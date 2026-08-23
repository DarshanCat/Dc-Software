/*
  Warnings:

  - You are about to drop the column `workOrderId` on the `DeliveryChallan` table. All the data in the column will be lost.
  - Added the required column `woNumber` to the `DeliveryChallan` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "DeliveryChallan" DROP CONSTRAINT "DeliveryChallan_workOrderId_fkey";

-- DropIndex
DROP INDEX "DeliveryChallan_workOrderId_idx";

-- AlterTable
ALTER TABLE "DeliveryChallan" DROP COLUMN "workOrderId",
ADD COLUMN     "woNumber" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "DeliveryChallan_woNumber_idx" ON "DeliveryChallan"("woNumber");
