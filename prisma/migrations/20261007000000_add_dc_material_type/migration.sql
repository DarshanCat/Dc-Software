-- AlterTable: add Material Type business classification to DeliveryChallan
-- (PRODUCTION / CONVERSION), orthogonal to the existing movementType
-- (MATERIAL/TOOL/COMPANY_PROPERTY) enum, which is left untouched.
--
-- Backward-compatible by construction: the new column is nullable with no
-- default, so every existing row (historical MATERIAL DCs and all TOOL/
-- COMPANY_PROPERTY DCs) is preserved unchanged with materialType = NULL.
-- No backfill is performed - it is not knowable retroactively for existing
-- records, and the application only requires the field going forward, for
-- newly created MATERIAL DCs.
CREATE TYPE "DcMaterialType" AS ENUM ('PRODUCTION', 'CONVERSION');

ALTER TABLE "DeliveryChallan" ADD COLUMN "materialType" "DcMaterialType";

CREATE INDEX "DeliveryChallan_materialType_idx" ON "DeliveryChallan"("materialType");
