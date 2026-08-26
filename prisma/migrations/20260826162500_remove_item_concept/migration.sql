-- DropForeignKey
ALTER TABLE "DeliveryChallanItem" DROP CONSTRAINT IF EXISTS "DeliveryChallanItem_dcId_fkey";
ALTER TABLE "DeliveryChallanItem" DROP CONSTRAINT IF EXISTS "DeliveryChallanItem_itemId_fkey";
ALTER TABLE "DeliveryChallanItem" DROP CONSTRAINT IF EXISTS "DeliveryChallanItem_jobWorkStandardId_fkey";

ALTER TABLE "DeliveryChallanExpectedReturn" DROP CONSTRAINT IF EXISTS "DeliveryChallanExpectedReturn_dcId_fkey";
ALTER TABLE "DeliveryChallanExpectedReturn" DROP CONSTRAINT IF EXISTS "DeliveryChallanExpectedReturn_returnItemId_fkey";

ALTER TABLE "JobWorkStandard" DROP CONSTRAINT IF EXISTS "JobWorkStandard_itemId_fkey";
ALTER TABLE "JobWorkStandard" DROP CONSTRAINT IF EXISTS "JobWorkStandard_processId_fkey";

ALTER TABLE "MaterialClassificationItem" DROP CONSTRAINT IF EXISTS "MaterialClassificationItem_itemId_fkey";

ALTER TABLE "Item" DROP CONSTRAINT IF EXISTS "Item_itemCategoryId_fkey";

ALTER TABLE "ReconciliationItem" DROP CONSTRAINT IF EXISTS "ReconciliationItem_reconciliationId_fkey";

-- DropTable
DROP TABLE IF EXISTS "DeliveryChallanItem" CASCADE;
DROP TABLE IF EXISTS "DeliveryChallanExpectedReturn" CASCADE;
DROP TABLE IF EXISTS "JobWorkStandard" CASCADE;
DROP TABLE IF EXISTS "JobWorkStandardRevision" CASCADE;
DROP TABLE IF EXISTS "Item" CASCADE;
DROP TABLE IF EXISTS "ItemCategory" CASCADE;
DROP TABLE IF EXISTS "ReconciliationItem" CASCADE;

-- AlterTable
ALTER TABLE "DcAmendment" DROP COLUMN IF EXISTS "dcItemId";
ALTER TABLE "MaterialClassificationItem" DROP COLUMN IF EXISTS "itemId";
ALTER TABLE "MaterialReceiptItem" ALTER COLUMN "itemId" DROP NOT NULL;
