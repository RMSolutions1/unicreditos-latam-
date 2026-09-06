-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('CURRENT', 'GRACE_PERIOD', 'OVERDUE', 'INTENSIVE_COLLECTION', 'LEGAL_REVIEW', 'RECOVERED', 'DEFAULTED');

-- CreateTable
CREATE TABLE "collection_cases" (
    "id" TEXT NOT NULL,
    "credit_id" TEXT NOT NULL,
    "status" "CollectionStatus" NOT NULL DEFAULT 'CURRENT',
    "max_days_overdue" INTEGER NOT NULL DEFAULT 0,
    "last_scan_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "collection_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collection_cases_credit_id_key" ON "collection_cases"("credit_id");

-- AddForeignKey
ALTER TABLE "collection_cases" ADD CONSTRAINT "collection_cases_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "credits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
