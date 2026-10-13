-- AlterTable: add materialCategory to DeliveryChallan
ALTER TABLE "DeliveryChallan" ADD COLUMN "materialCategory" TEXT DEFAULT 'PRODUCTION';

-- CreateIndex
CREATE INDEX "DeliveryChallan_materialCategory_idx" ON "DeliveryChallan"("materialCategory");
