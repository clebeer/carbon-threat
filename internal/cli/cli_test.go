package cli

import (
	"bytes"
	"encoding/json"
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
	s := strings.Replace(string(src), "    protocol: postgres\n    encrypted: false\n", "    protocol: postgres\n    encrypted: true\n", 1)
	s = strings.Replace(s, "\nsuppressions:", `  - id: export
    from: api
    to: staff
    protocol: http
    data: [orders]

suppressions:`, 1)
	if s == string(src) {
		t.Fatal("fixture edit did not apply")
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
	if code, out, errOut := run(t, "init", dir); code != ExitOK || !strings.Contains(out, "Generated") {
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
}

func TestRulesTest(t *testing.T) {
	code, out, _ := run(t, "rules", "test")
	if code != ExitOK || !strings.Contains(out, "0 failed") {
		t.Fatalf("code %d\n%s", code, out)
	}
}
