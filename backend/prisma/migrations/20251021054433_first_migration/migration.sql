/*
  Warnings:

  - You are about to alter the column `expected_roi` on the `igaming_campaigns` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `DoublePrecision`.
  - The `tags` column on the `streamers` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `performance_score` on table `campaign_performance` required. This step will fail if there are existing NULL values in that column.
  - Made the column `status` on table `igaming_campaigns` required. This step will fail if there are existing NULL values in that column.
  - Made the column `igaming_score` on table `streamers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `brand_safety_score` on table `streamers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `gambling_compatibility` on table `streamers` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StreamerTag" ADD VALUE 'CASINO';
ALTER TYPE "StreamerTag" ADD VALUE 'SLOTS';
ALTER TYPE "StreamerTag" ADD VALUE 'BETTING';
ALTER TYPE "StreamerTag" ADD VALUE 'POKER';
ALTER TYPE "StreamerTag" ADD VALUE 'BLACKJACK';
ALTER TYPE "StreamerTag" ADD VALUE 'ROULETTE';
ALTER TYPE "StreamerTag" ADD VALUE 'GAMBLING';
ALTER TYPE "StreamerTag" ADD VALUE 'IGAMING';

-- DropIndex
DROP INDEX "idx_brand_safety_score";

-- DropIndex
DROP INDEX "idx_gambling_compatibility";

-- DropIndex
DROP INDEX "idx_igaming_score";

-- DropIndex
DROP INDEX "idx_last_intelligence_update";

-- DropIndex
DROP INDEX "streamers_currentGame_idx";

-- DropIndex
DROP INDEX "streamers_fraudCheck_idx";

-- DropIndex
DROP INDEX "streamers_region_isLive_idx";

-- DropIndex
DROP INDEX "streamers_region_platform_idx";

-- DropIndex
DROP INDEX "streamers_tags_idx";

-- DropIndex
DROP INDEX "streamers_topGames_idx";

-- AlterTable
ALTER TABLE "campaign_performance" ALTER COLUMN "performance_score" SET NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "igaming_campaigns" ALTER COLUMN "expected_roi" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "streamers" ADD COLUMN     "about_section" TEXT,
ADD COLUMN     "banner_text" TEXT,
ADD COLUMN     "chat_keywords" TEXT[],
ADD COLUMN     "community_posts" JSONB,
ADD COLUMN     "content_analysis" JSONB,
ADD COLUMN     "external_links" JSONB,
ADD COLUMN     "last_enrichment_update" TIMESTAMP(3),
ADD COLUMN     "panel_images" JSONB,
ADD COLUMN     "panel_texts" TEXT[],
ADD COLUMN     "profile_description" TEXT,
ADD COLUMN     "stream_titles" JSONB,
ADD COLUMN     "web_presence" JSONB,
DROP COLUMN "tags",
ADD COLUMN     "tags" TEXT[],
ALTER COLUMN "igaming_score" SET NOT NULL,
ALTER COLUMN "brand_safety_score" SET NOT NULL,
ALTER COLUMN "gambling_compatibility" SET NOT NULL,
ALTER COLUMN "last_intelligence_update" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "cached_stats" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cached_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cached_stats_key_key" ON "cached_stats"("key");

-- CreateIndex
CREATE INDEX "streamers_currentViewers_idx" ON "streamers"("currentViewers" DESC);

-- CreateIndex
CREATE INDEX "streamers_highestViewers_idx" ON "streamers"("highestViewers" DESC);

-- CreateIndex
CREATE INDEX "streamers_displayName_idx" ON "streamers"("displayName");

-- CreateIndex
CREATE INDEX "streamers_isLive_platform_idx" ON "streamers"("isLive", "platform");

-- CreateIndex
CREATE INDEX "streamers_isLive_currentViewers_idx" ON "streamers"("isLive", "currentViewers" DESC);
