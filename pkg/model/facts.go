package model

import "strings"

// Protocols whose encryption status is known when a flow omits "encrypted".
var (
	encryptedProtocols = map[string]bool{
		"https": true, "tls": true, "mtls": true, "wss": true, "grpcs": true,
		"ssh": true, "sftp": true, "ftps": true, "ldaps": true, "smtps": true,
		"imaps": true, "amqps": true, "mqtts": true, "rediss": true,
	}
	plaintextProtocols = map[string]bool{
		"http": true, "ws": true, "ftp": true, "telnet": true, "ldap": true,
		"smtp": true, "imap": true, "pop3": true, "amqp": true, "mqtt": true,
		"redis": true, "memcached": true, "snmp": true,
	}
)

// FlowEncrypted reports whether a flow is encrypted: the explicit value if
// set, otherwise what the protocol implies, otherwise unknown (nil).
func FlowEncrypted(f DataFlow) *bool {
	if f.Encrypted != nil {
		return f.Encrypted
	}
	p := strings.ToLower(f.Protocol)
	switch {
	case encryptedProtocols[p]:
		return Bool(true)
	case plaintextProtocols[p]:
		return Bool(false)
	}
	return nil
}

// Facts is the model flattened into the maps that rule expressions see.
// Unknown facts are left out of the maps, so rules test them with has().
type Facts struct {
	Model      map[string]any
	Components map[string]map[string]any // by component id
	Flows      []map[string]any          // in model order
	FlowIDs    []string
	CompIDs    []string // in model order
}

// BuildFacts derives rule inputs from a validated model.
func BuildFacts(m *Model) *Facts {
	zones := map[string]map[string]any{}
	for _, z := range m.TrustZones {
		name := z.Name
		if name == "" {
			name = z.ID
		}
		zones[z.ID] = map[string]any{
			"id":        z.ID,
			"name":      name,
			"trust":     int64(z.Trust),
			"untrusted": z.Trust < UntrustedBelow,
		}
	}
	data := map[string]map[string]any{}
	rank := map[string]int{}
	for _, d := range m.Data {
		name := d.Name
		if name == "" {
			name = d.ID
		}
		data[d.ID] = map[string]any{
			"id":             d.ID,
			"name":           name,
			"classification": d.Classification,
		}
		rank[d.ID] = ClassificationRank(d.Classification)
	}
	dataList := func(ids []string) ([]any, int64) {
		out := make([]any, 0, len(ids))
		highest := int64(-1)
		for _, id := range ids {
			out = append(out, data[id])
			if r := int64(rank[id]); r > highest {
				highest = r
			}
		}
		return out, highest
	}

	f := &Facts{Components: map[string]map[string]any{}}
	compSensitivity := map[string]int64{}
	exposed := map[string]bool{}
	zoneOf := map[string]string{}
	for _, c := range m.Components {
		zoneOf[c.ID] = c.TrustZone
	}

	for _, fl := range m.DataFlows {
		list, sens := dataList(fl.Data)
		src, dst := zones[zoneOf[fl.From]], zones[zoneOf[fl.To]]
		fm := map[string]any{
			"id":              fl.ID,
			"name":            displayName(fl.Name, fl.From+" → "+fl.To),
			"from":            fl.From,
			"to":              fl.To,
			"protocol":        strings.ToLower(fl.Protocol),
			"data":            list,
			"sensitivity":     sens,
			"crossesBoundary": zoneOf[fl.From] != zoneOf[fl.To],
			"trustDelta":      dst["trust"].(int64) - src["trust"].(int64),
		}
		if enc := FlowEncrypted(fl); enc != nil {
			fm["encrypted"] = *enc
		}
		if fl.Authenticated != nil {
			fm["authenticated"] = *fl.Authenticated
		}
		f.Flows = append(f.Flows, fm)
		f.FlowIDs = append(f.FlowIDs, fl.ID)

		for _, id := range []string{fl.From, fl.To} {
			if s, ok := compSensitivity[id]; !ok || sens > s {
				compSensitivity[id] = sens
			}
		}
		if src["untrusted"].(bool) {
			exposed[fl.To] = true
		}
	}

	for _, c := range m.Components {
		list, sens := dataList(c.Stores)
		if s, ok := compSensitivity[c.ID]; ok && s > sens {
			sens = s
		}
		tags := make([]any, 0, len(c.Tags))
		for _, t := range c.Tags {
			tags = append(tags, t)
		}
		cm := map[string]any{
			"id":          c.ID,
			"name":        displayName(c.Name, c.ID),
			"type":        c.Type,
			"technology":  strings.ToLower(c.Technology),
			"trustZone":   c.TrustZone,
			"zone":        zones[c.TrustZone],
			"tags":        tags,
			"stores":      list,
			"sensitivity": sens,
			"exposed":     exposed[c.ID],
			"properties":  propertiesMap(c.Properties),
		}
		f.Components[c.ID] = cm
		f.CompIDs = append(f.CompIDs, c.ID)
	}

	f.Model = map[string]any{
		"name":        m.Metadata.Name,
		"description": m.Metadata.Description,
	}
	return f
}

func propertiesMap(p Properties) map[string]any {
	out := map[string]any{}
	if p.Authentication != "" {
		out["authentication"] = p.Authentication
	}
	if p.Image != "" {
		out["image"] = p.Image
	}
	for k, v := range map[string]*bool{
		"encryptionAtRest": p.EncryptionAtRest,
		"publicAccess":     p.PublicAccess,
		"logging":          p.Logging,
		"rateLimiting":     p.RateLimiting,
		"privileged":       p.Privileged,
		"hardcodedSecrets": p.HardcodedSecrets,
	} {
		if v != nil {
			out[k] = *v
		}
	}
	return out
}

func displayName(name, fallback string) string {
	if name != "" {
		return name
	}
	return fallback
}
