-- AlterTable
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "preparedByName" TEXT;
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "approvedByName" TEXT;
