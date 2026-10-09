// Package terraform builds a ctm/v1 model from Terraform code (AWS provider).
//
// It parses the .tf files of one directory (the root module) statically:
// variables (defaults, terraform.tfvars, *.auto.tfvars) and locals are
// evaluated, but nothing is planned or applied, and module calls are not
// followed. Like every extractor it records only facts the code states (or
// that are documented provider/AWS defaults) and never classifies data.
package terraform

import (
	"fmt"
	"io/fs"
	"math/big"
	"path"
	"sort"
	"strings"

	"github.com/clebeer/carbon-threat/pkg/extract/internal/secrets"
	"github.com/clebeer/carbon-threat/pkg/model"
	"github.com/hashicorp/hcl/v2"
	"github.com/hashicorp/hcl/v2/hclparse"
	"github.com/hashicorp/hcl/v2/hclsyntax"
	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/function"
	"github.com/zclconf/go-cty/cty/function/stdlib"
)

func init() {
	model.RegisterExtractor("terraform", Extract)
}

// Trust levels of the zones the extractor creates.
const (
	internetTrust = 0
	publicTrust   = 30
	privateTrust  = 70
)

// resource is a parsed "resource" block.
type resource struct {
	typ, name string
	body      *hclsyntax.Body
	file      string
	line      int
	refs      map[string]bool // addresses (type.name) referenced anywhere in the body
}

func (r *resource) addr() string { return r.typ + "." + r.name }

// id is the component id: the lower-cased resource address, which is
// already valid in ctm/v1 (letters, digits, '_', '.', '-').
func (r *resource) id() string { return strings.ToLower(r.addr()) }

type extractor struct {
	ctx       *hcl.EvalContext
	resources []*resource
	byAddr    map[string]*resource
	warnings  []string
}

// Extract parses the .tf files in dir (relative to fsys).
func Extract(fsys fs.FS, dir string) (*model.Model, []string, error) {
	entries, err := fs.ReadDir(fsys, dir)
	if err != nil {
		return nil, nil, err
	}
	parser := hclparse.NewParser()
	var bodies []*hclsyntax.Body
	var files []string
	var tfvars []*hclsyntax.Body
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() {
			continue
		}
		isTF := strings.HasSuffix(name, ".tf")
		isVars := name == "terraform.tfvars" || strings.HasSuffix(name, ".auto.tfvars")
		if !isTF && !isVars {
			continue
		}
		p := path.Join(dir, name)
		src, err := fs.ReadFile(fsys, p)
		if err != nil {
			return nil, nil, err
		}
		f, diags := parser.ParseHCL(src, p)
		if diags.HasErrors() {
			return nil, nil, fmt.Errorf("%s", diags.Error())
		}
		body, ok := f.Body.(*hclsyntax.Body)
		if !ok {
			continue
		}
		if isVars {
			tfvars = append(tfvars, body)
		} else {
			bodies = append(bodies, body)
			files = append(files, p)
		}
	}
	if len(bodies) == 0 {
		return nil, nil, fmt.Errorf("no .tf files in %s", dir)
	}

	x := &extractor{byAddr: map[string]*resource{}}
	x.buildContext(bodies, tfvars)
	for i, body := range bodies {
		for _, blk := range body.Blocks {
			switch blk.Type {
			case "resource":
				if len(blk.Labels) != 2 {
					continue
				}
				r := &resource{typ: blk.Labels[0], name: blk.Labels[1], body: blk.Body, file: files[i], line: blk.DefRange().Start.Line}
				if n, ok := x.number(blk.Body, "count"); ok && n == 0 {
					continue // count = 0: not created
				}
				r.refs = references(blk.Body)
				x.resources = append(x.resources, r)
				x.byAddr[r.addr()] = r
			case "module":
				if len(blk.Labels) == 1 {
					x.warnings = append(x.warnings, fmt.Sprintf("module %q is not followed; only resources of this directory are extracted", blk.Labels[0]))
				}
			}
		}
	}
	m := x.build()
	return m, x.warnings, nil
}

// buildContext evaluates variables (defaults overridden by tfvars) and
// locals so that attribute values using them can be known.
func (x *extractor) buildContext(bodies, tfvars []*hclsyntax.Body) {
	vars := map[string]cty.Value{}
	for _, body := range bodies {
		for _, blk := range body.Blocks {
			if blk.Type != "variable" || len(blk.Labels) != 1 {
				continue
			}
			val := cty.DynamicVal
			if a, ok := blk.Body.Attributes["default"]; ok {
				if v, diags := a.Expr.Value(nil); !diags.HasErrors() {
					val = v
				}
			}
			vars[blk.Labels[0]] = val
		}
	}
	for _, body := range tfvars {
		for name, a := range body.Attributes {
			if v, diags := a.Expr.Value(nil); !diags.HasErrors() {
				vars[name] = v
			}
		}
	}
	x.ctx = &hcl.EvalContext{
		Variables: map[string]cty.Value{"var": cty.ObjectVal(vars)},
		Functions: map[string]function.Function{
			"jsonencode": stdlib.JSONEncodeFunc,
			"lower":      stdlib.LowerFunc,
			"upper":      stdlib.UpperFunc,
			"format":     stdlib.FormatFunc,
			"join":       stdlib.JoinFunc,
			"concat":     stdlib.ConcatFunc,
			"coalesce":   stdlib.CoalesceFunc,
			"merge":      stdlib.MergeFunc,
		},
	}

	// Locals may refer to each other; evaluate until nothing changes.
	pending := map[string]hclsyntax.Expression{}
	for _, body := range bodies {
		for _, blk := range body.Blocks {
			if blk.Type == "locals" {
				for name, a := range blk.Body.Attributes {
					pending[name] = a.Expr
				}
			}
		}
	}
	locals := map[string]cty.Value{}
	for name := range pending {
		locals[name] = cty.DynamicVal
	}
	for pass := 0; pass < len(pending)+1; pass++ {
		x.ctx.Variables["local"] = cty.ObjectVal(locals)
		changed := false
		for name, expr := range pending {
			v, diags := expr.Value(x.ctx)
			if diags.HasErrors() || !v.IsWhollyKnown() {
				continue
			}
			locals[name] = v
			delete(pending, name)
			changed = true
		}
		if !changed {
			break
		}
	}
	x.ctx.Variables["local"] = cty.ObjectVal(locals)
}

// value evaluates an attribute; ok is false when it is absent or unknown
// (e.g. it depends on another resource or on a variable without value).
func (x *extractor) value(body *hclsyntax.Body, name string) (cty.Value, bool) {
	a, present := body.Attributes[name]
	if !present {
		return cty.NilVal, false
	}
	v, diags := a.Expr.Value(x.ctx)
	if diags.HasErrors() || !v.IsWhollyKnown() || v.IsNull() {
		return cty.NilVal, false
	}
	return v, true
}

func (x *extractor) str(body *hclsyntax.Body, name string) (string, bool) {
	v, ok := x.value(body, name)
	if !ok || v.Type() != cty.String {
		return "", false
	}
	return v.AsString(), true
}

func (x *extractor) boolean(body *hclsyntax.Body, name string) (bool, bool) {
	v, ok := x.value(body, name)
	if !ok || v.Type() != cty.Bool {
		return false, false
	}
	return v.True(), true
}

// boolOr returns the attribute, or def when the attribute is absent. An
// attribute that is present but unknown yields ok=false.
func (x *extractor) boolOr(body *hclsyntax.Body, name string, def bool) (bool, bool) {
	if _, present := body.Attributes[name]; !present {
		return def, true
	}
	return x.boolean(body, name)
}

func (x *extractor) number(body *hclsyntax.Body, name string) (int64, bool) {
	v, ok := x.value(body, name)
	if !ok || v.Type() != cty.Number {
		return 0, false
	}
	n, acc := v.AsBigFloat().Int64()
	return n, acc == big.Exact
}

func (x *extractor) strList(body *hclsyntax.Body, name string) []string {
	v, ok := x.value(body, name)
	if !ok {
		return nil
	}
	if t := v.Type(); !t.IsListType() && !t.IsSetType() && !t.IsTupleType() {
		return nil
	}
	var out []string
	for it := v.ElementIterator(); it.Next(); {
		_, e := it.Element()
		if e.IsKnown() && !e.IsNull() && e.Type() == cty.String {
			out = append(out, e.AsString())
		}
	}
	return out
}

// knownItems evaluates an object attribute item by item and returns the
// items whose key and value are known. A map that mixes literals with
// references to other resources is unknown as a whole, but its literal
// items are still facts.
func (x *extractor) knownItems(body *hclsyntax.Body, name string) map[string]cty.Value {
	out := map[string]cty.Value{}
	a, ok := body.Attributes[name]
	if !ok {
		return out
	}
	obj, ok := a.Expr.(*hclsyntax.ObjectConsExpr)
	if !ok {
		if v, ok := x.value(body, name); ok && (v.Type().IsObjectType() || v.Type().IsMapType()) {
			for it := v.ElementIterator(); it.Next(); {
				k, val := it.Element()
				out[k.AsString()] = val
			}
		}
		return out
	}
	for _, item := range obj.Items {
		k, diags := item.KeyExpr.Value(x.ctx)
		if diags.HasErrors() || !k.IsKnown() || k.IsNull() || k.Type() != cty.String {
			continue
		}
		v, diags := item.ValueExpr.Value(x.ctx)
		if diags.HasErrors() || !v.IsWhollyKnown() || v.IsNull() {
			continue
		}
		out[k.AsString()] = v
	}
	return out
}

// references collects every resource address referenced in a body.
func references(body *hclsyntax.Body) map[string]bool {
	out := map[string]bool{}
	var walk func(b *hclsyntax.Body)
	walk = func(b *hclsyntax.Body) {
		for _, a := range b.Attributes {
			for _, t := range a.Expr.Variables() {
				root := t.RootName()
				if root == "var" || root == "local" || root == "data" || root == "module" || root == "each" || root == "count" || root == "path" || root == "terraform" || root == "self" {
					continue
				}
				if len(t) > 1 {
					if attr, ok := t[1].(hcl.TraverseAttr); ok {
						out[root+"."+attr.Name] = true
					}
				}
			}
		}
		for _, blk := range b.Blocks {
			walk(blk.Body)
		}
	}
	walk(body)
	return out
}

// refersTo returns the resources of the given types that r references.
func (x *extractor) refersTo(r *resource, types ...string) []*resource {
	var out []*resource
	for addr := range r.refs {
		if t, ok := x.byAddr[addr]; ok {
			for _, typ := range types {
				if t.typ == typ {
					out = append(out, t)
				}
			}
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].addr() < out[j].addr() })
	return out
}

// referencedBy returns the resources of the given types that reference r.
func (x *extractor) referencedBy(r *resource, types ...string) []*resource {
	var out []*resource
	for _, o := range x.resources {
		if !o.refs[r.addr()] {
			continue
		}
		for _, typ := range types {
			if o.typ == typ {
				out = append(out, o)
			}
		}
	}
	return out
}

func blocks(body *hclsyntax.Body, typ string) []*hclsyntax.Block {
	var out []*hclsyntax.Block
	for _, b := range body.Blocks {
		if b.Type == typ {
			out = append(out, b)
		}
	}
	return out
}

func isOpenCIDR(c string) bool { return c == "0.0.0.0/0" || c == "::/0" }

// openPorts returns the ports a security group opens to the whole internet
// (inline ingress blocks and standalone rule resources). A port of -1 means
// "all ports".
func (x *extractor) openPorts(sg *resource) []int64 {
	var ports []int64
	add := func(body *hclsyntax.Body, cidrAttrs ...string) {
		open := false
		for _, a := range cidrAttrs {
			if s, ok := x.str(body, a); ok && isOpenCIDR(s) {
				open = true
			}
			for _, c := range x.strList(body, a) {
				if isOpenCIDR(c) {
					open = true
				}
			}
		}
		if !open {
			return
		}
		from, okFrom := x.number(body, "from_port")
		to, okTo := x.number(body, "to_port")
		if !okFrom || !okTo || from != to || from <= 0 {
			ports = append(ports, -1)
			return
		}
		ports = append(ports, from)
	}
	for _, b := range blocks(sg.body, "ingress") {
		add(b.Body, "cidr_blocks", "ipv6_cidr_blocks")
	}
	for _, rule := range x.referencedBy(sg, "aws_security_group_rule") {
		if t, ok := x.str(rule.body, "type"); ok && t == "ingress" {
			add(rule.body, "cidr_blocks", "ipv6_cidr_blocks")
		}
	}
	for _, rule := range x.referencedBy(sg, "aws_vpc_security_group_ingress_rule") {
		add(rule.body, "cidr_ipv4", "cidr_ipv6")
	}
	return ports
}

// exposure decides whether a publicly addressable resource is reachable from
// the internet given its security groups: known=false means no security
// group could be resolved.
func (x *extractor) exposure(r *resource) (ports []int64, known bool) {
	sgs := x.refersTo(r, "aws_security_group")
	if len(sgs) == 0 {
		return nil, false
	}
	for _, sg := range sgs {
		ports = append(ports, x.openPorts(sg)...)
	}
	return ports, true
}

var dbProtocols = map[string]string{
	"postgres": "postgres", "aurora-postgresql": "postgres",
	"mysql": "mysql", "mariadb": "mysql", "aurora-mysql": "mysql", "aurora": "mysql",
	"sqlserver-ee": "tds", "sqlserver-se": "tds", "sqlserver-ex": "tds", "sqlserver-web": "tds",
	"oracle-ee": "oracle", "oracle-se2": "oracle",
}

var defaultPorts = map[string]int64{"postgres": 5432, "mysql": 3306, "tds": 1433, "oracle": 1521}

// portProtocols names well-known ports opened on instances.
var portProtocols = map[int64]string{22: "ssh", 80: "http", 443: "https", 3389: "rdp", 8080: "http", 8443: "https"}

// draft is a component plus what the flow builder needs to know about it.
type draft struct {
	res      *resource
	comp     model.Component
	protocol string // protocol clients use to reach it
	// internet exposure: ports (or -1) and protocol per port
	exposed  []int64
	expProto map[int64]string
	expAuth  *bool // whether internet flows are authenticated
}

func (x *extractor) build() *model.Model {
	var drafts []*draft
	byAddr := map[string]*draft{}
	add := func(r *resource, typ, tech string) *draft {
		d := &draft{res: r, comp: model.Component{
			ID: r.id(), Name: r.name, Type: typ, Technology: tech, TrustZone: "aws-private",
		}}
		drafts = append(drafts, d)
		byAddr[r.addr()] = d
		return d
	}

	for _, r := range x.resources {
		switch r.typ {
		case "aws_db_instance", "aws_rds_cluster", "aws_rds_cluster_instance":
			engine, _ := x.str(r.body, "engine")
			d := add(r, model.TypeDatastore, engine)
			d.protocol = dbProtocols[engine]
			if r.typ != "aws_rds_cluster_instance" {
				// Provider default: storage_encrypted = false.
				if enc, ok := x.boolOr(r.body, "storage_encrypted", false); ok {
					d.comp.Properties.EncryptionAtRest = model.Bool(enc)
				}
			}
			x.markSecrets(d, r.body, "password", "master_password")
			if public, ok := x.boolean(r.body, "publicly_accessible"); ok && public {
				port := defaultPorts[d.protocol]
				if p, ok := x.number(r.body, "port"); ok {
					port = p
				}
				ports, known := x.exposure(r)
				if !known {
					ports = []int64{port}
					x.warnings = append(x.warnings, fmt.Sprintf("%s is publicly accessible and its security groups could not be resolved; assuming it is reachable from the internet", r.addr()))
				}
				// Only the database port (or an all-ports rule) exposes it.
				for _, p := range ports {
					if p == -1 || p == port {
						d.exposed = append(d.exposed, port)
						break
					}
				}
			}
		case "aws_s3_bucket":
			d := add(r, model.TypeDatastore, "s3")
			// Since January 2023 S3 encrypts every new object (SSE-S3).
			d.comp.Properties.EncryptionAtRest = model.Bool(true)
			d.protocol = "https"
			d.comp.Properties.PublicAccess = x.bucketPublic(r)
		case "aws_dynamodb_table":
			d := add(r, model.TypeDatastore, "dynamodb")
			d.comp.Properties.EncryptionAtRest = model.Bool(true) // always encrypted at rest
			d.protocol = "https"
		case "aws_elasticache_replication_group", "aws_elasticache_cluster":
			engine, ok := x.str(r.body, "engine")
			if !ok {
				engine = "redis"
			}
			d := add(r, model.TypeDatastore, engine)
			if r.typ == "aws_elasticache_replication_group" {
				if enc, ok := x.boolOr(r.body, "at_rest_encryption_enabled", false); ok {
					d.comp.Properties.EncryptionAtRest = model.Bool(enc)
				}
				if tls, ok := x.boolOr(r.body, "transit_encryption_enabled", false); ok {
					d.protocol = map[bool]string{true: "rediss", false: "redis"}[tls]
				}
				x.markSecrets(d, r.body, "auth_token")
			} else {
				d.protocol = engine
			}
		case "aws_sqs_queue", "aws_sns_topic":
			d := add(r, model.TypeDatastore, strings.TrimPrefix(strings.TrimSuffix(r.typ, "_queue"), "aws_"))
			if strings.HasSuffix(r.typ, "_topic") {
				d.comp.Technology = "sns"
			}
			d.protocol = "https"
			if _, ok := x.str(r.body, "kms_master_key_id"); ok {
				d.comp.Properties.EncryptionAtRest = model.Bool(true)
			} else if sse, ok := x.boolean(r.body, "sqs_managed_sse_enabled"); ok {
				d.comp.Properties.EncryptionAtRest = model.Bool(sse)
			}
		case "aws_lambda_function":
			d := add(r, model.TypeProcess, "aws-lambda")
			for _, env := range blocks(r.body, "environment") {
				for k, v := range x.knownItems(env.Body, "variables") {
					if v.Type() == cty.String && secrets.Hardcoded(k, v.AsString()) {
						d.comp.Properties.HardcodedSecrets = model.Bool(true)
					}
				}
			}
		case "aws_instance":
			d := add(r, model.TypeProcess, "ec2")
			if public, ok := x.boolean(r.body, "associate_public_ip_address"); ok && public {
				if ports, known := x.exposure(r); known {
					d.exposed = ports
					d.expProto = map[int64]string{}
					for _, p := range ports {
						d.expProto[p] = portProtocols[p]
					}
				}
			}
		case "aws_ecs_service":
			add(r, model.TypeProcess, "ecs")
		case "aws_lb", "aws_alb":
			d := add(r, model.TypeProcess, "aws-load-balancer")
			// Provider default: internal = false (internet-facing).
			if internal, ok := x.boolOr(r.body, "internal", false); ok && !internal {
				d.expProto = map[int64]string{}
				for _, l := range x.referencedBy(r, "aws_lb_listener", "aws_alb_listener") {
					port, _ := x.number(l.body, "port")
					proto, _ := x.str(l.body, "protocol")
					d.exposed = append(d.exposed, port)
					d.expProto[port] = strings.ToLower(proto)
				}
				if len(d.exposed) == 0 {
					d.exposed = []int64{-1}
				}
			}
		case "aws_apigatewayv2_api", "aws_api_gateway_rest_api":
			d := add(r, model.TypeProcess, "aws-api-gateway")
			d.exposed = []int64{443}
			d.expProto = map[int64]string{443: "https"}
			if auth, ok := x.apiAuthentication(r); ok {
				d.comp.Properties.Authentication = auth
				d.expAuth = model.Bool(auth != "none")
			}
		}
	}

	// Lambda function URLs make functions reachable from the internet.
	for _, r := range x.resources {
		if r.typ != "aws_lambda_function_url" {
			continue
		}
		for _, fn := range x.refersTo(r, "aws_lambda_function") {
			d := byAddr[fn.addr()]
			d.exposed = []int64{443}
			d.expProto = map[int64]string{443: "https"}
			if t, ok := x.str(r.body, "authorization_type"); ok {
				auth := map[string]string{"NONE": "none", "AWS_IAM": "iam"}[t]
				if auth != "" {
					d.comp.Properties.Authentication = auth
					d.expAuth = model.Bool(auth != "none")
				}
			}
		}
	}

	m := &model.Model{APIVersion: model.APIVersion, Kind: model.Kind, Metadata: model.Metadata{Name: "terraform"}}
	anyExposed := false
	for _, d := range drafts {
		if len(d.exposed) > 0 {
			anyExposed = true
			d.comp.TrustZone = "aws-public"
		}
	}
	if anyExposed {
		m.TrustZones = append(m.TrustZones,
			model.TrustZone{ID: "internet", Name: "Internet", Trust: internetTrust},
			model.TrustZone{ID: "aws-public", Name: "AWS (internet-facing)", Trust: publicTrust})
		m.Components = append(m.Components, model.Component{ID: "internet", Name: "Internet clients", Type: model.TypeExternalEntity, TrustZone: "internet"})
	}
	m.TrustZones = append(m.TrustZones, model.TrustZone{ID: "aws-private", Name: "AWS (private)", Trust: privateTrust})

	for _, d := range drafts {
		m.Components = append(m.Components, d.comp)
		m.SetLocation("component", d.comp.ID, d.res.file, d.res.line)
	}

	seen := map[string]bool{}
	addFlow := func(f model.DataFlow, at *resource) {
		if seen[f.ID] {
			return
		}
		seen[f.ID] = true
		m.DataFlows = append(m.DataFlows, f)
		m.SetLocation("flow", f.ID, at.file, at.line)
	}
	for _, d := range drafts {
		for _, port := range d.exposed {
			id := "internet-to-" + d.comp.ID
			if port > 0 {
				id += fmt.Sprintf("-%d", port)
			}
			proto := d.protocol
			if p, ok := d.expProto[port]; ok && p != "" {
				proto = p
			}
			addFlow(model.DataFlow{ID: id, From: "internet", To: d.comp.ID, Protocol: proto, Authenticated: d.expAuth}, d.res)
		}
	}
	// A process (or gateway) that references another modeled resource talks
	// to it: environment variables, integrations, target groups, ...
	for _, d := range drafts {
		if d.comp.Type != model.TypeProcess {
			continue
		}
		for _, target := range x.flowTargets(d.res) {
			t := byAddr[target.addr()]
			if t == nil || t == d {
				continue
			}
			addFlow(model.DataFlow{ID: d.comp.ID + "-to-" + t.comp.ID, From: d.comp.ID, To: t.comp.ID, Protocol: t.protocol}, d.res)
		}
	}
	return m
}

// flowTargets resolves the resources a process sends data to, following
// glue resources (integrations, listeners, target groups) where needed.
func (x *extractor) flowTargets(r *resource) []*resource {
	var out []*resource
	for addr := range r.refs {
		if t, ok := x.byAddr[addr]; ok {
			out = append(out, t)
		}
	}
	switch r.typ {
	case "aws_apigatewayv2_api", "aws_api_gateway_rest_api":
		for _, integ := range x.referencedBy(r, "aws_apigatewayv2_integration", "aws_api_gateway_integration") {
			out = append(out, x.refersTo(integ, "aws_lambda_function")...)
		}
	case "aws_lb", "aws_alb":
		for _, l := range x.referencedBy(r, "aws_lb_listener", "aws_alb_listener") {
			for _, tg := range x.refersTo(l, "aws_lb_target_group", "aws_alb_target_group") {
				for _, att := range x.referencedBy(tg, "aws_lb_target_group_attachment", "aws_alb_target_group_attachment") {
					out = append(out, x.refersTo(att, "aws_instance", "aws_lambda_function")...)
				}
				out = append(out, x.referencedBy(tg, "aws_ecs_service")...)
			}
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].addr() < out[j].addr() })
	return out
}

// bucketPublic decides whether a bucket is publicly readable: a public ACL
// that no public access block neutralizes.
func (x *extractor) bucketPublic(r *resource) *bool {
	for _, pab := range x.referencedBy(r, "aws_s3_bucket_public_access_block") {
		blockACLs, ok1 := x.boolean(pab.body, "block_public_acls")
		ignoreACLs, ok2 := x.boolean(pab.body, "ignore_public_acls")
		blockPolicy, ok3 := x.boolean(pab.body, "block_public_policy")
		restrict, ok4 := x.boolean(pab.body, "restrict_public_buckets")
		if ok1 && ok2 && ok3 && ok4 && blockACLs && ignoreACLs && blockPolicy && restrict {
			return model.Bool(false)
		}
	}
	acls := []string{}
	if a, ok := x.str(r.body, "acl"); ok {
		acls = append(acls, a)
	}
	for _, aclRes := range x.referencedBy(r, "aws_s3_bucket_acl") {
		if a, ok := x.str(aclRes.body, "acl"); ok {
			acls = append(acls, a)
		}
	}
	for _, a := range acls {
		if a == "public-read" || a == "public-read-write" {
			return model.Bool(true)
		}
	}
	return nil
}

// apiAuthentication returns "none" when every route/method of the API is
// unauthenticated, another value when all are authenticated, ok=false when
// mixed or unknown.
func (x *extractor) apiAuthentication(api *resource) (string, bool) {
	var kinds []string
	for _, rt := range x.referencedBy(api, "aws_apigatewayv2_route") {
		k, ok := x.str(rt.body, "authorization_type")
		if !ok {
			k = "NONE" // provider default
		}
		kinds = append(kinds, k)
	}
	for _, mt := range x.referencedBy(api, "aws_api_gateway_method") {
		k, ok := x.str(mt.body, "authorization")
		if !ok {
			return "", false
		}
		kinds = append(kinds, k)
	}
	if len(kinds) == 0 {
		return "", false
	}
	none := 0
	for _, k := range kinds {
		if k == "NONE" {
			none++
		}
	}
	switch none {
	case len(kinds):
		return "none", true
	case 0:
		if kinds[0] == "AWS_IAM" {
			return "iam", true
		}
		return "other", true
	}
	return "", false
}

// markSecrets flags credentials whose value is a literal in the code
// (including a variable default or a committed tfvars value).
func (x *extractor) markSecrets(d *draft, body *hclsyntax.Body, attrs ...string) {
	for _, a := range attrs {
		if v, ok := x.str(body, a); ok && v != "" && !secrets.IsReference(v) {
			d.comp.Properties.HardcodedSecrets = model.Bool(true)
		}
	}
}
