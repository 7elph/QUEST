# QUEST™

App completo do QUEST™: painel de missoes com camada RPG na UX e operacao objetiva com SLA, evidencia, revisao, reputacao e cofre (escrow manual no Alpha).

## Documento Base da V0

- Veja a documentacao completa da baseline em [`VERSAO_0_QUEST.md`](./VERSAO_0_QUEST.md)
- Historico de releases em [`CHANGELOG.md`](./CHANGELOG.md)

## Dev (Thiago)

Use estas variaveis no `.env`:

```bash
ADMIN_EMAIL=admin@quest.local
ADMIN_PASSWORD=Quest1234!
ALPHA_MODE=true
ESCROW_MODE=manual
DEMO_SEED=true
DEMO_ENTERPRISE_EMAIL=enterprise@quest.local
DEMO_ENTERPRISE_PASSWORD=QuestEnterprise123!
DEMO_ADVENTURER_EMAIL=aventureiro.demo@quest.local
DEMO_ADVENTURER_PASSWORD=QuestAventura123!
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=phi3:mini
OLLAMA_RETRY_ATTEMPTS=1
OLLAMA_RETRY_BACKOFF_MS=700
OLLAMA_DISPUTE_COMPLETE_MIN_CONFIDENCE=0.78
OLLAMA_DISPUTE_BLOCK_COMPLETE_ON_HIGH=true
OLLAMA_DISPUTE_MODEL=phi3:mini
OLLAMA_DISPUTE_TIMEOUT_MS=45000
MISSION_APPROVAL_MODE=direct
OLLAMA_MISSION_MODEL=phi3:mini
OLLAMA_MISSION_TIMEOUT_MS=30000
RPG_LLM_KEY=
RPG_LLM_ENABLED=true
OLLAMA_RPG_MODEL=phi3:mini
OLLAMA_RPG_TIMEOUT_MS=35000
OLLAMA_SIMULATION_MODEL=phi3:mini
OLLAMA_SIMULATION_TIMEOUT_MS=45000
SENTRY_ENABLED=false
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENABLED=false
NEXT_PUBLIC_SENTRY_DSN=
QUEST_SKIP_DOCKER=false
QUEST_SKIP_QUALITY=false
QUEST_NO_DEV=false
QUEST_SKIP_OLLAMA=false
NGROK_ENABLED=false
NGROK_AUTHTOKEN=
NGROK_PORT=3000
NGROK_REGION=sa
NGROK_DOMAIN=
OLLAMA_WARMUP_MODELS=
OLLAMA_WARMUP_PROMPT=Responda apenas: OK
LLM_SIM_EMAIL=llm.simulador@quest.local
LLM_SIM_PASSWORD=Quest1234!
LLM_SIM_NAME=Simulador LLM
LLM_SIM_NICK=OraculoLLM
LLM_SIM_PATRON_EMAIL=llm.patrono@quest.local
LLM_SIM_PATRON_PASSWORD=Quest1234!
LLM_SIM_PATRON_NAME=Patrono LLM
LLM_SIM_PATRON_NICK=PatronoIA
```

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- Auth: NextAuth (Credentials + JWT)
- DB: PostgreSQL + Prisma ORM
- Logs: pino
- Testes: Vitest + Playwright

## Melhorias aplicadas (por etapas)

1. Auth e sessao
- Callback pos-login consistente (`/profile` e demais rotas protegidas)
- UX de login/cadastro com feedback de erro/carregamento
- Rate limit com modo persistente em banco (`RATE_LIMIT_STORE=db`)

2. Fluxo de missao
- Wizard real em `/create-mission` com etapas, validacao e autosave (`MissionDraft`)
- Templates de missao (`MissionTemplate`) com salvar e reaproveitar
- SLA visivel no detalhe da missao
- Historico de revisoes da submissao (`SubmissionRevision`)
- Regra de 1 revisao padrao por missao

3. Escrow, ranking e notificacoes
- Timeline de escrow na missao
- Ranking `/ranking` com score composto (pontualidade, qualidade, volume, disputa)
- Notificacoes in-app (campainha no topo) e digest por e-mail stub

4. Admin avancado
- Inbox operacional (escrow pendente, disputas, founders pendentes)
- Busca de auditoria
- Escopos admin granulares (`SUPER_ADMIN`, `MODERATOR`, `FINANCE`, `OPS`)
- Export CSV (`/api/admin/export?entity=missions|users`)
- Triagem IA de disputas com Ollama local (`tinyllama` ou `phi3:mini`) para filtro de inconsistencias
- Gate de seguranca: bloqueia sugestao `COMPLETE_MISSION` com confianca baixa ou inconsistencia `HIGH`
- Acao "Rodar simulacao LLM" no painel admin para gerar uso sintetico (aceite + submissao) com fallback `Aguardando`
- Acao "Rodar jornada completa" no painel admin para simular Patrono + Aventureiro (ciclo completo, revisao, disputa e fila de aprovacao)
- Rate limit na rota de triagem IA para evitar abuso
- Retry/backoff automatico no cliente Ollama para reduzir falhas intermitentes

5. Qualidade
- Testes unitarios adicionais de score
- E2E basico de auth
- Endpoint de metricas (`/api/metrics`)
 
6. Observabilidade
- Sentry integrado (server, edge e client) com toggles por ambiente
- `x-request-id` em respostas e propagacao para endpoints de API
- Persistencia de erros em `ErrorEvent` (server/client/edge) para analise operacional
- Dashboard de erros no `/admin` com filtros por origem e busca por request id/rota

7. Produto (perfil + execucao)
- Mini teste de perfil do aventureiro com habilidades dominantes e score por area
- Checklist de condicoes de vitoria clicavel durante execucao da missao
- Andamento visivel para patrono/admin com percentual de conclusao
- Fluxo opcional `LLM -> aprovacao admin -> publicar missao` via `MISSION_APPROVAL_MODE=llm_review`
- Wizard Patrono em 5 passos (categoria/tipo, scope, checklist, prazo/orcamento, publicar)
- Camada dupla de narrativa: Patrono ve tarefa seria; Aventureiro ve `rpgTitle` e `rpgNarrative`
- Filtro no feed por categoria e bairro de Piracicaba

## Modelagem Prisma

Entidades principais:

- `User`, `Profile`, `Rank`
- `Mission`, `Submission`, `SubmissionRevision`, `Review`, `XPLog`
- `MissionTemplate`, `MissionDraft`
- `Dispute`, `Announcement`, `AuditLog`
- `Notification`, `NotificationDigest`
- `FounderPledge`, `PasswordResetToken`, `RateLimitBucket`
- `ErrorEvent` (observabilidade)
- `AdventurerAssessment`, `MissionProgress`, `MissionScreening`

## Rotas principais

- App: `/home`, `/mission/[id]`, `/create-mission`, `/my-missions`, `/profile`, `/ranking`, `/admin`
- Publico: `/landing`, `/enterprise`, `/founders`, `/rules`, `/privacy`
- Auth: `/login`, `/register`, `/reset-password`
- Admin IA: `POST /api/admin/disputes/[id]/triage`
- Simulacao de uso: `POST /api/admin/simulations/run`
- Simulacao ponta a ponta (Patrono + Aventureiro): `POST /api/admin/simulations/full-run`
- Telemetria client error: `POST /api/telemetry/client-error`
- Perfil aventureiro: `GET/POST /api/profile/assessment`
- Checklist da missao: `POST /api/missions/[id]/checklist`
- Aprovacao de missao (admin): `POST /api/admin/missions/[id]/approval`

## Observabilidade (Sentry + Request ID)

- Ativar Sentry:

```bash
SENTRY_ENABLED=true
SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_ENABLED=true
NEXT_PUBLIC_SENTRY_DSN=...
```

- Cada request recebe `x-request-id` (header).
- Erros capturados sao gravados em `ErrorEvent` e tambem enviados ao Sentry quando habilitado.
- No Admin, a secao "Dashboard de erros" permite filtrar `SERVER`/`CLIENT`/`EDGE` e buscar por request id.

## Setup local

Comandos principais:

```bash
npm run quest:all
npm run quest:fast
npm run tunnel
npm run tunnel:status
```

Fluxo recomendado (ngrok separado):

1. Terminal 1: suba o app com `npm run quest:fast` (ou `npm run quest:all`).
2. Terminal 2: suba o tunel com `npm run tunnel`.

Credenciais demo (geradas no seed):

- Enterprise (papel Patrono): `enterprise@quest.local` / `QuestEnterprise123!`
- Aventureiro: `aventureiro.demo@quest.local` / `QuestAventura123!`

- `quest:all`: completo (docker + migrate + seed + warm-up Ollama + lint + test + build + dev)
- `quest:fast`: rapido para iteracao (docker + migrate + seed + dev, sem warm-up/lint/test/build)

O `quest:all` agora faz:

1. Cria `.env` automaticamente (se nao existir)
2. Valida migracoes (`migration.sql`)
3. Sobe Docker/Postgres e espera banco ficar pronto
4. `prisma generate` + `prisma deploy`
5. Seed (se `DEMO_SEED=true`)
6. `lint`, `test`, `build` (se `QUEST_SKIP_QUALITY=false`)
7. Sobe `next dev`
8. Opcional: sobe `ngrok` se `NGROK_ENABLED=true`
9. No modo completo, liga Ollama e aquece os modelos (`OLLAMA_MODEL`, `OLLAMA_MISSION_MODEL`, `OLLAMA_RPG_MODEL`, `OLLAMA_DISPUTE_MODEL`, `OLLAMA_SIMULATION_MODEL` e `OLLAMA_WARMUP_MODELS`)

### Acesso no celular (ngrok)

- O link do ngrok espelha o app inteiro, nao apenas uma pagina.
- Se abriu `https://SEU-LINK.ngrok-free.app`, voce pode navegar em todas as rotas (`/home`, `/profile`, `/ranking`, `/enterprise`, `/admin`).
- Use sempre o link completo no celular e entre normalmente com login/senha.
- Para manter ngrok separado do app, deixe `NGROK_ENABLED=false` e use `npm run tunnel`.
- `npm run tunnel` reaproveita tunel ativo (evita sessao duplicada), e sincroniza `NEXTAUTH_URL` no `.env` e `.env.example`.
- `npm run tunnel:status` mostra se ja existe tunel ativo sem abrir novo processo.
- Alternativa integrada: `npm run quest:all -- --ngrok` para subir ngrok dentro do pipeline.
- Se houver erro `ERR_NGROK_108`, encerre agentes antigos e mantenha so um tunel ativo na conta free.

Flags uteis:

```bash
npm run quest:all -- --no-dev
npm run quest:all -- --skip-quality
npm run quest:all -- --skip-docker
npm run quest:all -- --skip-ollama
npm run quest:all -- --ngrok
npm run quest:fast -- --no-dev
npm run quest:fast -- --ngrok
```

Fluxo manual:

1. Copie ambiente:

```bash
cp .env.example .env
```

2. Suba Postgres (Docker):

```bash
docker compose up -d
```

3. Rode migracao e generate:

```bash
npm run prisma:deploy
npm run prisma:generate
```

4. Seed (com demo):

```bash
npm run seed
```

5. Suba app:

```bash
npm run dev
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:push
npm run prisma:generate
npm run seed
npm run test
npm run test:e2e
npm run quest:all
npm run quest:fast
npm run tunnel
npm run tunnel:status
npm run assets:generate
```

## Deploy (Vercel + Neon/Supabase)

- Configure `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- Opcional: `RATE_LIMIT_STORE=db`, `SENDGRID_API_KEY`, `SENDGRID_FROM`.
- Execute migrations no banco alvo antes do primeiro deploy.

## FAQ curto

- Precisa morar em SP? Nao. SP e origem. Missoes remotas (Brasil).
- Como funciona pagamento? Cofre quando patrocinado; Alpha pode ser manual.
- Precisa portfolio? Nao. Sobe de rank por missoes de treino.
- Isso e emprego? Nao. Painel de missoes + reputacao.
- E disputa? Checklist + evidencias. Arbitragem objetiva.

## Regras do Alpha

- Patrono define condicoes de vitoria.
- 1 revisao padrao.
- Ban por fraude ou quebra recorrente de regras.
- Sem promessa de emprego/CLT.

## Observacoes

- Upload atual e local (`public/uploads`), pronto para trocar por S3.
- Cofre e founders operam em modo manual no Alpha (confirmacao admin).
- O seed cria admin, patrono, aventureiro, 28 missoes digitais de Piracicaba/SP (4 por categoria), 5 submissoes e dados de ranking.
