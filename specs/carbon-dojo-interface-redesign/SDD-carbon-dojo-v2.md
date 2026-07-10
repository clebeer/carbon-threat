# CarbonThreat → **Carbon Dojo** 2.0 — SDD (Spec-Driven Development)
## Re-plataforma completa para console de gestão de vulnerabilidades & pentest

> **Decisão (2026-07-09):** a V2 é uma **re-plataforma completa** para a arquitetura
> de informação **Carbon Dojo** (Findings → Engagements → Assessments → Products →
> Connectors), adotando o design system homônimo. Isso substitui a IA atual de
> *threat modeling* (Projects/Threats/ATT&CK/canvas STRIDE) por uma IA de
> *vulnerability management*. **Este documento é só o plano** — nenhum código de app
> é escrito nesta fase; os prompts da Seção 12 são o roteiro executável.
>
> **Fonte de design:** `specs/carbon-dojo-interface-redesign/` (bundle Claude Design),
> arquivo `project/Carbon Dojo.dc.html` + `uploads/redesign-brief.md`. Tokens e
> componentes desta SDD foram **extraídos diretamente** desse bundle.

- **Data:** 2026-07-09
- **Alvo:** `ct.client` (reescrita de frontend) **+** `td.server` (novo domínio de
  backend) **+** possivelmente um novo serviço de import. `stride-engine` é
  reavaliado (Seção 9).

---

## 1. Objetivos e não-objetivos

### 1.1 Objetivos
1. **Nova IA de vuln management** — domínio `Organization → Business Unit → Product
   → Engagement → Assessment → Finding`, com Connectors (Jira) e pipeline de import.
2. **Design system Carbon Dojo aplicado** — tokens light/dark, componentes e shell,
   com a interface **light-first** (o app atual é dark-first; invertemos a ênfase).
3. **Responsivo e acessível** — de 1440px a 390px; tabelas viram cards no mobile;
   sidebar → drawer; WCAG 2.1 **AA** em ambos os temas (severidade/SLA nunca por cor só).
4. **Data-dense mas legível** — tabelas fortes, filtros, detalhes, badges de severidade
   e SLA que se leem instantaneamente.
5. **Fluxos de segurança de primeira classe** — mudança de status, **risk acceptance
   com aprovação de duas pessoas**, export para Jira, SLA por severidade.
6. **Backend seguro por construção** — evitar as classes de falha catalogadas na
   Seção 10 (BOLA/IDOR/tenant isolation/MFA brute-force/etc.).

### 1.2 Não-objetivos
- Não escrever código de app nesta fase (entregar só o SDD/plano).
- Não manter o canvas de diagramação ReactFlow/yjs como núcleo do produto (o
  threat-modeling deixa de ser a IA principal — ver Seção 9 para o destino).
- Não trocar a linguagem do backend sem necessidade: reusar `td.server`
  (Node/Express/Knex/PG) para as novas entidades, salvo decisão contrária na Fase 1.

### 1.3 Métricas de sucesso
| Métrica | Meta V2 |
|---|---|
| Telas do brief entregues (desktop+mobile, light+dark) | 11/11 |
| Tokens Carbon Dojo aplicados (0 valores de cor ad-hoc) | 100% |
| Rotas com URL própria + deep-link | Todas |
| Lighthouse mobile (Perf / A11y) | ≥ 90 / ≥ 95 |
| Contraste severidade/SLA nos 2 temas | WCAG AA |
| Findings de segurança da Seção 10 mitigados no novo backend | 100% |

---

## 2. Estado atual → alvo

| Camada | Hoje (v1) | Alvo (v2 Carbon Dojo) |
|---|---|---|
| IA | Threat modeling: Projects, Assets, Threats, Scanner (OSV), ATT&CK, Reports | Vuln mgmt: Dashboard, Findings, Engagements, Products, Import Scan, Pentest Report, Connectors, Admin |
| Domínio | Threat models (diagramas STRIDE) | `Org → BU → Product → Engagement → Assessment → Finding` |
| Frontend | React 18 + Vite, roteamento manual, estilos inline, dark-first | React 18 + Vite, React Router, design tokens Carbon Dojo, light-first responsivo |
| Backend | Node/Express/Knex/PG; controllers de threatmodel/threats/osv/attack | Node/Express/Knex/PG; novos domínios (products/engagements/assessments/findings/connectors/imports) |
| Auth/RBAC | JWT, SAML/OIDC, papéis admin/analyst/viewer | Reusar + novos papéis: Admin, Red Team Manager, Red Team Analyst, Dev Owner, Reader |

### 2.1 O que **reusar** do v1
- **Auth/SSO/RBAC** (JWT, Passport, SAML/OIDC) — estender papéis e escopos.
- **OSV Scanner** (`osvScanner.js`) — vira uma **fonte de import** de findings.
- **Integrações de issue tracker** (`integrations.ts`, export Jira/GitHub/GitLab) —
  base do módulo **Connectors**.
- **Exporters de relatório** (PDF/SARIF) — base do **Pentest Report**.
- **Audit logging**, **backup/restore**, **SMTP/Teams delivery** — reusados no Admin.
- Tokens de espaçamento/tipografia do `index.css` — reconciliados com Carbon Dojo.

### 2.2 O que é **novo**
- Entidades: Organization, Business Unit, Product, Engagement, Assessment, Finding,
  Connector, Service Account/API Key, Identity Provider mapping, Policy (SLA/retention).
- **Pipeline de import** multi-formato (SARIF, Burp, ZAP, Nessus, Nuclei, Semgrep, Trivy).
- **Motor de SLA** (por severidade) e cálculo de estado (on_track/at_risk/breached).
- **Risk acceptance** com aprovação de duas pessoas (requester ≠ approver).
- Design system Carbon Dojo completo (Seção 5).

---

## 3. Modelo de domínio

### 3.1 Hierarquia e entidades
```
Organization ──1:N── BusinessUnit ──1:N── Product ──1:N── Engagement ──1:N── Assessment ──1:N── Finding
                                                   └── Connector (Jira) escopo por Product/Engagement
```
- **Finding** — uma vulnerabilidade: `severity` (critical|high|medium|low|info),
  `status` (triage|active|resolved|false_positive|risk_accepted), `sla`
  (on_track|at_risk|breached), `cve`, `cwe`, `cvss`, `source` (web|file|scanner),
  `description`, `remediation`, `jiraKey?`, timestamps, `productId`, `assessmentId`.
- **Engagement** — projeto de segurança sobre um Product: `type` (pentest|scan|bug
  bounty|red team), `status` (planned|active|completed), `jiraProject`.
- **Assessment** — uma execução/import dentro de um Engagement.
- **Connector** — integração Jira: `edition` (cloud|data center), `baseUrl`, `email`,
  `apiToken` (**write-only**, nunca retornado), `projectKey`, `issueType`, `status`.
- **Product/BU/Organization** — hierarquia de asset com CRUD e cascata de seleção.

### 3.2 Papéis e permissões (RBAC)
| Papel | Capacidade (resumo) |
|---|---|
| **Admin** | Tudo, inclusive Admin (users, SA/API keys, IdP, notifications, policies) |
| **Red Team Manager** | Gerir engagements/assessments, exportar, aprovar risco |
| **Red Team Analyst** | Triar findings, importar scans, comentar, solicitar risco |
| **Dev Owner** | Ver findings do seu produto, comentar, remediar |
| **Reader** | Somente leitura |

A UI mostra/esconde ações por permissão (tratamento visual **primary vs restrito**).
Escopos de exemplo: `findings:read`, `findings:write`, `imports:read`, `imports:write`,
`engagements:write`, `connectors:write`, `admin:*`.

### 3.3 Máquinas de estado
- **Finding.status:** `triage → active → (resolved | false_positive | risk_accepted)`.
- **Risk acceptance:** `requested (por user A) → approved (por user B ≠ A)`; exige data
  de reavaliação. Validação server-side: **approver ≠ requester**.
- **SLA:** derivado de `severity` + política + idade → `on_track|at_risk|breached`.
- **Import job:** `idle → queued → processing → done|error` (com contadores
  created/updated/reopened/errors).

---

## 4. Arquitetura de backend

### 4.1 Decisões
- **Reusar `td.server`** (Node 20 / Express / Knex / PostgreSQL 15). Novos módulos
  seguem o padrão de `controllers/ + services/ + repositories/ + db/migrations/`.
- **Multi-tenancy real:** toda leitura/escrita é escopada por Organization/BU/Product
  do principal autenticado. Sem borda "nil → Global" (ver Seção 10).
- **Import pipeline:** serviço que normaliza cada formato para o modelo `Finding`,
  de-duplica por (product, cwe/cve, título/fingerprint), e reabre findings fechados
  que voltaram a aparecer.
- **Secrets:** tokens de connector e chaves cifrados (AES-256-GCM já usado no v1),
  com **KEKs distintas por finalidade** (sem reuso).

### 4.2 Superfície de API (novos grupos, prefixados `/api/v1`)
```
/orgs  /business-units  /products                (CRUD hierárquico + cascata)
/engagements  /engagements/:id                    (+ export Jira, edit)
/assessments                                       (dentro de engagement)
/findings  /findings/:id                           (filtro/paginação por cursor assinado)
  /findings/:id/status  /findings/:id/comments  /findings/:id/evidence
  /findings/:id/risk-acceptance  (request/approve)  /findings/:id/export
/imports  /imports/:id                             (submit + status; :id escopado ao caller)
/connectors  /connectors/:id/test
/reports  (executive|technical → HTML/CSV/JSON)
/admin/users  /admin/service-accounts  /admin/audit
/admin/identity-providers  /admin/notifications  /admin/policies
/metrics                                            (atrás de auth / network policy)
```

### 4.3 Modelo de dados (migrations — esboço)
Tabelas novas: `organizations`, `business_units`, `products`, `engagements`,
`assessments`, `findings`, `finding_comments`, `finding_evidence`,
`risk_acceptances`, `connectors`, `service_accounts`, `api_keys`,
`identity_providers`, `idp_role_mappings`, `notification_channels`, `policies`
(SLA por severidade + retenção). Índices para filtros de findings
(product_id, severity, status, sla) e FKs com cascata controlada.

---

## 5. Design System **Carbon Dojo** (extraído do bundle)

> Materializar como `src/ui/tokens.css` (CSS variables) na Fase 0. Tema por atributo
> `data-theme="light|dark"` no container raiz (como no `.dc.html`) **ou** classe —
> decidir na Fase 0, mantendo compat com o toggle atual.

### 5.1 Tokens de cor — **Light** (padrão) e **Dark**
| Token | Light | Dark |
|---|---|---|
| `--bg` | `#f4f5f8` | `#0b0d14` |
| `--surface` | `#ffffff` | `#12151f` |
| `--surface-2` | `#f7f8fb` | `#171b27` |
| `--hover` | `#f0f1f6` | `#1c2130` |
| `--text` | `#14161f` | `#eceef4` |
| `--text-2` | `#565b6b` | `#a4abbd` |
| `--text-3` | `#888fa0` | `#6f7689` |
| `--border` | `#e7e9ef` | `#222838` |
| `--border-strong` | `#d7dae3` | `#313748` |
| `--accent` | `#5b50e6` | `#8079f6` |
| `--accent-hover` | `#4a40d4` | `#948dff` |
| `--accent-soft` | `#ecebfb` | `#201f3d` |
| `--accent-text` | `#4a40d4` | `#a9a3ff` |
| `--success` | `#16a34a` | `#34d399` |
| `--warning` | `#b45309` | `#fbbf24` |
| `--danger` | `#dc2626` | `#f87171` |

### 5.2 Paleta semântica de **severidade** (mantém significado; hue por tema)
| Severidade | Light | Dark |
|---|---|---|
| Critical | `#d92d20` | `#f04438` |
| High | `#e8590c` | `#f97316` |
| Medium | `#cf9700` | `#eab308` |
| Low | `#2563eb` | `#3b82f6` |
| Info | `#98a2b3` | `#8a93a6` |

- **Chip de severidade:** texto = cor da severidade; fundo = `rgba(cor, α)` com
  **α = 0.12 (light) / 0.18 (dark)**; ponto colorido + rótulo textual (nunca só cor).
- **SLA:** `on_track → --success`, `at_risk → --warning`, `breached → --danger`;
  badge com fundo `rgba(cor, α)` **α = 0.13 (light) / 0.18 (dark)**. Rótulos:
  "On track" / "At risk" / "Breached".
- **Status pill:** neutro (`--surface-2` + `--border-strong` + `--text-2`), capitalizado.

### 5.3 Tipografia
- Famílias: **Inter** (400/500/600/700/800) para UI; **JetBrains Mono** (400/500/600)
  para IDs/CVE/CWE/CVSS/código (classe `.cd-mono`).
- Base **14px**, line-height **1.5**. Escala observada: caption 11, small 12–13,
  body 14, título de card 14, H1 de página 22, display 24–34. `letter-spacing` de
  títulos ≈ `-0.02em`.

### 5.4 Forma, espaçamento, elevação, motion
- **Raio:** chips 6px, badges/botões pequenos 7px, inputs/botões 8px, cards **12px**,
  avatares 50%.
- **Espaçamento** (escala): 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 24 / 28 / 32.
- **Elevação:** sutil; ex.: toast `0 8px 24px rgba(8,10,16,0.18)`; cards com borda
  1px `--border` em vez de sombra pesada.
- **Foco:** `outline: 2px solid var(--accent); outline-offset: 2px` (focus-visible).
- **Motion:** `spin 0.8s linear`, `toast 0.2s ease`, `fade 0.15s ease`; respeitar
  `prefers-reduced-motion`.

### 5.5 Shell (dimensões)
- Sidebar fixa **240px** (desktop); drawer **264px** (mobile). Topbar sticky **60px**.
- Conteúdo `max-width: 1280px`, padding **28px**.
- **Breakpoint do shell:** `≤1023px` → sidebar some, aparece hambúrguer + drawer;
  `main` perde a margem de 240px. Brief: desktop ≥1280, tablet 768–1279, mobile <768.

### 5.6 Inventário de componentes (biblioteca a construir)
- **Navegação:** Sidebar (full/collapsed/drawer), Topbar (título+breadcrumb, busca,
  tema, user, logout), Breadcrumbs, Tabs.
- **Data display:** DataTable (header sticky, linhas densas, hover/seleção, ações de
  linha, paginação por cursor, **modo card no mobile**), Card, **KPI StatCard**,
  Description list, **SeverityChip**, **StatusPill**, **SLABadge**, Tag, Avatar,
  **Mono/ID token**, EmptyState, Skeleton/Loading, InlineError.
- **Charts:** Donut (severidade), barra segmentada (SLA), barra simples (por BU);
  legenda/tooltip consistentes. (Reusar Recharts ou SVG puro como no protótipo.)
- **Inputs/forms:** Text, Password (reveal), Select, Multi-select, Toggle,
  Checkbox/Radio, Date, **Dropzone** (upload), **cascading pickers**
  (Org→BU→Product→Engagement), FormRow (label/help/validação), **write-only secret
  field** ("•••• set/unset").
- **Overlays/feedback:** Modal/Dialog, ConfirmDialog (destrutivo=danger), Drawer/side
  panel, Toast (success/info/error/warn), Tooltip, Popover, Banner.
- **Botões:** primary, secondary/default, danger, ghost/tertiary, icon; tamanhos;
  estados loading e disabled.
- Para **cada** componente: `default / hover / focus-visible / active / disabled` e
  **light + dark**.

---

## 6. Navegação & rotas
Sidebar (ordem do design): **Dashboard, Findings, Engagements, Products, Import Scan,
Pentest Report, Connectors, Admin**. Topbar: breadcrumb (`Org / BU`), busca global
("Search findings, CVEs…"), toggle de tema, logout, avatar/role.

```
/login                          (split brand panel; SSO Okta/Azure AD; MFA; sso_error)
/dashboard
/findings            /findings/:id      (tabs Overview | Comments | Evidence)
/engagements         /engagements/:id   (export Jira em massa)
/products                                (cascata Org → BU → Product)
/import                                  (scope + dropzone + job status)
/report                                  (engagement + model executive|technical)
/connectors
/admin               (tabs: users | service | audit | identity | notifications | policies)
```
Guards: auth global; RBAC por rota e por ação; tenant scope em toda query; 403/404
dedicados; refresh preserva a tela.

---

## 7. Especificação das telas (mapeadas a entidades + componentes)

1. **Login** — card centrado (email, password+reveal, "Sign in") + **painel de marca**
   (gradiente accent, KPIs) + botões **SSO** (Okta/Azure AD) + passo **MFA** + banner
   de erro (`sso_error`). Rodapé "Protected by MFA · SOC 2 Type II".
2. **Dashboard** — filtros Org/BU/Product; **KPI cards** (Total findings, Critical &
   High, SLA breached, In triage); **donut** por severidade; **barra segmentada** de
   SLA; tabela **por Business Unit** (Total/Crit/High/Med/Low/Breached + mini-barra).
3. **Findings list** — FilterBar (Org/BU/Product/Severity/Status + Reset); **DataTable**
   (SeverityChip, Título, StatusPill, SLABadge, ID Jira mono); paginação prev/next;
   linha → detalhe; **cards no mobile**; empty/loading/error.
4. **Finding detail** — header (SeverityChip + título + StatusPill; linha mono
   CWE·CVSS·Jira); cards **Change status** (select+Transition) e **Export to Jira**;
   painel **Risk acceptance** (stepper de 2 pessoas: Requested ✓ / Awaiting approval;
   data de reavaliação; Request/Approve); **Tabs** Overview (Description + Remediation +
   Details: Source/CVE/CWE/CVSS/SLA/Jira) | Comments (thread + textarea) | Evidence
   (empty state + upload).
5. **Engagements list** — form **New engagement** (Name, Type, Jira project) + **DataTable**
   (Name, Type chip, Status badge, Jira) → detalhe.
6. **Engagement detail** — header (nome, type, status, **Edit**); painel **Export to
   Jira** com tabela de findings **selecionável** (checkbox por linha + bulk "Export
   selected (N)"; estado de export por finding: mono `PEN-x` ou "Not exported").
7. **Products / Assets** — três colunas em cascata **Organizations → Business units →
   Products**, cada uma com create (+) e itens com Edit/Delete; seleção realça a coluna
   seguinte. Mobile: empilhar / progressive disclosure.
8. **Import Scan** — Scope (Org/BU/Product/Engagement/Assessment) + **Format** (SARIF,
   Burp, ZAP, Nessus, Nuclei, Semgrep, Trivy) + **Dropzone** + botão Submit; card
   **Job status** (idle / running spinner / done com contadores Created/Updated/
   Reopened/Errors / error).
9. **Pentest Report** — picker de Engagement + **Report model** (Executive|Technical) +
   export HTML/CSV/JSON + **preview** (capa confidencial, resumo por severidade,
   findings com descrição + remediation destacada).
10. **Connectors** — form **New Jira connector** (Name, Edition, Base URL, Email, **API
    token write-only**, Project key, Issue type) + tabela (Name, Type, Base URL, Status
    enabled, **Test**/Delete). Secret nunca exibido (só set/unset).
11. **Admin** — tabs: **Users & Roles** (create + tabela com avatar/role/status/Edit),
    **Service Accounts & API Keys** (escopos; secrets write-only), **Audit Log**
    (imutável), **Identity Providers** (OIDC/SAML + group→role), **Notifications**
    (SMTP/Teams), **Policies** (SLA por severidade + retenção de dados).

---

## 8. Arquitetura de frontend (alvo `ct.client/src`)
```
app/        router.tsx, providers.tsx, routes/ (lazy por rota), guards
shell/      AppShell, Sidebar, Topbar, Breadcrumbs, CommandPalette
ui/         tokens.css, primitives/ (Seção 5.6), patterns/ (DataTable, PageHeader,
            FilterBar, StatCard, EmptyState, cascading pickers, charts)
features/   dashboard/ findings/ engagements/ products/ import/ report/
            connectors/ admin/ auth/
api/        clientes por domínio (novos) — reusar axios/React Query
store/      Zustand (auth, ui) — reusar
```
Estado: **React Query** para dados de servidor; **Zustand** para auth/UI. Roteamento:
**React Router v6** com guards. Ícones: lucide-react (paths já presentes no design).

---

## 9. Destino dos ativos de threat-modeling (v1) — **SUBSTITUIÇÃO TOTAL**
> **Decisão do usuário (2026-07-09):** a IA de threat-modeling é **removida por
> completo** na V2 (não há módulo legado atrás de flag). Salvamos só as peças
> reutilizáveis; o resto é descomissionado no mesmo PR em que o substituto entra.

- **OSV Scanner** → **salvo**, vira **fonte de import** de findings (`osvScanner.js`).
- **Reports/exporters (PDF/SARIF)** → **salvos** como base do **Pentest Report**.
- **Integrações (Jira/GitHub/GitLab), auth/SSO/RBAC, audit, backup, SMTP/Teams** →
  **salvos** e reusados em Connectors/Admin.
- **Projects/Threats/Assets views, canvas ReactFlow, STRIDE, yjs, ATT&CK** →
  **REMOVIDOS** (frontend `ct.client/src/views/*` + `components/Canvas/*`; controllers/
  serviços de backend correspondentes descomissionados após migração de dados relevante).
  ATT&CK **não** entra na V2.

---

## 10. Requisitos de segurança do novo backend (baked-in)
O seed de findings do design corresponde a um pentest real do produto
(CT-2026-01..13). O novo backend **deve** nascer sem essas classes:
- **Isolamento de tenant** em `listEngagements`, `GetImport` e toda leitura — sem
  vazamento cross-tenant; sem cadeia enum→import.
- **Autorização object-level** (sem BOLA/IDOR) em products/engagements/imports/findings;
  exigir principal autenticado; **negar quando o escopo resolver para Global**.
- **Service accounts least-privilege** — nunca `global:true` por padrão; avaliar escopo
  antes de qualquer curto-circuito.
- **MFA:** contador + lockout no `VerifyMFA`; rate-limit por **conta** (não por IP).
- **Sem user enumeration:** resposta/timing uniforme para conta inexistente vs. locked.
- **`/metrics`** atrás de auth/network policy; sem labels sensíveis.
- **Retenção de PII (LGPD):** job de expurgo para `audit_events` e `sessions`.
- **Cripto:** KEKs distintas por finalidade (sem reuso); webhook **fail-closed** sem
  secret; **egress allowlist** para webhooks (sem SSRF Teams).
- **Prompt injection (MCP):** sanitizar/delimitar texto de finding entregue a agentes.
- **Sessões:** revogar todas no reset de senha; **JWT** rejeitar `alg=none`.
- **Injeção:** queries parametrizadas (sem SQLi); cursores de paginação **assinados**.
- **Headers:** CSP `frame-ancestors` + `X-Frame-Options: DENY`.

---

## 11. Estratégia de entrega
1. **Design system primeiro** (Fase 0): tokens + primitivas + shell — base de tudo,
   sem depender do domínio.
2. **Backend por vertical** (Fase 1–2): modelar dados → subir APIs por domínio, cada
   uma com autorização/tenant scope testados.
3. **Frontend por tela** (Fase 3–4): shell/rotas/login → uma tela por prompt, cada uma
   responsiva (card no mobile), light+dark, acessível.
4. **Cross-cutting** (Fase 5): SLA engine, risk acceptance 2-pessoas, notifications,
   audit, import pipeline completo.
5. **Acabamento** (Fase 6): PWA, a11y AA, e2e responsivo, hardening da Seção 10, docs.
6. **Feature flags** apenas para módulos novos ainda sem backend (não há legado
   threat-model a manter — ele é removido, Seção 9).

---

## 12. Sequência de prompts de implementação (roteiro executável)

> Convenções para todos os prompts: trabalhar no repo; **não** quebrar build/lint/test;
> adicionar testes; **sem valores de cor ad-hoc** (usar tokens da Seção 5); toda tela
> responsiva + acessível + light/dark; toda rota/endpoint com **tenant scope + RBAC**
> conforme Seção 3.2/10. Ao fim de cada prompt: rodar test/lint/build e reportar diff.

### FASE 0 — Design system (frontend, IA-agnóstico)

**Prompt 0.1 — Tokens Carbon Dojo**
```
Crie ct.client/src/ui/tokens.css com as CSS variables das tabelas 5.1/5.2 (light e
dark), tipografia (Inter + JetBrains Mono), raio, espaçamento, sombras e motion (5.3/5.4).
Aplique o tema por data-theme no container raiz (ou classe), preservando um toggle
light/dark; light é o padrão. Importe tokens.css no entrypoint. Prove build/test verdes
e um componente demo consumindo os tokens nos dois temas. Sem tela de domínio ainda.
```

**Prompt 0.2 — Tailwind (opcional) + utilidades derivadas dos tokens**
```
Se adotar Tailwind v4: configure mapeando cores/espaços/raios/breakpoints para as
variáveis do tokens.css (sem duplicar valores). Defina breakpoints do brief
(mobile <768, tablet 768–1279, desktop ≥1280) e o corte de shell em 1023px. Utilitário
para prefers-reduced-motion. Sem mudança visual fora do demo.
```

**Prompt 0.3 — Primitivas**
```
Implemente src/ui/primitives conforme a Seção 5.6, espelhando o visual do
Carbon Dojo.dc.html: Button (primary/secondary/danger/ghost/icon; sizes; loading/
disabled), Input/Password(reveal)/Select/Multi-select/Toggle/Checkbox/Radio/Date,
Dropzone, write-only SecretField, Card, Dialog/ConfirmDialog, Drawer, Tabs, Tooltip,
Popover, Toast, Banner, Avatar, Tag, Badge. Estados default/hover/focus-visible/active/
disabled e light+dark. Teste cada primitiva (render, variantes, teclado).
```

**Prompt 0.4 — Componentes de segurança/domínio-neutros**
```
Implemente SeverityChip, StatusPill, SLABadge, MonoToken/ID, KPI StatCard, DataTable
(sticky header, densa, hover/seleção, ações de linha, paginação por cursor, MODO CARD
em <768px), FilterBar, PageHeader, EmptyState, Skeleton, InlineError, e os charts
(donut de severidade, barra segmentada de SLA, barra por BU) — todos com as cores da
Seção 5.2 e nunca "cor sozinha". Testes + snapshot nos dois temas.
```

### FASE 1 — Fundação de backend (domínio + segurança)

**Prompt 1.1 — Decisões de Fase 1 (ADR)**
```
Produza um ADR curto decidindo: (a) reuso de td.server (Node/Knex/PG) vs. serviço
novo; (b) plano de **remoção** do threat-modeling/ATT&CK/canvas (Seção 9 — decisão já
tomada: SUBSTITUIÇÃO TOTAL; mapear arquivos a apagar e migração de dados a salvar antes);
(c) estratégia de multi-tenancy (coluna org_id + row-level scoping) e de secrets (KEKs
distintas). Não escreva schema ainda; entregue o ADR em docs/v2/adr/.
```

**Prompt 1.2 — Modelo de dados + migrations**
```
Crie as migrations Knex para: organizations, business_units, products, engagements,
assessments, findings (+ índices product_id/severity/status/sla), finding_comments,
finding_evidence, risk_acceptances, connectors, service_accounts, api_keys,
identity_providers, idp_role_mappings, notification_channels, policies. FKs com cascata
controlada e org_id em todas para tenant scope. Seeds mínimos de dev. Testes de migração.
```

**Prompt 1.3 — RBAC, papéis e escopos**
```
Estenda o RBAC para os papéis Admin, Red Team Manager, Red Team Analyst, Dev Owner,
Reader e os escopos da Seção 3.2. Middleware que exige principal autenticado e resolve
tenant scope; NUNCA cair para Global por padrão (Seção 10). Testes de autorização
cobrindo BOLA/IDOR e cross-tenant.
```

### FASE 2 — APIs por domínio (uma vertical por prompt)

> Cada prompt: controller + service + repository + testes; tenant scope + RBAC;
> validação de entrada; erros consistentes.

- **Prompt 2.1 — Products/BU/Org** (CRUD hierárquico + cascata; ownership checks).
- **Prompt 2.2 — Engagements + Assessments** (CRUD; `listEngagements` com tenant
  isolation; export Jira scaffolding).
- **Prompt 2.3 — Findings** (filtro/paginação por **cursor assinado**; status
  transitions; comments; evidence; export por finding). Sem IDOR em `/findings/:id`.
- **Prompt 2.4 — Risk acceptance** (request/approve com **approver ≠ requester**
  validado server-side; data de reavaliação; audit).
- **Prompt 2.5 — Connectors (Jira)** (CRUD; token **write-only** cifrado; `/test`;
  export findings→issues reusando `integrations.ts`).
- **Prompt 2.6 — Import pipeline** (submit + job status; parsers SARIF/Burp/ZAP/Nessus/
  Nuclei/Semgrep/Trivy + **OSV** reusado; de-dup e reopen; `GET /imports/:id` escopado
  ao caller com `imports:read`).
- **Prompt 2.7 — SLA engine + Policies** (SLA por severidade; cálculo
  on_track/at_risk/breached; retenção/expurgo LGPD).
- **Prompt 2.8 — Reports** (executive|technical → HTML/CSV/JSON; reusar exporters v1).
- **Prompt 2.9 — Admin** (users, service accounts/API keys, audit log imutável, IdP +
  group→role, notifications SMTP/Teams com egress allowlist).

### FASE 3 — Shell e autenticação (frontend)

- **Prompt 3.1 — AppShell + Sidebar + Topbar + Drawer** (Seção 5.5/6; breakpoints;
  busca global slot; toggle tema; menu do usuário; RBAC na nav).
- **Prompt 3.2 — Roteamento + guards** (React Router; rotas da Seção 6; auth/RBAC/tenant;
  403/404; refresh preserva tela).
- **Prompt 3.3 — Login** (split brand panel; email/senha+reveal; SSO Okta/Azure AD; MFA;
  banner sso_error; responsivo).

### FASE 4 — Telas de domínio (uma por prompt)

> Padrão: consumir as APIs da Fase 2 via React Query; DataTable→card no mobile; empty/
> loading/error; light+dark; a11y (severidade/SLA com texto+ícone); testes de render +
> breakpoint.

- **Prompt 4.1 — Dashboard** (KPIs + donut + SLA bar + tabela por BU + filtros).
- **Prompt 4.2 — Findings list** (FilterBar + DataTable + paginação; cards mobile).
- **Prompt 4.3 — Finding detail** (tabs Overview/Comments/Evidence; change status;
  export Jira; **risk acceptance 2 pessoas**).
- **Prompt 4.4 — Engagements list + detail** (form + tabela; export Jira em massa
  selecionável com estado por finding).
- **Prompt 4.5 — Products/Assets** (cascata Org→BU→Product; CRUD inline; mobile empilha).
- **Prompt 4.6 — Import Scan** (scope + format + dropzone + job status com contadores).
- **Prompt 4.7 — Pentest Report** (model exec/técnico + export + preview).
- **Prompt 4.8 — Connectors** (form Jira + write-only secret + tabela + test/delete).
- **Prompt 4.9 — Admin** (6 tabs; users/roles primeiro; demais como listas configuráveis).

### FASE 5 — Cross-cutting
- **Prompt 5.1 — Notifications/Alerts** (fim de import, novos criticals, SLA breach;
  badge no topbar; SMTP/Teams).
- **Prompt 5.2 — Audit trail UI** + filtros; imutabilidade no backend.
- **Prompt 5.3 — Command Palette (⌘K)** + busca global (findings/CVEs/telas/ações).

### FASE 6 — Acabamento
- **Prompt 6.1 — PWA + performance** (instalável; code-split por rota; Lighthouse ≥90).
- **Prompt 6.2 — Auditoria WCAG 2.1 AA** (axe em todas as rotas; foco/teclado/contraste
  severidade nos 2 temas; Lighthouse A11y ≥95).
- **Prompt 6.3 — Hardening de segurança** (checklist da Seção 10 verificado com testes).
- **Prompt 6.4 — E2E responsivo (Playwright)** nos 3 breakpoints para fluxos-chave:
  login→dashboard, filtrar findings, triar finding, risk acceptance, import, export Jira.
- **Prompt 6.5 — Docs** (arquitetura v2, API, schema, guia de design tokens).

---

## 13. Definition of Done
**Por prompt:** funcionalidade + testes; tenant scope + RBAC (quando backend);
responsivo + a11y + light/dark (quando frontend); tokens da Seção 5 (sem cor ad-hoc);
build/lint/test verdes.
**Global (V2):** 11 telas entregues nos 2 temas e 3 breakpoints; domínio Carbon Dojo
completo; segurança da Seção 10 verificada; métricas da Seção 1.3 atingidas; destino do
legado threat-model decidido e implementado (flag ou remoção sinalizada).

---

## 14. Riscos e mitigações
| Risco | Impacto | Mitigação |
|---|---|---|
| Re-plataforma exige backend novo grande | Alto | Entregar por vertical (Fase 2), cada uma testável; reusar auth/OSV/reports/integrations do v1 |
| Substituição total remove threat-modeling (decisão tomada) | Alto | Salvar peças reusáveis (OSV/reports/integrations/auth) ANTES de apagar; remover no mesmo PR do substituto; migração de dados relevante primeiro |
| Falhas de AuthZ/tenant (repetir o pentest) | Alto | Seção 10 baked-in; testes de BOLA/IDOR/cross-tenant obrigatórios |
| Parsers de import heterogêneos (7 formatos) | Médio | Normalizador comum + testes por formato; começar por SARIF + OSV (reuso) |
| Contraste de severidade/SLA em light | Médio | Cores já calibradas para AA por tema (5.2); validar com axe |
| Divergência tokens antigos × Carbon Dojo | Baixo | Carbon Dojo é fonte de verdade; `index.css` reconciliado |

---

## 15. Ordem de execução
```
Fase 0 (0.1→0.4)  →  Fase 1 (1.1 ADR → 1.2 → 1.3)
→ Fase 2 (2.1 … 2.9, por vertical)
→ Fase 3 (3.1→3.3)  →  Fase 4 (4.1 … 4.9, por tela)
→ Fase 5 (5.1→5.3)  →  Fase 6 (6.1→6.5)
```
**Decisão travada (2026-07-09):** SUBSTITUIÇÃO TOTAL — a IA de threat-modeling/ATT&CK é
removida (Seção 9). Sem bloqueio de escopo pendente.
```
