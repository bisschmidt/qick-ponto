-- AlterTable
ALTER TABLE "Colaborador" ADD COLUMN     "gestor_id" UUID;

-- AddForeignKey
ALTER TABLE "Colaborador" ADD CONSTRAINT "Colaborador_gestor_id_fkey" FOREIGN KEY ("gestor_id") REFERENCES "Colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;
