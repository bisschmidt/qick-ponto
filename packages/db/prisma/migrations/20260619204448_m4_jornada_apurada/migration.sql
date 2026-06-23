-- AlterEnum
ALTER TYPE "StatusPonto" ADD VALUE 'PRESENTE';

-- CreateTable
CREATE TABLE "JornadaApurada" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" UUID NOT NULL,
    "colaborador_id" UUID NOT NULL,
    "data_referencia" DATE NOT NULL,
    "entrada_real" TIMESTAMP(3),
    "saida_real" TIMESTAMP(3),
    "minutos_trabalhados" INTEGER NOT NULL DEFAULT 0,
    "minutos_he_50" INTEGER NOT NULL DEFAULT 0,
    "minutos_he_100" INTEGER NOT NULL DEFAULT 0,
    "minutos_atraso" INTEGER NOT NULL DEFAULT 0,
    "minutos_saida_antecipada" INTEGER NOT NULL DEFAULT 0,
    "minutos_ad_noturno" INTEGER NOT NULL DEFAULT 0,
    "minutos_hora_reduzida" INTEGER NOT NULL DEFAULT 0,
    "pausas_nr17_concedidas" INTEGER NOT NULL DEFAULT 0,
    "pausas_nr17_conformes" BOOLEAN NOT NULL DEFAULT false,
    "status" "StatusPonto" NOT NULL,
    "eh_feriado" BOOLEAN NOT NULL DEFAULT false,
    "eh_dsr" BOOLEAN NOT NULL DEFAULT false,
    "inconsistencias" JSONB NOT NULL DEFAULT '[]',
    "origem_ajuste_id" UUID,

    CONSTRAINT "JornadaApurada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JornadaApurada_tenant_id_colaborador_id_data_referencia_idx" ON "JornadaApurada"("tenant_id", "colaborador_id", "data_referencia");

-- CreateIndex
CREATE INDEX "JornadaApurada_tenant_id_data_referencia_idx" ON "JornadaApurada"("tenant_id", "data_referencia");

-- CreateIndex
CREATE INDEX "JornadaApurada_tenant_id_status_idx" ON "JornadaApurada"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "JornadaApurada" ADD CONSTRAINT "JornadaApurada_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "Colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
