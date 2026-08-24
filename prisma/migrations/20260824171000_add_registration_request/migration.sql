-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "RegistrationRequest" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "employeeId" TEXT,
    "phone" TEXT,
    "requestedDepartment" TEXT NOT NULL,
    "reason" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    "approvedUserId" TEXT,
    "activationTokenHash" TEXT,
    "activationTokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationRequest_activationTokenHash_key" ON "RegistrationRequest"("activationTokenHash");

-- CreateIndex
CREATE INDEX "RegistrationRequest_email_idx" ON "RegistrationRequest"("email");

-- CreateIndex
CREATE INDEX "RegistrationRequest_status_idx" ON "RegistrationRequest"("status");

-- CreateIndex
CREATE INDEX "RegistrationRequest_createdAt_idx" ON "RegistrationRequest"("createdAt");
