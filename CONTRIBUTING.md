# Contributing to Carbon Threat

Thanks for your interest! Carbon Threat is being rebuilt as a **threat-modeling-as-code**
CLI: it builds a threat model from your infrastructure and code, evaluates it with
declarative rules, and reports the threats a pull request introduces. The direction is
recorded in [ADR 0002](docs/adr/0002-threat-modeling-as-code.md).

## Project status

We are between Phase 0 (cleanup) and Phase 1 (CLI MVP). The new code base does not exist
yet, so the most useful contributions right now are:

- **Feedback on the direction.** Open a discussion or issue about the model schema, rule
  format, or which IaC sources matter to you.
- **Threat rules ideas.** Describe an architectural pattern that should produce a threat
  (e.g. "internet-facing load balancer → database without TLS"), with positive and
  negative examples.
- **Reference architectures.** Small, realistic Terraform / Kubernetes / docker-compose
  projects we can use as a test corpus (must be redistributable).

The v1 web platform (`td.server/`, `ct.client/`, `stride-engine/`) is **frozen** at the
`legacy/v1-final` tag. We do not accept feature work on it. It will be removed from `main`
when Phase 1 starts.

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
