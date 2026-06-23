# CLAUDE.md — Qick Ponto (Implementação)

> Este arquivo contém **decisões de implementação**: stack, schema, padrões de código.
> As regras de negócio e especificações regulatórias vivem em `docs/BUSINESS_RULES.md`.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js 22 LTS + TypeScript 5 (strict) |
| API | Fastify 5 + @fastify/jwt + @fastify/multipart |
| Schema validation | Zod (domínio) + JSON Schema via Fastify (transporte) |
| ORM | Prisma 6 |
| Banco | PostgreSQL 16 |
| Fila / cache | BullMQ 5 + Redis 7 |
| Storage | S3-compatible (MinIO local, AWS S3 prod) |
| PDF | pdfkit + node-signpdf (CRPT PAdES) |
| Assinatura fiscal | pkijs (CAdES para AFD/AEJ) |
| Testes | Vitest + Supertest |
| Monorepo | pnpm workspaces |

---

## Estrutura de pastas

```
qick-ponto/
├── apps/
│   ├── api/            # Fastify REST API
│   │   ├── src/
│   │   │   ├── modules/   # Um diretório por módulo de negócio (m1, m2, ...)
│   │   │   ├── plugins/   # Fastify plugins (auth, db, redis, s3, queue)
│   │   │   └── server.ts
│   │   └── package.json
│   └── worker/         # Processo BullMQ separado
│       ├── src/
│       │   ├── jobs/      # Um arquivo por tipo de job
│       │   └── index.ts
│       └── package.json
├── packages/
│   ├── db/             # Prisma schema + migrations + client
│   ├── afd/            # Gerador de AFD/AEJ (ISO 8859-1, CRC-16, SHA-256)
│   ├── pdf/            # Gerador de CRPT e espelho em PDF
│   └── types/          # Tipos TypeScript compartilhados
├── docs/
│   └── BUSINESS_RULES.md
├── CLAUDE.md           # Este arquivo
├── docker-compose.yml  # PostgreSQL + Redis + MinIO local
├── package.json        # pnpm workspace root
└── pnpm-workspace.yaml
```

---

## Convenções de código

### Geral
- TypeScript strict — sem `any`, sem `as` desnecessário
- Sem comentários que expliquem o óbvio; apenas WHY não-óbvio
- Erros como valores usando `Result<T, E>` ou throws tipados — nunca `catch (e: any)`
- Sem `console.log` em produção; usar o logger do Fastify (`request.log`)

### Naming
- Arquivos: `kebab-case.ts`
- Classes/tipos/interfaces: `PascalCase`
- Funções/variáveis: `camelCase`
- Constantes de ambiente: `UPPER_SNAKE_CASE`
- Rotas: `kebab-case` (ex.: `/colaboradores/:id/marcacoes`)

### Módulos
- Cada módulo de negócio tem: `router.ts`, `service.ts`, `schema.ts`, `repository.ts`
- Service nunca fala com o banco diretamente — chama repository
- Router só valida input/output e delega ao service
- Repository só faz queries — sem lógica de negócio

---

## Multi-tenancy

- Isolamento por **row-level** com coluna `tenant_id` (UUID) em todas as tabelas de dados
- O `tenant_id` é injetado automaticamente via plugin Fastify após autenticação
- Nenhuma query é executada sem filtro de `tenant_id` — o repository recebe sempre o contexto do tenant
- AFD e AEJ são gerados por CNPJ — nunca agregam dados de CNPJs diferentes

---

## Banco de dados (Prisma)

### Convenções de schema
- Nomes de modelo: `PascalCase` singular (ex.: `Colaborador`, `Marcacao`)
- Nomes de coluna: `snake_case` com mapeamento `@map` do Prisma
- PKs: UUID v7 (`@default(dbgenerated("gen_random_uuid()"))`) para ordenação temporal
- Timestamps: `created_at` e `updated_at` em toda tabela; sem `deleted_at` (imutabilidade via eventos)
- Enums: definidos no Prisma e mapeados para strings no DB

### Imutabilidade
- Registros de marcação, aceites e logs **nunca** recebem `UPDATE` ou `DELETE`
- Correções são novos registros referenciando o `nsr` original
- Migrations são sempre `additive` — nunca dropar colunas em produção

---

## Fila de jobs (BullMQ)

| Queue | Job | Trigger |
|-------|-----|---------|
| `crpt` | `generate-crpt` | Após cada marcação (M2) |
| `afd` | `generate-afd` | Solicitação manual ou fim de período |
| `aej` | `generate-aej` | Após fechamento do período (M6) |
| `alerts` | `check-alerts` | Cron a cada hora |

Workers rodam em `apps/worker` — processo separado do API.

---

## Autenticação e RBAC

```
Admin tenant  → CRUD completo no tenant
Gestor        → leitura da equipe, aprovações, lançamento de HE
RH/DP         → fechamento, homologação, relatórios fiscais, atestados
Colaborador   → marcação, ajuste próprio, espelho, compensação
Auditor       → somente leitura de relatórios e arquivos fiscais
```

JWT com payload: `{ sub: colaboradorId, tenantId, role, cnpj }`.
Middleware valida `tenantId` e `role` antes de qualquer handler.

---

## Variáveis de ambiente

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
S3_ENDPOINT=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=qick-ponto
JWT_SECRET=...
CERT_PFX_PATH=...        # Caminho para o A1 da Qick.ai (nunca em código)
CERT_PFX_PASSWORD=...    # Via secret manager em prod
```

A chave privada do certificado ICP-Brasil A1 **nunca** vai para o repositório.
Em produção, usar AWS Secrets Manager ou equivalente.

---

## Ordem de implementação dos módulos

1. **M1** — Cadastro & Escalas (fundação de dados)
2. **M2** — Marcação de Ponto (core + NSR + sequência)
3. **M7** — Geração AFD/AEJ (validação regulatória)
4. **M4** — Apuração & Tratamento (jornada apurada)
5. **M3** — Pausas NR-17 (controle de conformidade)
6. **M6** — Fechamento & Espelho (período + assinatura)
7. **M8** — Integração PSLZ Pay (eventos de folha)
8. **M5** — Banco de Horas (saldo + compensação)
9. **M9** — Gestão de Exceções (ajustes + log)
10. **M10** — Alertas & Relatórios (observabilidade)

M11 (Controle de Ativos) **não será implementado**.

---

## Referências regulatórias

Ver `docs/BUSINESS_RULES.md` para especificações completas de cada módulo.
Fonte primária para AFD/AEJ: Portaria MTP 671/2021, Anexos V e VI (gov.br).
