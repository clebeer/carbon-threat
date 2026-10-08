// Package diff compares the threats of two revisions of a model.
package diff

import "github.com/clebeer/carbon-threat/pkg/engine"

// Result lists the threats that appear or disappear between two revisions.
// Only active (unsuppressed) threats are compared, so suppressing a threat
// counts as resolving it.
type Result struct {
	Added   []engine.Threat // active in head, not in base
	Removed []engine.Threat // active in base, not in head
}

// Compare matches threats by fingerprint (rule id + target id).
func Compare(base, head []engine.Threat) Result {
	inBase := map[string]bool{}
	for _, t := range engine.Active(base) {
		inBase[t.Fingerprint] = true
	}
	inHead := map[string]bool{}
	var r Result
	for _, t := range engine.Active(head) {
		inHead[t.Fingerprint] = true
		if !inBase[t.Fingerprint] {
			r.Added = append(r.Added, t)
		}
	}
	for _, t := range engine.Active(base) {
		if !inHead[t.Fingerprint] {
			r.Removed = append(r.Removed, t)
		}
	}
	engine.Sort(r.Added)
	engine.Sort(r.Removed)
	return r
}
