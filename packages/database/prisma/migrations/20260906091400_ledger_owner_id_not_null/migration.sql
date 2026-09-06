/*
  Warnings:

  - Made the column `owner_id` on table `ledger_accounts` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ledger_accounts" ALTER COLUMN "owner_id" SET NOT NULL;
