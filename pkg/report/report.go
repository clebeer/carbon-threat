// Package report renders threats as a terminal table, JSON, Markdown or SARIF.
package report

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"text/tabwriter"

	"github.com/clebeer/carbon-threat/pkg/engine"
)

// Formats supported by Write.
var Formats = []string{"table", "json", "markdown", "sarif"}

// Input is what a report renders. For a diff, Added and Removed are set and
// Threats holds the head revision's threats.
type Input struct {
	ToolVersion string
	ModelName   string
	ModelPath   string // path used in SARIF locations
	Threats     []engine.Threat
	Rules       []*engine.Rule

	IsDiff  bool
	Added   []engine.Threat
	Removed []engine.Threat
}

// Write renders in into w using the named format.
func Write(w io.Writer, format string, in Input) error {
	var render func(io.Writer, Input) error
	switch format {
	case "table":
		render = writeTable
	case "json":
		render = writeJSON
	case "markdown", "md":
		render = writeMarkdown
	case "sarif":
		render = writeSARIF
	default:
		return fmt.Errorf("unknown format %q (want one of %s)", format, strings.Join(Formats, ", "))
	}
	ew := &errWriter{w: w}
	if err := render(ew, in); err != nil {
		return err
	}
	return ew.err
}

// errWriter remembers the first write error and drops later writes, so the
// renderers can use fmt.Fprint* freely and Write still reports failures.
type errWriter struct {
	w   io.Writer
	err error
}

func (e *errWriter) Write(p []byte) (int, error) {
	if e.err != nil {
		return 0, e.err
	}
	n, err := e.w.Write(p)
	e.err = err
	return n, err
}

// Summary counts active threats per severity.
func Summary(ts []engine.Threat) map[string]int {
	out := map[string]int{}
	for _, s := range engine.Severities {
		out[s] = 0
	}
	for _, t := range engine.Active(ts) {
		out[t.Severity]++
	}
	return out
}

func summaryLine(ts []engine.Threat) string {
	s := Summary(ts)
	var parts []string
	for _, sev := range engine.Severities {
		if s[sev] > 0 {
			parts = append(parts, fmt.Sprintf("%d %s", s[sev], sev))
		}
	}
	if len(parts) == 0 {
		return "no threats"
	}
	return strings.Join(parts, ", ")
}

func suppressedCount(ts []engine.Threat) int {
	n := 0
	for _, t := range ts {
		if t.Suppressed {
			n++
		}
	}
	return n
}

func writeTable(w io.Writer, in Input) error {
	list := in.Threats
	if in.IsDiff {
		fmt.Fprintf(w, "%s: %d new, %d resolved\n\n", in.ModelName, len(engine.Active(in.Added)), len(in.Removed))
		list = in.Added
	} else {
		fmt.Fprintf(w, "%s: %s", in.ModelName, summaryLine(in.Threats))
		if n := suppressedCount(in.Threats); n > 0 {
			fmt.Fprintf(w, " (%d suppressed)", n)
		}
		fmt.Fprint(w, "\n\n")
	}
	active := engine.Active(list)
	if len(active) == 0 {
		return nil
	}
	tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
	fmt.Fprintln(tw, "SEVERITY\tRULE\tTARGET\tTITLE")
	for _, t := range active {
		fmt.Fprintf(tw, "%s\t%s\t%s %s\t%s\n", strings.ToUpper(t.Severity), t.RuleID, t.TargetKind, t.TargetID, t.Title)
	}
	if err := tw.Flush(); err != nil {
		return err
	}
	if in.IsDiff && len(in.Removed) > 0 {
		fmt.Fprintln(w, "\nResolved:")
		for _, t := range in.Removed {
			fmt.Fprintf(w, "  %s  %s %s  %s\n", t.RuleID, t.TargetKind, t.TargetID, t.Title)
		}
	}
	return nil
}

type jsonReport struct {
	Tool    string          `json:"tool"`
	Version string          `json:"version"`
	Model   string          `json:"model"`
	Summary map[string]int  `json:"summary"`
	Threats []engine.Threat `json:"threats"`
	Added   []engine.Threat `json:"added,omitempty"`
	Removed []engine.Threat `json:"removed,omitempty"`
}

func writeJSON(w io.Writer, in Input) error {
	r := jsonReport{
		Tool:    "ctm",
		Version: in.ToolVersion,
		Model:   in.ModelName,
		Summary: Summary(in.Threats),
		Threats: nonNilThreats(in.Threats),
	}
	if in.IsDiff {
		r.Added = nonNilThreats(in.Added)
		r.Removed = nonNilThreats(in.Removed)
	}
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(r)
}

func nonNilThreats(ts []engine.Threat) []engine.Threat {
	if ts == nil {
		return []engine.Threat{}
	}
	return ts
}

var severityIcon = map[string]string{
	"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵", "info": "⚪",
}

func writeMarkdown(w io.Writer, in Input) error {
	if in.IsDiff {
		added := engine.Active(in.Added)
		fmt.Fprintf(w, "## Carbon Threat: %s\n\n", in.ModelName)
		switch {
		case len(added) == 0 && len(in.Removed) == 0:
			fmt.Fprint(w, "✅ This change does not introduce or resolve any threat.\n")
			return nil
		case len(added) == 0:
			fmt.Fprint(w, "✅ This change introduces no new threats.\n\n")
		default:
			fmt.Fprintf(w, "⚠️ This change introduces **%d new threat(s)**: %s.\n\n", len(added), summaryLine(added))
			markdownTable(w, added)
			fmt.Fprintln(w)
			markdownDetails(w, added)
		}
		if len(in.Removed) > 0 {
			fmt.Fprintf(w, "\n🎉 **%d threat(s) resolved**\n\n", len(in.Removed))
			for _, t := range in.Removed {
				fmt.Fprintf(w, "- ~~%s~~ `%s` on `%s`\n", t.Title, t.RuleID, t.TargetID)
			}
		}
		return nil
	}

	fmt.Fprintf(w, "# Threat report: %s\n\n", in.ModelName)
	active := engine.Active(in.Threats)
	fmt.Fprintf(w, "**%s**", summaryLine(in.Threats))
	if n := suppressedCount(in.Threats); n > 0 {
		fmt.Fprintf(w, " · %d suppressed", n)
	}
	fmt.Fprint(w, "\n\n")
	if len(active) == 0 {
		return nil
	}
	markdownTable(w, active)
	fmt.Fprint(w, "\n## Details\n\n")
	markdownDetails(w, active)
	return nil
}

func markdownTable(w io.Writer, ts []engine.Threat) {
	fmt.Fprintln(w, "| Severity | Rule | Target | Threat |")
	fmt.Fprintln(w, "|---|---|---|---|")
	for _, t := range ts {
		fmt.Fprintf(w, "| %s %s | `%s` | %s `%s` | %s |\n",
			severityIcon[t.Severity], t.Severity, t.RuleID, t.TargetKind, t.TargetID, mdEscape(t.Title))
	}
}

func markdownDetails(w io.Writer, ts []engine.Threat) {
	for _, t := range ts {
		fmt.Fprintf(w, "<details><summary>%s <code>%s</code> %s</summary>\n\n", severityIcon[t.Severity], t.RuleID, mdEscape(t.Title))
		fmt.Fprintf(w, "%s\n\n", t.Message)
		fmt.Fprintf(w, "**Mitigation:** %s\n\n", t.Mitigation)
		var refs []string
		refs = append(refs, "STRIDE: "+strings.Join(t.Stride, ", "))
		for _, c := range t.CWE {
			refs = append(refs, fmt.Sprintf("[CWE-%d](https://cwe.mitre.org/data/definitions/%d.html)", c, c))
		}
		for _, c := range t.CAPEC {
			refs = append(refs, fmt.Sprintf("[CAPEC-%d](https://capec.mitre.org/data/definitions/%d.html)", c, c))
		}
		for _, a := range t.Attack {
			refs = append(refs, fmt.Sprintf("[ATT&CK %s](https://attack.mitre.org/techniques/%s/)", a, strings.ReplaceAll(a, ".", "/")))
		}
		fmt.Fprintf(w, "%s\n\n</details>\n\n", strings.Join(refs, " · "))
	}
}

func mdEscape(s string) string {
	return strings.NewReplacer("|", `\|`, "<", "&lt;", ">", "&gt;").Replace(s)
}
