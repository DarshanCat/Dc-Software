-- AlterTable: add complete address support (Address Line 2 and Area/Locality) to Vendor
-- Existing "address" column is reused as Address Line 1; city/state/pincode/country already exist.
ALTER TABLE "Vendor" ADD COLUMN "addressLine2" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "area" TEXT;
