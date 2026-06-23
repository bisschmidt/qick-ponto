# Qick Ponto

Sistema de ponto eletrônico **REP-P** multi-tenant para call centers, em conformidade com
CLT, Portaria MTP 671/2021 (AFD/AEJ), NR-17 e LGPD.

## Stack

- **API:** Node.js 22 + TypeScript + Fastify 5 + Prisma 6 + PostgreSQL (Supabase)
- **Web:** Next.js 15 (App Router)
- **Fila/cache:** BullMQ + Redis
- **Storage:** S3-compatible (MinIO local / AWS S3 prod)
- **Monorepo:** pnpm workspaces

## Estrutura

```
apps/
  api/      # API REST (Fastify) — deploy no Railway
  web/      # Front-end (Next.js) — deploy na Vercel
packages/
  db/       # Prisma schema + migrations
  afd/      # Gerador AFD/AEJ
  pdf/      # Gerador de CRPT e espelho
  types/    # Tipos compartilhados
docs/
  BUSINESS_RULES.md   # Regras de negócio e regulatórias
CLAUDE.md             # Decisões de implementação (stack, schema, convenções)
```

## Deploy

Ambos os apps fazem **deploy automático a cada `git push` na branch `main`**:

- **API** → Railway (Nixpacks, `railway.json`)
- **Web** → Vercel (root `apps/web`)

```bash
git add -A
git commit -m "descrição da mudança"
git push
```

> Os segredos vivem no `.env` (nunca commitado). Veja `.env.example` para os campos esperados.

## Documentação

- Regras de negócio e especificação regulatória: [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md)
- Decisões de implementação: [`CLAUDE.md`](CLAUDE.md)
