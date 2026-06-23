-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "ip_whitelist" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "plano" VARCHAR(50) NOT NULL DEFAULT 'pilot';
