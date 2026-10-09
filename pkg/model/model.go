// Package model defines the ctm/v1 threat model: trust zones, components, data
// assets and data flows, plus loading, validation and derived facts.
package model

// APIVersion is the only model version this package reads and writes.
const APIVersion = "ctm/v1"

// Kind is the document kind of a threat model file.
const Kind = "ThreatModel"

// Component types follow the classic data-flow-diagram vocabulary.
const (
	TypeExternalEntity = "external_entity"
	TypeProcess        = "process"
	TypeDatastore      = "datastore"
)

// UntrustedBelow is the trust level under which a zone counts as untrusted
// (e.g. the internet or a third party).
const UntrustedBelow = 20

// Classifications lists the data classification levels, from least to most sensitive.
var Classifications = []string{"public", "internal", "confidential", "restricted"}

// ClassificationRank returns the rank of a classification (0 = public,
// 3 = restricted) or -1 if it is unknown.
func ClassificationRank(c string) int {
	for i, v := range Classifications {
		if v == c {
			return i
		}
	}
	return -1
}

// Model is a ctm/v1 threat model document.
type Model struct {
	APIVersion   string        `yaml:"apiVersion" json:"apiVersion"`
	Kind         string        `yaml:"kind" json:"kind"`
	Metadata     Metadata      `yaml:"metadata" json:"metadata"`
	TrustZones   []TrustZone   `yaml:"trustZones" json:"trustZones"`
	Data         []DataAsset   `yaml:"data,omitempty" json:"data,omitempty"`
	Components   []Component   `yaml:"components" json:"components"`
	DataFlows    []DataFlow    `yaml:"dataFlows,omitempty" json:"dataFlows,omitempty"`
	Suppressions []Suppression `yaml:"suppressions,omitempty" json:"suppressions,omitempty"`
	// Sources lists infrastructure definitions that are extracted when the
	// model is loaded; the rest of the document overlays the result.
	Sources []SourceRef `yaml:"sources,omitempty" json:"sources,omitempty"`

	// Source is the path or label the model was loaded from.
	Source string `yaml:"-" json:"-"`
	// Warnings are non-fatal messages from extractors.
	Warnings []string `yaml:"-" json:"-"`
	// locs maps "component:<id>", "flow:<id>", ... to where the element is
	// declared: in Source, or in an extracted source file.
	locs map[string]Location
}

// SourceRef points at an infrastructure definition to extract, relative to
// the model file. Exactly one field is set.
type SourceRef struct {
	Compose   string `yaml:"compose,omitempty" json:"compose,omitempty"`
	Terraform string `yaml:"terraform,omitempty" json:"terraform,omitempty"`
}

// Kind returns the extractor kind and path of the reference.
func (s SourceRef) Kind() (kind, path string) {
	switch {
	case s.Compose != "":
		return "compose", s.Compose
	case s.Terraform != "":
		return "terraform", s.Terraform
	}
	return "", ""
}

// Location is where a model element is declared.
type Location struct {
	File string // as given to the loader, e.g. "threatmodel.yaml" or "infra/main.tf"
	Line int    // 1-based, 0 if unknown
}

// Metadata describes the modelled system.
type Metadata struct {
	Name        string `yaml:"name" json:"name"`
	Description string `yaml:"description,omitempty" json:"description,omitempty"`
	Owner       string `yaml:"owner,omitempty" json:"owner,omitempty"`
}

// TrustZone groups components that share a level of trust (0 = untrusted,
// 100 = fully trusted).
type TrustZone struct {
	ID          string `yaml:"id" json:"id"`
	Name        string `yaml:"name,omitempty" json:"name,omitempty"`
	Trust       int    `yaml:"trust" json:"trust"`
	Description string `yaml:"description,omitempty" json:"description,omitempty"`
}

// DataAsset is a kind of data handled by the system.
type DataAsset struct {
	ID             string `yaml:"id" json:"id"`
	Name           string `yaml:"name,omitempty" json:"name,omitempty"`
	Classification string `yaml:"classification" json:"classification"`
	Description    string `yaml:"description,omitempty" json:"description,omitempty"`
}

// Component is a node of the architecture: an external entity, a process or a
// datastore.
type Component struct {
	ID          string     `yaml:"id" json:"id"`
	Name        string     `yaml:"name,omitempty" json:"name,omitempty"`
	Type        string     `yaml:"type" json:"type"`
	Technology  string     `yaml:"technology,omitempty" json:"technology,omitempty"`
	TrustZone   string     `yaml:"trustZone" json:"trustZone"`
	Description string     `yaml:"description,omitempty" json:"description,omitempty"`
	Tags        []string   `yaml:"tags,omitempty" json:"tags,omitempty"`
	Stores      []string   `yaml:"stores,omitempty" json:"stores,omitempty"`
	Properties  Properties `yaml:"properties,omitempty" json:"properties,omitempty"`
}

// Properties are security-relevant facts about a component. A nil pointer
// means "unknown": rules only fire on facts that are stated explicitly.
type Properties struct {
	Authentication   string `yaml:"authentication,omitempty" json:"authentication,omitempty"`
	EncryptionAtRest *bool  `yaml:"encryptionAtRest,omitempty" json:"encryptionAtRest,omitempty"`
	PublicAccess     *bool  `yaml:"publicAccess,omitempty" json:"publicAccess,omitempty"`
	Logging          *bool  `yaml:"logging,omitempty" json:"logging,omitempty"`
	RateLimiting     *bool  `yaml:"rateLimiting,omitempty" json:"rateLimiting,omitempty"`
	Privileged       *bool  `yaml:"privileged,omitempty" json:"privileged,omitempty"`
	HardcodedSecrets *bool  `yaml:"hardcodedSecrets,omitempty" json:"hardcodedSecrets,omitempty"`
	Image            string `yaml:"image,omitempty" json:"image,omitempty"`
}

// DataFlow is a directed flow of data between two components.
type DataFlow struct {
	ID            string   `yaml:"id" json:"id"`
	Name          string   `yaml:"name,omitempty" json:"name,omitempty"`
	From          string   `yaml:"from" json:"from"`
	To            string   `yaml:"to" json:"to"`
	Protocol      string   `yaml:"protocol,omitempty" json:"protocol,omitempty"`
	Encrypted     *bool    `yaml:"encrypted,omitempty" json:"encrypted,omitempty"`
	Authenticated *bool    `yaml:"authenticated,omitempty" json:"authenticated,omitempty"`
	Data          []string `yaml:"data,omitempty" json:"data,omitempty"`
	Description   string   `yaml:"description,omitempty" json:"description,omitempty"`
}

// Suppression accepts a threat (or all threats of a rule) with a reason.
type Suppression struct {
	Rule    string `yaml:"rule" json:"rule"`
	Target  string `yaml:"target,omitempty" json:"target,omitempty"`
	Reason  string `yaml:"reason" json:"reason"`
	Expires string `yaml:"expires,omitempty" json:"expires,omitempty"`
}

// Line returns the line where the element of the given kind ("component",
// "flow", "zone", "data") and id is declared, or 0 if unknown.
func (m *Model) Line(kind, id string) int {
	return m.Location(kind, id).Line
}

// Location returns where the element is declared. File is empty if unknown.
func (m *Model) Location(kind, id string) Location {
	return m.locs[kind+":"+id]
}

// SetLocation records where an element is declared. Extractors call it for
// the elements they produce, with file relative to their source root.
func (m *Model) SetLocation(kind, id, file string, line int) {
	m.setLoc(kind+":"+id, Location{File: file, Line: line})
}

func (m *Model) setLoc(key string, loc Location) {
	if m.locs == nil {
		m.locs = map[string]Location{}
	}
	m.locs[key] = loc
}

// Bool returns a pointer to b; handy for building models in code.
func Bool(b bool) *bool { return &b }
