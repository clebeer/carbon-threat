package cli

import (
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"os/exec"
	pathpkg "path"
	"path/filepath"
	"sort"
	"strings"

	"github.com/clebeer/carbon-threat/pkg/diff"
	"github.com/clebeer/carbon-threat/pkg/engine"
	"github.com/clebeer/carbon-threat/pkg/model"
	"github.com/clebeer/carbon-threat/pkg/report"
	"github.com/spf13/cobra"
)

// loadModel loads a model file and prints extractor warnings to stderr.
func loadModel(cmd *cobra.Command, path string) (*model.Model, error) {
	m, err := model.LoadFile(path)
	if err != nil {
		return nil, err
	}
	for _, w := range m.Warnings {
		fmt.Fprintln(cmd.ErrOrStderr(), "warning:", w)
	}
	return m, nil
}

// reportPaths rewrites threat locations relative to the working directory.
func reportPaths(ts []engine.Threat) {
	for i := range ts {
		if ts[i].File != "" {
			ts[i].File = reportPath(ts[i].File)
		}
	}
}

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
			m, err := loadModel(cmd, path)
			if err != nil {
				return &ExitError{Code: ExitFailure, Err: err}
			}
			fmt.Fprintf(cmd.OutOrStdout(), "%s: valid (%d components, %d flows", path, len(m.Components), len(m.DataFlows))
			if len(m.Sources) > 0 {
				fmt.Fprintf(cmd.OutOrStdout(), ", %d source(s)", len(m.Sources))
			}
			fmt.Fprintln(cmd.OutOrStdout(), ")")
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
			m, err := loadModel(cmd, path)
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
			reportPaths(threats)
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
			head, err := loadModel(cmd, path)
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

			reportPaths(headThreats)
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

// loadFromGit reads the model at path as it was at rev, together with its
// sources at that revision. It returns (nil, nil) when the model does not
// exist at that revision.
func loadFromGit(rev, path string) (*model.Model, error) {
	if strings.HasPrefix(rev, "-") {
		return nil, fmt.Errorf("invalid git revision %q", rev)
	}
	top, err := gitOutput("rev-parse", "--show-toplevel")
	if err != nil {
		return nil, err
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	// Resolve symlinks on both sides (e.g. /tmp vs /private/tmp on macOS).
	if r, err := filepath.EvalSymlinks(filepath.Dir(abs)); err == nil {
		abs = filepath.Join(r, filepath.Base(abs))
	}
	root := strings.TrimSpace(string(top))
	if r, err := filepath.EvalSymlinks(root); err == nil {
		root = r
	}
	rel, err := filepath.Rel(root, abs)
	if err != nil || strings.HasPrefix(rel, "..") {
		return nil, fmt.Errorf("%s is not inside the git repository", path)
	}
	rel = filepath.ToSlash(rel)
	data, err := gitOutput("show", rev+":"+rel)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	dir := pathpkg.Dir(rel)
	if dir == "." {
		dir = ""
	}
	return model.Load(data, rev+":"+rel, gitFS{rev: rev, dir: dir})
}

// gitFS reads files from a git revision, rooted at dir (repository-relative,
// slash-separated, "" for the root).
type gitFS struct{ rev, dir string }

func (g gitFS) spec(name string) string {
	if name == "." {
		name = ""
	}
	return g.rev + ":" + pathpkg.Join(g.dir, name)
}

func (g gitFS) Open(name string) (fs.File, error) {
	return nil, &fs.PathError{Op: "open", Path: name, Err: errors.ErrUnsupported}
}

func (g gitFS) ReadFile(name string) ([]byte, error) {
	if !fs.ValidPath(name) {
		return nil, &fs.PathError{Op: "read", Path: name, Err: fs.ErrInvalid}
	}
	data, err := gitOutput("show", g.spec(name))
	if err != nil {
		return nil, &fs.PathError{Op: "read", Path: name, Err: err}
	}
	return data, nil
}

func (g gitFS) ReadDir(name string) ([]fs.DirEntry, error) {
	if !fs.ValidPath(name) {
		return nil, &fs.PathError{Op: "readdir", Path: name, Err: fs.ErrInvalid}
	}
	out, err := gitOutput("ls-tree", "-z", g.spec(name))
	if err != nil {
		return nil, &fs.PathError{Op: "readdir", Path: name, Err: err}
	}
	var entries []fs.DirEntry
	for _, rec := range strings.Split(strings.TrimRight(string(out), "\x00"), "\x00") {
		meta, entryName, ok := strings.Cut(rec, "\t")
		if !ok {
			continue
		}
		fields := strings.Fields(meta) // mode type object
		entries = append(entries, gitEntry{name: entryName, dir: len(fields) > 1 && fields[1] == "tree"})
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
	return entries, nil
}

type gitEntry struct {
	name string
	dir  bool
}

func (e gitEntry) Name() string { return e.name }
func (e gitEntry) IsDir() bool  { return e.dir }
func (e gitEntry) Type() fs.FileMode {
	if e.dir {
		return fs.ModeDir
	}
	return 0
}
func (e gitEntry) Info() (fs.FileInfo, error) { return nil, errors.ErrUnsupported }

// gitOutput runs git and returns stdout. A path missing at the revision is
// reported as fs.ErrNotExist.
func gitOutput(args ...string) ([]byte, error) {
	var stdout, stderr bytes.Buffer
	c := exec.Command("git", args...)
	c.Stdout, c.Stderr = &stdout, &stderr
	if err := c.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if strings.Contains(msg, "does not exist") || strings.Contains(msg, "exists on disk, but not in") {
			return nil, fmt.Errorf("git %s: %w", strings.Join(args, " "), fs.ErrNotExist)
		}
		return nil, fmt.Errorf("git %s: %w: %s", strings.Join(args, " "), err, msg)
	}
	return stdout.Bytes(), nil
}
