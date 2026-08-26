-- AlterTable
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "partNumber" TEXT;
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "expectedScrap" DECIMAL(12,3);
