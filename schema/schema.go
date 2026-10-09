// Package schema embeds the JSON Schema of the ctm/v1 model format.
package schema

import _ "embed"

// CTMv1 is the JSON Schema (draft 2020-12) for ctm/v1 threat models.
//
//go:embed ctm-v1.json
var CTMv1 []byte
