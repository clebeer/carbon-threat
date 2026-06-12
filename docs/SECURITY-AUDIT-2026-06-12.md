# 🔒 CarbonThreat — Relatório de Auditoria de Segurança (Pentest Estático)

**Data:** 12/06/2026
**Target:** Repositório `carbon-threat` — branch `feature/stride-engine-integration`
**Metodologia:** Revisão de código no nível de pentest (SAST manual) + análise de controle de acesso, seguindo OWASP ASVS / Testing Guide v4 e OWASP Top 10 2021/API Top 10 2023.
**Escopo:** `td.server` (Express/Node), `ct.client` (React), `stride-engine` (FastAPI/Python).
**Restrição combinada:** nenhum ataque executado contra infraestrutura. Itens que exigem validação dinâmica estão marcados como **[requer ambiente]**.

---

## 📊 Sumário Executivo

A base de código está, no geral, **bem defendida** — há evidência de rodadas anteriores de hardening (JWT RS256, rotação de refresh token, bloqueio de mass-assignment em usuários, sanitização de path traversal em backups, CSP com nonce, SSRF guard no webhook, redação de segredos). A maioria dos vetores clássicos (SQLi, XSS refletido, command injection por shell, secrets versionados) **não** se aplica.

Os achados abaixo são **novos** em relação ao relatório de 14/05/2026 e foram confirmados por leitura de código.

| Severidade | Qtd | IDs |
|:----------:|:---:|:----|
| 🔴 Critical | 0 | — |
| 🟠 High | 1 | CT-2026-01 |
| 🟡 Medium | 4 | CT-2026-02, 03, 04, 05 |
| 🔵 Low | 4 | CT-2026-06, 07, 08, 09 |
| ⚪ Info | 4 | CT-2026-10..13 |

**Recomendação prioritária:** corrigir **CT-2026-01** (revogação de sessão/privilégio ineficaz) — é o único achado com impacto direto de controle de acesso pós-autenticação.

---

## 🟠 HIGH

### CT-2026-01 — Revogação de sessão e de privilégio ineficaz (Broken Access Control / Improper Session Termination)

**Arquivos:** `td.server/src/config/bearer.config.js`, `td.server/src/controllers/auth.js` (`refresh`), `td.server/src/repositories/token.js` (`verify`), `td.server/src/controllers/users.js` (`deleteUser`, `updateUser`)

**OWASP:** A01:2021 Broken Access Control / A07 Identification & Authentication Failures.

**Descrição:**
O papel (`role`) e a identidade do usuário são gravados no JWT no momento do login e **nunca são revalidados contra o banco** durante o ciclo de vida da sessão:

1. O middleware `bearer.middleware` apenas valida assinatura e expiração do access token (`jwt.verifyToken`). Não consulta a tabela `users`, logo **não verifica `is_active`** nem o papel atual.
2. `deleteUser` faz *soft-delete* (`is_active = false`), mas isso não invalida tokens já emitidos.
3. O endpoint `POST /api/token/refresh` (`auth.refresh`) chama `tokenRepo.verify`, que confirma apenas que o refresh token existe na tabela e é criptograficamente válido — **sem checar se o usuário ainda está ativo**. Em seguida reemite um novo par de tokens **copiando `provider`/`user` (inclusive `role`) do token antigo**.

**Impacto:**
- **Usuário desativado continua autenticado:** o access token segue válido por até 1 dia; e como o refresh reemite indefinidamente um novo par a cada 7 dias sem checar `is_active`, a sessão **nunca expira sozinha**. Desativar uma conta comprometida não corta o acesso.
- **Rebaixamento de privilégio não tem efeito:** se um admin é rebaixado para `viewer`, o refresh token dele ainda carrega `role: admin` e o refresh continua emitindo tokens de admin — persistência de privilégio por tempo indeterminado.
- Hoje a única forma de revogar de fato é apagar manualmente as linhas em `refresh_tokens` e esperar o access token expirar.

**Validação [requer ambiente]:** login → desativar o usuário via outro admin → confirmar que `GET /api/users/:id` ainda responde com o token antigo e que `POST /api/token/refresh` continua emitindo tokens.

**Remediação:**
- No `bearer.middleware`, após validar o JWT, carregar o usuário (`db('users').where({id}).first()`) e rejeitar se `!is_active`; usar o `role` **do banco**, não o do token (ou cachear por poucos segundos). 
- No `refresh`, revalidar `is_active` e **reler `role`/claims do banco** antes de reemitir.
- Considerar invalidar todos os refresh tokens do usuário em `deleteUser`/rebaixamento (`DELETE FROM refresh_tokens WHERE user_id = ?`) — requer associar `user_id` à linha do token (hoje a tabela guarda só `token`/`expires_at`).

---

## 🟡 MEDIUM

### CT-2026-02 — SSRF no scanner de repositório git (sem validação de destino)

**Arquivo:** `td.server/src/services/osvScanner.js` → `extractPackagesFromGitRepo` (clone), exposto por `POST /api/scanner/scans` (`scan_type: "git"`, role `analyst`+).

**Descrição:** o webhook de integrações (`integrations/third-party.js`) usa `assertPublicUrl()` para resolver o DNS e **bloquear endereços privados/loopback/metadata** (169.254.169.254, RFC1918, etc.). O scanner git **não** aplica esse mesmo guard: valida apenas que o protocolo é `http(s)` e que a URL faz parse. Um usuário `analyst` pode disparar `git clone` contra `http://169.254.169.254/...`, `http://localhost:<porta>/` ou hosts internos.

**Impacto:** SSRF cega — varredura de portas/hosts internos e requisição a endpoints internos a partir do servidor. O `git clone` em si não interpreta a resposta como segredo, mas erros/timeouts diferenciados permitem inferência de serviços internos. (Argument-injection do tipo `ext::`/`--upload-pack` está **mitigada** pela exigência de protocolo http/https.)

**Remediação:** reutilizar `assertPublicUrl()` (de `third-party.js`) no caminho git e container antes de clonar/puxar; idealmente extrair esse guard para um helper compartilhado.

---

### CT-2026-03 — SAML sem proteção anti-replay (`validateInResponseTo`) e sem `audience` explícito

**Arquivo:** `td.server/src/config/saml.config.js` (`getSamlConfig`).

**Descrição:** a configuração da `SamlStrategy` define `wantAssertionsSigned` (bom), mas **não define `validateInResponseTo`** (rastreamento de `InResponseTo` para impedir replay de respostas SAML) nem `audience` explícito (restrição de audiência). Dependendo da versão do `@node-saml/passport-saml`, esses defaults não são seguros o bastante para um cenário enterprise.

**Impacto:** uma resposta SAML interceptada pode ser reapresentada (replay) dentro da janela de validade; sem `audience`, uma asserção emitida para outro SP poderia ser aceita.

**Remediação:** definir `validateInResponseTo: 'always'` (com store de requestId), `audience: <SP entityID>`, `wantAuthnResponseSigned: true` e `acceptedClockSkewMs` controlado. Validar contra Azure AD/Okta após o ajuste. **[requer ambiente IdP para teste dinâmico]**

---

### CT-2026-04 — Scanner de container: pull/execução de imagem arbitrária via Docker

**Arquivo:** `td.server/src/services/osvScanner.js` → `extractPackagesFromContainer`, via `POST /api/scanner/scans` (`scan_type: "container"`, role `analyst`+).

**Descrição:** o serviço executa `docker pull/create/export` sobre um `image_name` fornecido pelo usuário (validado por regex de caracteres e `--` como separador — sem command injection). Porém um `analyst` pode fazer o servidor **puxar e materializar o filesystem de qualquer imagem** do registry público. Isso pressupõe acesso ao daemon Docker (socket) pelo processo do servidor.

**Impacto:** abuso de recurso (disco/CPU/rede — imagens grandes, 300s de timeout no pull), e ampliação de superfície: se o socket é o do host, qualquer falha futura nesse fluxo se aproxima de container escape; `docker export` de imagem maliciosa cria arquivos controlados pelo atacante em `tmp` (mitigado por `walkDirForPackages` ler só manifests). 

**Remediação:** restringir a feature a `admin`; aplicar allowlist de registries; impor cotas de tamanho/disco; isolar o builder (DinD sem socket do host, ou usar um analisador estático de imagem como `syft`/`trivy` em vez do daemon Docker).

---

### CT-2026-05 — SSRF guard de integrações vulnerável a DNS rebinding (TOCTOU)

**Arquivo:** `td.server/src/integrations/third-party.js` → `assertPublicUrl` + `axios.post`.

**Descrição:** `assertPublicUrl` resolve o hostname e valida os IPs, mas depois o `axios` faz **a sua própria resolução DNS** na hora da conexão (janela TOCTOU). Um domínio controlado pelo atacante com TTL baixo pode responder um IP público na validação e um IP interno (169.254.169.254 / RFC1918) no momento da requisição.

**Impacto:** SSRF para rede interna a partir de integrações Jira/ServiceNow. **Mitigado parcialmente** por `maxRedirects: 0` e por exigir papel `admin` para configurar a integração — daí severidade Medium e não High.

**Remediação:** "pin" do IP validado — resolver uma vez e forçar a conexão para aquele IP (ex.: `lookup` custom no agente HTTP, ou `axios` com `httpAgent` que rejeita re-resolução), ou usar uma biblioteca anti-SSRF que valide no momento do socket connect.

---

## 🔵 LOW

### CT-2026-06 — `GET /api/config` expõe metadados do banco sem autenticação
**Arquivo:** `controllers/config.js` → `config`. Retorna `db_config` (host, porta, nome, **usuário** do PostgreSQL) sem auth. Info disclosure que facilita ataques direcionados. **Remediação:** remover `db_config` da resposta pública; expor apenas `status` e `auth_type`.

### CT-2026-07 — `POST /api/config/test-db` como primitiva de port-scan pré-setup
**Arquivo:** `controllers/config.js` → `testDbConnection` (sem auth, só antes do setup). Mitigado por `validateEnterpriseSetupPgHost`, mas mensagens de erro distintas (`ECONNREFUSED` vs timeout) permitem inferir serviços. **Remediação:** exigir `SETUP_TOKEN` obrigatório (não opcional) e normalizar mensagens de erro.

### CT-2026-08 — Redação de segredos baseada só em nome de chave
**Arquivo:** `controllers/integrationsController.js` → `redactSecrets` (`SECRET_KEYS = token, password, apiKey, api_key, clientSecret, client_secret`). Campos como `signingSecret`/`signing_secret` (Slack), `privateKey`, `cert`, ou um token embutido dentro de `webhookUrl` **não são redigidos** e podem vazar no `GET /api/integrations/:platform` (acessível a `viewer`). **Remediação:** redação por allowlist de campos exibíveis (em vez de blocklist) e nunca devolver URLs com credenciais embutidas.

### CT-2026-09 — Rate limiting in-memory e ausência de account lockout
**Arquivo:** `config/routes.config.js` (`authLimiter` 20/15min). O store padrão do `express-rate-limit` é por instância — em deploy multi-réplica o limite efetivo se multiplica. Não há lockout por conta (apenas por IP). **Remediação:** store compartilhado (Redis) e contador de falhas por conta com backoff.

---

## ⚪ INFORMATIVO

- **CT-2026-10** — Propagação de papel obsoleta: subconjunto de CT-2026-01; mesmo com a correção do refresh, o access token vive até 1 dia. Considere reduzir `expiresIn` do access token para ~15min.
- **CT-2026-11** — `stride-engine/service.py`: comparação do `x-internal-token` com `!=` não é constant-time. Risco baixo (token interno), mas use `hmac.compare_digest`.
- **CT-2026-12** — CSP mantém `'unsafe-inline'` em `style-src` por causa do ReactFlow (tradeoff documentado). Acompanhar para remover quando possível.
- **CT-2026-13** — Inconsistência de limites: `osvScannerController` cita `MAX_CONTENT_LENGTH = 50MB`, mas `parsers.config.js` impõe `5mb` no body parser global — uploads de lockfile entre 5–50MB são rejeitados com 413 antes de chegar ao handler (mais seguro, porém confuso). Alinhar os valores/documentar. Relacionado: isolamento de integrações quando `org_id` é `null` (todos os usuários locais/SSO são criados sem org) — em cenário multi-tenant, configs `org_id IS NULL` são compartilhadas (segredos redigidos). Definir org obrigatória ou fallback por `owner_id` também para integrações.

---

## ✅ Controles verificados como adequados

- **SQL Injection:** todas as queries usam Knex parametrizado; `knex.raw` aparece só em migrations com literais. Sem concatenação de input.
- **Command Injection (shell):** `osvScanner` usa `execFile` (sem shell) com `--` em docker/tar; git protegido por validação de protocolo.
- **Auth local:** bcrypt (cost 12), mitigação de timing com hash dummy, senha mínima de 12 chars, bootstrap admin gated por contagem de usuários.
- **JWT:** algoritmos restritos explicitamente (`['RS256']`/`['HS256']`), sem alg-confusion; suporte a RS256.
- **IDOR em usuários:** `updateUser`/`changePassword`/`getUser` aplicam checagem object-level (self vs admin); mass-assignment de `password`/`role` bloqueado para não-admin.
- **Backups:** admin-only; `sanitizeName` bloqueia traversal.
- **Headers:** Helmet + CSP com nonce, sem `unsafe-eval`, `frameAncestors 'none'`, HSTS, Permissions-Policy restritiva. Sem CORS permissivo.
- **Segredos:** `.env`, `certs/` e chaves **não** versionados; nunca estiveram no histórico git.
- **Python (stride-engine):** sem `eval/exec/pickle/yaml.load/os.system`; auth por token interno.

---

## Próximos passos sugeridos

1. Corrigir **CT-2026-01** (prioridade máxima) — revalidação de `is_active`/role no bearer e no refresh.
2. Compartilhar o SSRF guard entre webhook, git scan e container scan (CT-2026-02/04/05).
3. Endurecer a config SAML (CT-2026-03).
4. **[requer ambiente]** Posso conduzir validação dinâmica (DAST/fuzzing autenticado) dos achados marcados se você subir uma instância — me passe a URL base, credenciais de teste (admin + viewer) e, se possível, um IdP SAML de teste. **Não executarei** ataques sem esse ambiente dedicado, conforme combinado.
