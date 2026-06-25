-- CreateTable: horário por dia da semana (override do horário base da Jornada)
CREATE TABLE "JornadaHorario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "jornada_id" UUID NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "hora_inicio" VARCHAR(5) NOT NULL,
    "hora_fim" VARCHAR(5) NOT NULL,

    CONSTRAINT "JornadaHorario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JornadaHorario_jornada_id_dia_semana_key" ON "JornadaHorario"("jornada_id", "dia_semana");

-- AddForeignKey
ALTER TABLE "JornadaHorario" ADD CONSTRAINT "JornadaHorario_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "Jornada"("id") ON DELETE CASCADE ON UPDATE CASCADE;
