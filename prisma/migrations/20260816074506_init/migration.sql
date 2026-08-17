-- CreateEnum
CREATE TYPE "CalculationType" AS ENUM ('FIXED', 'PERCENTAGE', 'INPUT_MINUS_OUTPUT', 'MANUAL');

-- CreateEnum
CREATE TYPE "DcStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'AT_VENDOR', 'PARTIALLY_RETURNED', 'MATERIAL_RETURNED', 'SCRAP_PENDING', 'RECONCILIATION', 'RECONCILED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DcPurpose" AS ENUM ('JOB_WORK', 'MACHINING', 'HEAT_TREATMENT', 'SURFACE_TREATMENT', 'REPAIR', 'SAMPLE', 'TRIAL', 'SUBCONTRACTING', 'OTHER');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('PENDING', 'BALANCED', 'EXCEPTION', 'RECONCILED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('MATERIAL_SHORTAGE', 'SCRAP_SHORTAGE', 'EXCESS_SCRAP', 'PROCESS_LOSS_EXCEEDED', 'QUANTITY_MISMATCH', 'WEIGHT_MISMATCH', 'OVERDUE', 'QUALITY_REJECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "ExceptionStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ExceptionSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "vendorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "legalName" TEXT,
    "gstNumber" TEXT,
    "panNumber" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'India',
    "pincode" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultReturnDays" INTEGER NOT NULL DEFAULT 15,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorContact" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VendorContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ItemCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UOM" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isWeight" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UOM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "description" TEXT,
    "itemCategoryId" TEXT,
    "drawingNumber" TEXT,
    "drawingRevision" TEXT,
    "materialGrade" TEXT,
    "defaultUOM" TEXT NOT NULL DEFAULT 'NOS',
    "weightUOM" TEXT NOT NULL DEFAULT 'KG',
    "standardUnitWeight" DECIMAL(18,3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Process" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobWorkStandard" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "inputUOM" TEXT NOT NULL DEFAULT 'KG',
    "inputWeight" DECIMAL(18,3) NOT NULL,
    "expectedOutputQty" DECIMAL(18,3),
    "expectedOutputWeight" DECIMAL(18,3) NOT NULL,
    "expectedScrapWeight" DECIMAL(18,3) NOT NULL,
    "expectedScrapPercentage" DECIMAL(9,4),
    "allowedProcessLoss" DECIMAL(18,3) NOT NULL,
    "allowedProcessLossPercentage" DECIMAL(9,4),
    "tolerancePercentage" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "calculationType" "CalculationType" NOT NULL DEFAULT 'PERCENTAGE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobWorkStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobWorkStandardRevision" (
    "id" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobWorkStandardRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'KG',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryChallan" (
    "id" TEXT NOT NULL,
    "dcNumber" TEXT NOT NULL,
    "dcDate" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT NOT NULL,
    "purpose" "DcPurpose" NOT NULL,
    "processId" TEXT,
    "jobWorkOrderNumber" TEXT,
    "expectedReturnDate" TIMESTAMP(3),
    "transporter" TEXT,
    "vehicleNumber" TEXT,
    "ewayBillNumber" TEXT,
    "referenceNumber" TEXT,
    "remarks" TEXT,
    "status" "DcStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "dispatchedBy" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "qrToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryChallan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryChallanItem" (
    "id" TEXT NOT NULL,
    "dcId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchNumber" TEXT,
    "heatNumber" TEXT,
    "drawingNumber" TEXT,
    "drawingRevision" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'NOS',
    "inputUnitWeight" DECIMAL(18,3),
    "inputWeight" DECIMAL(18,3) NOT NULL,
    "expectedFinishedQuantity" DECIMAL(18,3),
    "expectedFinishedWeight" DECIMAL(18,3) NOT NULL,
    "expectedScrapWeight" DECIMAL(18,3) NOT NULL,
    "expectedProcessLoss" DECIMAL(18,3) NOT NULL,
    "tolerancePercentage" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "jobWorkStandardId" TEXT,
    "remarks" TEXT,

    CONSTRAINT "DeliveryChallanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispatch" (
    "id" TEXT NOT NULL,
    "dcId" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3) NOT NULL,
    "dispatchedBy" TEXT NOT NULL,
    "vehicleNumber" TEXT,
    "transporter" TEXT,
    "totalInputWeight" DECIMAL(18,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchItem" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "weight" DECIMAL(18,3) NOT NULL,

    CONSTRAINT "DispatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialReceipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "dcId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "receivedBy" TEXT NOT NULL,
    "remarks" TEXT,
    "documentReference" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantityReceived" DECIMAL(18,3) NOT NULL,
    "weightReceived" DECIMAL(18,3) NOT NULL,
    "batchNumber" TEXT,
    "heatNumber" TEXT,
    "rejectedQuantity" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "rejectedWeight" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "remarks" TEXT,

    CONSTRAINT "MaterialReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapReceipt" (
    "id" TEXT NOT NULL,
    "scrapReceiptNumber" TEXT NOT NULL,
    "dcId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "receivedBy" TEXT NOT NULL,
    "weighmentSlipNumber" TEXT,
    "remarks" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapReceiptItem" (
    "id" TEXT NOT NULL,
    "scrapReceiptId" TEXT NOT NULL,
    "scrapTypeId" TEXT NOT NULL,
    "weight" DECIMAL(18,3) NOT NULL,
    "quantity" DECIMAL(18,3),
    "uom" TEXT NOT NULL DEFAULT 'KG',
    "batchReference" TEXT,
    "documentReference" TEXT,
    "remarks" TEXT,

    CONSTRAINT "ScrapReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reconciliation" (
    "id" TEXT NOT NULL,
    "dcId" TEXT NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "totalInputWeight" DECIMAL(18,3) NOT NULL,
    "totalFinishedWeight" DECIMAL(18,3) NOT NULL,
    "totalScrapWeight" DECIMAL(18,3) NOT NULL,
    "totalRejectedWeight" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "approvedProcessLoss" DECIMAL(18,3) NOT NULL,
    "accountedWeight" DECIMAL(18,3) NOT NULL,
    "unaccountedWeight" DECIMAL(18,3) NOT NULL,
    "scrapRecoveryPercent" DECIMAL(9,4),
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculatedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "closureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationItem" (
    "id" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "inputWeight" DECIMAL(18,3) NOT NULL,
    "finishedWeight" DECIMAL(18,3) NOT NULL,
    "scrapWeight" DECIMAL(18,3) NOT NULL,
    "unaccountedWeight" DECIMAL(18,3) NOT NULL,

    CONSTRAINT "ReconciliationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exception" (
    "id" TEXT NOT NULL,
    "dcId" TEXT NOT NULL,
    "type" "ExceptionType" NOT NULL,
    "severity" "ExceptionSeverity" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "expectedValue" DECIMAL(18,3),
    "actualValue" DECIMAL(18,3),
    "variance" DECIMAL(18,3),
    "status" "ExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "createdBy" TEXT,
    "assignedTo" TEXT,
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExceptionApproval" (
    "id" TEXT NOT NULL,
    "exceptionId" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExceptionApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "requestId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" TEXT NOT NULL,
    "dcId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'general',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberSequence" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "padding" INTEGER NOT NULL DEFAULT 6,
    "current" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_vendorId_idx" ON "User"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_vendorCode_key" ON "Vendor"("vendorCode");

-- CreateIndex
CREATE INDEX "Vendor_vendorCode_idx" ON "Vendor"("vendorCode");

-- CreateIndex
CREATE INDEX "Vendor_active_idx" ON "Vendor"("active");

-- CreateIndex
CREATE INDEX "VendorContact_vendorId_idx" ON "VendorContact"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCategory_key_key" ON "ItemCategory"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UOM_code_key" ON "UOM"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Item_itemCode_key" ON "Item"("itemCode");

-- CreateIndex
CREATE INDEX "Item_itemCode_idx" ON "Item"("itemCode");

-- CreateIndex
CREATE INDEX "Item_itemCategoryId_idx" ON "Item"("itemCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Process_code_key" ON "Process"("code");

-- CreateIndex
CREATE INDEX "JobWorkStandard_itemId_processId_effectiveFrom_idx" ON "JobWorkStandard"("itemId", "processId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "JobWorkStandard_approved_idx" ON "JobWorkStandard"("approved");

-- CreateIndex
CREATE UNIQUE INDEX "JobWorkStandard_itemId_processId_revision_key" ON "JobWorkStandard"("itemId", "processId", "revision");

-- CreateIndex
CREATE INDEX "JobWorkStandardRevision_standardId_idx" ON "JobWorkStandardRevision"("standardId");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapType_code_key" ON "ScrapType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryChallan_dcNumber_key" ON "DeliveryChallan"("dcNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryChallan_qrToken_key" ON "DeliveryChallan"("qrToken");

-- CreateIndex
CREATE INDEX "DeliveryChallan_dcNumber_idx" ON "DeliveryChallan"("dcNumber");

-- CreateIndex
CREATE INDEX "DeliveryChallan_dcDate_idx" ON "DeliveryChallan"("dcDate");

-- CreateIndex
CREATE INDEX "DeliveryChallan_vendorId_idx" ON "DeliveryChallan"("vendorId");

-- CreateIndex
CREATE INDEX "DeliveryChallan_status_idx" ON "DeliveryChallan"("status");

-- CreateIndex
CREATE INDEX "DeliveryChallan_expectedReturnDate_idx" ON "DeliveryChallan"("expectedReturnDate");

-- CreateIndex
CREATE INDEX "DeliveryChallan_vendorId_status_idx" ON "DeliveryChallan"("vendorId", "status");

-- CreateIndex
CREATE INDEX "DeliveryChallanItem_dcId_idx" ON "DeliveryChallanItem"("dcId");

-- CreateIndex
CREATE INDEX "DeliveryChallanItem_itemId_idx" ON "DeliveryChallanItem"("itemId");

-- CreateIndex
CREATE INDEX "DeliveryChallanItem_batchNumber_idx" ON "DeliveryChallanItem"("batchNumber");

-- CreateIndex
CREATE INDEX "DeliveryChallanItem_heatNumber_idx" ON "DeliveryChallanItem"("heatNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Dispatch_dcId_key" ON "Dispatch"("dcId");

-- CreateIndex
CREATE INDEX "Dispatch_dcId_idx" ON "Dispatch"("dcId");

-- CreateIndex
CREATE INDEX "DispatchItem_dispatchId_idx" ON "DispatchItem"("dispatchId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialReceipt_receiptNumber_key" ON "MaterialReceipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "MaterialReceipt_dcId_idx" ON "MaterialReceipt"("dcId");

-- CreateIndex
CREATE INDEX "MaterialReceipt_receiptDate_idx" ON "MaterialReceipt"("receiptDate");

-- CreateIndex
CREATE INDEX "MaterialReceiptItem_receiptId_idx" ON "MaterialReceiptItem"("receiptId");

-- CreateIndex
CREATE INDEX "MaterialReceiptItem_itemId_idx" ON "MaterialReceiptItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapReceipt_scrapReceiptNumber_key" ON "ScrapReceipt"("scrapReceiptNumber");

-- CreateIndex
CREATE INDEX "ScrapReceipt_dcId_idx" ON "ScrapReceipt"("dcId");

-- CreateIndex
CREATE INDEX "ScrapReceipt_receiptDate_idx" ON "ScrapReceipt"("receiptDate");

-- CreateIndex
CREATE INDEX "ScrapReceiptItem_scrapReceiptId_idx" ON "ScrapReceiptItem"("scrapReceiptId");

-- CreateIndex
CREATE INDEX "ScrapReceiptItem_scrapTypeId_idx" ON "ScrapReceiptItem"("scrapTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Reconciliation_dcId_key" ON "Reconciliation"("dcId");

-- CreateIndex
CREATE INDEX "Reconciliation_dcId_idx" ON "Reconciliation"("dcId");

-- CreateIndex
CREATE INDEX "Reconciliation_status_idx" ON "Reconciliation"("status");

-- CreateIndex
CREATE INDEX "ReconciliationItem_reconciliationId_idx" ON "ReconciliationItem"("reconciliationId");

-- CreateIndex
CREATE INDEX "Exception_dcId_idx" ON "Exception"("dcId");

-- CreateIndex
CREATE INDEX "Exception_status_idx" ON "Exception"("status");

-- CreateIndex
CREATE INDEX "Exception_type_idx" ON "Exception"("type");

-- CreateIndex
CREATE INDEX "ExceptionApproval_exceptionId_idx" ON "ExceptionApproval"("exceptionId");

-- CreateIndex
CREATE INDEX "Document_entityType_entityId_idx" ON "Document"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "StatusHistory_dcId_idx" ON "StatusHistory"("dcId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "NumberSequence_key_fiscalYear_key" ON "NumberSequence"("key", "fiscalYear");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorContact" ADD CONSTRAINT "VendorContact_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_itemCategoryId_fkey" FOREIGN KEY ("itemCategoryId") REFERENCES "ItemCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobWorkStandard" ADD CONSTRAINT "JobWorkStandard_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobWorkStandard" ADD CONSTRAINT "JobWorkStandard_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobWorkStandardRevision" ADD CONSTRAINT "JobWorkStandardRevision_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "JobWorkStandard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanItem" ADD CONSTRAINT "DeliveryChallanItem_dcId_fkey" FOREIGN KEY ("dcId") REFERENCES "DeliveryChallan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanItem" ADD CONSTRAINT "DeliveryChallanItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanItem" ADD CONSTRAINT "DeliveryChallanItem_jobWorkStandardId_fkey" FOREIGN KEY ("jobWorkStandardId") REFERENCES "JobWorkStandard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_dcId_fkey" FOREIGN KEY ("dcId") REFERENCES "DeliveryChallan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchItem" ADD CONSTRAINT "DispatchItem_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReceipt" ADD CONSTRAINT "MaterialReceipt_dcId_fkey" FOREIGN KEY ("dcId") REFERENCES "DeliveryChallan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReceiptItem" ADD CONSTRAINT "MaterialReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "MaterialReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapReceipt" ADD CONSTRAINT "ScrapReceipt_dcId_fkey" FOREIGN KEY ("dcId") REFERENCES "DeliveryChallan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapReceiptItem" ADD CONSTRAINT "ScrapReceiptItem_scrapReceiptId_fkey" FOREIGN KEY ("scrapReceiptId") REFERENCES "ScrapReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapReceiptItem" ADD CONSTRAINT "ScrapReceiptItem_scrapTypeId_fkey" FOREIGN KEY ("scrapTypeId") REFERENCES "ScrapType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_dcId_fkey" FOREIGN KEY ("dcId") REFERENCES "DeliveryChallan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "Reconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_dcId_fkey" FOREIGN KEY ("dcId") REFERENCES "DeliveryChallan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionApproval" ADD CONSTRAINT "ExceptionApproval_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "Exception"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_dcId_fkey" FOREIGN KEY ("dcId") REFERENCES "DeliveryChallan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
