package engine

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"time"

	"cel.dev/cel-go/cel"
	"github.com/clebeer/carbon-threat/pkg/model"
)

// Threat is one rule match on one component or flow.
type Threat struct {
	RuleID      string   `json:"ruleId"`
	Title       string   `json:"title"`
	Severity    string   `json:"severity"`
	Stride      []string `json:"stride"`
	CWE         []int    `json:"cwe,omitempty"`
	CAPEC       []int    `json:"capec,omitempty"`
	Attack      []string `json:"attack,omitempty"`
	TargetKind  string   `json:"targetKind"`
	TargetID    string   `json:"targetId"`
	TargetName  string   `json:"targetName"`
	Message     string   `json:"message"`
	Mitigation  string   `json:"mitigation"`
	Fingerprint string   `json:"fingerprint"`
	Line        int      `json:"line,omitempty"`

	Suppressed        bool   `json:"suppressed,omitempty"`
	SuppressionReason string `json:"suppressionReason,omitempty"`
}

// Fingerprint identifies a threat across model revisions: same rule, same
// target id.
func Fingerprint(ruleID, targetKind, targetID string) string {
	sum := sha256.Sum256([]byte("ctm/v1|" + ruleID + "|" + targetKind + "|" + targetID))
	return hex.EncodeToString(sum[:])[:16]
}

type compiledRule struct {
	*Rule
	prg cel.Program
}

// Engine holds compiled rules.
type Engine struct {
	rules []compiledRule
	// Now is used to decide whether a suppression has expired.
	Now func() time.Time
}

func newEnv(target string) (*cel.Env, error) {
	m := cel.MapType(cel.StringType, cel.DynType)
	opts := []cel.EnvOption{cel.Variable("model", m)}
	switch target {
	case TargetComponent:
		opts = append(opts, cel.Variable("component", m))
	case TargetFlow:
		opts = append(opts,
			cel.Variable("flow", m),
			cel.Variable("source", m),
			cel.Variable("destination", m))
	}
	return cel.NewEnv(opts...)
}

// New compiles rules. It fails on the first rule whose expression does not
// compile or does not evaluate to a boolean.
func New(rules []*Rule) (*Engine, error) {
	envs := map[string]*cel.Env{}
	for _, t := range []string{TargetComponent, TargetFlow} {
		env, err := newEnv(t)
		if err != nil {
			return nil, err
		}
		envs[t] = env
	}
	e := &Engine{Now: time.Now}
	for _, r := range rules {
		env := envs[r.Target]
		ast, iss := env.Compile(r.When)
		if iss != nil && iss.Err() != nil {
			return nil, fmt.Errorf("%s: rule %s: when: %w", r.File, r.ID, iss.Err())
		}
		if ast.OutputType() != cel.BoolType {
			return nil, fmt.Errorf("%s: rule %s: when must evaluate to a bool, got %s", r.File, r.ID, ast.OutputType())
		}
		prg, err := env.Program(ast)
		if err != nil {
			return nil, fmt.Errorf("%s: rule %s: %w", r.File, r.ID, err)
		}
		e.rules = append(e.rules, compiledRule{Rule: r, prg: prg})
	}
	return e, nil
}

// Rules returns the compiled rules in id order.
func (e *Engine) Rules() []*Rule {
	out := make([]*Rule, len(e.rules))
	for i, r := range e.rules {
		out[i] = r.Rule
	}
	return out
}

// Analyze evaluates every rule against the model. Suppressed threats are
// returned with Suppressed set. Threats are sorted by severity, rule, target.
func (e *Engine) Analyze(m *model.Model) ([]Threat, error) {
	facts := model.BuildFacts(m)
	var out []Threat
	for _, r := range e.rules {
		switch r.Target {
		case TargetComponent:
			for _, id := range facts.CompIDs {
				c := facts.Components[id]
				vars := map[string]any{"model": facts.Model, "component": c}
				hit, err := eval(r, vars)
				if err != nil {
					return nil, fmt.Errorf("rule %s on component %s: %w", r.ID, id, err)
				}
				if hit {
					t, err := e.threat(r.Rule, vars, TargetComponent, id, c["name"].(string), m.Line("component", id))
					if err != nil {
						return nil, err
					}
					out = append(out, t)
				}
			}
		case TargetFlow:
			for i, f := range facts.Flows {
				id := facts.FlowIDs[i]
				vars := map[string]any{
					"model":       facts.Model,
					"flow":        f,
					"source":      facts.Components[f["from"].(string)],
					"destination": facts.Components[f["to"].(string)],
				}
				hit, err := eval(r, vars)
				if err != nil {
					return nil, fmt.Errorf("rule %s on flow %s: %w", r.ID, id, err)
				}
				if hit {
					t, err := e.threat(r.Rule, vars, TargetFlow, id, f["name"].(string), m.Line("flow", id))
					if err != nil {
						return nil, err
					}
					out = append(out, t)
				}
			}
		}
	}
	e.applySuppressions(m, out)
	Sort(out)
	return out, nil
}

func eval(r compiledRule, vars map[string]any) (bool, error) {
	val, _, err := r.prg.Eval(vars)
	if err != nil {
		return false, err
	}
	b, ok := val.Value().(bool)
	if !ok {
		return false, fmt.Errorf("when returned %T, want bool", val.Value())
	}
	return b, nil
}

func (e *Engine) threat(r *Rule, vars map[string]any, kind, id, name string, line int) (Threat, error) {
	var msg strings.Builder
	if err := r.message.Execute(&msg, vars); err != nil {
		return Threat{}, fmt.Errorf("rule %s: message: %w", r.ID, err)
	}
	return Threat{
		RuleID:      r.ID,
		Title:       r.Title,
		Severity:    r.Severity,
		Stride:      r.Stride,
		CWE:         r.CWE,
		CAPEC:       r.CAPEC,
		Attack:      r.Attack,
		TargetKind:  kind,
		TargetID:    id,
		TargetName:  name,
		Message:     strings.TrimSpace(msg.String()),
		Mitigation:  strings.TrimSpace(r.Mitigation),
		Fingerprint: Fingerprint(r.ID, kind, id),
		Line:        line,
	}, nil
}

func (e *Engine) applySuppressions(m *model.Model, threats []Threat) {
	today := e.Now().Format("2006-01-02")
	for i := range threats {
		for _, s := range m.Suppressions {
			if s.Rule != threats[i].RuleID {
				continue
			}
			if s.Target != "" && s.Target != threats[i].TargetID {
				continue
			}
			if s.Expires != "" && s.Expires < today {
				continue
			}
			threats[i].Suppressed = true
			threats[i].SuppressionReason = s.Reason
			break
		}
	}
}

// Sort orders threats by severity (most severe first), rule id, target id.
func Sort(ts []Threat) {
	sort.SliceStable(ts, func(i, j int) bool {
		a, b := ts[i], ts[j]
		if ra, rb := SeverityRank(a.Severity), SeverityRank(b.Severity); ra != rb {
			return ra > rb
		}
		if a.RuleID != b.RuleID {
			return a.RuleID < b.RuleID
		}
		return a.TargetID < b.TargetID
	})
}

// Active returns the threats that are not suppressed.
func Active(ts []Threat) []Threat {
	var out []Threat
	for _, t := range ts {
		if !t.Suppressed {
			out = append(out, t)
		}
	}
	return out
}

// AtOrAbove returns the active threats whose severity is at least minSeverity.
func AtOrAbove(ts []Threat, minSeverity string) []Threat {
	floor := SeverityRank(minSeverity)
	var out []Threat
	for _, t := range Active(ts) {
		if SeverityRank(t.Severity) >= floor {
			out = append(out, t)
		}
	}
	return out
}
