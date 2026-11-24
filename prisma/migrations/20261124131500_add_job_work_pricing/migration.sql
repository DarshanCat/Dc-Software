-- CreateTable
CREATE TABLE IF NOT EXISTS "JobWorkPricing" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "processId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL DEFAULT 'ALL',
    "uom" TEXT NOT NULL DEFAULT 'KG',
    "rate" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobWorkPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "JobWorkPricing_vendorId_idx" ON "JobWorkPricing"("vendorId");
CREATE INDEX IF NOT EXISTS "JobWorkPricing_processId_idx" ON "JobWorkPricing"("processId");
CREATE INDEX IF NOT EXISTS "JobWorkPricing_partNumber_idx" ON "JobWorkPricing"("partNumber");
CREATE INDEX IF NOT EXISTS "JobWorkPricing_active_idx" ON "JobWorkPricing"("active");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'JobWorkPricing_vendorId_fkey'
  ) THEN
    ALTER TABLE "JobWorkPricing" ADD CONSTRAINT "JobWorkPricing_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'JobWorkPricing_processId_fkey'
  ) THEN
    ALTER TABLE "JobWorkPricing" ADD CONSTRAINT "JobWorkPricing_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
