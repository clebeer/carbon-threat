# Carbon Threat: análise adversarial e plano de reestruturação

- **Data:** 2026-10-07
- **Escopo:** repositório completo (`td.server`, `ct.client`, `stride-engine`, docs, CI, histórico git)
- **Método:** leitura direta do código, com dois auditores independentes (backend/segurança e produto/frontend/OSS). Os achados críticos foram reverificados manualmente. As referências são `arquivo:linha`.

> ℹ️ Versão pública. Os detalhes técnicos das vulnerabilidades da v1 (seção 2.3) ficam fora do repositório, em `docs/strategy/private/` (ignorado pelo git). A v1 não é suportada e não deve ser implantada; veja [SECURITY.md](../../SECURITY.md).

---

## 0. TL;DR

1. **Hoje o projeto não é um produto.** É um fork do OWASP Threat Dragon parado no meio de um pivô para um clone do DefectDojo.
   - O README vende o produto antigo.
   - A UI nova é um mock, com login falso e dados de 59 linhas de fixture.
   - O backend só expõe as APIs antigas.
   - O domínio novo existe apenas como migrations sem nenhuma rota.
2. **Para uma ferramenta de segurança, a postura de segurança é desqualificante.**
   - A v1 tem falhas conhecidas e não corrigidas de isolamento entre tenants, de autorização e de bootstrap/setup.
   - O módulo de isolamento escrito para a v2 nunca foi conectado ao código de produção.
   - O `security.md` mandava os reports de vulnerabilidade para o projeto errado (o upstream da OWASP).
3. **O pivô para "Carbon Dojo" leva a uma briga perdida.** Ele compete de frente com o DefectDojo, que é gratuito, maduro, tem centenas de parsers e uma comunidade grande. O projeto não tem diferencial, tem 1 mantenedor e cerca de 50% dos commits vêm de bots/IA.
4. **Recomendação: reestruturação total para "threat modeling as code".**
   - Um CLI de binário único, CI-native, determinístico primeiro e com IA opcional.
   - Diferenciais: gera o modelo a partir de IaC/código e mostra **"quais ameaças este PR introduz"**.
   - Esse nicho tem demanda real e nenhum líder open source ativo. Os ativos que valem algo no repo atual (motor STRIDE, ATT&CK, OSV, SARIF, importadores draw.io/Visio) servem a ele.
   - **Isto reverte a decisão de 2026-07-09 (ADR 0001) de remover threat modeling.** A justificativa está na seção 3.

---

## 1. Veredito por dimensão

| Dimensão | Nota | Resumo |
|---|---|---|
| Identidade de produto | 1/5 | Três produtos descritos (README, SDD, código) e nenhum entregue de ponta a ponta |
| Diferenciação de mercado | 1/5 | v1 é Threat Dragon + extras rasos; v2 é DefectDojo sem os parsers |
| Arquitetura | 2/5 | Monólito Express com saída Babel commitada e viva, três esquemas de tenant, 28 controllers chamando `db()` direto |
| Segurança (da própria ferramenta) | 1/5 | Vazamento cross-tenant, escalada via OAuth, segredos default, achados de pentest "corrigidos" que continuam abertos |
| Qualidade e testes | 2/5 | Testes cobrem justamente o código que não roda; zero testes nos pontos dos achados críticos |
| Distribuição e DX | 1/5 | Exige Postgres + TLS + Docker + `.env` manual; sem CLI, sem release, sem tag, sem imagem publicada |
| Prontidão OSS | 1/5 | Sem CONTRIBUTING, CoC, NOTICE, templates ou CHANGELOG; metadata aponta para a OWASP; bus factor 1 |
| Momentum | 1/5 | Último commit em 2026-07-10, cerca de 3 meses parado |

---

## 2. Achados (com evidência)

### 2.1 Produto: crise de identidade

- **O README vende o produto antigo.** `README.md:3` diz "Enterprise threat modeling platform — built on OWASP Threat Dragon". Lista STRIDE/LINDDUN, ATT&CK, wizard e credenciais default. As screenshots também são da UI antiga.
- **O SDD v2 descreve outro produto.** Segundo `specs/carbon-dojo-interface-redesign/SDD-carbon-dojo-v2.md:2-8`, o produto vira um "console de gestão de vulnerabilidades & pentest". A hierarquia `Org → BU → Product → Engagement → Finding` e o import de SARIF/Burp/ZAP/Nessus/Nuclei/Semgrep/Trivy são o modelo do DefectDojo. Até o nome ("Dojo") remete a ele.
- **O SDD se contradiz.** A §9 diz "sem flag de legado", e a §13 (DoD) diz "flag ou remoção sinalizada". O SDD também cita uma fonte de design (`Carbon Dojo.dc.html`) que não existe no repo.
- **O escopo muda sem parar.**
  - A integração Jules foi planejada em 1.687 linhas de doc e depois removida (`017_remove_jules.js`).
  - Há SIEM export e "7 novas integrações", um dashboard editável e backup/restore.
  - Tudo foi construído em ~4 meses por 1 pessoa e abandonado no pivô.
- **Metadata errada.**
  - `package.json:39-47` aponta homepage, repo e bugs para `OWASP/threat-dragon` e para o e-mail do mantenedor upstream.
  - `package.json:5` tem `appBundleId: org.owasp.carbonthreat`, o que é um risco de marca.
  - A versão é `1.0.0-enterprise`, mas o repo tem 0 tags.
  - O `CNAME` aponta para um domínio pessoal.

### 2.2 Arquitetura e engenharia

- **A UI v2 é um mock completo.**
  - Todas as features leem `ct.client/src/api/carbon.ts`, que usa fixtures em memória e latência simulada com `setTimeout` (`carbon.ts:2-17`).
  - O login aceita qualquer senha e cria uma sessão admin com o token `'demo-access'` (`features/auth/LoginView.tsx:12-20`). A tela ainda exibe "Protected by MFA · SOC 2 Type II".
  - Ações como "Exported to Jira" e "Risk acceptance requested" só disparam um toast.
  - Essa SPA é servida pela imagem Docker de produção.
- **O backend não tem API v2.** `grep -r api/v1 td.server/src` não retorna nada. As migrations 018–021 (findings, engagements, api_keys…) não têm controller, rota nem query. **A UI e a API estão totalmente desconectadas.**
- **Saída de build commitada e viva.** `td.server/{app.js,controllers,ai,engine,db}` são cerca de 9,1k LOC de saída Babel versionada.
  - `engine/rule-engine.js` (o "motor STRIDE": 7 regras hardcoded) **não tem fonte** e é importado por `src/controllers/threats.pg.js:3`.
  - Esse arquivo só pode ser editado como CJS transpilado.
- **O `stride-engine` não é um motor.** São cerca de 900 LOC de prompts portados do STRIDE-GPT para 7 provedores de LLM. Os testes mockam todas as chamadas de LLM.
- **Três esquemas de tenant convivem:**
  - `helpers/scope.helper.js`;
  - um `scopedQuery` local em `controllers/threatmodels.pg.js:33`;
  - `auth/tenantScope.js`, que é deny-by-default, tem testes e **não é usado por nada**.
- **Migrations com números duplicados** (`011_*` ×2, `016_*` ×2). A `005_nullable_org_id.js` admite DDL aplicado à mão em produção.
- **Herança do Threat Dragon.** Cerca de 2,2k LOC de storage via GitHub/GitLab/Bitbucket/Google Drive continuam roteados ao lado do Postgres.
- **Frontend:**
  - `tsconfig` com `"strict": false`.
  - 294 `style={{` inline, contra a meta do SDD de zero valores ad hoc.
  - 0 testes em `features/`, `shell/` ou no router. Os 16 arquivos de teste cobrem primitivos de UI e módulos legados mortos.
  - Dependências mortas: reactflow, yjs, dagre, elkjs, jspdf.
- **CI é cosmético.**
  - `npm audit … || true`, e o lint do server também roda com `|| true`.
  - O healthcheck do container só emite um warning.
  - Não há typecheck, testes Python, SAST, secret scan, scan de container, SBOM, assinatura nem release.
  - As actions não estão pinadas por SHA.
- **Runtime:** a imagem usa Node 20, que está em EOL desde 2026-04-30, e roda `npm install --legacy-peer-deps` no Dockerfile.

### 2.3 Segurança da própria ferramenta (resumo público)

A revisão encontrou 10 problemas na v1. Os detalhes (arquivo, linha e impacto) ficam fora do repositório, porque o código da v1 continua público no histórico. Por classe:

| Classe | Qtde | Severidade máxima |
|---|---|---|
| Isolamento entre tenants e autorização em nível de objeto | 4 | Crítica |
| Autenticação/provisionamento via provedor OAuth externo | 1 | Crítica |
| Setup/bootstrap alcançável sem autenticação | 1 | Alta |
| Rate limiting e lockout contornáveis | 1 | Média |
| Segredos default e reuso de chave nos scripts de instalação | 1 | Alta |
| SSRF residual em integrações de saída | 1 | Média |
| Processo (canal de disclosure errado, relatório de pentest publicado) | 1 | Alta |

Também se constatou que parte dos itens do pentest de 2026-06 marcados como corrigidos continua aberta ou foi corrigida só em parte.

**Decisão (ADR 0002):** a v1 não será corrigida; ela é congelada na tag `legacy/v1-final`, marcada como insegura e não suportada. O código novo nasce com isolamento testado contra banco real como gate de CI (Fase 3).

### 2.4 Sinais do histórico

- São 187 commits, todos entre abril e julho de 2026. Desde 2026-07-10 não há nenhum.
- Há 1 autor humano. Cerca de 50% dos commits que não são merge vêm de bot ou IA (Jules, Claude, Palette, Sentinel, aikido).
- Os 53 merges foram self-merge.
- Todo o re-platform v2 (SDD, reescrita do frontend e fase 1 do backend) entrou num único dia, em um PR gerado por IA.
- O efeito é velocidade de geração sem verificação. Os padrões ruins acima se explicam assim: testes que mockam tudo, módulo seguro que nunca foi conectado, achados "corrigidos" que continuam abertos.

---

## 3. Por que o caminho atual não leva a "amplamente utilizado"

1. **O caminho v2 é o oceano mais vermelho possível.** O DefectDojo (OWASP Flagship) já é o padrão open source de vuln management, com centenas de parsers, API madura e anos de comunidade. Faraday, Dependency-Track e ArcherySec cobrem nichos vizinhos. Um clone feito por 1 pessoa, sem parsers e com UI mock, não tem argumento de adoção. **O próprio nome "Carbon Dojo" posiciona o produto como derivado.**
2. **O caminho v1 também não vencia.** "Threat Dragon com Postgres, RBAC e extras" é um fork empresarial de um projeto que já é gratuito. Quem quer GUI de threat modeling usa o Threat Dragon. Quem quer enterprise compra IriusRisk ou ThreatModeler.
3. **O formato de entrega está errado para adoção.** As ferramentas de segurança open source que viraram padrão (Trivy, Semgrep, Nuclei, gitleaks, Checkov, Grype/Syft) têm o mesmo funil:
   - `brew install x && x scan .`, com valor em menos de 60 s;
   - roda no CI e emite SARIF;
   - comunidade contribuindo **conteúdo** (regras/templates), não código de plataforma.

   O Carbon Threat exige Postgres, TLS, Docker, `.env` e wizard antes de entregar qualquer valor.
4. **A capacidade não sustenta o escopo.** 1 mantenedor não sustenta uma plataforma web multi-tenant com SSO, RBAC, backups, SIEM, 7 integrações e IA. Já sustenta um CLI focado com um repositório de regras aberto a contribuição.

**Por que threat modeling as code (TMaC):**

- **A dor é real.** Threat modeling é unanimemente recomendado (OWASP SAMM, NIST SSDF, CISA Secure by Design) e quase ninguém faz continuamente, porque é manual, vira documento morto e não acompanha o código.
- **O espaço open source está fraco.**
  - O pytm é pequeno.
  - O Threagile tem pouca atividade.
  - O Threat Dragon é GUI-only.
  - O STRIDE-GPT é um gerador de prompt sem determinismo.
  - Ninguém domina "threat model gerado do IaC, avaliado em cada PR".
- **Já existe um formato aberto para interoperar:** o Open Threat Model (OTM). O CycloneDX também modela services, data flows e trust zones.
- **Os ativos do repo atual servem diretamente:** regras STRIDE, mapeamento ATT&CK/CAPEC, cliente OSV, exportador SARIF, importadores draw.io/Visio/Gliffy, integração LLM multi-provedor.

**Se você mantiver o vuln management** (decisão sua), o único caminho com chance é **não competir com o DefectDojo e sim complementá-lo**: um motor de *priorização contextual* que lê findings (SARIF ou a API do DefectDojo) e os cruza com a arquitetura (exposição, trust boundaries, dados sensíveis). Isso é a fase 3 do plano abaixo. Ou seja, os dois caminhos convergem no mesmo núcleo: **o modelo de arquitetura como fonte de verdade**.

---

## 4. Tese de produto

> **Um threat model vivo, versionado junto com o código, gerado automaticamente da infraestrutura e da aplicação, e que reprova o PR que abre uma ameaça nova.**

- **Usuário primário:** dev/AppSec engineer em time com CI. Secundário: AppSec lead que precisa de visão consolidada (o Hub, mais tarde).
- **Jobs-to-be-done:**
  1. "Me dê um threat model decente do meu repo em 1 minuto, sem eu desenhar nada."
  2. "Me avise no PR quando uma mudança cria um fluxo novo de dados sensíveis para a internet, remove auth ou cruza uma trust boundary."
  3. "Me diga quais dos meus 3.000 findings de scanner estão realmente no caminho de ataque."
- **Princípios:**
  - Determinístico primeiro, IA depois: a IA nunca é requisito e é sempre marcada como sugestão.
  - Local-first e offline-capable.
  - Formato aberto (OTM e schema próprio versionado) e sem lock-in.
  - Regras como conteúdo comunitário.
  - Zero servidor para começar.

### Superfície do produto

```
ctm init                      # detecta stack e gera threatmodel.yaml a partir do repo
ctm extract  [--from tf,k8s,compose,openapi,code]   # (re)gera componentes, fluxos, trust boundaries
ctm analyze                   # aplica regras → ameaças (STRIDE/LINDDUN) com CWE/CAPEC/ATT&CK
ctm diff origin/main..HEAD    # ameaças introduzidas/removidas pelo PR
ctm report --format sarif|md|html|json|otm|cyclonedx
ctm view                      # UI local (diagrama + ameaças) servida pelo próprio binário
ctm suggest --llm ollama:...  # opcional: enriquecimento por LLM, sempre marcado como sugestão
ctm correlate trivy.sarif semgrep.sarif   # (fase 3) prioriza findings pela arquitetura
```

Integrações:
- GitHub Action, que comenta no PR e faz upload de SARIF para o code scanning;
- template de GitLab CI;
- pre-commit;
- extensão VS Code com preview do diagrama.

---

## 5. Arquitetura alvo

### 5.1 Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Linguagem do núcleo | **Go** | Binário estático único, cross-compile trivial, padrão do ecossistema (Trivy, Nuclei, Grype, gitleaks). A maior parte do código atual é cola Express, então pouco se perde. Alternativa aceitável: TypeScript via Bun/Deno compile, se a prioridade for reaproveitar código; a contrapartida é distribuição pior |
| Formato do modelo | YAML com **JSON Schema versionado** (`ctm/v1`), import/export **OTM** | Diffável em PR, validável, interoperável |
| Regras | YAML declarativo com expressões **CEL** (ou Rego), com IDs estáveis e metadata (STRIDE, CWE, CAPEC, ATT&CK, ASVS) | Contribuível por não programadores, como os templates do Nuclei e as regras do Semgrep |
| Repositório de regras | Separado (`carbon-threat-rules`), versionado, baixado e embutido no binário | Ciclo de release de conteúdo independente do motor |
| Extractors | Plugins internos: Terraform (HCL + plan JSON), Kubernetes/Helm, docker-compose, CloudFormation, OpenAPI; depois código via tree-sitter (rotas, clientes HTTP, DB) | É a geração automática que elimina a barreira do "desenhar" |
| LLM | Interface de provider (Ollama, OpenAI-compatible, Anthropic…), com delimitação anti-prompt-injection e redaction de segredos antes do envio | Opcional, auditável, nunca no caminho crítico |
| UI | React + ReactFlow (reaproveitar o design system) **embutido no binário** (`go:embed`), lendo e escrevendo arquivos locais | Visualização e edição sem servidor nem banco |
| Hub (fase 3+) | Servidor opcional que agrega modelos e resultados de N repos. Reaproveita conceitos de auth/RBAC/audit do `td.server`, reescritos com RLS do Postgres | Visão de org; possível base de open-core |

### 5.2 Layout do novo repositório

```
carbon-threat/
├── cmd/ctm/                 # entrypoint do CLI
├── pkg/
│   ├── model/               # tipos, loader, validação JSON Schema, OTM in/out
│   ├── extract/{terraform,k8s,compose,cfn,openapi,code}/
│   ├── engine/              # avaliação de regras (CEL), dedup, fingerprint estável
│   ├── diff/                # diff semântico de modelos e ameaças
│   ├── report/{sarif,markdown,html,json,cyclonedx}/
│   ├── correlate/           # (fase 3) SARIF/DefectDojo → priorização por arquitetura
│   └── llm/                 # providers opcionais
├── schema/ctm-v1.json
├── web/                     # UI React (viewer/editor), embutida no binário
├── integrations/{github-action,gitlab,pre-commit,vscode}/
├── testdata/corpus/         # repos de referência + modelos esperados (golden files)
├── docs/                    # site (MkDocs/Docusaurus)
└── hub/                     # (fase 3+) servidor opcional
```

### 5.3 O que salvar, portar ou descartar do código atual

| Ativo atual | Destino |
|---|---|
| `engine/rule-engine.js` (7 regras), `stride-engine/{threat_model,dread,mitigations}.py` | **Portar** a lógica para regras declarativas; prompts viram o módulo `llm/` (manter a atribuição do STRIDE-GPT, licença MIT) |
| `services/attackFramework.js` + dados ATT&CK | **Portar** como dataset de mapeamento das regras |
| `services/osvScanner.js` (cliente OSV) | **Portar** só o cliente, para enriquecer componentes com CVEs conhecidos |
| Exportador SARIF/PDF | **Portar** o SARIF; descartar o PDF (o relatório HTML imprime para PDF) |
| `ct.client/src/importers/{drawio,visio,gliffy}` | **Manter** na UI web (import de diagramas legados) |
| Design system / tokens Carbon | **Manter** na UI embutida |
| `helpers/ssrfGuard.helper.js` | Referência conceitual para o Hub |
| Auth/SSO/RBAC/audit/backup/SIEM/integrações do `td.server` | **Congelar.** Reavaliar só para o Hub, reescrevendo com RLS e testes de isolamento contra banco real |
| Providers git (GitHub/GitLab/Bitbucket/Google Drive), wizard, `stride-engine` HTTP, UI mock "Carbon Dojo", migrations 018–021 | **Descartar** |
| Saída Babel commitada (`td.server/{app.js,controllers,ai,engine,db}`) | **Descartar** |

O legado não é apagado do histórico: vai para uma branch/tag `legacy/v1-final` e o repo principal é reiniciado com o layout novo.

---

## 6. Roadmap em fases

As estimativas são para 1 mantenedor em tempo parcial com apoio de IA. Cada fase tem um critério de saída **verificável**: depois do histórico deste repo, nada é considerado "pronto" sem prova.

### Fase 0: Estancar (1–2 semanas)

- [x] Instâncias expostas: nenhuma (confirmado pelo mantenedor em 2026-10-07).
- [x] `SECURITY.md` reescrito (canal próprio via GitHub Private Vulnerability Reporting; v1 declarada não suportada) e metadata corrigida (`package.json`, `appBundleId`).
- [x] Relatório de pentest removido do branch e senhas default removidas dos docs. A cópia fica local em `docs/strategy/private/`. O histórico git continua contendo o relatório; ver ADR 0002.
- [x] Nome: **Carbon Threat** (CLI `ctm`). "Carbon Dojo" foi abandonado.
- [x] Tag `legacy/v1-final` criada; v1 congelada; [ADR 0002](../adr/0002-threat-modeling-as-code.md) escrito, revertendo o ADR 0001.
- [x] NOTICE (Threat Dragon Apache-2.0, STRIDE-GPT MIT), CONTRIBUTING, CODE_OF_CONDUCT e templates de issue/PR adicionados.
- [x] Private Vulnerability Reporting habilitado no GitHub; contato alternativo `ctm-security@cle.beer`.

**Saída:** nenhuma instância vulnerável exposta; repo com governança mínima; ADR 0002 aprovado.

**Status (2026-10-07):** concluída.

### Fase 1: MVP do CLI, v0.1 (6–8 semanas)

**Status (2026-10-07):** em andamento; o núcleo está pronto. Ainda falta remover o código da v1 da árvore, o que depende de aprovação do mantenedor.

- [x] Schema `ctm/v1` (JSON Schema 2020-12) e loader/validador com erros por linha e checagem de referências.
- [ ] Extractors: **docker-compose** ✅; **Terraform (AWS primeiro)** e **Kubernetes** pendentes.
- [ ] Motor de regras CEL ✅, com testes positivos e negativos obrigatórios por regra. **13 de 40 regras** escritas (5 de fluxo e 8 de componente, incluindo as 7 regras da v1 portadas).
- [x] `ctm diff` com fingerprint estável por ameaça (arquivo ou revisão git).
- [x] Saídas SARIF, Markdown, JSON e tabela. GitHub Action composta com resumo no job e SARIF. Comentário no PR pendente.
- [ ] Corpus: 3 modelos de exemplo com golden files ✅ (meta: 10 repos de referência). CI ✅ com `go test -race` (Linux/macOS/Windows), `golangci-lint` e CodeQL; gitleaks e Trivy pendentes.
- [ ] Release com GoReleaser: binários multi-OS, Homebrew tap, imagem OCI, **cosign + SLSA provenance + SBOM**.

**Saída:** `brew install` → `ctm init && ctm analyze` num repo Terraform real gera um modelo e ≥5 ameaças corretas em menos de 60 s. Precisão ≥ 90% no corpus, medida e publicada.

### Fase 2: Ecossistema, v0.5 (8–10 semanas)

- [ ] Repositório `carbon-threat-rules` com guia de contribuição, testes por regra e meta de 150+ regras.
- [ ] Import/export de **OTM**, **Threat Dragon JSON**, **Threagile YAML** e draw.io. Export CycloneDX.
- [ ] `ctm view`: UI embutida com diagrama auto-layout, lista de ameaças e edição que grava no YAML.
- [ ] Extractors de OpenAPI e CloudFormation. Primeiro extractor de código (rotas HTTP em Express/FastAPI/Spring via tree-sitter).
- [ ] `ctm suggest` com Ollama/OpenAI-compatible: saída sempre separada e marcada; benchmark público de precisão LLM vs. regras.
- [ ] GitLab CI, pre-commit, extensão VS Code e site de docs com tutorial "threat model your Terraform in 60s".

**Saída:** 5+ contribuidores externos com PR mergeado, 3+ repos públicos de terceiros usando a Action e docs completas.

### Fase 3: Diferencial, v1.0 (3 meses)

- [ ] `ctm correlate`: ingere SARIF (Trivy, Semgrep, CodeQL) e a API do DefectDojo e reprioriza os findings por exposição arquitetural (alcançável da internet? toca dados sensíveis? cruza trust boundary?). **Isso integra com o DefectDojo em vez de competir com ele.**
- [ ] Análise de caminhos de ataque no grafo (entrada → crown jewels), com mapeamento ATT&CK.
- [ ] Hub opcional: agrega N repos, histórico e tendência, SSO e RBAC. Postgres com **RLS** e testes de isolamento cross-tenant contra banco real como gate de CI.
- [ ] Pentest externo antes do 1.0. Correções verificadas por teste de regressão, não por declaração.

**Saída:** v1.0 com API e schema estáveis (semver), relatório de pentest sem High/Critical abertos e 1 case público de adoção.

### Fase 4: Comunidade e governança (contínuo)

- Candidatura a projeto OWASP (Incubator) ou doação a uma fundação, com governança, MAINTAINERS e meta de ≥3 mantenedores de ≥2 organizações para eliminar o bus factor 1.
- OpenSSF Scorecard ≥ 8 e badge OpenSSF Best Practices.
- Talks e posts (OWASP Global AppSec, BSides, DEF CON AppSec Village). Listagem no GitHub Marketplace e nas awesome-lists de threat modeling e AppSec.
- Política de releases (cadência mensal de regras, trimestral do motor), CHANGELOG automatizado e deprecations com 2 versões de aviso.

---

## 7. Métricas de sucesso

As estrelas são vaidade; o que mede adoção:

| Métrica | v0.1 | v0.5 | v1.0 |
|---|---|---|---|
| Repos públicos usando a Action (dependents) | 10 | 100 | 1.000 |
| Downloads de release + pulls de imagem / mês | 500 | 5k | 50k |
| Regras no repositório | 40 | 150 | 300 |
| Contribuidores externos com PR mergeado (acumulado) | 1 | 10 | 40 |
| Mantenedores ativos | 1 | 2 | ≥3 (≥2 orgs) |
| Precisão das regras no corpus público | ≥90% | ≥92% | ≥95% |
| Tempo do `install` à primeira ameaça | <60 s | <60 s | <30 s |
| OpenSSF Scorecard | 6 | 7,5 | ≥8 |

Telemetria: **opt-in**, anônima e documentada. Em ferramenta de segurança, telemetria opt-out destrói a confiança.

---

## 8. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Repetir o padrão "gera rápido, não verifica" | Golden files e corpus como gate de CI; nenhum PR de IA mergeado sem teste novo que falharia sem ele; revisão humana obrigatória em código de segurança |
| Falsos positivos matam a adoção (regra que grita demais vira `--disable`) | Começar com 40 regras de alta precisão; cada regra com casos positivos e negativos; nível `experimental` separado |
| IA vista como gimmick ou risco de vazamento | IA opcional, local-first, com redaction e saída separada; benchmark público |
| Extrair arquitetura de código é difícil | Começar por IaC, que é declarativo e de alta fidelidade; código entra só na fase 2 e só por padrões de framework bem definidos |
| Bus factor 1 | A fase 4 é requisito, não bônus; regras como porta de entrada de contribuidores |
| Abandonar o v1 frustra eventuais usuários atuais | Tag `legacy/v1-final`, nota de migração e importador do formato antigo para `ctm/v1` |

---

## 9. Próximos 10 dias (concretos)

1. ~~Fase 0~~ (concluída em 2026-10-07).
2. Escrever o `schema/ctm-v1.json` e 3 modelos de exemplo à mão (app web simples, microserviços em k8s, serverless AWS).
3. Escrever 10 regras e seus testes contra esses 3 modelos, antes de escrever qualquer extractor. Isso valida a tese de que regras determinísticas produzem ameaças úteis.
4. Spike de 2 dias: extractor de docker-compose para `ctm/v1` e comparação com o modelo escrito à mão.
5. Mostrar o resultado de 2–4 a 3–5 AppSec engineers externos antes de investir na fase 1 inteira: é a validação de demanda.
