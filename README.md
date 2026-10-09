# Carbon Threat

**Threat modeling as code.** Carbon Threat builds a threat model from your infrastructure
and code, evaluates it with open, declarative rules, and tells you which threats a pull
request introduces. It runs in CI and needs no server.

> **Status: Phase 1, approaching v0.1.** The CLI works and is tested; signed
> releases are built from `v*` tags. The direction is recorded in
> [ADR 0002](docs/adr/0002-threat-modeling-as-code.md), and the roadmap (in pt-BR)
> is in [docs/strategy](docs/strategy/ANALISE-ADVERSARIAL-E-PLANO-2026-10.md).

## Quick start

```bash
brew install --cask clebeer/tap/ctm     # or a release binary, the container image, or go install (see docs/install.md)

ctm init                          # threatmodel.yaml wired to your docker-compose / Terraform
ctm analyze                       # threats mapped to STRIDE, CWE, CAPEC and ATT&CK
ctm diff --base-ref origin/main   # threats this branch introduces or resolves
ctm analyze -f sarif -o ctm.sarif # for GitHub code scanning (also: table, json, markdown)
```

Try it on an example:

```console
$ ctm analyze examples/webapp/threatmodel.yaml
web-shop: 5 high, 1 medium (1 suppressed)

SEVERITY  RULE          TARGET             TITLE
HIGH      CTM-COMP-001  component db       Sensitive datastore not encrypted at rest
HIGH      CTM-COMP-008  component admin    Internet-exposed process handling non-public data without authentication
HIGH      CTM-FLOW-001  flow api-to-db     Sensitive data sent over an unencrypted channel
HIGH      CTM-FLOW-002  flow admin-access  Unauthenticated flow into a more trusted zone
HIGH      CTM-FLOW-005  flow admin-access  Internal component directly exposed to an untrusted zone
MEDIUM    CTM-COMP-006  component api      No audit logging on a component handling sensitive data
```

### In a pull request (GitHub Actions)

```yaml
on: pull_request
permissions:
  contents: read
  security-events: write
jobs:
  threat-model:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: clebeer/carbon-threat@v0.1.0    # a release tag downloads a checksum-verified binary
        with:
          fail-on: high                       # fail only on NEW high/critical threats
      - uses: github/codeql-action/upload-sarif@v4
        if: always()
        with:
          sarif_file: ctm.sarif
```

The job summary shows a Markdown report of the threats the PR introduces and
resolves.

## How it works

- **The model** is a versioned YAML format that is diffable in PRs. See the
  [format reference](docs/model-format.md). Facts you leave out are *unknown*,
  and rules never fire on unknown facts.
- **Extractors** build the model from your infrastructure on every run
  (`sources:`). Supported today: docker-compose and Terraform (AWS). Your
  model file only adds what code cannot say, such as data classification, so
  a PR that opens a port or drops encryption shows up in `ctm diff` without
  anyone editing the model. See [extractors](docs/extractors.md). Next:
  Kubernetes, CloudFormation, OpenAPI.
- **Rules** are reviewable YAML with [CEL](https://cel.dev) expressions and
  mandatory positive and negative tests. There are 13 built-in rules
  (`ctm rules list`). See the [rule-writing guide](docs/writing-rules.md).
- **Deterministic first.** LLM suggestions are planned as an optional,
  local-first add-on, always labelled as suggestions.

## Roadmap

| Phase | Goal | Status |
|---|---|---|
| 0 · Cleanup | Governance, licensing, security policy, freeze v1 | ✅ Done (2026-10) |
| 1 · CLI v0.1 | Model + schema, rule engine, `analyze`/`diff`, SARIF, GitHub Action, compose + Terraform (AWS) extractors with `sources`, signed releases ✅ · Kubernetes extractor, 40 rules ⏳ | In progress |
| 2 · Ecosystem v0.5 | Community rules repo, OTM / Threat Dragon / Threagile import, embedded viewer, LLM assist | Planned |
| 3 · v1.0 | Correlate scanner findings (SARIF, DefectDojo) with the architecture; optional Hub server | Planned |

## Legacy v1 web platform

> **⚠️ Unsupported and insecure — do not deploy.**

The previous web platform (a fork of OWASP Threat Dragon plus a partial vulnerability
management rewrite) is frozen at the `legacy/v1-final` tag. It has **known, unfixed
security vulnerabilities**. Its code (`td.server/`, `ct.client/`, `stride-engine/`)
has been removed from `main` and is only available from that tag. Its docs are
archived [here](https://github.com/clebeer/carbon-threat/tree/5bf0b708cf5f99e786a3560e5b4e477dce370f7d/docs/legacy-v1).

## Contributing

Feedback on the direction, threat-rule ideas, and redistributable reference
architectures are the most useful contributions right now. See
[CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

Report security issues privately as described in [SECURITY.md](SECURITY.md).

## License

[Apache 2.0](license.txt). Carbon Threat includes work derived from OWASP Threat Dragon
and STRIDE GPT; see [NOTICE](NOTICE). It is an independent project, not affiliated with
the OWASP Foundation.
