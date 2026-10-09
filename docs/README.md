# Carbon Threat — Documentation

Carbon Threat is a **threat-modeling-as-code** CLI (`ctm`). See the
[project README](../README.md) for installation and the current status.

## Using ctm

| Document | Description |
|---|---|
| [install.md](install.md) | Install ctm (Homebrew, binaries, container, source) and verify downloads |
| [model-format.md](model-format.md) | The ctm/v1 model format, field by field |
| [extractors.md](extractors.md) | What the compose and Terraform extractors produce, and their assumptions |
| [writing-rules.md](writing-rules.md) | How to write and test threat rules |
| [../examples/](../examples/) | Example models with their expected threats |

## Direction and decisions

| Document | Description |
|---|---|
| [adr/0002-threat-modeling-as-code.md](adr/0002-threat-modeling-as-code.md) | Current direction: threat modeling as code, v1 frozen |
| [strategy/ANALISE-ADVERSARIAL-E-PLANO-2026-10.md](strategy/ANALISE-ADVERSARIAL-E-PLANO-2026-10.md) | Adversarial review and restructuring roadmap (pt-BR) |
| [adr/0001-carbon-dojo-replatform.md](adr/0001-carbon-dojo-replatform.md) | Superseded: vulnerability-management pivot |

## Legacy v1 (unsupported, insecure — do not deploy)

The v1 web platform was removed from `main`. Its code is at the `legacy/v1-final`
tag, and its (sanitized) documentation is archived
[here](https://github.com/clebeer/carbon-threat/tree/5bf0b708cf5f99e786a3560e5b4e477dce370f7d/docs/legacy-v1).
