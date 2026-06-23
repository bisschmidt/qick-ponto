-- AlterTable: add onboarding token fields and make senha_hash nullable
ALTER TABLE "Usuario"
  ADD COLUMN "onboarding_token"         VARCHAR(64),
  ADD COLUMN "onboarding_token_expires" TIMESTAMP(3),
  ALTER COLUMN "senha_hash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_onboarding_token_key" ON "Usuario"("onboarding_token");
