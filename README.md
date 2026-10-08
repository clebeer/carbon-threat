# Carbon Threat

**Threat modeling as code.** Carbon Threat builds a threat model from your infrastructure
and code, evaluates it with open, declarative rules, and tells you which threats a pull
request introduces. It runs in CI and needs no server.

> **Status: restructuring, no release yet.** The project is being rebuilt from scratch as a
> single-binary CLI. The direction is recorded in
> [ADR 0002](docs/adr/0002-threat-modeling-as-code.md), and the roadmap (in pt-BR) is in
> [docs/strategy](docs/strategy/ANALISE-ADVERSARIAL-E-PLANO-2026-10.md).

## What it will do

```bash
ctm init                         # detect the stack and generate threatmodel.yaml from the repo
ctm analyze                      # apply rules → threats mapped to STRIDE, CWE, CAPEC, ATT&CK
ctm diff origin/main..HEAD       # threats introduced or removed by this change
ctm report --format sarif        # upload to GitHub code scanning, or md / html / json / otm
ctm view                         # local diagram + threat viewer, served by the binary
```

- **Generated, not drawn.** Models are extracted from Terraform, Kubernetes,
  docker-compose, CloudFormation, and OpenAPI, then from application code.
- **Deterministic first.** Rules are reviewable YAML. LLM suggestions are optional,
  local-first (e.g. Ollama), and always labelled as suggestions.
- **Open format.** The model is a versioned YAML schema that is diffable in PRs, with
  [Open Threat Model (OTM)](https://github.com/iriusrisk/OpenThreatModel) import/export.
- **CI-native.** It ships as a GitHub Action, a GitLab CI template, and a pre-commit hook,
  and produces SARIF.

## Roadmap

| Phase | Goal | Status |
|---|---|---|
| 0 · Cleanup | Governance, licensing, security policy, freeze v1 | ✅ Done (2026-10) |
| 1 · CLI v0.1 | Terraform/compose/k8s extractors, 40 rules, `diff`, SARIF, GitHub Action | Next |
| 2 · Ecosystem v0.5 | Community rules repo, OTM / Threat Dragon / Threagile import, embedded viewer, LLM assist | Planned |
| 3 · v1.0 | Correlate scanner findings (SARIF, DefectDojo) with the architecture; optional Hub server | Planned |

## Legacy v1 web platform

> **⚠️ Unsupported and insecure — do not deploy.**

The previous web platform (a fork of OWASP Threat Dragon plus a partial vulnerability
management rewrite) is frozen at the `legacy/v1-final` tag. It has **known, unfixed
security vulnerabilities**. Its code (`td.server/`, `ct.client/`, `stride-engine/`) is
still in this branch for reference and will be removed when Phase 1 starts. Its docs
live in [docs/legacy-v1](docs/legacy-v1/).

## Contributing

Feedback on the direction, threat-rule ideas, and redistributable reference
architectures are the most useful contributions right now. See
[CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

Report security issues privately as described in [SECURITY.md](SECURITY.md).

## License

[Apache 2.0](license.txt). Carbon Threat includes work derived from OWASP Threat Dragon
and STRIDE GPT; see [NOTICE](NOTICE). It is an independent project, not affiliated with
the OWASP Foundation.
