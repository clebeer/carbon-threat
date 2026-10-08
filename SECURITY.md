# Security Policy

## Supported versions

Carbon Threat is being restructured into a threat-modeling-as-code CLI (see
[ADR 0002](docs/adr/0002-threat-modeling-as-code.md)). No version has been released yet.

| Version | Status |
|---|---|
| `main` (new CLI, pre-release) | Accepting reports |
| v1 web platform (`legacy/v1-final` tag and earlier) | **Unsupported. Do not deploy.** |

The v1 web platform (Express/PostgreSQL server, React client, `stride-engine`) has
**known, unfixed security vulnerabilities**, including tenant-isolation and authorization
flaws. It is frozen and will not receive fixes. If you run it anyway, keep it on an
isolated network with a single trusted user and no real data.

## Reporting a vulnerability

Please **do not** open a public issue, discussion, or pull request for security problems.

Report privately through GitHub (preferred):
**[Report a vulnerability](https://github.com/clebeer/carbon-threat/security/advisories/new)**

If you cannot use GitHub, email **[ctm-security@cle.beer](mailto:ctm-security@cle.beer)**.

Please include:

- the affected version or commit,
- a description of the issue and its impact,
- steps or a proof of concept to reproduce it,
- any suggested fix.

## What to expect

- Acknowledgement within 7 days.
- An initial assessment (accepted / needs info / not a vulnerability) within 14 days.
- For accepted reports: a fix and a GitHub Security Advisory, with credit to the reporter
  unless you prefer to stay anonymous. We aim for coordinated disclosure within 90 days.

This is a volunteer-maintained project; timelines are goals, not guarantees.

## Scope

In scope: code in this repository and the release artifacts built from it.

Out of scope: the unsupported v1 web platform (already known to be insecure), findings
that require a compromised host or maintainer account, and issues in third-party
dependencies that are not exploitable through Carbon Threat (please report those upstream).
