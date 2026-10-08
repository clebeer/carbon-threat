package report

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

// SARIF 2.1.0, limited to what GitHub code scanning and most viewers use.

type sarifLog struct {
	Schema  string     `json:"$schema"`
	Version string     `json:"version"`
	Runs    []sarifRun `json:"runs"`
}

type sarifRun struct {
	Tool    sarifTool     `json:"tool"`
	Results []sarifResult `json:"results"`
}

type sarifTool struct {
	Driver sarifDriver `json:"driver"`
}

type sarifDriver struct {
	Name           string      `json:"name"`
	Version        string      `json:"version,omitempty"`
	InformationURI string      `json:"informationUri"`
	Rules          []sarifRule `json:"rules"`
}

type sarifRule struct {
	ID                   string          `json:"id"`
	Name                 string          `json:"name"`
	ShortDescription     sarifText       `json:"shortDescription"`
	FullDescription      sarifText       `json:"fullDescription"`
	Help                 sarifText       `json:"help"`
	HelpURI              string          `json:"helpUri,omitempty"`
	DefaultConfiguration sarifConfig     `json:"defaultConfiguration"`
	Properties           sarifProperties `json:"properties"`
}

type sarifText struct {
	Text string `json:"text"`
}

type sarifConfig struct {
	Level string `json:"level"`
}

type sarifProperties struct {
	Tags             []string `json:"tags"`
	SecuritySeverity string   `json:"security-severity"`
	Precision        string   `json:"precision"`
}

type sarifResult struct {
	RuleID              string            `json:"ruleId"`
	Level               string            `json:"level"`
	Message             sarifText         `json:"message"`
	Locations           []sarifLocation   `json:"locations"`
	PartialFingerprints map[string]string `json:"partialFingerprints"`
	Suppressions        []sarifSuppress   `json:"suppressions,omitempty"`
}

type sarifSuppress struct {
	Kind          string `json:"kind"`
	Justification string `json:"justification,omitempty"`
}

type sarifLocation struct {
	PhysicalLocation sarifPhysical  `json:"physicalLocation"`
	LogicalLocations []sarifLogical `json:"logicalLocations,omitempty"`
}

type sarifPhysical struct {
	ArtifactLocation sarifArtifact `json:"artifactLocation"`
	Region           *sarifRegion  `json:"region,omitempty"`
}

type sarifArtifact struct {
	URI string `json:"uri"`
}

type sarifRegion struct {
	StartLine int `json:"startLine"`
}

type sarifLogical struct {
	Name string `json:"name"`
	Kind string `json:"kind"`
}

// GitHub maps security-severity to critical (>= 9.0), high (>= 7.0),
// medium (>= 4.0) and low.
var securitySeverity = map[string]string{
	"critical": "9.5", "high": "8.0", "medium": "5.5", "low": "3.0", "info": "1.0",
}

var sarifLevel = map[string]string{
	"critical": "error", "high": "error", "medium": "warning", "low": "note", "info": "note",
}

func writeSARIF(w io.Writer, in Input) error {
	results := in.Threats
	if in.IsDiff {
		results = in.Added
	}
	used := map[string]bool{}
	for _, t := range results {
		used[t.RuleID] = true
	}
	var rules []sarifRule
	for _, r := range in.Rules {
		if !used[r.ID] {
			continue
		}
		tags := []string{"security", "threat-model"}
		for _, s := range r.Stride {
			tags = append(tags, "stride/"+s)
		}
		for _, c := range r.CWE {
			tags = append(tags, fmt.Sprintf("external/cwe/cwe-%d", c))
		}
		help := strings.TrimSpace(r.Mitigation)
		rules = append(rules, sarifRule{
			ID:                   r.ID,
			Name:                 ruleName(r.Title),
			ShortDescription:     sarifText{Text: r.Title},
			FullDescription:      sarifText{Text: strings.TrimSpace(r.Description)},
			Help:                 sarifText{Text: help},
			DefaultConfiguration: sarifConfig{Level: sarifLevel[r.Severity]},
			Properties: sarifProperties{
				Tags:             tags,
				SecuritySeverity: securitySeverity[r.Severity],
				Precision:        "high",
			},
		})
	}

	out := make([]sarifResult, 0, len(results))
	for _, t := range results {
		loc := sarifLocation{
			PhysicalLocation: sarifPhysical{ArtifactLocation: sarifArtifact{URI: in.ModelPath}},
			LogicalLocations: []sarifLogical{{Name: t.TargetID, Kind: t.TargetKind}},
		}
		if t.Line > 0 {
			loc.PhysicalLocation.Region = &sarifRegion{StartLine: t.Line}
		}
		res := sarifResult{
			RuleID:              t.RuleID,
			Level:               sarifLevel[t.Severity],
			Message:             sarifText{Text: t.Message},
			Locations:           []sarifLocation{loc},
			PartialFingerprints: map[string]string{"ctmThreat/v1": t.Fingerprint},
		}
		if t.Suppressed {
			res.Suppressions = []sarifSuppress{{Kind: "inSource", Justification: t.SuppressionReason}}
		}
		out = append(out, res)
	}

	log := sarifLog{
		Schema:  "https://json.schemastore.org/sarif-2.1.0.json",
		Version: "2.1.0",
		Runs: []sarifRun{{
			Tool: sarifTool{Driver: sarifDriver{
				Name:           "ctm",
				Version:        in.ToolVersion,
				InformationURI: "https://github.com/clebeer/carbon-threat",
				Rules:          nonNilRules(rules),
			}},
			Results: out,
		}},
	}
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(log)
}

func nonNilRules(r []sarifRule) []sarifRule {
	if r == nil {
		return []sarifRule{}
	}
	return r
}

// ruleName turns a title into a PascalCase identifier, as SARIF expects.
func ruleName(title string) string {
	var b strings.Builder
	for _, word := range strings.FieldsFunc(title, func(r rune) bool {
		return (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9')
	}) {
		b.WriteString(strings.ToUpper(word[:1]) + word[1:])
	}
	return b.String()
}
