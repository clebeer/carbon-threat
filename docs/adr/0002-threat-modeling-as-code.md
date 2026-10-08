# ADR 0002 — Reposition Carbon Threat as threat-modeling-as-code; freeze v1

- **Status:** Accepted
- **Date:** 2026-10-07
- **Supersedes:** [ADR 0001](0001-carbon-dojo-replatform.md) (Carbon Dojo re-platform)
- **Context document:** [Análise adversarial e plano de reestruturação](../strategy/ANALISE-ADVERSARIAL-E-PLANO-2026-10.md) (pt-BR)

## Context

An adversarial review of the repository on 2026-10-07 found:

1. **No coherent product.** The README describes a threat-modeling web platform (a fork
   of OWASP Threat Dragon). The v2 SDD describes a vulnerability-management console
   modelled on DefectDojo. The code ships neither end to end: the v2 UI runs on in-memory
   fixtures with a demo login, the v2 backend tables have no routes, and the v1 APIs
   have no UI.
2. **The v2 direction has no differentiation.** DefectDojo is a free, mature OWASP
   Flagship project with hundreds of import parsers. A single-maintainer clone cannot
   offer a reason to switch.
3. **The v1 platform is not safe to run.** It has known, unfixed tenant-isolation,
   authorization, and setup flaws. Several findings from the June 2026 pentest marked as
   fixed are still open or only partly fixed.
4. **The delivery model blocks adoption.** Getting any value requires PostgreSQL, TLS,
   Docker, a hand-edited `.env`, and a setup wizard. The security tools that became
   defaults (Trivy, Semgrep, Nuclei, gitleaks, Checkov) are single binaries that run in
   CI, emit SARIF, and grow through community-contributed rules.
5. **Capacity.** One human maintainer. A multi-tenant web platform with SSO, RBAC,
   backups, SIEM export, and many integrations is not sustainable at that size.

There is an unserved gap: threat modeling is universally recommended (OWASP SAMM,
NIST SSDF, CISA Secure by Design) but rarely done continuously, because it is manual and
the result goes stale. No active open-source tool generates a threat model from
infrastructure and code and evaluates every pull request against it.

## Decision

1. **Product.** Carbon Threat becomes a **threat-modeling-as-code** tool:
   - It builds an architecture model (components, data flows, trust boundaries, data
     classification) from IaC and code.
   - It evaluates the model with declarative, community-contributed rules that map to
     STRIDE, CWE, CAPEC, and MITRE ATT&CK.
   - It reports the threats a change introduces (`ctm diff`), as SARIF and Markdown,
     in CI.
2. **Principles.** Deterministic first; LLM assistance optional, local-first, and always
   labelled as a suggestion. Offline-capable. Open, versioned model format with
   Open Threat Model (OTM) import/export. No server required to get value.
3. **Name.** Keep **Carbon Threat**; the CLI binary is **`ctm`**. Drop "Carbon Dojo".
4. **Technology.** The core is a single static binary written in **Go**. The web viewer
   (React, reusing the existing design tokens and the draw.io/Visio/Gliffy importers) is
   embedded in the binary. An optional multi-repo server ("Hub") is deferred to Phase 3.
5. **Freeze v1.** The v1 web platform (`td.server/`, `ct.client/`, `stride-engine/`,
   Docker/compose setup) is frozen at tag **`legacy/v1-final`**:
   - It is declared unsupported and insecure in `SECURITY.md` and the README.
   - It receives no fixes.
   - It is removed from `main` when Phase 1 starts. History is preserved.
6. **Salvage, don't migrate.** Ideas and data move to the new code base by porting, not
   by keeping v1 code alive:
   - the STRIDE rules (`td.server/engine/rule-engine.js`);
   - the STRIDE GPT-derived prompts (with MIT attribution kept);
   - the ATT&CK mapping data;
   - the OSV client;
   - the SARIF exporter;
   - the diagram importers.
7. **Security reports.** The detailed June 2026 pentest report is removed from the
   working tree. It remains in git history for commits up to `legacy/v1-final`, which is
   acceptable because v1 is declared insecure and unsupported. Rewriting public history
   would break forks and clones for little gain.

## Consequences

- The vulnerability-management domain (migrations 018–021, the "Carbon Dojo" UI, the v2
  SDD) is abandoned. The SDD is kept only as a historical record.
- Users of v1, if any, need to export their data before Phase 1 removes v1 from `main`.
  An importer from the v1 threat-model JSON to the new model format is planned for Phase 2.
- The roadmap, exit criteria, and adoption metrics are in the context document,
  sections 6 and 7.
- Correlating scanner findings (SARIF, DefectDojo API) with the architecture model is
  kept as a Phase 3 differentiator. Carbon Threat **integrates with** vulnerability
  managers instead of competing with them.
