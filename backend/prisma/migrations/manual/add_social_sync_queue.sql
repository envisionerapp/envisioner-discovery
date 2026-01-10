-- Social Sync Queue table for ScrapeCreators API
-- Run this manually on production database

-- Create enum if not exists
DO $$ BEGIN
    CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the social sync queue table
CREATE TABLE IF NOT EXISTS "discovery_social_sync_queue" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "username" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "source_streamer_id" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "discovery_social_sync_queue_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "discovery_social_sync_queue_platform_username_key"
ON "discovery_social_sync_queue"("platform", "username");

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "discovery_social_sync_queue_platform_status_idx"
ON "discovery_social_sync_queue"("platform", "status");

CREATE INDEX IF NOT EXISTS "discovery_social_sync_queue_priority_idx"
ON "discovery_social_sync_queue"("priority" DESC);
