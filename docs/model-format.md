# The ctm/v1 model format

A threat model is a YAML file (by convention `threatmodel.yaml`) that describes
the architecture: **trust zones**, **components**, the **data** they handle, and
the **data flows** between them. The format is defined by the JSON Schema in
[`schema/ctm-v1.json`](../schema/ctm-v1.json); `ctm validate` checks a file
against it and also checks that every reference resolves.

```yaml
apiVersion: ctm/v1
kind: ThreatModel
metadata:
  name: web-shop
trustZones:
  - {id: internet, trust: 0}
  - {id: internal, trust: 80}
data:
  - {id: customer-pii, classification: confidential}
components:
  - {id: customer, type: external_entity, trustZone: internet}
  - {id: api, type: process, trustZone: internal, properties: {authentication: oidc}}
  - {id: db, type: datastore, trustZone: internal, stores: [customer-pii], properties: {encryptionAtRest: true}}
dataFlows:
  - {id: orders, from: customer, to: api, protocol: https, authenticated: true, data: [customer-pii]}
  - {id: api-to-db, from: api, to: db, protocol: postgres, encrypted: true, data: [customer-pii]}
```

Complete examples live in [`examples/`](../examples/).

## Sources: extract instead of writing

Most of the architecture can come from your infrastructure code:

```yaml
apiVersion: ctm/v1
kind: ThreatModel
metadata: {name: shop}
sources:
  - terraform: infra            # re-extracted every time ctm runs
data:
  - {id: orders, classification: confidential}
components:
  - id: aws_db_instance.orders  # merged over the extracted component
    stores: [orders]
```

With `sources`, the document holds only what the sources cannot express,
such as data classification and authentication. Entries with the id of an
extracted element are merged over it; new ids add elements. `type`,
`trustZone`, `from` and `to` are then required only on the merged result.
See [extractors.md](extractors.md) for what each extractor produces, and run
`ctm render` to see the merged model.

## Unknown is not false

Every security fact is optional. **A fact you leave out is unknown, and rules do
not fire on unknown facts.** `encrypted: false` reports a plaintext flow;
omitting `encrypted` does not. This keeps false positives down. The cost is that
ctm only knows what you, or an extractor, tell it.

## Identifiers

Ids are lowercase (`a-z`, `0-9`, `.`, `_`, `-`) and must be unique:

- zone ids among zones;
- data ids among data;
- component and flow ids together, because suppressions and threats point at
  either by id alone.

Threat fingerprints come from the rule id plus the target id. `ctm diff` sees a
renamed component as one element removed and another added.

## Trust zones

| Field | Required | Meaning |
|---|---|---|
| `id` | ✓ | |
| `trust` | ✓ | 0 (untrusted) to 100 (fully trusted). Zones **below 20 are untrusted**, e.g. the internet or third parties. |
| `name`, `description` | | |

## Data

| Field | Required | Meaning |
|---|---|---|
| `id` | ✓ | |
| `classification` | ✓ | `public`, `internal`, `confidential` or `restricted` |
| `name`, `description` | | |

## Components

| Field | Required | Meaning |
|---|---|---|
| `id`, `type`, `trustZone` | ✓ | `type` is `external_entity`, `process` or `datastore` |
| `stores` | | Data ids held at rest (for datastores) |
| `technology`, `name`, `description`, `tags` | | Free-form |
| `properties.authentication` | | `none`, `password`, `api_key`, `oauth`, `oidc`, `saml`, `mtls`, `iam`, `other` |
| `properties.encryptionAtRest` | | bool |
| `properties.publicAccess` | | bool: anonymous read access (e.g. a public bucket) |
| `properties.logging` | | bool: security-relevant actions are audit-logged |
| `properties.rateLimiting` | | bool |
| `properties.privileged` | | bool: privileged container or host-level access |
| `properties.hardcodedSecrets` | | bool: credentials embedded in configuration or code |
| `properties.image` | | Container image reference |

## Data flows

| Field | Required | Meaning |
|---|---|---|
| `id`, `from`, `to` | ✓ | Component ids |
| `protocol` | | Free-form. When `encrypted` is omitted, well-known protocols imply it. TLS protocols (`https`, `tls`, `mtls`, `wss`, `grpcs`, `ssh`, `sftp`, `rediss`, …) imply `true`; plaintext ones (`http`, `ws`, `ftp`, `telnet`, `redis`, `amqp`, `mqtt`, …) imply `false`. Others (e.g. `postgres`, `grpc`) stay unknown. |
| `encrypted`, `authenticated` | | bool |
| `data` | | Data ids carried by the flow |

## Suppressions

Accept a risk explicitly instead of deleting the model element:

```yaml
suppressions:
  - rule: CTM-FLOW-004
    target: charge          # omit to suppress the rule for the whole model
    reason: DPA signed; card data goes to the PSP's hosted fields.
    expires: 2027-03-31     # optional; ignored after this date
```

Suppressed threats still appear:

- in JSON output, with `suppressed: true`;
- in SARIF, as suppressed results.

They do not count for `--fail-on`, and `ctm diff` treats them as resolved.

## Derived facts available to rules

Rules see the model through these values, computed by ctm:

| Value | Meaning |
|---|---|
| `component.sensitivity`, `flow.sensitivity` | Highest data classification involved: -1 none, 0 public … 3 restricted. A component's value covers stored data and every flow touching it. |
| `component.exposed` | Receives a flow from an untrusted zone |
| `component.zone.trust`, `component.zone.untrusted` | From the component's trust zone |
| `flow.crossesBoundary`, `flow.trustDelta` | Whether, and by how much, trust changes from source to destination zone |
| `flow.encrypted` | Explicit value, or inferred from `protocol` |

See [writing-rules.md](writing-rules.md).
