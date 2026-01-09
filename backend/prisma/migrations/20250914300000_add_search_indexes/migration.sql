-- Add indexes to improve search performance for AI chat queries
-- These indexes will significantly speed up tag, game, and region searches

-- Index for tag searches (most critical for iGaming queries)
CREATE INDEX IF NOT EXISTS "streamers_tags_idx" ON "streamers" USING GIN ("tags");

-- Index for game searches (currentGame and topGames)
CREATE INDEX IF NOT EXISTS "streamers_currentGame_idx" ON "streamers" ("currentGame");
CREATE INDEX IF NOT EXISTS "streamers_topGames_idx" ON "streamers" USING GIN ("topGames");

-- Index for region searches (very common in campaigns)
CREATE INDEX IF NOT EXISTS "streamers_region_idx" ON "streamers" ("region");

-- Index for platform searches
CREATE INDEX IF NOT EXISTS "streamers_platform_idx" ON "streamers" ("platform");

-- Index for live status (commonly filtered)
CREATE INDEX IF NOT EXISTS "streamers_isLive_idx" ON "streamers" ("isLive");

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS "streamers_region_platform_idx" ON "streamers" ("region", "platform");
CREATE INDEX IF NOT EXISTS "streamers_region_isLive_idx" ON "streamers" ("region", "isLive");

-- Index for follower count (commonly sorted/filtered)
CREATE INDEX IF NOT EXISTS "streamers_followers_idx" ON "streamers" ("followers" DESC);

-- Index for fraud check
CREATE INDEX IF NOT EXISTS "streamers_fraudCheck_idx" ON "streamers" ("fraudCheck");
