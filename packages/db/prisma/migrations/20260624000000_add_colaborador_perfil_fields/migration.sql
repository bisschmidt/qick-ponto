-- AlterTable: novos campos de perfil e configuração de marcação do colaborador (aditivo)
ALTER TABLE "Colaborador"
  ADD COLUMN "nome_social"      VARCHAR(100),
  ADD COLUMN "usar_nome_social" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cargo"            VARCHAR(100),
  ADD COLUMN "time_nome"        VARCHAR(100),
  ADD COLUMN "departamento"     VARCHAR(100),
  ADD COLUMN "validacao_facial" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "canal_app"        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "canal_quiosque"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "canal_computador" BOOLEAN NOT NULL DEFAULT false;
