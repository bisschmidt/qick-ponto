# Análise de Topologia — Qick Ponto (pré-lançamento)

> Diagnóstico do estado atual da infraestrutura e recomendação de topologia antes do
> lançamento oficial. Levantado em 2026-06-24 a partir do código e do estado real de
> produção. **Nada foi alterado** — este documento é base de decisão.

---

## 1. Resumo executivo (TL;DR)

O produto (API + web) está **funcionando** para o piloto, mas a infraestrutura tem
**lacunas que impedem um lançamento oficial em conformidade**. Os três pontos mais críticos:

1. **O Worker de geração de comprovante (CRPT) não está implantado** em lugar nenhum — e mesmo
   se estivesse, hoje ele **não salva o PDF**. O CRPT é exigência da Portaria 671.
2. **O Redis (Upstash, plano grátis) estourou o limite** de 500 mil requisições → a fila de
   jobs está quebrada.
3. **O storage (S3) não está realmente conectado em produção** → comprovantes, espelhos e
   arquivos fiscais (AFD/AEJ) não são guardados de forma durável.

Além disso, há **bagunças estruturais** que descobrimos no caminho (dois bancos de dados, dois
projetos Vercel, deploy manual da API) que precisam ser consolidadas.

A boa notícia: **nada disso é difícil de arrumar** — é organização de infraestrutura, não
reescrita de produto.

---

## 2. Topologia ATUAL (o que existe hoje)

```
                         GitHub (bisschmidt/qick-ponto) — monorepo pnpm
                          apps/api · apps/worker · apps/web · packages/*
                                          │
            ┌─────────────────────────────┼──────────────────────────────┐
            │                             │                              │
     ┌──────▼──────┐              ┌────────▼────────┐            ┌────────▼─────────┐
     │  VERCEL     │              │   RAILWAY       │            │  EXTERNOS         │
     │ qick-ponto- │              │  qick-ponto-api │            │  • Upstash Redis  │
     │   web       │              │  (deploy MANUAL │            │    (free, ESTOUROU)│
     │ (auto-deploy│              │   via railway up)│           │  • Supabase Postgres
     │  GitHub ✓)  │              │  + Postgres      │            │    (.env local;   │
     │ domínio:    │──API_URL──▶  │  (produção real) │            │    PII real)      │
     │ ponto.qick. │              │                  │            │  • S3 / bucket?   │
     │ digital     │              │  Worker? ❌ não  │            │    (não wired)    │
     └─────────────┘              │  implantado      │            └───────────────────┘
                                  └──────────────────┘
```

**Detalhamento:**

| Camada | Onde está | Situação |
|--------|-----------|----------|
| Código | GitHub `bisschmidt/qick-ponto` | OK ✓ |
| Web (Next.js) | Vercel `qick-ponto-web` | OK ✓ — auto-deploy + domínio `ponto.qick.digital` (resolvido hoje) |
| API (Fastify) | Railway `qick-ponto-api` | Deploy **manual** (`railway up`); não conectado ao GitHub |
| Banco produção | Railway Postgres | É o banco real do piloto ✓ |
| Banco "fantasma" | **Supabase** | O `.env` local aponta pra cá; tem **PII real**; RLS ligado hoje. Causou o bug do ConfigHe (migrations locais iam pro lugar errado) |
| Fila/cache | **Upstash Redis** (externo, grátis) | **Estourou 500k requisições** → fila quebrada |
| **Worker (CRPT)** | **nenhum lugar** | ❌ **Não implantado.** Jobs de comprovante se acumulam sem ninguém processar |
| Storage (S3) | MinIO local (docker) | Em produção **não há bucket conectado**; o código gera o PDF em memória mas **não faz upload** |
| Certificado A1 (ICP-Brasil) | `CERT_PFX_*` | Necessário pra assinar AFD/AEJ (API) e CRPT (worker). **Status em prod a confirmar** |
| Dev local | deveria ser `docker-compose` (Postgres/Redis/MinIO) | Mas o `.env` foi apontado pro Supabase — fonte de confusão |

---

## 3. Problemas e riscos (priorizados)

### 🔴 Bloqueadores para lançamento oficial (conformidade / perda de dado)

- **B1 — Worker de CRPT não roda.** O comprovante de registro de ponto (exigência legal,
  Portaria MTP 671) não é gerado. E o código do worker, mesmo rodando, **só monta a URL do PDF
  mas não sobe o arquivo** (`apps/worker/src/index.ts`). Precisa: implantar o worker + implementar
  o upload real.
- **B2 — Redis estourado.** A fila (`crpt`) depende do Redis, que atingiu o teto do plano grátis
  do Upstash. Precisa de um Redis sem esse teto.
- **B3 — Storage S3 não conectado em produção.** CRPT, espelho de ponto (M6) e arquivos fiscais
  AFD/AEJ não são persistidos de forma durável. O código comenta explicitamente "upload é
  responsabilidade do caller" — e ninguém faz o upload. Precisa: bucket real + wire dos uploads.
- **B4 — Certificado ICP-Brasil A1 em produção.** Sem ele, AFD/AEJ não assinam → não-conformidade
  fiscal. Confirmar que está configurado com segurança no ambiente (não em código).
- **B5 — Backups do Postgres de produção.** Dado de ponto tem retenção legal obrigatória.
  Confirmar que o Railway Postgres tem backup automático ativo.
- **B6 — Dois bancos / `.env` apontando pro errado.** Risco real de operar/migrar no banco
  errado (já aconteceu hoje). Consolidar em um único banco de produção e um de dev.

### 🟠 Importantes (não bloqueiam o lançamento, mas arrumar logo)

- **I1 — API sem auto-deploy.** Hoje é `railway up` manual. Conectar a API (e o worker) ao GitHub,
  ou usar GitHub Actions.
- **I2 — Projeto Vercel antigo "web"** ainda existe (o domínio foi movido pro `qick-ponto-web`).
  Limpar para não confundir no futuro.
- **I3 — Segredos.** Garantir `JWT_SECRET` forte em produção (o exemplo é `change-me`), e revisar
  todos os segredos. Rotacionar as senhas que ficaram expostas no Supabase sem RLS.
- **I4 — Sem ambiente de staging.** Para um produto regulado, ter homologação antes de produção
  evita testar na base real do cliente.
- **I5 — Observabilidade.** Não há alerta para "fila parada", "erro 500 em alta", "worker caiu".
  Para produção vale um mínimo de monitoração.
- **I6 — Faturamento/trials.** Vercel está em "Pro Trial" (expira em ~11 dias) e o Railway também
  tem cobrança. Definir os planos pagos antes do lançamento pra não cair o serviço.

---

## 4. Topologia RECOMENDADA

**Princípio: consolidar.** Hoje a infra está espalhada em Railway + Supabase + Upstash + (S3?) +
2 projetos Vercel. A recomendação é concentrar o backend **num único projeto Railway** (rede
interna, sem tetos de requisições, billing num lugar só) e manter o front no Vercel.

```
   GitHub (monorepo)
        │  push
        ├───────────────▶ VERCEL: qick-ponto-web  →  ponto.qick.digital   (auto-deploy ✓)
        │
        └───────────────▶ RAILWAY (projeto único)
                              ├── Serviço: API (Fastify)      ── auto-deploy
                              ├── Serviço: Worker (BullMQ)     ── auto-deploy   ← IMPLANTAR
                              ├── Postgres (com backup)        ← banco único de produção
                              └── Redis (plugin Railway)       ← sem teto de requisições

   Storage de arquivos fiscais (CRPT/espelho/AFD/AEJ):
        → bucket S3 real (AWS S3 ou Cloudflare R2) + wire dos uploads no código

   Certificado A1 ICP-Brasil:
        → guardado como secret do Railway (nunca em código)

   Dev local:
        → docker-compose (Postgres + Redis + MinIO) — .env volta pro localhost
        → Supabase aposentado
```

**Por que assim:**
- **Railway p/ todo o backend:** API, worker, Postgres e Redis no mesmo projeto se enxergam pela
  rede interna, sem custo/teto de requisições externas (resolve B2), e o billing fica num lugar só.
- **Redis do Railway** em vez do Upstash grátis: sem o teto de 500k que nos quebrou hoje.
- **Worker como serviço Railway** (resolve B1): o mesmo repo, um serviço separado rodando
  `apps/worker`. Falta também implementar o upload real do PDF.
- **S3 real + uploads conectados** (resolve B3): sugiro **Cloudflare R2** (sem custo de egress) ou
  **AWS S3**. Guardar CRPT, espelho e AFD/AEJ.
- **Um banco só de produção** (Railway) + um de dev (docker local). Aposentar o Supabase elimina a
  confusão de origem (resolve B6).

---

## 5. Decisões que dependem de você

1. **Redis:** migrar para o **Redis do Railway** (recomendado) ou pagar o Upstash?
2. **Storage de arquivos:** **Cloudflare R2** (mais barato, sem egress), **AWS S3**, ou volume do
   Railway? (Recomendo R2.)
3. **Supabase:** pode **aposentar**? (Recomendo sim — confirmar antes que nenhum dado vive só lá.)
4. **Auto-deploy da API/Worker:** resolver a conta do GitHub no Railway, ou usar **GitHub Actions**
   com token? (A conta do Railway não é baseada em GitHub — foi o que travou a conexão antes.)
5. **Staging:** quer um ambiente de homologação separado antes da produção?
6. **Planos pagos:** confirmar Vercel Pro e Railway (trials expiram) antes do lançamento.

---

## 6. Plano de ajustes (checklist para executarmos juntos)

**Fase 1 — Bloqueadores (antes de lançar):**
- [ ] Adicionar **Redis no Railway** e apontar `REDIS_URL` da API/worker pra ele
- [ ] **Implantar o Worker** como serviço no Railway (mesmo repo, start `apps/worker`)
- [ ] Implementar o **upload real** dos PDFs (CRPT no worker; espelho no M6; AFD/AEJ no M7)
- [ ] Configurar **bucket S3/R2** e as credenciais como secret
- [ ] Confirmar/instalar o **certificado A1** em produção (secret) e testar a assinatura AFD/AEJ
- [ ] Confirmar **backup automático** do Postgres de produção
- [ ] **Consolidar bancos:** definir Railway como único de produção; reverter `.env` local pro
      docker-compose; aposentar o Supabase (após conferência)
- [ ] Garantir **`JWT_SECRET` forte** e revisar todos os segredos; rotacionar os expostos

**Fase 2 — Robustez (logo após):**
- [ ] **Auto-deploy** da API e do Worker (GitHub ou Actions)
- [ ] Limpar o **projeto Vercel "web"** antigo
- [ ] Mínimo de **observabilidade/alertas** (erro 500, fila, worker)
- [ ] Definir **planos pagos** (Vercel/Railway)
- [ ] (Opcional) Ambiente de **staging**

---

### Anexo — evidências técnicas
- Worker existe em `apps/worker/src/index.ts` (consome fila `crpt`), mas Railway só tem os serviços
  `qick-ponto-api` + `Postgres` (sem worker, sem Redis).
- Upload ausente: `apps/worker/src/index.ts` monta `crpt_url` mas não sobe o arquivo;
  `apps/api/src/modules/m6-fechamento/service.ts` comenta "upload para S3 é responsabilidade do caller".
- AFD/AEJ: `apps/api/src/modules/m7-afd/service.ts` gera e assina (CAdES) **de forma síncrona** na
  API — depende do certificado em produção.
- Stack de dev pretendida: `docker-compose.yml` (Postgres 16 + Redis 7 + MinIO).
