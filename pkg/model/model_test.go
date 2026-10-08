package model

import (
	"errors"
	"strings"
	"testing"
)

const valid = `apiVersion: ctm/v1
kind: ThreatModel
metadata:
  name: t
trustZones:
  - id: internet
    trust: 0
  - id: internal
    trust: 80
data:
  - id: pii
    classification: confidential
components:
  - id: user
    type: external_entity
    trustZone: internet
  - id: app
    type: process
    trustZone: internal
dataFlows:
  - id: req
    from: user
    to: app
    protocol: http
    data: [pii]
`

func TestParseValidModelRecordsLines(t *testing.T) {
	m, err := Parse([]byte(valid), "valid.yaml")
	if err != nil {
		t.Fatal(err)
	}
	if got := m.Line("component", "app"); got != 17 {
		t.Errorf("component app line = %d, want 17", got)
	}
	if got := m.Line("flow", "req"); got != 21 {
		t.Errorf("flow req line = %d, want 21", got)
	}
}

func problems(t *testing.T, doc string) []Problem {
	t.Helper()
	_, err := Parse([]byte(doc), "bad.yaml")
	var inv *InvalidError
	if !errors.As(err, &inv) {
		t.Fatalf("want *InvalidError, got %v", err)
	}
	return inv.Problems
}

func TestSchemaErrorsPointAtTheLine(t *testing.T) {
	doc := strings.Replace(valid, "type: process", "type: service", 1)
	ps := problems(t, doc)
	if len(ps) == 0 || ps[0].Line != 18 || !strings.Contains(ps[0].Path, "/components/1/type") {
		t.Fatalf("unexpected problems: %+v", ps)
	}
}

func TestUnknownFieldIsRejected(t *testing.T) {
	doc := strings.Replace(valid, "    protocol: http\n", "    protocol: http\n    encrypt: true\n", 1)
	ps := problems(t, doc)
	if len(ps) == 0 || !strings.Contains(ps[0].Message, "encrypt") {
		t.Fatalf("unexpected problems: %+v", ps)
	}
}

func TestBrokenReferences(t *testing.T) {
	doc := strings.Replace(valid, "trustZone: internal", "trustZone: intranet", 1)
	doc = strings.Replace(doc, "to: app", "to: ap", 1)
	doc = strings.Replace(doc, "data: [pii]", "data: [pii, card]", 1)
	var msgs []string
	for _, p := range problems(t, doc) {
		msgs = append(msgs, p.Message)
	}
	all := strings.Join(msgs, "|")
	for _, want := range []string{`unknown trust zone "intranet"`, `unknown component "ap"`, `unknown data id "card"`} {
		if !strings.Contains(all, want) {
			t.Errorf("missing %q in %q", want, all)
		}
	}
}

func TestDuplicateIDsAcrossComponentsAndFlows(t *testing.T) {
	doc := strings.Replace(valid, "  - id: req\n", "  - id: app\n", 1)
	ps := problems(t, doc)
	if len(ps) != 1 || !strings.Contains(ps[0].Message, `duplicate component or flow id "app"`) {
		t.Fatalf("unexpected problems: %+v", ps)
	}
}

func TestFlowEncryptedInference(t *testing.T) {
	cases := []struct {
		flow DataFlow
		want string
	}{
		{DataFlow{Protocol: "HTTPS"}, "true"},
		{DataFlow{Protocol: "http"}, "false"},
		{DataFlow{Protocol: "postgres"}, "unknown"},
		{DataFlow{Protocol: "http", Encrypted: Bool(true)}, "true"},
	}
	for _, c := range cases {
		got := "unknown"
		if e := FlowEncrypted(c.flow); e != nil {
			got = map[bool]string{true: "true", false: "false"}[*e]
		}
		if got != c.want {
			t.Errorf("%+v: got %s, want %s", c.flow, got, c.want)
		}
	}
}

func TestFactsSensitivityAndExposure(t *testing.T) {
	m, err := Parse([]byte(valid), "valid.yaml")
	if err != nil {
		t.Fatal(err)
	}
	f := BuildFacts(m)
	app := f.Components["app"]
	if app["exposed"] != true {
		t.Error("app receives a flow from the internet and should be exposed")
	}
	if app["sensitivity"] != int64(2) {
		t.Errorf("app sensitivity = %v, want 2 (confidential via flow)", app["sensitivity"])
	}
	if f.Flows[0]["encrypted"] != false || f.Flows[0]["trustDelta"] != int64(80) {
		t.Errorf("unexpected flow facts: %v", f.Flows[0])
	}
	if _, ok := f.Components["user"]["properties"].(map[string]any)["logging"]; ok {
		t.Error("unknown properties must be absent, not false")
	}
}
