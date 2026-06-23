/*
  Warnings:

  - The `status` column on the `HeExtra` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "StatusHeExtra" AS ENUM ('PENDENTE_ACEITE', 'AGUARDANDO_MARCACAO', 'REALIZADA', 'FALTA_HE', 'RECUSADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusCompensacao" AS ENUM ('PENDENTE_GESTOR', 'APROVADA', 'REPROVADA', 'CANCELADA');

-- AlterTable
ALTER TABLE "HeExtra" ADD COLUMN     "compensacao_id" UUID,
ADD COLUMN     "entrada_marcacao_id" UUID,
ADD COLUMN     "saida_marcacao_id" UUID,
DROP COLUMN "status",
ADD COLUMN     "status" "StatusHeExtra" NOT NULL DEFAULT 'PENDENTE_ACEITE';

-- CreateTable
CREATE TABLE "ConfigHe" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "max_min_dia" INTEGER NOT NULL DEFAULT 120,
    "max_min_semana" INTEGER NOT NULL DEFAULT 600,
    "max_min_mes" INTEGER NOT NULL DEFAULT 2400,
    "intervalo_min_apos_jornada_min" INTEGER NOT NULL DEFAULT 60,

    CONSTRAINT "ConfigHe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitacaoCompensacao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "solicitante_id" UUID NOT NULL,
    "data_falta" DATE NOT NULL,
    "motivo" VARCHAR(300) NOT NULL,
    "status" "StatusCompensacao" NOT NULL DEFAULT 'PENDENTE_GESTOR',
    "gestor_id" UUID,
    "gestor_obs" VARCHAR(300),
    "gestor_at" TIMESTAMP(3),
    "reconciliada_at" TIMESTAMP(3),
    "resultado" VARCHAR(20),

    CONSTRAINT "SolicitacaoCompensacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfigHe_tenant_id_key" ON "ConfigHe"("tenant_id");

-- CreateIndex
CREATE INDEX "SolicitacaoCompensacao_tenant_id_colaborador_id_data_falta_idx" ON "SolicitacaoCompensacao"("tenant_id", "colaborador_id", "data_falta");

-- CreateIndex
CREATE INDEX "SolicitacaoCompensacao_tenant_id_status_idx" ON "SolicitacaoCompensacao"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "HeExtra_tenant_id_status_idx" ON "HeExtra"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "HeExtra_compensacao_id_idx" ON "HeExtra"("compensacao_id");

-- AddForeignKey
ALTER TABLE "HeExtra" ADD CONSTRAINT "HeExtra_compensacao_id_fkey" FOREIGN KEY ("compensacao_id") REFERENCES "SolicitacaoCompensacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigHe" ADD CONSTRAINT "ConfigHe_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoCompensacao" ADD CONSTRAINT "SolicitacaoCompensacao_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "Colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
