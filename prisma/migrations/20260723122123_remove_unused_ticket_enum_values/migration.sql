/*
  Warnings:

  - The values [CRITICAL] on the enum `TicketPriority` will be removed. If these variants are still used in the database, this will fail.
  - The values [ON_HOLD] on the enum `TicketStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TicketPriority_new" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
ALTER TABLE "public"."Ticket" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "priority" TYPE "TicketPriority_new" USING ("priority"::text::"TicketPriority_new");
ALTER TYPE "TicketPriority" RENAME TO "TicketPriority_old";
ALTER TYPE "TicketPriority_new" RENAME TO "TicketPriority";
DROP TYPE "public"."TicketPriority_old";
ALTER TABLE "Ticket" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TicketStatus_new" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
ALTER TABLE "public"."Ticket" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "status" TYPE "TicketStatus_new" USING ("status"::text::"TicketStatus_new");
ALTER TYPE "TicketStatus" RENAME TO "TicketStatus_old";
ALTER TYPE "TicketStatus_new" RENAME TO "TicketStatus";
DROP TYPE "public"."TicketStatus_old";
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;
