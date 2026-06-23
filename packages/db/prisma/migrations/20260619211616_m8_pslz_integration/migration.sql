-- CreateTable
CREATE TABLE "IntegracaoPslz" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "endpoint_url" VARCHAR(500) NOT NULL,
    "api_key_enc" VARCHAR(500) NOT NULL,
    "webhook_secret_enc" VARCHAR(500) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "IntegracaoPslz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookPslzLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" UUID NOT NULL,
    "direcao" VARCHAR(6) NOT NULL,
    "evento" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 1,
    "resposta" JSONB,
    "erro_msg" VARCHAR(500),

    CONSTRAINT "WebhookPslzLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegracaoPslz_tenant_id_key" ON "IntegracaoPslz"("tenant_id");

-- CreateIndex
CREATE INDEX "WebhookPslzLog_tenant_id_evento_created_at_idx" ON "WebhookPslzLog"("tenant_id", "evento", "created_at");

-- CreateIndex
CREATE INDEX "WebhookPslzLog_tenant_id_status_idx" ON "WebhookPslzLog"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "IntegracaoPslz" ADD CONSTRAINT "IntegracaoPslz_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookPslzLog" ADD CONSTRAINT "WebhookPslzLog_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
