package engine

import (
	"strings"
	"testing"
	"time"

	"github.com/clebeer/carbon-threat/pkg/model"
)

const ruleYAML = `id: CTM-TEST-001
title: Plaintext flow
severity: medium
stride: [information_disclosure]
target: flow
when: has(flow.encrypted) && !flow.encrypted
message: "{{.flow.name}} from {{.source.name}} is plaintext"
mitigation: Use TLS.
tests:
  - {name: pos, expect: [f], model: {}}
  - {name: neg, expect: [], model: {}}
`

const modelYAML = `apiVersion: ctm/v1
kind: ThreatModel
metadata: {name: t}
trustZones: [{id: z, trust: 50}]
components:
  - {id: a, name: Alpha, type: process, trustZone: z}
  - {id: b, type: process, trustZone: z}
dataFlows:
  - {id: f, from: a, to: b, protocol: http}
  - {id: g, from: b, to: a, protocol: https}
`

func mustEngine(t *testing.T, ruleSrc string) *Engine {
	t.Helper()
	r, err := ParseRule([]byte(ruleSrc), "test.yaml")
	if err != nil {
		t.Fatal(err)
	}
	e, err := New([]*Rule{r})
	if err != nil {
		t.Fatal(err)
	}
	return e
}

func mustModel(t *testing.T, src string) *model.Model {
	t.Helper()
	m, err := model.Parse([]byte(src), "m.yaml")
	if err != nil {
		t.Fatal(err)
	}
	return m
}

func TestAnalyzeRendersMessageAndFingerprint(t *testing.T) {
	ts, err := mustEngine(t, ruleYAML).Analyze(mustModel(t, modelYAML))
	if err != nil {
		t.Fatal(err)
	}
	if len(ts) != 1 {
		t.Fatalf("got %d threats, want 1", len(ts))
	}
	th := ts[0]
	if th.TargetID != "f" || th.Message != "a → b from Alpha is plaintext" {
		t.Errorf("unexpected threat: %+v", th)
	}
	if th.Fingerprint != Fingerprint("CTM-TEST-001", "flow", "f") || len(th.Fingerprint) != 16 {
		t.Errorf("unexpected fingerprint %q", th.Fingerprint)
	}
	if th.Line != 9 {
		t.Errorf("line = %d, want 9", th.Line)
	}
}

func TestSuppressionsHonourTargetAndExpiry(t *testing.T) {
	e := mustEngine(t, ruleYAML)
	e.Now = func() time.Time { return time.Date(2026, 10, 7, 0, 0, 0, 0, time.UTC) }
	cases := []struct {
		suppression string
		suppressed  bool
	}{
		{"{rule: CTM-TEST-001, target: f, reason: accepted}", true},
		{"{rule: CTM-TEST-001, reason: whole model}", true},
		{"{rule: CTM-TEST-001, target: g, reason: other flow}", false},
		{"{rule: CTM-TEST-001, target: f, reason: old, expires: 2026-10-06}", false},
		{"{rule: CTM-TEST-001, target: f, reason: today, expires: 2026-10-07}", true},
	}
	for _, c := range cases {
		m := mustModel(t, modelYAML+"suppressions:\n  - "+c.suppression+"\n")
		ts, err := e.Analyze(m)
		if err != nil {
			t.Fatal(err)
		}
		if ts[0].Suppressed != c.suppressed {
			t.Errorf("%s: suppressed = %v, want %v", c.suppression, ts[0].Suppressed, c.suppressed)
		}
		if got := len(AtOrAbove(ts, "low")); got != map[bool]int{true: 0, false: 1}[c.suppressed] {
			t.Errorf("%s: AtOrAbove returned %d", c.suppression, got)
		}
	}
}

func TestRuleValidation(t *testing.T) {
	cases := map[string]string{
		"bad id":        strings.Replace(ruleYAML, "CTM-TEST-001", "TEST-1", 1),
		"bad severity":  strings.Replace(ruleYAML, "severity: medium", "severity: severe", 1),
		"bad stride":    strings.Replace(ruleYAML, "[information_disclosure]", "[leak]", 1),
		"no negative":   strings.Replace(ruleYAML, "expect: [], ", "expect: [f], ", 1),
		"unknown field": strings.Replace(ruleYAML, "severity: medium", "severity: medium\nsevrity: low", 1),
	}
	for name, src := range cases {
		if _, err := ParseRule([]byte(src), "x.yaml"); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}

func TestNonBooleanExpressionIsRejected(t *testing.T) {
	src := strings.Replace(ruleYAML, "when: has(flow.encrypted) && !flow.encrypted", "when: flow.protocol", 1)
	r, err := ParseRule([]byte(src), "x.yaml")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := New([]*Rule{r}); err == nil || !strings.Contains(err.Error(), "bool") {
		t.Fatalf("want a bool type error, got %v", err)
	}
}

func TestMissingFactWithoutHasIsAnError(t *testing.T) {
	// Rules must guard optional facts with has(); evaluating a missing key
	// fails loudly instead of silently matching or not matching.
	src := strings.Replace(ruleYAML, "has(flow.encrypted) && !flow.encrypted", `"!flow.authenticated"`, 1)
	_, err := mustEngine(t, src).Analyze(mustModel(t, modelYAML))
	if err == nil || !strings.Contains(err.Error(), "no such key") {
		t.Fatalf("want a missing-key error, got %v", err)
	}
}
