-- AddForeignKey
ALTER TABLE "EspelhoPonto" ADD CONSTRAINT "EspelhoPonto_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "Colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
