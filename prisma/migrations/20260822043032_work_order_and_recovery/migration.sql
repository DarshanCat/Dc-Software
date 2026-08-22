/*
  Warnings:

  - The values [QUALITY_REJECTION] on the enum `ExceptionType` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `workOrderId` to the `DeliveryChallan` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "WoStatus" AS ENUM ('DRAFT', 'OPEN', 'WAITING_FOR_MATERIAL', 'READY_FOR_PROCESSING', 'PROCESSING', 'PARTIALLY_RETURNED', 'FULLY_RETURNED', 'RECONCILIATION', 'CLOSED', 'CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "ExceptionType_new" AS ENUM ('MATERIAL_SHORTAGE', 'MATERIAL_RETURN_SHORT', 'SCRAP_SHORTAGE', 'EXCESS_SCRAP', 'BORING_SHORT', 'UNCLASSIFIED_MATERIAL', 'PROCESS_LOSS_EXCEEDED', 'QUANTITY_MISMATCH', 'WEIGHT_MISMATCH', 'OVERDUE', 'OTHER');
ALTER TABLE "Exception" ALTER COLUMN "type" TYPE "ExceptionType_new" USING ("type"::text::"ExceptionType_new");
ALTER TYPE "ExceptionType" RENAME TO "ExceptionType_old";
ALTER TYPE "ExceptionType_new" RENAME TO "ExceptionType";
DROP TYPE "ExceptionType_old";
COMMIT;

-- AlterTable
ALTER TABLE "DeliveryChallan" ADD COLUMN     "workOrderId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "woNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "processId" TEXT,
    "requiredInputQty" DECIMAL(18,3) NOT NULL,
    "requiredInputUOM" TEXT NOT NULL DEFAULT 'NOS',
    "expectedOutputQty" DECIMAL(18,3) NOT NULL,
    "expectedOutputUOM" TEXT NOT NULL DEFAULT 'NOS',
    "status" "WoStatus" NOT NULL DEFAULT 'OPEN',
    "remarks" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryChallanExpectedReturn" (
    "id" TEXT NOT NULL,
    "dcId" TEXT NOT NULL,
    "returnItemId" TEXT NOT NULL,
    "expectedQty" DECIMAL(18,3) NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'NOS',
    "expectedWeight" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "remarks" TEXT,

    CONSTRAINT "DeliveryChallanExpectedReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'KG',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RecoveryType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryRequirement" (
    "id" TEXT NOT NULL,
    "dcId" TEXT NOT NULL,
    "recoveryTypeId" TEXT NOT NULL,
    "expectedWeight" DECIMAL(18,3) NOT NULL,

    CONSTRAINT "RecoveryRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryReceipt" (
    "id" TEXT NOT NULL,
    "dcId" TEXT NOT NULL,
    "recoveryTypeId" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedBy" TEXT NOT NULL,
    "weight" DECIMAL(18,3) NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialClassification" (
    "id" TEXT NOT NULL,
    "dcId" TEXT NOT NULL,
    "materialReceiptId" TEXT,
    "classifiedBy" TEXT NOT NULL,
    "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialClassificationItem" (
    "id" TEXT NOT NULL,
    "classificationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "receivedQty" DECIMAL(18,3) NOT NULL,
    "goodQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "scrapQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "scrapTypeId" TEXT,

    CONSTRAINT "MaterialClassificationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_woNumber_key" ON "WorkOrder"("woNumber");

-- CreateIndex
CREATE INDEX "WorkOrder_woNumber_idx" ON "WorkOrder"("woNumber");

-- CreateIndex
CREATE INDEX "WorkOrder_vendorId_idx" ON "WorkOrder"("vendorId");

-- CreateIndex
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

-- CreateIndex
CREATE INDEX "DeliveryChallanExpectedReturn_dcId_idx" ON "DeliveryChallanExpectedReturn"("dcId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryType_code_key" ON "RecoveryType"("code");

-- CreateIndex
CREATE INDEX "RecoveryRequirement_dcId_idx" ON "RecoveryRequirement"("dcId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryRequirement_dcId_recoveryTypeId_key" ON "RecoveryRequirement"("dcId", "recoveryTypeId");

-- CreateIndex
CREATE INDEX "RecoveryReceipt_dcId_idx" ON "RecoveryReceipt"("dcId");

-- CreateIndex
CREATE INDEX "RecoveryReceipt_recoveryTypeId_idx" ON "RecoveryReceipt"("recoveryTypeId");

-- CreateIndex
CREATE INDEX "MaterialClassification_dcId_idx" ON "MaterialClassification"("dcId");

-- CreateIndex
CREATE INDEX "MaterialClassificationItem_classificationId_idx" ON "MaterialClassificationItem"("classificationId");

-- CreateIndex
CREATE INDEX "MaterialClassificationItem_itemId_idx" ON "MaterialClassificationItem"("itemId");

-- CreateIndex
CREATE INDEX "DeliveryChallan_workOrderId_idx" ON "DeliveryChallan"("workOrderId");

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanExpectedReturn" ADD CONSTRAINT "DeliveryChallanExpectedReturn_dcId_fkey" FOREIGN KEY ("dcId") REFERENCES "DeliveryChallan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanExpectedReturn" ADD CONSTRAINT "DeliveryChallanExpectedReturn_returnItemId_fkey" FOREIGN KEY ("returnItemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryRequirement" ADD CONSTRAINT "RecoveryRequirement_dcId_fkey" FOREIGN KEY ("dcId") REFERENCES "DeliveryChallan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryRequirement" ADD CONSTRAINT "RecoveryRequirement_recoveryTypeId_fkey" FOREIGN KEY ("recoveryTypeId") REFERENCES "RecoveryType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryReceipt" ADD CONSTRAINT "RecoveryReceipt_dcId_fkey" FOREIGN KEY ("dcId") REFERENCES "DeliveryChallan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryReceipt" ADD CONSTRAINT "RecoveryReceipt_recoveryTypeId_fkey" FOREIGN KEY ("recoveryTypeId") REFERENCES "RecoveryType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialClassification" ADD CONSTRAINT "MaterialClassification_dcId_fkey" FOREIGN KEY ("dcId") REFERENCES "DeliveryChallan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialClassificationItem" ADD CONSTRAINT "MaterialClassificationItem_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "MaterialClassification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialClassificationItem" ADD CONSTRAINT "MaterialClassificationItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialClassificationItem" ADD CONSTRAINT "MaterialClassificationItem_scrapTypeId_fkey" FOREIGN KEY ("scrapTypeId") REFERENCES "ScrapType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
