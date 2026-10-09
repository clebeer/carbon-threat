package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

const webapp = "../../examples/webapp/threatmodel.yaml"

func run(t *testing.T, args ...string) (int, string, string) {
	t.Helper()
	var out, errOut bytes.Buffer
	code := Execute("test", args, &out, &errOut)
	return code, out.String(), errOut.String()
}

func TestAnalyzeExitCodes(t *testing.T) {
	if code, out, _ := run(t, "analyze", webapp); code != ExitOK || !strings.Contains(out, "CTM-FLOW-001") {
		t.Fatalf("analyze: code %d, output:\n%s", code, out)
	}
	if code, _, errOut := run(t, "analyze", webapp, "--fail-on", "high"); code != ExitFindings || !strings.Contains(errOut, "at or above") {
		t.Fatalf("--fail-on high: code %d, stderr %q", code, errOut)
	}
	// The example has no critical threat.
	if code, _, _ := run(t, "analyze", webapp, "--fail-on", "critical"); code != ExitOK {
		t.Fatalf("--fail-on critical: code %d", code)
	}
	if code, _, _ := run(t, "analyze", webapp, "--fail-on", "severe"); code != ExitFailure {
		t.Fatalf("bad --fail-on: code %d", code)
	}
}

func TestAnalyzeSARIF(t *testing.T) {
	code, out, _ := run(t, "analyze", webapp, "--format", "sarif")
	if code != ExitOK {
		t.Fatalf("code %d", code)
	}
	var log struct {
		Version string `json:"version"`
		Runs    []struct {
			Tool struct {
				Driver struct {
					Rules []struct {
						ID string `json:"id"`
					} `json:"rules"`
				} `json:"driver"`
			} `json:"tool"`
			Results []struct {
				RuleID    string `json:"ruleId"`
				Locations []struct {
					PhysicalLocation struct {
						ArtifactLocation struct{ URI string }    `json:"artifactLocation"`
						Region           struct{ StartLine int } `json:"region"`
					} `json:"physicalLocation"`
				} `json:"locations"`
				Suppressions []any `json:"suppressions"`
			} `json:"results"`
		} `json:"runs"`
	}
	if err := json.Unmarshal([]byte(out), &log); err != nil {
		t.Fatal(err)
	}
	if log.Version != "2.1.0" || len(log.Runs) != 1 {
		t.Fatalf("unexpected SARIF envelope: %+v", log)
	}
	res := log.Runs[0].Results
	if len(res) != 7 {
		t.Fatalf("got %d results, want 7 (6 active + 1 suppressed)", len(res))
	}
	suppressed := 0
	for _, r := range res {
		loc := r.Locations[0].PhysicalLocation
		if loc.Region.StartLine == 0 || !strings.HasSuffix(loc.ArtifactLocation.URI, "examples/webapp/threatmodel.yaml") {
			t.Errorf("%s: bad location %+v", r.RuleID, loc)
		}
		if len(r.Suppressions) > 0 {
			suppressed++
		}
	}
	if suppressed != 1 {
		t.Errorf("suppressed results = %d, want 1", suppressed)
	}
	if len(log.Runs[0].Tool.Driver.Rules) != 7 {
		t.Errorf("driver rules = %d, want the 7 rules with results (incl. the suppressed one)", len(log.Runs[0].Tool.Driver.Rules))
	}
}

func TestValidate(t *testing.T) {
	if code, out, _ := run(t, "validate", webapp); code != ExitOK || !strings.Contains(out, "valid") {
		t.Fatalf("code %d, out %q", code, out)
	}
	bad := filepath.Join(t.TempDir(), "bad.yaml")
	if err := os.WriteFile(bad, []byte("apiVersion: ctm/v2\nkind: ThreatModel\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	code, _, errOut := run(t, "validate", bad)
	if code != ExitFailure || !strings.Contains(errOut, "/apiVersion") {
		t.Fatalf("code %d, stderr %q", code, errOut)
	}
}

// fixedWebapp returns the webapp example with the DB flow encrypted and a new
// plaintext flow added: one threat resolved, one introduced.
func fixedWebapp(t *testing.T) string {
	t.Helper()
	src, err := os.ReadFile(webapp)
	if err != nil {
		t.Fatal(err)
	}
	// Normalize line endings so the edits below also apply to CRLF checkouts.
	orig := strings.ReplaceAll(string(src), "\r\n", "\n")
	s := strings.Replace(orig, "    protocol: postgres\n    encrypted: false\n", "    protocol: postgres\n    encrypted: true\n", 1)
	s = strings.Replace(s, "\nsuppressions:", `  - id: export
    from: api
    to: staff
    protocol: http
    data: [orders]

suppressions:`, 1)
	if strings.Count(s, "encrypted: true") != strings.Count(orig, "encrypted: true")+1 || !strings.Contains(s, "id: export") {
		t.Fatal("fixture edits did not apply")
	}
	return s
}

func TestDiffAgainstFile(t *testing.T) {
	head := filepath.Join(t.TempDir(), "threatmodel.yaml")
	if err := os.WriteFile(head, []byte(fixedWebapp(t)), 0o644); err != nil {
		t.Fatal(err)
	}
	code, out, _ := run(t, "diff", head, "--base", webapp, "--format", "json", "--fail-on", "high")
	if code != ExitFindings {
		t.Fatalf("code %d, want %d (a new high threat)", code, ExitFindings)
	}
	var r struct {
		Added   []struct{ RuleID, TargetID string } `json:"added"`
		Removed []struct{ RuleID, TargetID string } `json:"removed"`
	}
	if err := json.Unmarshal([]byte(out), &r); err != nil {
		t.Fatal(err)
	}
	if len(r.Added) != 2 || len(r.Removed) != 1 || r.Removed[0].TargetID != "api-to-db" {
		t.Fatalf("unexpected diff: %+v", r)
	}
	for _, a := range r.Added {
		if a.TargetID != "export" {
			t.Errorf("unexpected added threat %+v", a)
		}
	}

	if _, out, _ := run(t, "diff", head, "--base", webapp, "--format", "markdown"); !strings.Contains(out, "introduces **2 new threat(s)**") || !strings.Contains(out, "1 threat(s) resolved") {
		t.Errorf("markdown diff:\n%s", out)
	}
	if code, _, _ := run(t, "diff", head); code != ExitFailure {
		t.Errorf("diff without a base: code %d", code)
	}
}

func TestDiffAgainstGitRevision(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	dir := t.TempDir()
	git := func(args ...string) {
		t.Helper()
		c := exec.Command("git", append([]string{"-c", "user.email=t@example.com", "-c", "user.name=t", "-c", "commit.gpgsign=false"}, args...)...)
		c.Dir = dir
		if out, err := c.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	src, err := os.ReadFile(webapp)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "threatmodel.yaml")
	git("init", "-q")
	if err := os.WriteFile(path, src, 0o644); err != nil {
		t.Fatal(err)
	}
	git("add", ".")
	git("commit", "-qm", "base")
	if err := os.WriteFile(path, []byte(fixedWebapp(t)), 0o644); err != nil {
		t.Fatal(err)
	}

	t.Chdir(dir)

	code, out, errOut := run(t, "diff", "--base-ref", "HEAD", "threatmodel.yaml")
	if code != ExitOK || !strings.Contains(out, "2 new, 1 resolved") {
		t.Fatalf("code %d\nstdout:\n%s\nstderr:\n%s", code, out, errOut)
	}

	// A model that does not exist in the base revision: everything is new.
	if err := os.WriteFile("new.yaml", src, 0o644); err != nil {
		t.Fatal(err)
	}
	code, out, _ = run(t, "diff", "--base-ref", "HEAD", "new.yaml")
	if code != ExitOK || !strings.Contains(out, "6 new, 0 resolved") {
		t.Fatalf("new file: code %d\n%s", code, out)
	}
	if code, _, _ := run(t, "diff", "--base-ref", "--upload-pack=x", "new.yaml"); code != ExitFailure {
		t.Errorf("option-like revision must be rejected, got code %d", code)
	}
}

func TestInitFromComposeAndRefuseOverwrite(t *testing.T) {
	dir := t.TempDir()
	compose, err := os.ReadFile("../../pkg/extract/compose/testdata/docker-compose.yml")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "compose.yaml"), compose, 0o644); err != nil {
		t.Fatal(err)
	}
	if code, out, errOut := run(t, "init", dir); code != ExitOK || !strings.Contains(out, "sources: compose compose.yaml") {
		t.Fatalf("init: code %d\n%s\n%s", code, out, errOut)
	}
	model := filepath.Join(dir, "threatmodel.yaml")
	if code, out, _ := run(t, "analyze", model, "--fail-on", "critical"); code != ExitFindings || !strings.Contains(out, "CTM-FLOW-003") {
		t.Fatalf("analyze generated model: code %d\n%s", code, out)
	}
	if code, _, errOut := run(t, "init", dir); code != ExitFailure || !strings.Contains(errOut, "already exists") {
		t.Fatalf("second init: code %d, stderr %q", code, errOut)
	}
}

func TestInitSkeletonIsValid(t *testing.T) {
	dir := t.TempDir()
	if code, _, errOut := run(t, "init", dir); code != ExitOK {
		t.Fatalf("init: code %d, %s", code, errOut)
	}
	if code, _, errOut := run(t, "validate", filepath.Join(dir, "threatmodel.yaml")); code != ExitOK {
		t.Fatalf("skeleton is invalid: %s", errOut)
	}
	// The example is a secure baseline: a first run must not flag the
	// example itself.
	code, out, _ := run(t, "analyze", filepath.Join(dir, "threatmodel.yaml"), "--fail-on", "info")
	if code != ExitOK || !strings.Contains(out, "no threats") {
		t.Fatalf("the init example should have no threats: code %d\n%s", code, out)
	}
}

func TestRulesTest(t *testing.T) {
	code, out, _ := run(t, "rules", "test")
	if code != ExitOK || !strings.Contains(out, "0 failed") {
		t.Fatalf("code %d\n%s", code, out)
	}
}

const composeV1 = `services:
  app:
    image: acme/app:1.0.0
    environment:
      DATABASE_URL: postgres://app:hunter2@db:5432/app
  db:
    image: postgres:16.4
`

// composeV2 removes the hardcoded password and makes app privileged.
const composeV2 = `services:
  app:
    image: acme/app:1.0.0
    privileged: true
    environment:
      DATABASE_URL: postgres://app:${DB_PASSWORD}@db:5432/app
  db:
    image: postgres:16.4
`

const overlay = `apiVersion: ctm/v1
kind: ThreatModel
metadata:
  name: shop
sources:
  - compose: docker-compose.yml
data:
  - id: orders
    classification: confidential
components:
  - id: db
    stores: [orders]
    properties:
      encryptionAtRest: false
`

func TestSourcesAnnotationsAndLocations(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "docker-compose.yml"), composeV1)
	write(t, filepath.Join(dir, "threatmodel.yaml"), overlay)
	t.Chdir(dir)

	code, out, errOut := run(t, "analyze", "--format", "json")
	if code != ExitOK {
		t.Fatalf("code %d: %s", code, errOut)
	}
	var r struct {
		Threats []struct {
			RuleID, TargetID, File string
			Line                   int
		}
	}
	if err := json.Unmarshal([]byte(out), &r); err != nil {
		t.Fatal(err)
	}
	got := map[string]string{}
	for _, th := range r.Threats {
		got[th.RuleID+" "+th.TargetID] = fmt.Sprintf("%s:%d", th.File, th.Line)
	}
	// The annotation (encryptionAtRest: false on stored confidential data)
	// combines with the extracted datastore; locations point at the compose
	// service, where a fix would go.
	want := map[string]string{
		"CTM-COMP-001 db":  "docker-compose.yml:6",
		"CTM-COMP-003 app": "docker-compose.yml:2",
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("%s: got %q, want %q (all: %v)", k, got[k], v, got)
		}
	}
	if len(got) != len(want) {
		t.Errorf("unexpected threats: %v", got)
	}

	code, out, _ = run(t, "render")
	if code != ExitOK || !strings.Contains(out, "encryptionAtRest: false") || !strings.Contains(out, "image: postgres:16.4") || strings.Contains(out, "sources:") {
		t.Fatalf("render: code %d\n%s", code, out)
	}
}

func TestDiffWhenOnlyTheSourceChanges(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	dir := t.TempDir()
	git := func(args ...string) {
		t.Helper()
		c := exec.Command("git", append([]string{"-c", "user.email=t@example.com", "-c", "user.name=t", "-c", "commit.gpgsign=false"}, args...)...)
		c.Dir = dir
		if out, err := c.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	git("init", "-q")
	write(t, filepath.Join(dir, "docker-compose.yml"), composeV1)
	write(t, filepath.Join(dir, "threatmodel.yaml"), overlay)
	git("add", ".")
	git("commit", "-qm", "base")
	write(t, filepath.Join(dir, "docker-compose.yml"), composeV2)
	t.Chdir(dir)

	code, out, errOut := run(t, "diff", "--base-ref", "HEAD", "--format", "json")
	if code != ExitOK {
		t.Fatalf("code %d: %s", code, errOut)
	}
	var r struct {
		Added, Removed []struct{ RuleID, TargetID string }
	}
	if err := json.Unmarshal([]byte(out), &r); err != nil {
		t.Fatal(err)
	}
	if len(r.Added) != 1 || r.Added[0].RuleID != "CTM-COMP-004" || len(r.Removed) != 1 || r.Removed[0].RuleID != "CTM-COMP-003" {
		t.Fatalf("want privileged added and hardcoded secret removed, got %+v", r)
	}
}

func TestSourceErrors(t *testing.T) {
	cases := map[string]struct{ model, want string }{
		"escaping path":            {strings.Replace(overlay, "compose: docker-compose.yml", "compose: ../docker-compose.yml", 1), "inside the model's directory"},
		"missing file":             {strings.Replace(overlay, "compose: docker-compose.yml", "compose: nope.yml", 1), "nope.yml"},
		"incomplete new component": {overlay + "  - id: queue\n    type: datastore\n", `component "queue": trustZone is required`},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			dir := t.TempDir()
			write(t, filepath.Join(dir, "docker-compose.yml"), composeV1)
			write(t, filepath.Join(dir, "threatmodel.yaml"), c.model)
			code, _, errOut := run(t, "validate", filepath.Join(dir, "threatmodel.yaml"))
			if code != ExitFailure || !strings.Contains(errOut, c.want) {
				t.Fatalf("code %d, stderr %q, want %q", code, errOut, c.want)
			}
		})
	}
}

func write(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestInitAndAnalyzeTerraform(t *testing.T) {
	dir := t.TempDir()
	tfDir := filepath.Join(dir, "infra")
	if err := os.MkdirAll(tfDir, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"main.tf", "variables.tf", "terraform.tfvars"} {
		src, err := os.ReadFile(filepath.Join("../../pkg/extract/terraform/testdata/aws", name))
		if err != nil {
			t.Fatal(err)
		}
		write(t, filepath.Join(tfDir, name), string(src))
	}
	if code, out, errOut := run(t, "init", dir); code != ExitOK || !strings.Contains(out, "terraform infra") {
		t.Fatalf("init: code %d\n%s\n%s", code, out, errOut)
	}
	t.Chdir(dir)
	code, out, errOut := run(t, "analyze", "--format", "sarif", "--fail-on", "critical")
	if code != ExitFindings {
		t.Fatalf("code %d, stderr %s", code, errOut)
	}
	if !strings.Contains(errOut, "module \"vpc\" is not followed") {
		t.Errorf("extractor warning not shown: %q", errOut)
	}
	if !strings.Contains(out, `"uri": "infra/main.tf"`) {
		t.Errorf("SARIF results should point at the Terraform file:\n%s", out)
	}
}

func TestVersionIncludesBuildMetadata(t *testing.T) {
	if _, out, _ := run(t, "version"); out != "ctm test\n" {
		t.Errorf("dev build: got %q", out)
	}
	Commit, Date = "abc1234", "2026-10-09T12:00:00Z"
	defer func() { Commit, Date = "", "" }()
	if _, out, _ := run(t, "version"); out != "ctm test (commit abc1234, built 2026-10-09T12:00:00Z)\n" {
		t.Errorf("release build: got %q", out)
	}
}
