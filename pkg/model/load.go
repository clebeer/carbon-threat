package model

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/clebeer/carbon-threat/schema"
	"github.com/santhosh-tekuri/jsonschema/v6"
	"go.yaml.in/yaml/v3"
	"golang.org/x/text/language"
	"golang.org/x/text/message"
)

// Problem is one schema or consistency error in a model.
type Problem struct {
	Path    string // JSON pointer, e.g. /components/2/trustZone
	File    string // file the element comes from, empty if unknown
	Line    int    // 1-based line in File, 0 if unknown
	Message string
}

func (p Problem) String() string {
	switch {
	case p.File != "" && p.Line > 0:
		return fmt.Sprintf("%s:%d: %s: %s", p.File, p.Line, p.Path, p.Message)
	case p.Line > 0:
		return fmt.Sprintf("line %d: %s: %s", p.Line, p.Path, p.Message)
	}
	return fmt.Sprintf("%s: %s", p.Path, p.Message)
}

// InvalidError is returned when a model does not satisfy the schema or is
// internally inconsistent.
type InvalidError struct {
	Source   string
	Problems []Problem
}

func (e *InvalidError) Error() string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s: invalid threat model (%d problem", e.Source, len(e.Problems))
	if len(e.Problems) != 1 {
		b.WriteString("s")
	}
	b.WriteString(")")
	for _, p := range e.Problems {
		b.WriteString("\n  - ")
		b.WriteString(p.String())
	}
	return b.String()
}

// LoadFile reads and validates a model file. Its sources, if any, are read
// from the file's directory.
func LoadFile(path string) (*Model, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return Load(data, path, os.DirFS(filepath.Dir(path)))
}

// Parse decodes and validates a model without file access. Models with
// sources must be loaded with Load or LoadFile.
func Parse(data []byte, source string) (*Model, error) {
	return Load(data, source, nil)
}

// Load decodes and validates a model. source names the model in errors and
// reports (usually its path). Sources are read from fsys, which must be
// rooted at the model's directory.
func Load(data []byte, source string, fsys fs.FS) (*Model, error) {
	var root yaml.Node
	if err := yaml.Unmarshal(data, &root); err != nil {
		return nil, fmt.Errorf("%s: %w", source, err)
	}
	if root.Kind == 0 || len(root.Content) == 0 {
		return nil, fmt.Errorf("%s: empty document", source)
	}
	doc := root.Content[0]

	if problems := validateSchema(doc); len(problems) > 0 {
		return nil, &InvalidError{Source: source, Problems: problems}
	}

	var m Model
	if err := doc.Decode(&m); err != nil {
		return nil, fmt.Errorf("%s: %w", source, err)
	}
	if len(m.Sources) > 0 {
		return resolveSources(&m, doc, source, fsys)
	}
	m.Source = source
	for key, line := range collectLines(doc) {
		m.setLoc(key, Location{File: source, Line: line})
	}
	locate := func(path string) Location { return Location{File: source, Line: lineAt(doc, path)} }
	if problems := m.check(locate); len(problems) > 0 {
		return nil, &InvalidError{Source: source, Problems: problems}
	}
	return &m, nil
}

var (
	compiledSchema *jsonschema.Schema
	compileOnce    sync.Once
	compileErr     error
)

func ctmSchema() (*jsonschema.Schema, error) {
	compileOnce.Do(func() {
		doc, err := jsonschema.UnmarshalJSON(bytes.NewReader(schema.CTMv1))
		if err != nil {
			compileErr = err
			return
		}
		c := jsonschema.NewCompiler()
		if err := c.AddResource("ctm-v1.json", doc); err != nil {
			compileErr = err
			return
		}
		compiledSchema, compileErr = c.Compile("ctm-v1.json")
	})
	return compiledSchema, compileErr
}

func validateSchema(doc *yaml.Node) []Problem {
	sch, err := ctmSchema()
	if err != nil {
		return []Problem{{Path: "/", Message: "internal error compiling schema: " + err.Error()}}
	}
	var raw any
	if err := doc.Decode(&raw); err != nil {
		return []Problem{{Path: "/", Message: err.Error()}}
	}
	// Round-trip through JSON so the validator sees JSON types only.
	buf, err := json.Marshal(normalizeYAML(raw))
	if err != nil {
		return []Problem{{Path: "/", Message: err.Error()}}
	}
	inst, err := jsonschema.UnmarshalJSON(bytes.NewReader(buf))
	if err != nil {
		return []Problem{{Path: "/", Message: err.Error()}}
	}
	err = sch.Validate(inst)
	if err == nil {
		return nil
	}
	var ve *jsonschema.ValidationError
	if !errors.As(err, &ve) {
		return []Problem{{Path: "/", Message: err.Error()}}
	}
	// Walk the cause tree ourselves: BasicOutput() reports errors reached
	// through $ref only as "validation failed", losing the actual message.
	seen := map[string]bool{}
	var out []Problem
	var walk func(e *jsonschema.ValidationError)
	walk = func(e *jsonschema.ValidationError) {
		if len(e.Causes) > 0 {
			for _, c := range e.Causes {
				walk(c)
			}
			return
		}
		path := "/" + strings.Join(escapePointer(e.InstanceLocation), "/")
		msg := e.ErrorKind.LocalizedString(printer)
		if seen[path+"|"+msg] {
			return
		}
		seen[path+"|"+msg] = true
		out = append(out, Problem{Path: path, Line: lineAt(doc, path), Message: msg})
	}
	walk(ve)
	sort.SliceStable(out, func(i, j int) bool { return out[i].Line < out[j].Line })
	return out
}

var printer = message.NewPrinter(language.English)

func escapePointer(tokens []string) []string {
	out := make([]string, len(tokens))
	for i, t := range tokens {
		out[i] = strings.ReplaceAll(strings.ReplaceAll(t, "~", "~0"), "/", "~1")
	}
	return out
}

// normalizeYAML converts YAML-decoded values (which may contain
// map[any]any or non-string scalars) into JSON-marshalable values.
func normalizeYAML(v any) any {
	switch t := v.(type) {
	case map[string]any:
		out := make(map[string]any, len(t))
		for k, val := range t {
			out[k] = normalizeYAML(val)
		}
		return out
	case map[any]any:
		out := make(map[string]any, len(t))
		for k, val := range t {
			out[fmt.Sprint(k)] = normalizeYAML(val)
		}
		return out
	case []any:
		out := make([]any, len(t))
		for i, val := range t {
			out[i] = normalizeYAML(val)
		}
		return out
	case fmt.Stringer:
		return t.String()
	default:
		return v
	}
}

// lineAt resolves a JSON pointer against a YAML node and returns its line.
func lineAt(doc *yaml.Node, pointer string) int {
	n := doc
	if pointer == "" || pointer == "/" {
		return n.Line
	}
	for _, tok := range strings.Split(strings.TrimPrefix(pointer, "/"), "/") {
		tok = strings.ReplaceAll(strings.ReplaceAll(tok, "~1", "/"), "~0", "~")
		switch n.Kind {
		case yaml.MappingNode:
			found := false
			for i := 0; i+1 < len(n.Content); i += 2 {
				if n.Content[i].Value == tok {
					n = n.Content[i+1]
					found = true
					break
				}
			}
			if !found {
				return n.Line
			}
		case yaml.SequenceNode:
			i, err := strconv.Atoi(tok)
			if err != nil || i < 0 || i >= len(n.Content) {
				return n.Line
			}
			n = n.Content[i]
		default:
			return n.Line
		}
	}
	return n.Line
}

// collectLines records where each identified element is declared.
func collectLines(doc *yaml.Node) map[string]int {
	lines := map[string]int{}
	sections := map[string]string{
		"trustZones": "zone",
		"data":       "data",
		"components": "component",
		"dataFlows":  "flow",
	}
	for i := 0; i+1 < len(doc.Content); i += 2 {
		kind, ok := sections[doc.Content[i].Value]
		seq := doc.Content[i+1]
		if !ok || seq.Kind != yaml.SequenceNode {
			continue
		}
		for _, item := range seq.Content {
			for j := 0; j+1 < len(item.Content); j += 2 {
				if item.Content[j].Value == "id" {
					lines[kind+":"+item.Content[j+1].Value] = item.Line
				}
			}
		}
	}
	return lines
}

// check verifies required fields, cross-references and uniqueness. Required
// fields are checked here rather than in the schema because sources may
// supply them. locate maps a JSON pointer to where it is declared.
func (m *Model) check(locate func(path string) Location) []Problem {
	var out []Problem
	add := func(path, format string, args ...any) {
		loc := locate(path)
		out = append(out, Problem{Path: path, File: loc.File, Line: loc.Line, Message: fmt.Sprintf(format, args...)})
	}

	if len(m.TrustZones) == 0 {
		add("/trustZones", "at least one trust zone is required")
	}
	if len(m.Components) == 0 {
		add("/components", "at least one component is required")
	}

	zones := map[string]bool{}
	for i, z := range m.TrustZones {
		if zones[z.ID] {
			add(fmt.Sprintf("/trustZones/%d/id", i), "duplicate trust zone id %q", z.ID)
		}
		zones[z.ID] = true
	}
	data := map[string]bool{}
	for i, d := range m.Data {
		if data[d.ID] {
			add(fmt.Sprintf("/data/%d/id", i), "duplicate data id %q", d.ID)
		}
		data[d.ID] = true
	}
	// Components and flows share one namespace so suppressions and threats
	// can target either by id alone.
	elements := map[string]bool{}
	for i, c := range m.Components {
		if elements[c.ID] {
			add(fmt.Sprintf("/components/%d/id", i), "duplicate component or flow id %q", c.ID)
		}
		elements[c.ID] = true
		if c.Type == "" {
			add(fmt.Sprintf("/components/%d", i), "component %q: type is required", c.ID)
		}
		switch {
		case c.TrustZone == "":
			add(fmt.Sprintf("/components/%d", i), "component %q: trustZone is required", c.ID)
		case !zones[c.TrustZone]:
			add(fmt.Sprintf("/components/%d/trustZone", i), "unknown trust zone %q", c.TrustZone)
		}
		for j, s := range c.Stores {
			if !data[s] {
				add(fmt.Sprintf("/components/%d/stores/%d", i, j), "unknown data id %q", s)
			}
		}
	}
	components := map[string]bool{}
	for _, c := range m.Components {
		components[c.ID] = true
	}
	for i, f := range m.DataFlows {
		if elements[f.ID] {
			add(fmt.Sprintf("/dataFlows/%d/id", i), "duplicate component or flow id %q", f.ID)
		}
		elements[f.ID] = true
		for _, end := range []struct{ field, value string }{{"from", f.From}, {"to", f.To}} {
			switch {
			case end.value == "":
				add(fmt.Sprintf("/dataFlows/%d", i), "flow %q: %s is required", f.ID, end.field)
			case !components[end.value]:
				add(fmt.Sprintf("/dataFlows/%d/%s", i, end.field), "unknown component %q", end.value)
			}
		}
		if f.From != "" && f.From == f.To {
			add(fmt.Sprintf("/dataFlows/%d/to", i), "a flow cannot start and end at the same component")
		}
		for j, d := range f.Data {
			if !data[d] {
				add(fmt.Sprintf("/dataFlows/%d/data/%d", i, j), "unknown data id %q", d)
			}
		}
	}
	for i, s := range m.Suppressions {
		if s.Target != "" && !elements[s.Target] {
			add(fmt.Sprintf("/suppressions/%d/target", i), "unknown component or flow %q", s.Target)
		}
	}
	return out
}
