package cli

import (
	"bytes"
	"errors"
	"fmt"
	"os/exec"
	"strings"

	"github.com/clebeer/carbon-threat/pkg/diff"
	"github.com/clebeer/carbon-threat/pkg/engine"
	"github.com/clebeer/carbon-threat/pkg/model"
	"github.com/clebeer/carbon-threat/pkg/report"
	"github.com/spf13/cobra"
)

func modelArg(args []string) string {
	if len(args) == 1 {
		return args[0]
	}
	return DefaultModelFile
}

func newValidateCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "validate [model]",
		Short: "Check a model against the ctm/v1 schema and for broken references",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			path := modelArg(args)
			m, err := model.LoadFile(path)
			if err != nil {
				return &ExitError{Code: ExitFailure, Err: err}
			}
			fmt.Fprintf(cmd.OutOrStdout(), "%s: valid (%d components, %d flows)\n", path, len(m.Components), len(m.DataFlows))
			return nil
		},
	}
}

type outputFlags struct {
	format string
	output string
	failOn string
	rules  []string
}

func (o *outputFlags) register(cmd *cobra.Command, defaultFormat string) {
	cmd.Flags().StringVarP(&o.format, "format", "f", defaultFormat, "output format: "+strings.Join(report.Formats, ", "))
	cmd.Flags().StringVarP(&o.output, "output", "o", "", "write the report to a file instead of stdout")
	cmd.Flags().StringVar(&o.failOn, "fail-on", "none", "exit with code 1 if a threat at or above this severity is found (none, critical, high, medium, low, info)")
	cmd.Flags().StringArrayVar(&o.rules, "rules", nil, "additional rules directory (repeatable)")
}

func newAnalyzeCmd(version string) *cobra.Command {
	var o outputFlags
	cmd := &cobra.Command{
		Use:   "analyze [model]",
		Short: "Evaluate the rules against a model and report threats",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := checkFailOn(o.failOn); err != nil {
				return err
			}
			path := modelArg(args)
			m, err := model.LoadFile(path)
			if err != nil {
				return &ExitError{Code: ExitFailure, Err: err}
			}
			eng, err := newEngine(o.rules)
			if err != nil {
				return &ExitError{Code: ExitFailure, Err: err}
			}
			threats, err := eng.Analyze(m)
			if err != nil {
				return &ExitError{Code: ExitFailure, Err: err}
			}
			w, closeFn, err := openOutput(cmd, o.output)
			if err != nil {
				return &ExitError{Code: ExitFailure, Err: err}
			}
			err = report.Write(w, o.format, report.Input{
				ToolVersion: version,
				ModelName:   m.Metadata.Name,
				ModelPath:   reportPath(path),
				Threats:     threats,
				Rules:       eng.Rules(),
			})
			if cerr := closeFn(); err == nil {
				err = cerr
			}
			if err != nil {
				return &ExitError{Code: ExitFailure, Err: err}
			}
			return failIfAtOrAbove(threats, o.failOn, "threat(s)")
		},
	}
	o.register(cmd, "table")
	return cmd
}

func newDiffCmd(version string) *cobra.Command {
	var o outputFlags
	var baseFile, baseRef string
	cmd := &cobra.Command{
		Use:   "diff [model]",
		Short: "Report threats introduced or resolved relative to a base revision",
		Long: `Compare the threats of a model with those of a base revision, given either
as another file (--base) or as a git revision (--base-ref), e.g.:

  ctm diff --base-ref origin/main threatmodel.yaml --fail-on high

If the model does not exist in the base revision, every threat is new.`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := checkFailOn(o.failOn); err != nil {
				return err
			}
			if (baseFile == "") == (baseRef == "") {
				return &ExitError{Code: ExitFailure, Err: errors.New("give exactly one of --base or --base-ref")}
			}
			path := modelArg(args)
			head, err := model.LoadFile(path)
			if err != nil {
				return &ExitError{Code: ExitFailure, Err: err}
			}
			eng, err := newEngine(o.rules)
			if err != nil {
				return &ExitError{Code: ExitFailure, Err: err}
			}
			headThreats, err := eng.Analyze(head)
			if err != nil {
				return &ExitError{Code: ExitFailure, Err: err}
			}

			var baseThreats []engine.Threat
			var base *model.Model
			if baseFile != "" {
				base, err = model.LoadFile(baseFile)
			} else {
				base, err = loadFromGit(baseRef, path)
			}
			if err != nil {
				return &ExitError{Code: ExitFailure, Err: err}
			}
			if base != nil {
				if baseThreats, err = eng.Analyze(base); err != nil {
					return &ExitError{Code: ExitFailure, Err: err}
				}
			}

			d := diff.Compare(baseThreats, headThreats)
			w, closeFn, err := openOutput(cmd, o.output)
			if err != nil {
				return &ExitError{Code: ExitFailure, Err: err}
			}
			err = report.Write(w, o.format, report.Input{
				ToolVersion: version,
				ModelName:   head.Metadata.Name,
				ModelPath:   reportPath(path),
				Threats:     headThreats,
				Rules:       eng.Rules(),
				IsDiff:      true,
				Added:       d.Added,
				Removed:     d.Removed,
			})
			if cerr := closeFn(); err == nil {
				err = cerr
			}
			if err != nil {
				return &ExitError{Code: ExitFailure, Err: err}
			}
			return failIfAtOrAbove(d.Added, o.failOn, "new threat(s)")
		},
	}
	o.register(cmd, "table")
	cmd.Flags().StringVar(&baseFile, "base", "", "base revision of the model, as a file")
	cmd.Flags().StringVar(&baseRef, "base-ref", "", "base revision of the model, as a git revision (e.g. origin/main)")
	return cmd
}

// loadFromGit reads path as it was at rev. It returns (nil, nil) when the
// file does not exist at that revision.
func loadFromGit(rev, path string) (*model.Model, error) {
	if strings.HasPrefix(rev, "-") {
		return nil, fmt.Errorf("invalid git revision %q", rev)
	}
	spec := rev + ":./" + strings.TrimPrefix(path, "./")
	var stdout, stderr bytes.Buffer
	c := exec.Command("git", "show", spec)
	c.Stdout, c.Stderr = &stdout, &stderr
	if err := c.Run(); err != nil {
		msg := stderr.String()
		if strings.Contains(msg, "does not exist") || strings.Contains(msg, "exists on disk, but not in") {
			return nil, nil
		}
		return nil, fmt.Errorf("git show %s: %w: %s", spec, err, strings.TrimSpace(msg))
	}
	return model.Parse(stdout.Bytes(), spec)
}
