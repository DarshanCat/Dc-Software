-- CreateTable
CREATE TABLE "ItemMaster" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "partDescription" TEXT NOT NULL,
    "pricingBasis" "PricingBasis" NOT NULL DEFAULT 'RW',
    "ratePerQuantity" DECIMAL(12,2),
    "uom" TEXT NOT NULL DEFAULT 'NOS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemMaster_partNumber_key" ON "ItemMaster"("partNumber");

-- CreateIndex
CREATE INDEX "ItemMaster_partNumber_idx" ON "ItemMaster"("partNumber");

-- CreateIndex
CREATE INDEX "ItemMaster_active_idx" ON "ItemMaster"("active");