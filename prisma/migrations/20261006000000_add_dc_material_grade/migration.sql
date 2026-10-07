-- AlterTable: add Material Grade capture to DeliveryChallan (required at Material DC creation)
-- No existing grade/materialGrade/partGrade field was found anywhere in the schema, so this is new.
ALTER TABLE "DeliveryChallan" ADD COLUMN "materialGrade" TEXT;
