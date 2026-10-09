# Example models

Handwritten ctm/v1 models with deliberate weaknesses. Each folder has the
model and an `expected.txt` golden file listing the threats ctm must report
(`<rule> <target> [suppressed]`). `go test ./examples/` checks them, so a rule
change that alters the results must update the golden file in the same PR.

| Example | What it shows |
|---|---|
| [webapp](webapp/) | Three-tier shop: plaintext DB traffic, unencrypted DB, admin panel open to the internet, a suppressed third-party flow |
| [k8s-microservices](k8s-microservices/) | Services on Kubernetes: privileged pod, hardcoded secrets, `:latest` image, plaintext Redis with session tokens |
| [aws-serverless](aws-serverless/) | API Gateway + Lambda + S3/DynamoDB: public bucket with user uploads, PII sent to an email provider |
| [terraform-aws](terraform-aws/) | **Extracted from Terraform** (`sources:`): the model file only classifies data. Internet-reachable RDS, plaintext Redis with session tokens, unauthenticated API, public bucket, hardcoded credentials |

Try one:

```bash
ctm analyze examples/webapp/threatmodel.yaml
```
