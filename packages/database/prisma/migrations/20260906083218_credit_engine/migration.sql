-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'PRE_APPROVED', 'MANUAL_REVIEW', 'APPROVED', 'REJECTED', 'READY_FOR_DISBURSEMENT', 'DISBURSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('ACTIVE', 'PAID_OFF');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "income" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "credit_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_rate" DECIMAL(6,3) NOT NULL,
    "min_amount" DECIMAL(14,2) NOT NULL,
    "max_amount" DECIMAL(14,2) NOT NULL,
    "min_term_months" INTEGER NOT NULL,
    "max_term_months" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_applications" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "months" INTEGER NOT NULL,
    "monthly_payment" DECIMAL(14,2) NOT NULL,
    "tna" DECIMAL(6,3) NOT NULL,
    "tea" DECIMAL(6,3) NOT NULL,
    "cft" DECIMAL(6,3) NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_decisions" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "risk_score" INTEGER NOT NULL,
    "risk_level" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "rules_version" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "decided_by" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credits" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL,
    "months" INTEGER NOT NULL,
    "monthly_payment" DECIMAL(14,2) NOT NULL,
    "tna" DECIMAL(6,3) NOT NULL,
    "status" "CreditStatus" NOT NULL DEFAULT 'ACTIVE',
    "disbursed_to" TEXT,
    "disbursed_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "credit_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "principal" DECIMAL(14,2) NOT NULL,
    "interest" DECIMAL(14,2) NOT NULL,
    "total_due" DECIMAL(14,2) NOT NULL,
    "amount_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "document_hash" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL,
    "accepted_by_user_id" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_applications_public_id_key" ON "credit_applications"("public_id");

-- CreateIndex
CREATE INDEX "credit_applications_user_id_idx" ON "credit_applications"("user_id");

-- CreateIndex
CREATE INDEX "credit_decisions_application_id_idx" ON "credit_decisions"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "credits_public_id_key" ON "credits"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "credits_application_id_key" ON "credits"("application_id");

-- CreateIndex
CREATE INDEX "installments_credit_id_idx" ON "installments"("credit_id");

-- CreateIndex
CREATE UNIQUE INDEX "installments_credit_id_number_key" ON "installments"("credit_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_application_id_key" ON "contracts"("application_id");

-- AddForeignKey
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "credit_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_decisions" ADD CONSTRAINT "credit_decisions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "credits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "credit_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
