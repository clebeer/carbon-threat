// Package cli implements the ctm command line.
package cli

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/clebeer/carbon-threat/pkg/engine"
	// Extractors register themselves for models' "sources".
	_ "github.com/clebeer/carbon-threat/pkg/extract/compose"
	_ "github.com/clebeer/carbon-threat/pkg/extract/terraform"
	"github.com/clebeer/carbon-threat/rules"
	"github.com/spf13/cobra"
)

// Exit codes.
const (
	ExitOK       = 0
	ExitFindings = 1 // threats at or above --fail-on
	ExitFailure  = 2 // usage, I/O or validation errors
)

// Build metadata, set by main from linker flags. Empty in development builds.
var (
	// Commit is the short git commit the binary was built from.
	Commit string
	// Date is the commit date of the build.
	Date string
)

// DefaultModelFile is used when no model path is given.
const DefaultModelFile = "threatmodel.yaml"

// ExitError carries a process exit code through cobra.
type ExitError struct {
	Code int
	Err  error
}

func (e *ExitError) Error() string {
	if e.Err == nil {
		return fmt.Sprintf("exit %d", e.Code)
	}
	return e.Err.Error()
}

func (e *ExitError) Unwrap() error { return e.Err }

// Execute runs the CLI and returns the process exit code.
func Execute(version string, args []string, stdout, stderr io.Writer) int {
	root := newRoot(version)
	root.SetArgs(args)
	root.SetOut(stdout)
	root.SetErr(stderr)
	err := root.Execute()
	if err == nil {
		return ExitOK
	}
	var ee *ExitError
	if errors.As(err, &ee) {
		if ee.Err != nil {
			fmt.Fprintln(stderr, "ctm:", ee.Err)
		}
		return ee.Code
	}
	fmt.Fprintln(stderr, "ctm:", err)
	return ExitFailure
}

func newRoot(version string) *cobra.Command {
	root := &cobra.Command{
		Use:   "ctm",
		Short: "Carbon Threat: threat modeling as code",
		Long: `ctm builds a threat model from your infrastructure, evaluates it with
declarative rules, and reports the threats a change introduces.`,
		SilenceUsage:  true,
		SilenceErrors: true,
	}
	root.AddCommand(
		newVersionCmd(version),
		newValidateCmd(),
		newAnalyzeCmd(version),
		newDiffCmd(version),
		newExtractCmd(),
		newInitCmd(),
		newRenderCmd(),
		newRulesCmd(),
	)
	return root
}

func newVersionCmd(version string) *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print the ctm version",
		Args:  cobra.NoArgs,
		Run: func(cmd *cobra.Command, _ []string) {
			fmt.Fprint(cmd.OutOrStdout(), "ctm ", version)
			if Commit != "" {
				fmt.Fprintf(cmd.OutOrStdout(), " (commit %s, built %s)", Commit, Date)
			}
			fmt.Fprintln(cmd.OutOrStdout())
		},
	}
}

// loadRules returns the built-in rules plus any rules in extra directories.
func loadRules(extraDirs []string) ([]*engine.Rule, error) {
	all, err := engine.LoadRules(rules.FS(), ".")
	if err != nil {
		return nil, fmt.Errorf("built-in rules: %w", err)
	}
	for _, dir := range extraDirs {
		rs, err := engine.LoadRules(os.DirFS(dir), ".")
		if err != nil {
			return nil, err
		}
		for _, r := range rs {
			r.File = filepath.Join(dir, r.File)
		}
		all = append(all, rs...)
	}
	seen := map[string]string{}
	for _, r := range all {
		if prev, ok := seen[r.ID]; ok {
			return nil, fmt.Errorf("duplicate rule id %s in %s and %s", r.ID, prev, r.File)
		}
		seen[r.ID] = r.File
	}
	return all, nil
}

func newEngine(extraDirs []string) (*engine.Engine, error) {
	rs, err := loadRules(extraDirs)
	if err != nil {
		return nil, err
	}
	return engine.New(rs)
}

// openOutput returns stdout or the named file.
func openOutput(cmd *cobra.Command, path string) (io.Writer, func() error, error) {
	if path == "" || path == "-" {
		return cmd.OutOrStdout(), func() error { return nil }, nil
	}
	f, err := os.Create(path)
	if err != nil {
		return nil, nil, err
	}
	return f, f.Close, nil
}

func checkFailOn(v string) error {
	if v == "" || v == "none" {
		return nil
	}
	if engine.SeverityRank(v) < 0 {
		return &ExitError{Code: ExitFailure, Err: fmt.Errorf("--fail-on %q must be none or one of %s", v, strings.Join(engine.Severities, ", "))}
	}
	return nil
}

// failIfAtOrAbove returns an ExitFindings error when threats meet --fail-on.
func failIfAtOrAbove(threats []engine.Threat, failOn string, what string) error {
	if failOn == "" || failOn == "none" {
		return nil
	}
	if n := len(engine.AtOrAbove(threats, failOn)); n > 0 {
		return &ExitError{Code: ExitFindings, Err: fmt.Errorf("%d %s at or above %q", n, what, failOn)}
	}
	return nil
}

// reportPath is the model path as it should appear in reports: relative to
// the working directory and with forward slashes.
func reportPath(p string) string {
	if wd, err := os.Getwd(); err == nil {
		if abs, err := filepath.Abs(p); err == nil {
			if rel, err := filepath.Rel(wd, abs); err == nil && !strings.HasPrefix(rel, "..") {
				p = rel
			}
		}
	}
	return filepath.ToSlash(p)
}
