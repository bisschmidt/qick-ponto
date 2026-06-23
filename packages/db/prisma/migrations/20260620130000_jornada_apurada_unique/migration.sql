-- Antes de criar o índice, remove registros duplicados (mantém o mais recente)
DELETE FROM "JornadaApurada" a
USING "JornadaApurada" b
WHERE a."colaborador_id" = b."colaborador_id"
  AND a."data_referencia" = b."data_referencia"
  AND a."created_at" < b."created_at";

-- CreateIndex
CREATE UNIQUE INDEX "JornadaApurada_colaborador_id_data_referencia_key"
  ON "JornadaApurada"("colaborador_id", "data_referencia");
