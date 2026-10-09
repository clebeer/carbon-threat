// Command ctm is the Carbon Threat CLI: threat modeling as code.
package main

import (
	"os"

	"github.com/clebeer/carbon-threat/internal/cli"
)

// Set at build time with -ldflags "-X main.version=... -X main.commit=... -X main.date=...".
var (
	version = "dev"
	commit  = ""
	date    = ""
)

func main() {
	cli.Commit, cli.Date = commit, date
	os.Exit(cli.Execute(version, os.Args[1:], os.Stdout, os.Stderr))
}
