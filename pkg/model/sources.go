package model

import (
	"fmt"
	"io/fs"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"

	"go.yaml.in/yaml/v3"
)

// ExtractFunc builds a model from an infrastructure definition at path
// (slash-separated, relative to fsys). It returns non-fatal warnings and
// records element locations with SetLocation, relative to fsys.
type ExtractFunc func(fsys fs.FS, path string) (*Model, []string, error)

var (
	extractorsMu sync.RWMutex
	extractors   = map[string]ExtractFunc{}
)

// RegisterExtractor makes an extractor available to models' "sources" under
// kind (e.g. "compose"). Extractor packages call it from init.
func RegisterExtractor(kind string, fn ExtractFunc) {
	extractorsMu.Lock()
	defer extractorsMu.Unlock()
	extractors[kind] = fn
}

func extractor(kind string) (ExtractFunc, bool) {
	extractorsMu.RLock()
	defer extractorsMu.RUnlock()
	fn, ok := extractors[kind]
	return fn, ok
}

// mergedLists are the top-level lists whose entries are merged by id.
var mergedLists = map[string]string{
	"trustZones": "zone",
	"data":       "data",
	"components": "component",
	"dataFlows":  "flow",
}

// resolveSources extracts every source, merges the results, and lays the
// document (overlay) on top: entries with an id that already exists are
// merged field by field (maps recursively, everything else replaced), new
// ids are appended.
func resolveSources(overlay *Model, doc *yaml.Node, source string, fsys fs.FS) (*Model, error) {
	if fsys == nil {
		return nil, fmt.Errorf("%s: models with sources must be loaded from a file", source)
	}
	invalid := func(path, format string, args ...any) error {
		return &InvalidError{Source: source, Problems: []Problem{{
			Path: path, File: source, Line: lineAt(doc, path), Message: fmt.Sprintf(format, args...),
		}}}
	}

	base := map[string]any{}
	locs := map[string]Location{}
	producedBy := map[string]string{} // element key -> source description
	var warnings []string
	for i, ref := range overlay.Sources {
		kind, p := ref.Kind()
		path := fmt.Sprintf("/sources/%d/%s", i, kind)
		if !fs.ValidPath(p) {
			return nil, invalid(path, "%q must be a relative path inside the model's directory, without '.' or '..' segments", p)
		}
		extract, ok := extractor(kind)
		if !ok {
			return nil, invalid(path, "no %s extractor is available in this build", kind)
		}
		em, warns, err := extract(fsys, p)
		if err != nil {
			return nil, fmt.Errorf("%s: source %s %s: %w", source, kind, p, err)
		}
		desc := kind + " " + p
		for _, w := range warns {
			warnings = append(warnings, desc+": "+w)
		}
		emMap, err := toMap(em)
		if err != nil {
			return nil, err
		}
		for list, elemKind := range mergedLists {
			for _, item := range asList(emMap[list]) {
				id := idOf(item)
				key := elemKind + ":" + id
				if prev, dup := producedBy[key]; dup {
					if elemKind == "zone" {
						continue // sources may share zones; the first definition wins
					}
					return nil, invalid(path, "%s %q is produced by both %s and %s", elemKind, id, prev, desc)
				}
				producedBy[key] = desc
				base[list] = append(asList(base[list]), item)
			}
		}
		for key, loc := range em.locs {
			if _, ok := locs[key]; !ok {
				locs[key] = Location{File: relativeTo(source, loc.File), Line: loc.Line}
			}
		}
	}

	var overlayMap map[string]any
	if err := doc.Decode(&overlayMap); err != nil {
		return nil, fmt.Errorf("%s: %w", source, err)
	}
	delete(overlayMap, "sources")
	merged := overlayOnto(base, overlayMap)

	out, err := yaml.Marshal(merged)
	if err != nil {
		return nil, err
	}
	var m Model
	if err := yaml.Unmarshal(out, &m); err != nil {
		return nil, fmt.Errorf("%s: merging sources: %w", source, err)
	}
	m.Source = source
	m.Sources = overlay.Sources
	m.Warnings = warnings
	m.locs = locs
	// Elements only declared in the document are located there; extracted
	// elements keep their source location, which is where a fix would go.
	for key, line := range collectLines(doc) {
		if _, ok := m.locs[key]; !ok {
			m.setLoc(key, Location{File: source, Line: line})
		}
	}

	locate := func(p string) Location {
		parts := strings.Split(strings.TrimPrefix(p, "/"), "/")
		if kind, ok := mergedLists[parts[0]]; ok && len(parts) > 1 {
			if i, err := strconv.Atoi(parts[1]); err == nil {
				if id := m.idAt(parts[0], i); id != "" {
					if loc := m.Location(kind, id); loc.File != "" {
						return loc
					}
				}
			}
			return Location{File: source}
		}
		return Location{File: source, Line: lineAt(doc, p)}
	}
	if problems := m.check(locate); len(problems) > 0 {
		return nil, &InvalidError{Source: source, Problems: problems}
	}
	return &m, nil
}

func (m *Model) idAt(list string, i int) string {
	switch list {
	case "trustZones":
		if i < len(m.TrustZones) {
			return m.TrustZones[i].ID
		}
	case "data":
		if i < len(m.Data) {
			return m.Data[i].ID
		}
	case "components":
		if i < len(m.Components) {
			return m.Components[i].ID
		}
	case "dataFlows":
		if i < len(m.DataFlows) {
			return m.DataFlows[i].ID
		}
	}
	return ""
}

// relativeTo turns a path relative to the model's directory into one
// relative to wherever source is (so reports can resolve it).
func relativeTo(source, p string) string {
	return filepath.ToSlash(filepath.Join(filepath.Dir(source), filepath.FromSlash(p)))
}

func toMap(m *Model) (map[string]any, error) {
	out, err := yaml.Marshal(m)
	if err != nil {
		return nil, err
	}
	var res map[string]any
	return res, yaml.Unmarshal(out, &res)
}

func asList(v any) []any {
	l, _ := v.([]any)
	return l
}

func idOf(item any) string {
	if m, ok := item.(map[string]any); ok {
		if id, ok := m["id"].(string); ok {
			return id
		}
	}
	return ""
}

func overlayOnto(base, overlay map[string]any) map[string]any {
	out := map[string]any{}
	for k, v := range base {
		out[k] = v
	}
	keys := make([]string, 0, len(overlay))
	for k := range overlay {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		if _, ok := mergedLists[k]; ok {
			out[k] = mergeByID(asList(out[k]), asList(overlay[k]))
			continue
		}
		out[k] = overlay[k]
	}
	return out
}

func mergeByID(base, over []any) []any {
	out := append([]any(nil), base...)
	index := map[string]int{}
	for i, item := range out {
		index[idOf(item)] = i
	}
	for _, item := range over {
		id := idOf(item)
		if i, ok := index[id]; ok && id != "" {
			if bm, ok := out[i].(map[string]any); ok {
				if om, ok := item.(map[string]any); ok {
					out[i] = deepMerge(bm, om)
					continue
				}
			}
		}
		index[id] = len(out)
		out = append(out, item)
	}
	return out
}

func deepMerge(a, b map[string]any) map[string]any {
	out := map[string]any{}
	for k, v := range a {
		out[k] = v
	}
	for k, v := range b {
		am, aok := out[k].(map[string]any)
		bm, bok := v.(map[string]any)
		if aok && bok {
			out[k] = deepMerge(am, bm)
			continue
		}
		out[k] = v
	}
	return out
}
