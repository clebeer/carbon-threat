package compose

import (
	"os"
	"sort"
	"strings"
	"testing"

	"github.com/clebeer/carbon-threat/pkg/engine"
	"github.com/clebeer/carbon-threat/pkg/model"
	"github.com/clebeer/carbon-threat/rules"
)

func extractFixture(t *testing.T) *model.Model {
	t.Helper()
	data, err := os.ReadFile("testdata/docker-compose.yml")
	if err != nil {
		t.Fatal(err)
	}
	m, warnings, err := Extract(data, "testdata/docker-compose.yml")
	if err != nil {
		t.Fatal(err)
	}
	if len(warnings) > 0 {
		t.Errorf("unexpected warnings: %v", warnings)
	}
	return m
}

func TestExtractComponents(t *testing.T) {
	m := extractFixture(t)
	if m.Metadata.Name != "acme-shop" {
		t.Errorf("name = %q", m.Metadata.Name)
	}
	byID := map[string]model.Component{}
	for _, c := range m.Components {
		byID[c.ID] = c
	}
	checks := []struct {
		id, typ, zone string
	}{
		{"internet", model.TypeExternalEntity, "internet"},
		{"proxy", model.TypeProcess, "edge"},
		{"app", model.TypeProcess, "internal"},
		{"db", model.TypeDatastore, "edge"},
		{"cache", model.TypeDatastore, "internal"}, // published on loopback only
		{"worker", model.TypeProcess, "internal"},
	}
	for _, c := range checks {
		got, ok := byID[c.id]
		if !ok {
			t.Errorf("missing component %s", c.id)
			continue
		}
		if got.Type != c.typ || got.TrustZone != c.zone {
			t.Errorf("%s: type=%s zone=%s, want %s/%s", c.id, got.Type, got.TrustZone, c.typ, c.zone)
		}
	}
	if p := byID["worker"].Properties.Privileged; p == nil || !*p {
		t.Error("worker should be privileged")
	}
	for _, id := range []string{"app", "db"} {
		if p := byID[id].Properties.HardcodedSecrets; p == nil || !*p {
			t.Errorf("%s should have hardcoded secrets", id)
		}
	}
	// ${JWT_SECRET} and *_FILE are not hardcoded.
	if byID["worker"].Properties.HardcodedSecrets != nil {
		t.Error("worker uses a secret file and must not be flagged")
	}
}

func TestExtractFlows(t *testing.T) {
	m := extractFixture(t)
	got := map[string]string{}
	for _, f := range m.DataFlows {
		enc := "?"
		if e := model.FlowEncrypted(f); e != nil {
			enc = map[bool]string{true: "tls", false: "plain"}[*e]
		}
		got[f.ID] = f.From + ">" + f.To + " " + f.Protocol + " " + enc
	}
	want := map[string]string{
		"internet-to-proxy-80":  "internet>proxy http plain",
		"internet-to-proxy-443": "internet>proxy https tls",
		"internet-to-db-5432":   "internet>db postgres ?",
		"proxy-to-app":          "proxy>app  ?",
		"app-to-db":             "app>db postgres plain",
		"app-to-cache":          "app>cache redis plain",
		"worker-to-db":          "worker>db postgres ?",
	}
	if len(got) != len(want) {
		t.Errorf("got %d flows, want %d: %v", len(got), len(want), got)
	}
	for id, w := range want {
		if got[id] != w {
			t.Errorf("flow %s = %q, want %q", id, got[id], w)
		}
	}
}

func TestExtractedModelProducesExpectedThreats(t *testing.T) {
	m := extractFixture(t)
	rs, err := engine.LoadRules(rules.FS(), ".")
	if err != nil {
		t.Fatal(err)
	}
	eng, err := engine.New(rs)
	if err != nil {
		t.Fatal(err)
	}
	ts, err := eng.Analyze(m)
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, th := range ts {
		got = append(got, th.RuleID+" "+th.TargetID)
	}
	sort.Strings(got)
	want := []string{
		"CTM-COMP-003 app",
		"CTM-COMP-003 db",
		"CTM-COMP-004 worker",
		"CTM-COMP-005 proxy",
		"CTM-COMP-005 worker",
		"CTM-FLOW-003 internet-to-db-5432",
	}
	if strings.Join(got, "\n") != strings.Join(want, "\n") {
		t.Errorf("threats:\n got: %v\nwant: %v", got, want)
	}
}

func TestParseShortPort(t *testing.T) {
	cases := []struct {
		in        string
		port      int
		published bool
	}{
		{"80", 80, true},
		{"8080:80", 80, true},
		{"0.0.0.0:443:443/tcp", 443, true},
		{"127.0.0.1:5432:5432", 0, false},
		{"[::1]:8080:80", 0, false},
		{"8000-8001:8000-8001", 8000, true},
	}
	for _, c := range cases {
		port, published, err := parseShortPort(c.in)
		if err != nil || port != c.port || published != c.published {
			t.Errorf("%q: got %d %v %v, want %d %v", c.in, port, published, err, c.port, c.published)
		}
	}
}

func TestDatastoreIgnoresTag(t *testing.T) {
	if _, _, ok := datastore("acme/app:redis-cache"); ok {
		t.Error("a tag mentioning redis must not make the image a datastore")
	}
	if tech, _, ok := datastore("bitnami/postgresql:16@sha256:abc"); !ok || tech != "postgres" {
		t.Errorf("bitnami/postgresql: got %q %v", tech, ok)
	}
}
