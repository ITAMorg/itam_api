/*
  Warnings:

  - Made the column `purchaseDate` on table `Asset` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Asset" ALTER COLUMN "purchaseDate" SET NOT NULL,
ALTER COLUMN "purchaseDate" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AssetType" ADD COLUMN     "colorKey" TEXT NOT NULL DEFAULT '1D4ED8',
ADD COLUMN     "iconKey" TEXT NOT NULL DEFAULT 'devices';
