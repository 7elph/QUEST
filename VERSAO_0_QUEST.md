# QUEST - Documentacao Completa da Versao 0 (V0)

## 1. Objetivo deste documento

Este arquivo registra a **linha de base oficial da Versao 0** do app QUEST.
Ele serve para:

- explicar o produto de ponta a ponta;
- descrever estrutura tecnica e organizacao do codigo;
- registrar fluxos funcionais atuais;
- fixar o ponto de partida para o versionamento futuro (`v1`, `v1.1`, `v1.2`, `v2`, `v3`, `v4`...).

---

## 2. Visao do produto

### 2.1 Proposta

QUEST e um marketplace de missões digitais com 2 camadas de experiencia:

- **Camada RPG (usuario final):**
  - linguagem de guilda, missoes, rank, drops, Enchantiun.
- **Camada operacional seria (negocio):**
  - tarefa, SLA, evidencia, revisao, auditoria, reputacao, arbitragem.

### 2.2 Regra central da plataforma

1. Patrono cria missao com escopo + checklist.
2. Aventureiro aceita.
3. Aventureiro executa e envia prova.
4. Patrono aprova ou pede revisao.
5. Sistema atualiza reputacao (XP/rank/score).
6. Disputa (quando existe) e decidida por checklist + evidencia.

### 2.3 Escopo Alpha atual

- Escrow manual (confirmacao admin).
- Founders/loja com fluxo manual apoiado por auditoria.
- Triagem IA em pontos especificos.
- Sem promessa de emprego (painel de missoes + reputacao).

---

## 3. Stack e arquitetura

## 3.1 Stack principal

- Frontend/Backend web: `Next.js 14 (App Router) + TypeScript`
- UI: `TailwindCSS` + componentes internos
- Auth: `NextAuth Credentials + JWT`
- Banco: `PostgreSQL`
- ORM: `Prisma`
- Testes: `Vitest` (unit), `Playwright` (e2e)
- Observabilidade: `Sentry (opcional)` + `ErrorEvent` em banco
- IA local: `Ollama` (phi3:mini, tinyllama, etc)

## 3.2 Arquitetura logica

- `src/app`: rotas (pages) + API routes
- `src/components/app`: componentes de dominio (missao, admin, perfil, enterprise)
- `src/lib`: regras de negocio, seguranca, IA, catalogos, seed helpers
- `prisma/schema.prisma`: modelo de dados
- `scripts/quest-all.mjs`: pipeline operacional local

## 3.3 Camadas internas

- Camada de apresentacao (rotas e componentes)
- Camada de aplicacao (API routes com validacao e regras)
- Camada de dominio (`src/lib/*`)
- Camada de persistencia (Prisma/Postgres)

---

## 4. Estrutura de diretorios (resumo)

```
.
|- src/
|  |- app/
|  |  |- (auth)/              # login, register, reset
|  |  |- (public)/            # landing, enterprise, founders
|  |  |- admin/               # painel admin
|  |  |- home/                # feed/quadro de missoes
|  |  |- mission/[id]/        # detalhe de missao
|  |  |- profile/             # hub do usuario
|  |  |- api/                 # endpoints
|  |- components/app/         # UI de negocio
|  |- lib/                    # regras, seguranca, IA, seeds
|- prisma/
|  |- schema.prisma
|  |- migrations/
|- scripts/
|  |- quest-all.mjs
|- public/assets/             # imagens/artefatos visuais
```

---

## 5. Modulos funcionais da V0

## 5.1 Autenticacao e sessao

- Login com email/senha.
- Cadastro para `ADVENTURER` e `PATRON`.
- Admin criado por seed via env.
- Sessao JWT com middleware de protecao por rota/papel.
- Rate limit no login.

## 5.2 Missoes

- Criacao por wizard (patrono).
- Checklist de condicoes de vitoria.
- Aceite por aventureiro.
- Submissao de prova (link/arquivo).
- Revisao patrono (aprovar, revisar, rejeitar).
- Checklist de progresso durante execucao.

## 5.3 Ranking, XP e moeda

- XP por eventos.
- Rank por faixa.
- Score de performance (ranking).
- Moeda interna: **Enchantiun**.

## 5.4 Admin

- Moderacao de usuarios.
- Gestao de missoes e escrow manual.
- Disputas com suporte de triagem IA.
- Auditoria e monitor de erros.
- Pipeline LLM dedicado.

## 5.5 Enterprise

- Visual corporativo sem elementos RPG.
- Request builder para solicitacoes.
- Monitor de quests com escopo por login:
  - patrono ve somente o que ele criou;
  - admin ve tudo.

## 5.6 Loja/Founders

- Confirmacoes manuais no Alpha.
- Log de eventos para rastreabilidade.

---

## 6. Regras de permissao (RBAC)

- `ADVENTURER`
  - aceita missao aberta
  - executa checklist
  - envia submissao
- `PATRON`
  - cria missao
  - revisa entregas
  - acompanha status das proprias solicitacoes no enterprise
- `ADMIN`
  - acesso total
  - escopos adicionais: `SUPER_ADMIN`, `MODERATOR`, `FINANCE`, `OPS`

---

## 7. Modelo de dados (resumo)

Entidades principais na V0:

- `User`, `Profile`, `Rank`
- `Mission`, `MissionTemplate`, `MissionDraft`, `MissionScreening`, `MissionProgress`
- `Submission`, `SubmissionRevision`, `Review`
- `XPLog`
- `Dispute`
- `FounderPledge`
- `Announcement`
- `Notification`, `NotificationDigest`
- `AuditLog`
- `PasswordResetToken`
- `RateLimitBucket`
- `ErrorEvent`
- `AdventurerAssessment`

Pontos importantes:

- Mission possui camada dupla de texto (`title/narrative` e `rpgTitle/rpgNarrative`).
- Screening de missao fica em `MissionScreening`.
- Auditoria transversal fica em `AuditLog`.

---

## 8. IA e automacao na V0

## 8.1 Triagem de disputa

- Endpoint: `POST /api/admin/disputes/[id]/triage`
- Pode usar modelo Ollama local.
- Resultado passa por gate de seguranca para reduzir falso positivo de fechamento.

## 8.2 Simulacao LLM

- Endpoint: `POST /api/admin/simulations/run`
- Fluxo:
  1. encontra missao aberta
  2. aceite sintetico
  3. cria submissao sintetica
  4. move para review
- Se modelo nao responder, status cai em fallback: `aguardando`.

## 8.3 Narrativa RPG

- Geracao de narrativa para visao aventureiro.
- Patrono trabalha com dados objetivos.

---

## 9. UX atual (V0)

## 9.1 Home

- Quadro de missoes com visual RPG.
- Desktop com hover detalhado.
- Mobile com cards touch diretos (sem dependencia de hover).

## 9.2 Perfil

- Hub de operacao do usuario.
- Inventario, progresso, missoes e historico.
- Bloco passo a passo por papel.

## 9.3 Admin

- Separacao por abas:
  - visao geral
  - usuarios
  - missoes
  - disputas
  - pipeline llm
  - loja/founders
  - compliance

## 9.4 Enterprise

- Painel corporativo, linguagem de negocio.
- Monitor de quests por escopo de autenticacao.

---

## 10. Seguranca e compliance

- Rate limit em auth e endpoints sensiveis.
- Sanitizacao de input em pontos criticos.
- Upload com restricao de tipo/tamanho.
- Middleware com headers de seguranca.
- Logs de auditoria para acoes relevantes.
- Regras e privacidade disponiveis em rotas dedicadas.

---

## 11. Operacao local e scripts

## 11.1 Pipeline completo

`npm run quest:all`

Executa:

1. env bootstrap
2. docker/postgres (opcional)
3. prisma generate + deploy
4. seed
5. warm-up ollama (quando habilitado)
6. lint + test + build
7. dev server

## 11.2 Pipeline rapido

`npm run quest:fast`

Para iteracao curta (sem checks pesados).

---

## 12. Estado oficial da V0

Esta V0 e considerada:

- funcional para demo Alpha;
- modular para evolucao incremental;
- com admin e fluxo de moderacao operacionais;
- com camada de IA assistiva (nao decisoria final autonoma).

**Base de referencia para evolucao: este documento + README + schema Prisma atual.**

---

## 13. Politica de versionamento (a partir da V0)

Voce pediu a sequencia: `v1`, `v1.1`, `v1.2`, `v2`, `v3`, `v4`...
Vamos oficializar assim:

## 13.1 Regra de incremento

- `vN` (major):
  - mudanca estrutural importante
  - quebra de fluxo antigo
  - nova arquitetura ou nova plataforma
- `vN.M` (minor):
  - feature grande sem quebrar base
  - melhorias de UX/fluxo, novos modulos
- `vN.M.P` (patch, opcional):
  - bugfix pontual/hotfix
  - ajuste sem alterar comportamento macro

## 13.2 Marcacao recomendada no Git

- Tag inicial desta baseline: `v0.0.0`
- Proxima entrega estrutural: `v1.0.0`
- Evolucoes: `v1.1.0`, `v1.2.0`, etc

Exemplo:

```bash
git tag -a v0.0.0 -m "Baseline QUEST V0"
git push origin v0.0.0
```

## 13.3 Branches recomendadas

- `main`: estavel
- `release/vX.Y`: preparacao de release
- `feature/*`: desenvolvimento
- `hotfix/*`: correcoes urgentes

## 13.4 Checklist minimo para liberar nova versao

1. atualizar documentacao da versao
2. rodar `lint`, `test`, `build`
3. validar migracoes Prisma
4. revisar seguranca basica (auth, permissao, rate limit)
5. registrar changelog resumido
6. criar tag de release

---

## 14. Proposta de linha evolutiva (macro)

- `v1`: consolidacao de fluxos e UX operacional
- `v1.1`: melhorias de produtividade/admin + automacoes seguras
- `v1.2`: estabilizacao de observabilidade e qualidade de dados
- `v2`: pagamentos integrados e automacoes avancadas
- `v3`: escala de operacao (PWA, integracoes, APIs externas)
- `v4`: produto multi-tenant/enterprise expandido com governanca avancada

---

## 15. Conclusao

A V0 do QUEST esta definida e documentada.
Este arquivo e o ponto oficial para iniciar o versionamento progressivo.

