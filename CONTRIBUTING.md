# Contributing to Carbon Threat

Thanks for your interest! Carbon Threat is being rebuilt as a **threat-modeling-as-code**
CLI: it builds a threat model from your infrastructure and code, evaluates it with
declarative rules, and reports the threats a pull request introduces. The direction is
recorded in [ADR 0002](docs/adr/0002-threat-modeling-as-code.md).

## Project status

Phase 1 (CLI MVP) is in progress. Contributions that help most right now:

- **Threat rules.** Propose one with the "Threat rule proposal" issue
  template, or send it as a PR. See [docs/writing-rules.md](docs/writing-rules.md).
- **Extractors.** Terraform, Kubernetes and CloudFormation are next. Open an
  issue before starting so we can agree on the mapping.
- **Reference architectures.** Small, realistic, redistributable
  Terraform/Kubernetes/compose projects for the test corpus.
- **Feedback** on the [model format](docs/model-format.md).

The v1 web platform (`td.server/`, `ct.client/`, `stride-engine/`) is
**frozen** at the `legacy/v1-final` tag and has been removed from `main`. We do
not accept changes to it.

## Development

You need Go (see `go.mod` for the version) and, for linting,
[golangci-lint](https://golangci-lint.run/) v2.

```bash
make test      # go test -race ./...
make lint      # golangci-lint run
make build     # ./bin/ctm
make rules     # run the inline tests of the built-in rules through the CLI
```

Layout: `cmd/ctm` (entry point), `internal/cli` (commands), `pkg/model`
(format, validation, derived facts), `pkg/engine` (rule loading and
evaluation), `pkg/report` (table/JSON/Markdown/SARIF), `pkg/diff`,
`pkg/extract/*` (extractors), `rules/` (built-in rules), `schema/`,
`examples/` (golden-file tested example models).

## Ground rules

1. **Security issues go through [SECURITY.md](SECURITY.md)**, never public issues.
2. **Every change needs a test that would fail without it.** For rules, that means at
   least one positive and one negative fixture.
3. **Determinism first.** Features that depend on an LLM must be optional, clearly
   labelled as suggestions in the output, and must never be required for a passing run.
4. **AI-assisted contributions are welcome**, but you are responsible for every line:
   you must understand, run, and test what you submit. Say in the PR description which
   tools you used.
5. Be kind. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Workflow

1. For anything bigger than a small fix, open an issue first so we can agree on the approach.
2. Fork, create a branch from `main`, and keep the PR focused on one change.
3. Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages
   (`feat:`, `fix:`, `docs:`, `rules:`, `refactor:`, `test:`, `ci:`, `chore:`).
4. Make sure CI passes and fill in the pull request template.
5. Sign off your commits (`git commit -s`) to certify the
   [Developer Certificate of Origin](https://developercertificate.org/).

## Architecture decisions

Significant design decisions are recorded as ADRs in [`docs/adr/`](docs/adr/). If your
change alters one of them, propose a new ADR in the same PR.

## License

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](license.txt).
