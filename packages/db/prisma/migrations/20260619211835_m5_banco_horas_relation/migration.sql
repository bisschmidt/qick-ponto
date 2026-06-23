-- AddForeignKey
ALTER TABLE "BancoHoras" ADD CONSTRAINT "BancoHoras_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "Colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
