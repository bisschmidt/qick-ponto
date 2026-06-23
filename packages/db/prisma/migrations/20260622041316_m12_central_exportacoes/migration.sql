-- CreateEnum
CREATE TYPE "SistemaFolha" AS ENUM ('QUESTOR');

-- CreateEnum
CREATE TYPE "EventoFolhaTipo" AS ENUM ('HE_50', 'HE_100', 'ADICIONAL_NOTURNO', 'FALTA', 'FALTA_DSR', 'ATRASO', 'HORA_REDUZIDA');

-- CreateTable
CREATE TABLE "ConfigExportacaoFolha" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sistema" "SistemaFolha" NOT NULL,
    "codigo_empresa" VARCHAR(20) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ConfigExportacaoFolha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapeamentoEventoFolha" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sistema" "SistemaFolha" NOT NULL,
    "evento" "EventoFolhaTipo" NOT NULL,
    "codigo_externo" VARCHAR(20) NOT NULL,

    CONSTRAINT "MapeamentoEventoFolha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColaboradorCodigoFolha" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "sistema" "SistemaFolha" NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,

    CONSTRAINT "ColaboradorCodigoFolha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportacaoFolhaLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" UUID NOT NULL,
    "sistema" "SistemaFolha" NOT NULL,
    "cnpj_estab_id" UUID NOT NULL,
    "periodo_id" UUID,
    "competencia_ini" DATE NOT NULL,
    "competencia_fim" DATE NOT NULL,
    "solicitante_id" UUID NOT NULL,
    "total_linhas" INTEGER NOT NULL,
    "nome_arquivo" VARCHAR(200) NOT NULL,

    CONSTRAINT "ExportacaoFolhaLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfigExportacaoFolha_tenant_id_sistema_key" ON "ConfigExportacaoFolha"("tenant_id", "sistema");

-- CreateIndex
CREATE UNIQUE INDEX "MapeamentoEventoFolha_tenant_id_sistema_evento_key" ON "MapeamentoEventoFolha"("tenant_id", "sistema", "evento");

-- CreateIndex
CREATE UNIQUE INDEX "ColaboradorCodigoFolha_colaborador_id_sistema_key" ON "ColaboradorCodigoFolha"("colaborador_id", "sistema");

-- CreateIndex
CREATE INDEX "ExportacaoFolhaLog_tenant_id_sistema_created_at_idx" ON "ExportacaoFolhaLog"("tenant_id", "sistema", "created_at");

-- AddForeignKey
ALTER TABLE "ConfigExportacaoFolha" ADD CONSTRAINT "ConfigExportacaoFolha_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapeamentoEventoFolha" ADD CONSTRAINT "MapeamentoEventoFolha_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColaboradorCodigoFolha" ADD CONSTRAINT "ColaboradorCodigoFolha_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "Colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportacaoFolhaLog" ADD CONSTRAINT "ExportacaoFolhaLog_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
