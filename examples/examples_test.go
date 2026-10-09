// Package examples holds the handwritten example models. This test keeps
// their expected.txt golden files in sync with the built-in rules.
package examples_test

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/clebeer/carbon-threat/pkg/engine"
	_ "github.com/clebeer/carbon-threat/pkg/extract/compose"
	_ "github.com/clebeer/carbon-threat/pkg/extract/terraform"
	"github.com/clebeer/carbon-threat/pkg/model"
	"github.com/clebeer/carbon-threat/rules"
)

func TestExamplesMatchGoldenFiles(t *testing.T) {
	rs, err := engine.LoadRules(rules.FS(), ".")
	if err != nil {
		t.Fatal(err)
	}
	eng, err := engine.New(rs)
	if err != nil {
		t.Fatal(err)
	}
	dirs, err := filepath.Glob("*/threatmodel.yaml")
	if err != nil || len(dirs) == 0 {
		t.Fatalf("no examples found (%v)", err)
	}
	for _, path := range dirs {
		dir := filepath.Dir(path)
		t.Run(dir, func(t *testing.T) {
			m, err := model.LoadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			threats, err := eng.Analyze(m)
			if err != nil {
				t.Fatal(err)
			}
			var got []string
			for _, th := range threats {
				line := th.RuleID + " " + th.TargetID
				if th.Suppressed {
					line += " suppressed"
				}
				got = append(got, line)
			}
			sort.Strings(got)

			raw, err := os.ReadFile(filepath.Join(dir, "expected.txt"))
			if err != nil {
				t.Fatal(err)
			}
			var want []string
			for _, l := range strings.Split(strings.TrimSpace(string(raw)), "\n") {
				if l = strings.TrimSpace(l); l != "" {
					want = append(want, l)
				}
			}
			sort.Strings(want)
			if strings.Join(got, "\n") != strings.Join(want, "\n") {
				t.Errorf("threats differ from expected.txt\n got:\n  %s\nwant:\n  %s",
					strings.Join(got, "\n  "), strings.Join(want, "\n  "))
			}
		})
	}
}
