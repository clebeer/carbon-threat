// Command ctm is the Carbon Threat CLI: threat modeling as code.
package main

import (
	"os"

	"github.com/clebeer/carbon-threat/internal/cli"
)

// version is set at build time with -ldflags "-X main.version=...".
var version = "dev"

func main() {
	os.Exit(cli.Execute(version, os.Args[1:], os.Stdout, os.Stderr))
}
