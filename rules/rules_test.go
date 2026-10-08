package rules_test

import (
	"testing"

	"github.com/clebeer/carbon-threat/pkg/engine"
	"github.com/clebeer/carbon-threat/rules"
)

// TestBuiltinRules runs the inline positive/negative fixtures of every
// built-in rule.
func TestBuiltinRules(t *testing.T) {
	rs, err := engine.LoadRules(rules.FS(), ".")
	if err != nil {
		t.Fatal(err)
	}
	if len(rs) == 0 {
		t.Fatal("no built-in rules found")
	}
	for _, res := range engine.RunRuleTests(rs) {
		res := res
		t.Run(res.RuleID+"/"+res.Name, func(t *testing.T) {
			if res.Err != nil {
				t.Error(res.Err)
			}
		})
	}
}
