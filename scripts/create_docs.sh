#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/clebeer/workdir/carbon-threat"

mkdir -p "$ROOT/docs/development"
mkdir -p "$ROOT/scripts"

# QUICK_START_ITEM_1.md
cat > "$ROOT/QUICK_START_ITEM_1.md" <<'QUICK'
# Item 1 - Quick Start Guide

## 🚀 Como Completar Item 1 em ~5 Horas

Resumo do que já está pronto:
- `docs/development/ARCHITECTURE.md` (será criado aqui também)
- Planos e templates para services/validators/mappers/controllers/tests

O que falta:
- Criar os arquivos de documentação (DESIGN_PATTERNS, API_STANDARDS, DATABASE_SCHEMA, CODE_STANDARDS)
- Criar os arquivos de código (services, validators, mappers, middleware, controller refatorado)
- Criar testes unitários para service/validator/mapper

Estimativa:
- Documentação restante: ~30 min
- Services/validators/mappers: ~1h
- Middleware: ~45 min
- Controller refactor: ~1h
- Testes: ~1.5h
- Verificação (lint/test): ~30 min

Checklist (final):
- [ ] docs/development/DESIGN_PATTERNS.md
- [ ] docs/development/API_STANDARDS.md
- [ ] docs/development/DATABASE_SCHEMA.md
- [ ] docs/CODE_STANDARDS.md
- [ ] td.server/src/services/threatmodel.service.js
- [ ] td.server/src/validators/threatmodel.validator.js
- [ ] td.server/src/mappers/threatmodel.mapper.js
- [ ] td.server/src/controllers/threatmodel.refactored.controller.js
- [ ] td.server/src/middleware/{auth,error,logging}.js
- [ ] tests unitários (service/validator/mapper)

Para executar quando pronto:
- `npm run test:server` (rodar testes do backend)
- `cd td.server && npm run lint` (rodar linter)
QUICK

# ITEM_1_COMPLETE_SUMMARY.md
cat > "$ROOT/ITEM_1_COMPLETE_SUMMARY.md" <<'SUMMARY'
# Item 1 - Qualidade de Código & Arquitetura - SUMÁRIO COMPLETO

Objetivo: refatorar backend para arquitetura em camadas, documentar padrões e adicionar testes de base.

Principais entregas planejadas:
- Documentação: ARCHITECTURE.md, DESIGN_PATTERNS.md, API_STANDARDS.md, DATABASE_SCHEMA.md, CODE_STANDARDS.md
- Estrutura de código: Controllers (HTTP-only), Services (business), Validators, Mappers, Repositories
- Middleware: auth, error handling, logging/audit
- Exemplos práticos: threatmodel service + controller refatorado
- Testes: unitários para services, validators e mappers

Estratégia:
1. Implementar um serviço para `threatmodel` com injeção de dependência do repositório.
2. Mover validação para `validators/`.
3. Transformar respostas com `mappers/`.
4. Manter controllers apenas para HTTP, validação e invocação do service.
5. Adicionar middleware cross-cutting (auth/error/logging).
6. Cobertura de testes unitários primeiro; depois integração.

Benefícios:
- Maior testabilidade e isolamento
- Melhor manutenção e onboarding de devs
- Preparação para segurança e observabilidade
SUMMARY

# ITEM_1_IMPLEMENTATION_STATUS.md
cat > "$ROOT/ITEM_1_IMPLEMENTATION_STATUS.md" <<'STATUS'
# Item 1 - Qualidade de Código & Arquitetura - Status de Implementação

Status atual: documentação inicial e planos criados. Implementação do código pendente.

Concluído:
- Planejamento completo
- `00_START_HERE.md` criado
- Template quick-start criado

Pendências (próximos passos):
- Criar os arquivos de documentação detalhada
- Implementar os services/validators/mappers
- Implementar middleware e controller refatorado
- Criar testes unitários e rodar cobertura

Próximo marco: implementar `threatmodel.service.js` + seus testes e integrar no controller refatorado.
STATUS

# ARCHITECTURE_AND_CODE_STANDARDS_REFERENCE.md
cat > "$ROOT/ARCHITECTURE_AND_CODE_STANDARDS_REFERENCE.md" <<'REF'
# Carbon Threat - Architecture & Code Standards Reference

Resumo rápido (referência):
- Arquitetura: Layered (Controller → Validator → Service → Mapper → Repository → DB)
- Controllers: HTTP handling only
- Services: Business logic (no request/response concerns)
- Validators: Input validation & sanitization
- Mappers: DTO <-> Domain transformation
- Repositories: Data access (knex / pg)
- Middleware: Auth (JWT), Error handling, Logging/Audit

Naming conventions:
- JS variables/functions: camelCase
- Classes: PascalCase
- DB columns: snake_case
- Constants: SCREAMING_SNAKE_CASE

Error Handling:
- Use response wrapper for consistent {status,message,details}
- Throw custom error types for operational errors

Logging:
- Use winston, structured logs JSON in production
- Audit logs: separate transport, append-only

Testing:
- Unit tests for service/validator/mapper
- Integration tests for controller→service→repo
- E2E for critical flows (auth, create model, sync)

Use this file as a quick cheat-sheet while implementing.
REF

# ITEM_2_SECURITY_PLAN.md
cat > "$ROOT/ITEM_2_SECURITY_PLAN.md" <<'SECPLAN'
# Item 2 - Segurança & Proteção Adicional - PLANO

Resumo das ações de segurança (após Item 1):

1) OWASP Top 10 checklist — assegurar controles para cada item.
2) Secrets management — validar entropy, rotacionar e considerar integração com Vault.
3) HMAC request signing — protegendo webhooks e endpoints sensíveis.
4) CSRF protection para flows web (token-based).
5) Rate limiting distribuído (Redis) por IP/usuário/endpoints.
6) Expandir audit logging (append-only) e integrar com SIEM.
7) Pen tests e security tests automatizados (SAST/DAST).
8) Atualização contínua de dependências e SBOM.

Estimativa: ~15 horas para implementação inicial (configuração + testes).
SECPLAN

# docs/development/ARCHITECTURE.md
cat > "$ROOT/docs/development/ARCHITECTURE.md" <<'ARCH'
# Carbon Threat - Architecture Documentation

Overview:
- Monorepo with `td.server` (Express, Knex, Postgres) and `ct.client` (React + Vite).
- Layered architecture for backend:
  - Controller (HTTP)
  - Validator (Input)
  - Service (Business logic)
  - Mapper (DTO conversion)
  - Repository (DB access with Knex)

Request flow:
1. Controller receives request
2. Controller validates with Validator
3. Controller calls Service
4. Service uses Repository
5. Service returns domain objects
6. Mapper converts to DTO
7. Controller responds to client

Security highlights:
- JWT for auth, SAML/OAuth providers supported.
- Secrets validated at startup (entropy checks).
- Helmet and rate-limiting middleware enabled.

DB highlights:
- PostgreSQL with migrations
- Key tables: users, organizations, threat_models, threats, audit_logs, app_config
- Threat model content encrypted at rest (AES-256-GCM)

Monitoring & logging:
- Winston for structured logging
- Health endpoints: /api/health/healthz and /api/health/ready
- OpenAPI/Swagger available at /api-docs

Development:
- npm scripts provided in root package.json
- Run backend locally: `npm run dev:server`
- Run frontend locally: `npm run dev:client`
ARCH

echo "All files created."
ls -lah "$ROOT"/00_START_HERE.md "$ROOT"/QUICK_START_ITEM_1.md "$ROOT"/ITEM_1_COMPLETE_SUMMARY.md "$ROOT"/ITEM_1_IMPLEMENTATION_STATUS.md "$ROOT"/ARCHITECTURE_AND_CODE_STANDARDS_REFERENCE.md "$ROOT"/ITEM_2_SECURITY_PLAN.md "$ROOT"/docs/development/ARCHITECTURE.md
