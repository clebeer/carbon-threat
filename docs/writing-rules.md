# Writing threat rules

A rule is one YAML file: metadata, a [CEL](https://cel.dev) expression evaluated
on each component or each flow, a message, a mitigation, and inline tests.
Built-in rules live in [`rules/`](../rules/). You can keep your own in any
directory and load them with `--rules <dir>`.

```yaml
id: CTM-FLOW-001                      # CTM-<AREA>-<NNN>, unique
title: Sensitive data sent over an unencrypted channel
description: >
  Why this is a threat, in two or three sentences.
severity: high                        # critical | high | medium | low | info
stride: [information_disclosure, tampering]
cwe: [319]                            # optional
capec: [157]                          # optional
attack: [T1040]                       # optional, MITRE ATT&CK technique ids
target: flow                          # component | flow
when: >
  flow.sensitivity >= 2 && has(flow.encrypted) && !flow.encrypted
message: >
  "{{.flow.name}}" from {{.source.name}} to {{.destination.name}} is not encrypted.
mitigation: >
  What to do about it.
tests:
  - name: plaintext http carrying PII
    expect: [login]                   # ids that must be flagged
    model: { ... }                    # partial model: zones, data, components, flows
  - name: https carrying PII
    expect: []                        # must not fire
    model: { ... }
```

## Variables

| Target | Variables |
|---|---|
| `component` | `component`, `model` |
| `flow` | `flow`, `source`, `destination` (the two components), `model` |

Component and flow fields are described in [model-format.md](model-format.md),
including derived values such as `sensitivity`, `exposed` and `trustDelta`.

## Rules of thumb

1. **Guard optional facts with `has()`.** Unknown facts are absent from the
   maps, so write `has(flow.encrypted) && !flow.encrypted`. Reading a missing
   key is an evaluation error, which ctm reports instead of guessing.
2. **Quote expressions that start with `!`.** YAML reads a leading `!` as a tag:
   write `when: "!component.exposed"` or use `>` block scalars as above.
3. **Precision over recall.** A rule that fires on every model gets disabled.
   Require explicit facts, and exclude the obvious safe cases (e.g. datastores
   that only hold public data).
4. **Tests are mandatory.** Each rule needs at least one positive test
   (`expect: [ids]`) and one negative test (`expect: []`). Add a negative test
   for every false positive you fix.
5. **Messages use Go templates** over the same variables (`{{.component.name}}`).
   Referencing a missing key fails the run, so templates only use fields that
   are always present (`id`, `name`, `zone`, `data`, …).

## Testing

```bash
ctm rules test                 # built-in rules
ctm rules test ./my-rules      # your rules
go test ./rules/ ./examples/   # in this repository
```

If a rule change alters the threats reported for an example in
[`examples/`](../examples/), update that example's `expected.txt` in the same PR.
