-- AlterTable
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "rmQuantity" DECIMAL(12,3);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "returnFgQuantity" DECIMAL(12,3);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "heatNumber" TEXT;
