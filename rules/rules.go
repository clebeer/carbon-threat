// Package rules embeds the built-in threat rules shipped with ctm.
package rules

import (
	"embed"
	"io/fs"
)

//go:embed flow component
var builtin embed.FS

// FS returns the built-in rules as a file system rooted at the rules directory.
func FS() fs.FS { return builtin }
