-- AlterEnum
ALTER TYPE "DcStatus" ADD VALUE 'CUSTODIAN_VERIFIED';

-- CreateEnum
CREATE TYPE "DcMovementType" AS ENUM ('MATERIAL', 'TOOL', 'COMPANY_PROPERTY');

-- AlterTable
ALTER TABLE "DeliveryChallan" ADD COLUMN "movementType" "DcMovementType" NOT NULL DEFAULT 'MATERIAL',
ADD COLUMN "isCommercialService" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "destinationDepartment" TEXT,
ADD COLUMN "responsibleCustodian" TEXT;

-- CreateTable
CREATE TABLE "DeliveryChallanItem" (
    "id" TEXT NOT NULL,
    "dcId" TEXT NOT NULL,
    "itemCode" TEXT,
    "itemDescription" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'NOS',
    "returnedQuantity" DECIMAL(12,3),
    "goodQty" DECIMAL(12,3),
    "rejectionQty" DECIMAL(12,3),
    "scrapQty" DECIMAL(12,3),
    "qualityDecision" TEXT,
    "inspectionRemarks" TEXT,
    "conditionIn" TEXT,
    "toolInstanceId" TEXT,
    "assetMasterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryChallanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolMaster" (
    "id" TEXT NOT NULL,
    "toolCode" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "category" TEXT,
    "specification" TEXT,
    "uom" TEXT NOT NULL DEFAULT 'NOS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolInstance" (
    "id" TEXT NOT NULL,
    "toolMasterId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "currentStatus" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "location" TEXT,
    "lastCalibratedAt" TIMESTAMP(3),
    "nextCalibrationDue" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetMaster" (
    "id" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "category" TEXT,
    "serialNumber" TEXT,
    "department" TEXT,
    "currentStatus" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ToolMaster_toolCode_key" ON "ToolMaster"("toolCode");

-- CreateIndex
CREATE UNIQUE INDEX "ToolInstance_serialNumber_key" ON "ToolInstance"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AssetMaster_assetTag_key" ON "AssetMaster"("assetTag");

-- CreateIndex
CREATE INDEX "DeliveryChallan_movementType_idx" ON "DeliveryChallan"("movementType");

-- CreateIndex
CREATE INDEX "DeliveryChallanItem_dcId_idx" ON "DeliveryChallanItem"("dcId");

-- CreateIndex
CREATE INDEX "ToolMaster_toolCode_idx" ON "ToolMaster"("toolCode");

-- CreateIndex
CREATE INDEX "ToolInstance_toolMasterId_idx" ON "ToolInstance"("toolMasterId");

-- CreateIndex
CREATE INDEX "ToolInstance_serialNumber_idx" ON "ToolInstance"("serialNumber");

-- CreateIndex
CREATE INDEX "AssetMaster_assetTag_idx" ON "AssetMaster"("assetTag");

-- AddForeignKey
ALTER TABLE "DeliveryChallanItem" ADD CONSTRAINT "DeliveryChallanItem_dcId_fkey" FOREIGN KEY ("dcId") REFERENCES "DeliveryChallan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolInstance" ADD CONSTRAINT "ToolInstance_toolMasterId_fkey" FOREIGN KEY ("toolMasterId") REFERENCES "ToolMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
