-- Add extended DcStatus enum values
ALTER TYPE "DcStatus" ADD VALUE IF NOT EXISTS 'OUTWARD_CREATED';
ALTER TYPE "DcStatus" ADD VALUE IF NOT EXISTS 'MATERIAL_OUT';
ALTER TYPE "DcStatus" ADD VALUE IF NOT EXISTS 'INWARD_PENDING';
ALTER TYPE "DcStatus" ADD VALUE IF NOT EXISTS 'INWARD_RECEIVED';
ALTER TYPE "DcStatus" ADD VALUE IF NOT EXISTS 'STORE_CONFIRMED';
ALTER TYPE "DcStatus" ADD VALUE IF NOT EXISTS 'QUALITY_PENDING';
ALTER TYPE "DcStatus" ADD VALUE IF NOT EXISTS 'QUALITY_COMPLETED';
ALTER TYPE "DcStatus" ADD VALUE IF NOT EXISTS 'MANAGER_APPROVAL_PENDING';
ALTER TYPE "DcStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_APPROVED';
ALTER TYPE "DcStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "DcStatus" ADD VALUE IF NOT EXISTS 'SENT_BACK';
ALTER TYPE "DcStatus" ADD VALUE IF NOT EXISTS 'HOLD';

-- Add master snapshot, outward, inward, store, quality, manager, payment columns to DeliveryChallan
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "supplierNameSnapshot" TEXT;
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "supplierAddressSnapshot" TEXT;
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "supplierGstSnapshot" TEXT;
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "partNumberSnapshot" TEXT;
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "partDescriptionSnapshot" TEXT;
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "pricingSnapshot" DECIMAL(14,2);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "department" TEXT;

ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "outwardDate" TIMESTAMP(3);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "outwardWeight" DECIMAL(12,3);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "outwardGatingWeight" DECIMAL(12,3);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "outwardQtyRw" DECIMAL(12,3);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "length" DECIMAL(10,2);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "width" DECIMAL(10,2);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "height" DECIMAL(10,2);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "outwardBoringWeight" DECIMAL(12,3);

ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "actualInwardQty" DECIMAL(12,3);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "inwardDate" TIMESTAMP(3);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "inwardDocumentNo" TEXT;
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "inwardGatingWeight" DECIMAL(12,3);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "inwardBoringWeight" DECIMAL(12,3);

ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "storeReceivedQty" DECIMAL(12,3);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "storeReceivedDate" TIMESTAMP(3);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "storeConfirmedBy" TEXT;

ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "goodQty" DECIMAL(12,3);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "rejectionQty" DECIMAL(12,3);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "scrapQty" DECIMAL(12,3);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "qualityDecision" TEXT;
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "inspectionDate" TIMESTAMP(3);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "inspectedBy" TEXT;
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "inspectionRemarks" TEXT;

ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT;
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "approvalRemarks" TEXT;

ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT;
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "paymentApprovedBy" TEXT;
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "paymentApprovedAt" TIMESTAMP(3);
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;

-- Create ProductionStage, StageMovement, StageRejection tables if not exists
CREATE TABLE IF NOT EXISTS "ProductionStage" (
    "id" TEXT NOT NULL,
    "woNumber" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "targetQty" DECIMAL(18,3) NOT NULL,
    "completedOkQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "rejectionQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "scrapQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "availableQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StageMovement" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "fromStage" TEXT NOT NULL,
    "toStage" TEXT NOT NULL,
    "movedQty" DECIMAL(18,3) NOT NULL,
    "movedBy" TEXT NOT NULL,
    "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,

    CONSTRAINT "StageMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StageRejection" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "rejectionQty" DECIMAL(18,3) NOT NULL,
    "reason" TEXT,
    "rejectedBy" TEXT NOT NULL,
    "rejectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageRejection_pkey" PRIMARY KEY ("id")
);

-- Add indexes
CREATE INDEX IF NOT EXISTS "ProductionStage_woNumber_idx" ON "ProductionStage"("woNumber");
CREATE INDEX IF NOT EXISTS "ProductionStage_stageName_idx" ON "ProductionStage"("stageName");
CREATE INDEX IF NOT EXISTS "StageMovement_stageId_idx" ON "StageMovement"("stageId");
CREATE INDEX IF NOT EXISTS "StageRejection_stageId_idx" ON "StageRejection"("stageId");

-- Add foreign keys
ALTER TABLE "StageMovement" DROP CONSTRAINT IF EXISTS "StageMovement_stageId_fkey";
ALTER TABLE "StageMovement" ADD CONSTRAINT "StageMovement_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StageRejection" DROP CONSTRAINT IF EXISTS "StageRejection_stageId_fkey";
ALTER TABLE "StageRejection" ADD CONSTRAINT "StageRejection_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
