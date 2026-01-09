-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('TWITCH', 'YOUTUBE', 'KICK', 'FACEBOOK', 'TIKTOK');

-- CreateEnum
CREATE TYPE "StreamerTag" AS ENUM ('GAMING', 'IRL', 'MUSIC', 'ART', 'COOKING', 'FITNESS', 'EDUCATION', 'TECHNOLOGY', 'FASHION', 'TRAVEL', 'SPORTS', 'COMEDY', 'VARIETY', 'RPG', 'FPS', 'STRATEGY', 'SIMULATION', 'HORROR', 'ADVENTURE');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('MEXICO', 'COLOMBIA', 'ARGENTINA', 'CHILE', 'PERU', 'VENEZUELA', 'ECUADOR', 'BOLIVIA', 'PARAGUAY', 'URUGUAY', 'COSTA_RICA', 'PANAMA', 'GUATEMALA', 'EL_SALVADOR', 'HONDURAS', 'NICARAGUA', 'DOMINICAN_REPUBLIC', 'PUERTO_RICO');

-- CreateEnum
CREATE TYPE "FraudStatus" AS ENUM ('CLEAN', 'SUSPICIOUS', 'FLAGGED', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'PENDING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "password" TEXT NOT NULL,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streamers" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "currentViewers" INTEGER,
    "highestViewers" INTEGER,
    "lastStreamed" TIMESTAMP(3),
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "currentGame" TEXT,
    "topGames" TEXT[],
    "tags" "StreamerTag"[],
    "region" "Region" NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'es',
    "socialLinks" JSONB NOT NULL DEFAULT '[]',
    "usesCamera" BOOLEAN NOT NULL DEFAULT false,
    "isVtuber" BOOLEAN NOT NULL DEFAULT false,
    "fraudCheck" "FraudStatus" NOT NULL DEFAULT 'CLEAN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastScrapedAt" TIMESTAMP(3),

    CONSTRAINT "streamers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rules" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budget" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streamer_campaigns" (
    "id" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "streamer_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "response" TEXT,
    "streamersReturned" TEXT[],
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingTime" INTEGER,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraping_logs" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "recordsFound" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,

    CONSTRAINT "scraping_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ChatMessageStreamers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "streamers_platform_username_key" ON "streamers"("platform", "username");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_name_key" ON "campaigns"("name");

-- CreateIndex
CREATE UNIQUE INDEX "streamer_campaigns_streamerId_campaignId_key" ON "streamer_campaigns"("streamerId", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_key_key" ON "system_config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "_ChatMessageStreamers_AB_unique" ON "_ChatMessageStreamers"("A", "B");

-- CreateIndex
CREATE INDEX "_ChatMessageStreamers_B_index" ON "_ChatMessageStreamers"("B");

-- AddForeignKey
ALTER TABLE "streamer_campaigns" ADD CONSTRAINT "streamer_campaigns_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "streamers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streamer_campaigns" ADD CONSTRAINT "streamer_campaigns_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streamer_campaigns" ADD CONSTRAINT "streamer_campaigns_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChatMessageStreamers" ADD CONSTRAINT "_ChatMessageStreamers_A_fkey" FOREIGN KEY ("A") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChatMessageStreamers" ADD CONSTRAINT "_ChatMessageStreamers_B_fkey" FOREIGN KEY ("B") REFERENCES "streamers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
