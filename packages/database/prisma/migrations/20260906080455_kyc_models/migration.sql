-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BankMatchStatus" AS ENUM ('PENDING', 'VERIFIED', 'MISMATCH', 'REJECTED', 'ERROR');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cuil" TEXT,
ADD COLUMN     "dni" TEXT;

-- CreateTable
CREATE TABLE "kyc_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'didit',
    "provider_session_id" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "normalized_result" JSONB,
    "raw_result_encrypted" BYTEA,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "kyc_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_account_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'argenapi',
    "cbu_or_alias" TEXT NOT NULL,
    "holder_name" TEXT,
    "holder_cuit" TEXT,
    "match_status" "BankMatchStatus" NOT NULL DEFAULT 'PENDING',
    "request_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_account_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kyc_verifications_user_id_idx" ON "kyc_verifications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_verifications_provider_provider_session_id_key" ON "kyc_verifications"("provider", "provider_session_id");

-- CreateIndex
CREATE INDEX "bank_account_verifications_user_id_idx" ON "bank_account_verifications"("user_id");

-- AddForeignKey
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_account_verifications" ADD CONSTRAINT "bank_account_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
