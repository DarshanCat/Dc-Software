-- AlterTable
ALTER TABLE "DeliveryChallan" ADD COLUMN     "storeGatingWeight" DECIMAL(12,3),
ADD COLUMN     "storeBoringWeight" DECIMAL(12,3),
ADD COLUMN     "rmUom" TEXT,
ADD COLUMN     "fgUom" TEXT,
ADD COLUMN     "dimensionUom" TEXT;
