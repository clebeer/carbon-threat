// Package engine evaluates declarative threat rules (CEL expressions) against
// a ctm/v1 model and produces threats.
package engine

import (
	"fmt"
	"io/fs"
	"path"
	"regexp"
	"sort"
	"strings"
	"text/template"

	"go.yaml.in/yaml/v3"
)

// Severities lists the rule severities, most severe first.
var Severities = []string{"critical", "high", "medium", "low", "info"}

// SeverityRank returns 4 for critical down to 0 for info, or -1 if unknown.
func SeverityRank(s string) int {
	for i, v := range Severities {
		if v == s {
			return len(Severities) - 1 - i
		}
	}
	return -1
}

// StrideCategories lists the STRIDE categories accepted in rules.
var StrideCategories = []string{
	"spoofing", "tampering", "repudiation", "information_disclosure",
	"denial_of_service", "elevation_of_privilege",
}

// Rule targets.
const (
	TargetComponent = "component"
	TargetFlow      = "flow"
)

var ruleIDPattern = regexp.MustCompile(`^CTM-[A-Z]+-[0-9]{3}$`)

// Rule is a declarative threat rule.
type Rule struct {
	ID          string     `yaml:"id"`
	Title       string     `yaml:"title"`
	Description string     `yaml:"description"`
	Severity    string     `yaml:"severity"`
	Stride      []string   `yaml:"stride"`
	CWE         []int      `yaml:"cwe"`
	CAPEC       []int      `yaml:"capec"`
	Attack      []string   `yaml:"attack"`
	Target      string     `yaml:"target"`
	When        string     `yaml:"when"`
	Message     string     `yaml:"message"`
	Mitigation  string     `yaml:"mitigation"`
	References  []string   `yaml:"references"`
	Tests       []RuleTest `yaml:"tests"`

	// File is where the rule was loaded from.
	File string `yaml:"-"`

	message *template.Template
}

// RuleTest is an inline fixture: a (partial) model and the ids of the
// components or flows the rule must flag. An empty Expect means the rule
// must not fire.
type RuleTest struct {
	Name   string         `yaml:"name"`
	Model  map[string]any `yaml:"model"`
	Expect []string       `yaml:"expect"`
}

func (r *Rule) validate() error {
	var errs []string
	if !ruleIDPattern.MatchString(r.ID) {
		errs = append(errs, fmt.Sprintf("id %q must match CTM-<AREA>-<NNN>", r.ID))
	}
	if strings.TrimSpace(r.Title) == "" {
		errs = append(errs, "title is required")
	}
	if SeverityRank(r.Severity) < 0 {
		errs = append(errs, fmt.Sprintf("severity %q must be one of %s", r.Severity, strings.Join(Severities, ", ")))
	}
	if len(r.Stride) == 0 {
		errs = append(errs, "at least one stride category is required")
	}
	for _, s := range r.Stride {
		if !contains(StrideCategories, s) {
			errs = append(errs, fmt.Sprintf("unknown stride category %q", s))
		}
	}
	if r.Target != TargetComponent && r.Target != TargetFlow {
		errs = append(errs, fmt.Sprintf("target %q must be %q or %q", r.Target, TargetComponent, TargetFlow))
	}
	if strings.TrimSpace(r.When) == "" {
		errs = append(errs, "when is required (quote expressions that start with '!': YAML reads a leading ! as a tag)")
	}
	if strings.TrimSpace(r.Message) == "" {
		errs = append(errs, "message is required")
	}
	if strings.TrimSpace(r.Mitigation) == "" {
		errs = append(errs, "mitigation is required")
	}
	if len(r.Tests) == 0 {
		errs = append(errs, "at least one test is required")
	}
	hasPositive, hasNegative := false, false
	for _, t := range r.Tests {
		if len(t.Expect) > 0 {
			hasPositive = true
		} else {
			hasNegative = true
		}
	}
	if len(r.Tests) > 0 && (!hasPositive || !hasNegative) {
		errs = append(errs, "tests must include at least one positive (expect: [...]) and one negative (expect: []) case")
	}
	if len(errs) > 0 {
		return fmt.Errorf("%s: rule %s: %s", r.File, r.ID, strings.Join(errs, "; "))
	}
	var err error
	r.message, err = template.New(r.ID).Option("missingkey=error").Parse(r.Message)
	if err != nil {
		return fmt.Errorf("%s: rule %s: message template: %w", r.File, r.ID, err)
	}
	return nil
}

// LoadRules reads every *.yaml rule file under dir in fsys. Each file holds
// exactly one rule.
func LoadRules(fsys fs.FS, dir string) ([]*Rule, error) {
	var rules []*Rule
	err := fs.WalkDir(fsys, dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || (path.Ext(p) != ".yaml" && path.Ext(p) != ".yml") {
			return nil
		}
		data, err := fs.ReadFile(fsys, p)
		if err != nil {
			return err
		}
		r, err := ParseRule(data, p)
		if err != nil {
			return err
		}
		rules = append(rules, r)
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(rules, func(i, j int) bool { return rules[i].ID < rules[j].ID })
	for i := 1; i < len(rules); i++ {
		if rules[i].ID == rules[i-1].ID {
			return nil, fmt.Errorf("duplicate rule id %s in %s and %s", rules[i].ID, rules[i-1].File, rules[i].File)
		}
	}
	return rules, nil
}

// ParseRule decodes and validates one rule file.
func ParseRule(data []byte, file string) (*Rule, error) {
	dec := yaml.NewDecoder(strings.NewReader(string(data)))
	dec.KnownFields(true)
	var r Rule
	if err := dec.Decode(&r); err != nil {
		return nil, fmt.Errorf("%s: %w", file, err)
	}
	r.File = file
	if err := r.validate(); err != nil {
		return nil, err
	}
	return &r, nil
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}
