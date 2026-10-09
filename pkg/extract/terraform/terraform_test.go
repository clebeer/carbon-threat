package terraform

import (
	"os"
	"sort"
	"strings"
	"testing"

	"github.com/clebeer/carbon-threat/pkg/engine"
	"github.com/clebeer/carbon-threat/pkg/model"
	"github.com/clebeer/carbon-threat/rules"
)

func extractFixture(t *testing.T) (*model.Model, []string) {
	t.Helper()
	m, warnings, err := Extract(os.DirFS("testdata"), "aws")
	if err != nil {
		t.Fatal(err)
	}
	return m, warnings
}

func TestComponents(t *testing.T) {
	m, warnings := extractFixture(t)
	if len(warnings) != 1 || !strings.Contains(warnings[0], `module "vpc" is not followed`) {
		t.Errorf("warnings = %v", warnings)
	}
	byID := map[string]model.Component{}
	for _, c := range m.Components {
		byID[c.ID] = c
	}
	type want struct {
		typ, zone, tech string
	}
	cases := map[string]want{
		"internet":                                {model.TypeExternalEntity, "internet", ""},
		"aws_db_instance.orders":                  {model.TypeDatastore, "aws-public", "postgres"},
		"aws_s3_bucket.uploads":                   {model.TypeDatastore, "aws-private", "s3"},
		"aws_s3_bucket.assets":                    {model.TypeDatastore, "aws-private", "s3"},
		"aws_dynamodb_table.sessions":             {model.TypeDatastore, "aws-private", "dynamodb"},
		"aws_elasticache_replication_group.cache": {model.TypeDatastore, "aws-private", "redis"},
		"aws_lambda_function.api":                 {model.TypeProcess, "aws-private", "aws-lambda"},
		"aws_apigatewayv2_api.http":               {model.TypeProcess, "aws-public", "aws-api-gateway"},
		"aws_instance.web":                        {model.TypeProcess, "aws-public", "ec2"},
		"aws_lb.web":                              {model.TypeProcess, "aws-public", "aws-load-balancer"},
	}
	for id, w := range cases {
		c, ok := byID[id]
		if !ok {
			t.Errorf("missing %s", id)
			continue
		}
		if c.Type != w.typ || c.TrustZone != w.zone || c.Technology != w.tech {
			t.Errorf("%s: got %s/%s/%s, want %s/%s/%s", id, c.Type, c.TrustZone, c.Technology, w.typ, w.zone, w.tech)
		}
	}
	if len(byID) != len(cases) {
		t.Errorf("got %d components, want %d (count = 0 resources and glue resources must be skipped)", len(byID), len(cases))
	}

	isTrue := func(b *bool) bool { return b != nil && *b }
	isFalse := func(b *bool) bool { return b != nil && !*b }
	checks := []struct {
		name string
		ok   bool
	}{
		{"rds storage_encrypted defaults to false", isFalse(byID["aws_db_instance.orders"].Properties.EncryptionAtRest)},
		{"password from a variable default is hardcoded", isTrue(byID["aws_db_instance.orders"].Properties.HardcodedSecrets)},
		{"literal API_KEY in lambda environment is hardcoded", isTrue(byID["aws_lambda_function.api"].Properties.HardcodedSecrets)},
		{"public-read ACL makes uploads public", isTrue(byID["aws_s3_bucket.uploads"].Properties.PublicAccess)},
		{"public access block wins over the ACL", isFalse(byID["aws_s3_bucket.assets"].Properties.PublicAccess)},
		{"S3 encrypts by default", isTrue(byID["aws_s3_bucket.uploads"].Properties.EncryptionAtRest)},
		{"elasticache at-rest encryption defaults to false", isFalse(byID["aws_elasticache_replication_group.cache"].Properties.EncryptionAtRest)},
		{"API without route authorization", byID["aws_apigatewayv2_api.http"].Properties.Authentication == "none"},
	}
	for _, c := range checks {
		if !c.ok {
			t.Error(c.name)
		}
	}
	if loc := m.Location("component", "aws_db_instance.orders"); loc.File != "aws/main.tf" || loc.Line != 32 {
		t.Errorf("location = %+v, want aws/main.tf:32", loc)
	}
}

func TestFlows(t *testing.T) {
	m, _ := extractFixture(t)
	got := map[string]string{}
	for _, f := range m.DataFlows {
		got[f.ID] = f.Protocol
	}
	want := map[string]string{
		"internet-to-aws_apigatewayv2_api.http-443":                   "https",
		"internet-to-aws_db_instance.orders-5432":                     "postgres",
		"internet-to-aws_instance.web-22":                             "ssh",
		"internet-to-aws_lb.web-80":                                   "http",
		"aws_apigatewayv2_api.http-to-aws_lambda_function.api":        "",
		"aws_instance.web-to-aws_elasticache_replication_group.cache": "redis",
		"aws_lambda_function.api-to-aws_db_instance.orders":           "postgres",
		"aws_lambda_function.api-to-aws_dynamodb_table.sessions":      "https",
		"aws_lambda_function.api-to-aws_s3_bucket.uploads":            "https",
		"aws_lb.web-to-aws_instance.web":                              "",
	}
	for id, proto := range want {
		p, ok := got[id]
		if !ok {
			t.Errorf("missing flow %s", id)
		} else if p != proto {
			t.Errorf("%s: protocol %q, want %q", id, p, proto)
		}
	}
	if len(got) != len(want) {
		var ids []string
		for id := range got {
			ids = append(ids, id)
		}
		sort.Strings(ids)
		t.Errorf("got %d flows, want %d: %v", len(got), len(want), ids)
	}
}

func TestThreatsFromExtractedModel(t *testing.T) {
	m, _ := extractFixture(t)
	rs, err := engine.LoadRules(rules.FS(), ".")
	if err != nil {
		t.Fatal(err)
	}
	eng, err := engine.New(rs)
	if err != nil {
		t.Fatal(err)
	}
	ts, err := eng.Analyze(m)
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, th := range ts {
		got = append(got, th.RuleID+" "+th.TargetID)
	}
	sort.Strings(got)
	want := []string{
		"CTM-COMP-002 aws_s3_bucket.uploads",
		"CTM-COMP-003 aws_db_instance.orders",
		"CTM-COMP-003 aws_lambda_function.api",
		"CTM-FLOW-002 internet-to-aws_apigatewayv2_api.http-443",
		"CTM-FLOW-003 internet-to-aws_db_instance.orders-5432",
	}
	if strings.Join(got, "\n") != strings.Join(want, "\n") {
		t.Errorf("threats:\n got: %v\nwant: %v", got, want)
	}
}

func TestDatabaseNotExposedThroughUnrelatedPort(t *testing.T) {
	fsys := mapFS{
		"tf/main.tf": `
resource "aws_security_group" "ssh" {
  ingress {
    from_port   = 22
    to_port     = 22
    cidr_blocks = ["0.0.0.0/0"]
  }
}
resource "aws_db_instance" "db" {
  engine                 = "mysql"
  publicly_accessible    = true
  storage_encrypted      = true
  vpc_security_group_ids = [aws_security_group.ssh.id]
}
`,
	}
	m, _, err := Extract(fsys, "tf")
	if err != nil {
		t.Fatal(err)
	}
	if len(m.DataFlows) != 0 {
		t.Errorf("an SSH-only security group must not expose the database: %+v", m.DataFlows)
	}
}
