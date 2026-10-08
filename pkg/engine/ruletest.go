package engine

import (
	"fmt"
	"sort"
	"strings"

	"github.com/clebeer/carbon-threat/pkg/model"
	"go.yaml.in/yaml/v3"
)

// TestResult is the outcome of one inline rule test.
type TestResult struct {
	RuleID string
	Name   string
	Err    error // nil when the test passed
}

// RunRuleTests runs every inline test of every rule, each rule in isolation.
func RunRuleTests(rules []*Rule) []TestResult {
	var out []TestResult
	for _, r := range rules {
		eng, err := New([]*Rule{r})
		if err != nil {
			out = append(out, TestResult{RuleID: r.ID, Name: "(compile)", Err: err})
			continue
		}
		for i, t := range r.Tests {
			name := t.Name
			if name == "" {
				name = fmt.Sprintf("test #%d", i+1)
			}
			out = append(out, TestResult{RuleID: r.ID, Name: name, Err: runOne(eng, r, t)})
		}
	}
	return out
}

func runOne(eng *Engine, r *Rule, t RuleTest) error {
	doc := map[string]any{
		"apiVersion": model.APIVersion,
		"kind":       model.Kind,
		"metadata":   map[string]any{"name": "rule-test"},
	}
	for k, v := range t.Model {
		doc[k] = v
	}
	data, err := yaml.Marshal(doc)
	if err != nil {
		return err
	}
	m, err := model.Parse(data, r.File+" ("+t.Name+")")
	if err != nil {
		return err
	}
	threats, err := eng.Analyze(m)
	if err != nil {
		return err
	}
	var got []string
	for _, th := range threats {
		got = append(got, th.TargetID)
	}
	want := append([]string(nil), t.Expect...)
	sort.Strings(got)
	sort.Strings(want)
	if strings.Join(got, ",") != strings.Join(want, ",") {
		return fmt.Errorf("flagged %v, want %v", nonNil(got), nonNil(want))
	}
	return nil
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
