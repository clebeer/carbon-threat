package cli

import (
	"fmt"
	"os"
	"strings"
	"text/tabwriter"

	"github.com/clebeer/carbon-threat/pkg/engine"
	"github.com/spf13/cobra"
)

func newRulesCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "rules",
		Short: "List or test threat rules",
	}
	var extra []string
	list := &cobra.Command{
		Use:   "list",
		Short: "List the built-in rules and any additional rules",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			rs, err := loadRules(extra)
			if err != nil {
				return &ExitError{Code: ExitFailure, Err: err}
			}
			tw := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 0, 2, ' ', 0)
			fmt.Fprintln(tw, "ID\tSEVERITY\tTARGET\tSTRIDE\tTITLE")
			for _, r := range rs {
				fmt.Fprintf(tw, "%s\t%s\t%s\t%s\t%s\n", r.ID, r.Severity, r.Target, strings.Join(r.Stride, ","), r.Title)
			}
			return tw.Flush()
		},
	}
	list.Flags().StringArrayVar(&extra, "rules", nil, "additional rules directory (repeatable)")

	test := &cobra.Command{
		Use:   "test [dir...]",
		Short: "Run the inline tests of rules (built-in rules when no dir is given)",
		RunE: func(cmd *cobra.Command, args []string) error {
			var rs []*engine.Rule
			if len(args) == 0 {
				var err error
				if rs, err = loadRules(nil); err != nil {
					return &ExitError{Code: ExitFailure, Err: err}
				}
			}
			for _, dir := range args {
				loaded, err := engine.LoadRules(os.DirFS(dir), ".")
				if err != nil {
					return &ExitError{Code: ExitFailure, Err: fmt.Errorf("%s: %w", dir, err)}
				}
				rs = append(rs, loaded...)
			}
			failed := 0
			results := engine.RunRuleTests(rs)
			for _, r := range results {
				if r.Err != nil {
					failed++
					fmt.Fprintf(cmd.OutOrStdout(), "FAIL  %s  %s: %v\n", r.RuleID, r.Name, r.Err)
				}
			}
			fmt.Fprintf(cmd.OutOrStdout(), "%d rules, %d tests, %d failed\n", len(rs), len(results), failed)
			if failed > 0 {
				return &ExitError{Code: ExitFindings}
			}
			return nil
		},
	}
	cmd.AddCommand(list, test)
	return cmd
}
