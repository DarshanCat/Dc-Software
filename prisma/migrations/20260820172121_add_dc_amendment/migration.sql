-- CreateTable
CREATE TABLE "DcAmendment" (
    "id" TEXT NOT NULL,
    "dcId" TEXT NOT NULL,
    "dcItemId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "previousQuantity" DECIMAL(18,3) NOT NULL,
    "previousWeight" DECIMAL(18,3) NOT NULL,
    "newQuantity" DECIMAL(18,3) NOT NULL,
    "newWeight" DECIMAL(18,3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,

    CONSTRAINT "DcAmendment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DcAmendment_dcId_idx" ON "DcAmendment"("dcId");

-- CreateIndex
CREATE INDEX "DcAmendment_status_idx" ON "DcAmendment"("status");

-- AddForeignKey
ALTER TABLE "DcAmendment" ADD CONSTRAINT "DcAmendment_dcId_fkey" FOREIGN KEY ("dcId") REFERENCES "DeliveryChallan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
