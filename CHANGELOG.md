# Changelog

Todas as mudancas relevantes do QUEST serao registradas aqui.

Formato baseado em "Keep a Changelog" e versionamento semantico adaptado ao plano do projeto (`v1`, `v1.1`, `v1.2`, `v2`...).

## [Unreleased]

### Added
- Estrutura inicial de changelog para rastrear evolucao por versao.
- Endpoint admin de controle LLM/Ollama (`/api/admin/llm/control`) com leitura de status do servidor, lista de modelos, warmup e teste manual.
- Telemetria runtime de chamadas Ollama (historico de sucesso/falha por `requestTag`) para inspeção no painel.
- Novo componente reutilizavel de cards de missao com icones + hover (`MissionPreviewGrid`).
- Modelo `UploadedAsset` para rastrear ownership de arquivos enviados e uso em submissao de missao.
- Novos testes unitarios para sanitizacao de callback (`callback-url.test.ts`) e regras de visibilidade de missao (`mission-visibility.test.ts`).
- Modelo `RuntimeSetting` para persistir configuracoes globais de runtime no banco.
- Script operacional `uploads:cleanup` para remover uploads orfaos antigos (`scripts/cleanup-orphan-uploads.mjs`).
- Testes E2E de seguranca para callback/login e RBAC entre aventureiros (`tests/e2e/rbac.spec.ts`).

### Changed
- `NEXTAUTH_URL` ajustado para dominio ngrok em ambiente externo.
- `.env.example` alinhado com `NEXTAUTH_URL` atual do ngrok para evitar erro de callback no auth em ambiente externo.
- `NEXTAUTH_URL` atualizado novamente para o novo dominio do tunel ngrok (`2a12-179-220-122-62.ngrok-free.app`).
- `NEXTAUTH_URL` atualizado para o novo dominio do tunel ngrok (`4223-179-220-122-62.ngrok-free.app`).
- Removido `trustHost` de `authOptions` por incompatibilidade de tipagem/comportamento com `next-auth` v4 (`AuthOptions`).
- Fluxos de LLM (screening de missao, triagem de disputa, simulacao e narrativa RPG) passam a respeitar runtime config central, nao apenas variaveis fixas de `.env`.
- Aba `Pipeline LLM` no admin passou a permitir controle completo em runtime (enable/disable, base URL, modelos por etapa, timeouts, retry, warmup e teste).
- Aba `Missoes` do admin ganhou modo `Hover` com preview visual antes de abrir detalhes.
- Acompanhamento `Enterprise` foi convertido para o mesmo padrao de preview com icones/hover.
- `GET /api/missions` agora aplica escopo por papel (admin total, patrono apenas proprio, aventureiro apenas abertas/atribuidas a ele).
- `GET /api/missions/[id]` e `/mission/[id]` passam a permitir visao publica apenas para missoes `OPEN`.
- Middleware e tela de login passaram a sanitizar `callbackUrl` e preservar query string original ao redirecionar para auth.
- Overrides do runtime LLM agora persistem no banco (via `RuntimeSetting`) para funcionar em ambiente com multiplas instancias.
- `admin-panel` foi modularizado com extracao de tipos e helpers para reduzir acoplamento do componente principal.
- Polling de notificacoes ficou adaptativo (intervalo maior com menu fechado e pausa quando aba esta oculta).
- `next.config.mjs` ganhou `allowedDevOrigins` via env (`ALLOWED_DEV_ORIGINS`) para reduzir bloqueios de origem no dev com ngrok.
- `next.config.mjs` migrou o ajuste de log do Sentry para `webpack.treeshake.removeDebugLogging`.
- Upload passou a aplicar limite total por usuario (`UPLOAD_USER_MAX_BYTES`) antes de aceitar novos arquivos.

### Fixed
- Logger de backend passou a usar implementacao sem worker thread para evitar falhas intermitentes em `next dev` no Windows (`vendor-chunks/lib/worker.js`).
- Upload agora valida assinatura real do arquivo (PNG/JPG/PDF/TXT) em vez de confiar apenas no MIME enviado pelo cliente.
- Submissao de missao agora valida `proofFiles` contra uploads realmente pertencentes ao usuario autenticado.
- Rotina de configuracao LLM deixou de depender de arquivo local por instancia, evitando desvio de comportamento entre processos.

---

## [v0.0.0] - 2026-03-07

### Added
- Baseline completa do app QUEST com stack Next.js + Prisma + Postgres + NextAuth.
- Fluxo de missoes com wizard do patrono, aceite, submissao, revisao e disputa.
- Sistema de ranking/XP e moeda Enchantiun.
- Painel admin com moderacao, escrow manual, auditoria e operacao Alpha.
- Camada enterprise com linguagem corporativa e monitoramento por escopo.
- Camada RPG para aventura (narrativas, ranks, recompensas visuais).
- Pipeline de suporte IA (triagem de disputa, simulacao LLM, screening de missoes).
- Observabilidade com ErrorEvent, request id e suporte opcional a Sentry.
- Scripts operacionais `quest:all` e `quest:fast`.

### Changed
- Home, quadro de missoes e perfil ajustados para UX mobile e desktop.
- Aba admin reorganizada para facilitar aprovacao de missoes.
- Login ajustado para redirecionamento robusto em localhost e ngrok.

### Fixed
- Correcoes de fluxo de login/callback em ambientes com dominio externo.
- Correcoes de visual e interacao de cards/hover de missao.

---

## Politica de versao

- `vN.0.0`: marco principal (major).
- `vN.M.0`: evolucao funcional importante sem quebra estrutural (minor).
- `vN.M.P`: hotfix/correcao pontual (patch).

Exemplo de progressao:

- `v1.0.0`
- `v1.1.0`
- `v1.2.0`
- `v2.0.0`
