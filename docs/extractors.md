# Extractors

Extractors turn infrastructure definitions into ctm/v1 components, flows and
trust zones. Reference them under `sources:` in your model. They run every
time ctm loads the model, so the model follows your code. `ctm diff
--base-ref` extracts the base revision from git as well.

```yaml
sources:
  - compose: docker-compose.yml   # a file
  - terraform: infra              # a directory (root module)
```

Paths are relative to the model file and must stay inside its directory.
Entries in the model with the same id as an extracted element are merged over
it:

- maps such as `properties` are merged key by key;
- lists such as `stores` and `data` are replaced.

Entries with new ids are added. `ctm render` prints the merged result.

Extractors **never classify data**: that is the part you write. They only
record facts the source states, plus the documented defaults listed below.
A threat on an extracted element points at the source line (e.g. the
Terraform resource), so SARIF annotations land where the fix goes.

## Docker Compose (`compose`)

| Source | Becomes |
|---|---|
| service with a datastore image (postgres, mysql, mariadb, mongo, redis, valkey, memcached, elasticsearch, opensearch, cassandra, couchdb, neo4j, clickhouse, influxdb, cockroach, minio, rabbitmq, kafka, nats) | `datastore` with `technology` |
| any other service | `process` |
| `ports` published on a non-loopback address | the service moves to zone `edge`; a flow per port from `internet` (80/8080 → `http`, 443/8443 → `https`, otherwise the datastore protocol) |
| `depends_on`, `links`, `*_HOST` env pointing at a service | flow to that service |
| connection URLs in env (`postgres://…@db…`) | flow with the URL scheme as protocol; `sslmode=disable` / `require` sets `encrypted` |
| literal credentials in env (`*_PASSWORD`, `*_TOKEN`, `*_SECRET`, URLs with passwords) | `hardcodedSecrets: true`. Not flagged: `${VAR}`, `*_FILE`, `/run/secrets/…` |
| `privileged: true` | `privileged: true` |
| `image` | `properties.image` |

Zones: `internet` (trust 0), `edge` (30), `internal` (70).

## Terraform, AWS provider (`terraform`)

The `.tf` files of **one directory** are parsed statically. Nothing is
planned or applied, and no credentials are needed:

- Variables are evaluated from their defaults, `terraform.tfvars` and
  `*.auto.tfvars`.
- `locals` are evaluated, plus a few functions: `jsonencode`, `lower`,
  `upper`, `format`, `join`, `concat`, `coalesce`, `merge`.
- A resource with `count = 0` is skipped.
- `module` calls are **not followed**; ctm prints a warning.
- Values that depend on other resources or on variables without a value are
  unknown, and stay out of the model.

| Resource | Becomes | Facts |
|---|---|---|
| `aws_db_instance`, `aws_rds_cluster`, `aws_rds_cluster_instance` | datastore (`technology` = engine) | `encryptionAtRest` from `storage_encrypted` (**provider default: false**; not set on cluster instances, which inherit it from the cluster); `hardcodedSecrets` when `password`/`master_password` is a literal or a committed variable default; internet flow when `publicly_accessible = true` **and** a referenced security group opens the DB port (or all ports) to `0.0.0.0/0` / `::/0` (if no security group can be resolved, it is assumed reachable and a warning is printed) |
| `aws_s3_bucket` | datastore `s3` | `encryptionAtRest: true` (SSE-S3 is the AWS default since 2023); `publicAccess: true` for a `public-read`/`public-read-write` ACL (inline or `aws_s3_bucket_acl`), `false` when an `aws_s3_bucket_public_access_block` sets all four flags |
| `aws_dynamodb_table` | datastore `dynamodb` | `encryptionAtRest: true` (always on) |
| `aws_elasticache_replication_group`, `aws_elasticache_cluster` | datastore (`redis`/`memcached`) | `encryptionAtRest` from `at_rest_encryption_enabled`; clients use `rediss`/`redis` according to `transit_encryption_enabled` (both **default false**); literal `auth_token` |
| `aws_sqs_queue`, `aws_sns_topic` | datastore | `encryptionAtRest` from `kms_master_key_id` / `sqs_managed_sse_enabled` |
| `aws_lambda_function` | process `aws-lambda` | literal credentials in `environment.variables`; with `aws_lambda_function_url`: internet flow and `authentication` (`NONE` → `none`, `AWS_IAM` → `iam`) |
| `aws_apigatewayv2_api`, `aws_api_gateway_rest_api` | process `aws-api-gateway`, internet flow on 443 | `authentication: none` when every route/method is unauthenticated (route default: `NONE`); flows to Lambda functions through integrations |
| `aws_lb`, `aws_alb` | process | internet-facing unless `internal = true` (**provider default: false**); one internet flow per listener with its protocol; flows to targets via target groups (attachments, ECS services) |
| `aws_instance` | process `ec2` | with `associate_public_ip_address = true`, one internet flow per port its security groups open to the internet (22 → `ssh`, 80 → `http`, 443 → `https`, …) |
| `aws_ecs_service` | process `ecs` | |

Flows between resources come from **references**: a process that refers to
another modeled resource (e.g. a Lambda environment variable set to
`aws_dynamodb_table.sessions.name`) gets a flow to it, using that resource's
protocol.

Zones: `internet` (trust 0), `aws-public` (30, internet-facing resources),
`aws-private` (70). Component ids are the lower-cased resource addresses,
e.g. `aws_db_instance.orders`.

**Not modeled yet:** IAM (who may call what), bucket policies, VPC/subnet
routing (exposure is decided by the public flag plus security groups),
modules, and other providers. Contributions are welcome. See
[CONTRIBUTING.md](../CONTRIBUTING.md).
