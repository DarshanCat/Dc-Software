-- AlterEnum
ALTER TYPE "PricingBasis" ADD VALUE 'RW';

-- AlterTable
ALTER TABLE "DeliveryChallan" ADD COLUMN "pricingQuantitySnapshot" DECIMAL(12,3);
