-- Unified Influencer Profile table
-- One row per person, all social platforms linked

CREATE TABLE IF NOT EXISTS "discovery_influencers" (
    "id" TEXT NOT NULL,

    -- UNIFIED IDENTITY
    "displayName" TEXT NOT NULL,
    "country" TEXT,
    "language" TEXT,
    "primary_category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- TWITCH
    "twitch_id" TEXT,
    "twitch_username" TEXT,
    "twitch_display_name" TEXT,
    "twitch_followers" INTEGER,
    "twitch_avatar" TEXT,
    "twitch_url" TEXT,
    "twitch_verified" BOOLEAN DEFAULT false,

    -- YOUTUBE
    "youtube_id" TEXT,
    "youtube_username" TEXT,
    "youtube_display_name" TEXT,
    "youtube_followers" INTEGER,
    "youtube_avatar" TEXT,
    "youtube_url" TEXT,
    "youtube_verified" BOOLEAN DEFAULT false,

    -- KICK
    "kick_id" TEXT,
    "kick_username" TEXT,
    "kick_display_name" TEXT,
    "kick_followers" INTEGER,
    "kick_avatar" TEXT,
    "kick_url" TEXT,
    "kick_verified" BOOLEAN DEFAULT false,

    -- TIKTOK
    "tiktok_id" TEXT,
    "tiktok_username" TEXT,
    "tiktok_display_name" TEXT,
    "tiktok_followers" INTEGER,
    "tiktok_avatar" TEXT,
    "tiktok_url" TEXT,
    "tiktok_verified" BOOLEAN DEFAULT false,

    -- INSTAGRAM
    "instagram_id" TEXT,
    "instagram_username" TEXT,
    "instagram_display_name" TEXT,
    "instagram_followers" INTEGER,
    "instagram_avatar" TEXT,
    "instagram_url" TEXT,
    "instagram_verified" BOOLEAN DEFAULT false,

    -- X (TWITTER)
    "x_id" TEXT,
    "x_username" TEXT,
    "x_display_name" TEXT,
    "x_followers" INTEGER,
    "x_avatar" TEXT,
    "x_url" TEXT,
    "x_verified" BOOLEAN DEFAULT false,

    -- FACEBOOK
    "facebook_id" TEXT,
    "facebook_username" TEXT,
    "facebook_display_name" TEXT,
    "facebook_followers" INTEGER,
    "facebook_avatar" TEXT,
    "facebook_url" TEXT,
    "facebook_verified" BOOLEAN DEFAULT false,

    -- LINKEDIN
    "linkedin_id" TEXT,
    "linkedin_username" TEXT,
    "linkedin_display_name" TEXT,
    "linkedin_followers" INTEGER,
    "linkedin_avatar" TEXT,
    "linkedin_url" TEXT,
    "linkedin_verified" BOOLEAN DEFAULT false,

    -- AGGREGATED METRICS
    "total_reach" BIGINT DEFAULT 0,
    "platform_count" INTEGER DEFAULT 0,
    "avg_engagement_rate" DOUBLE PRECISION,

    -- GDPR COMPLIANCE
    "data_source" TEXT DEFAULT 'public_api',
    "deletion_requested" BOOLEAN DEFAULT false,
    "deletion_requested_at" TIMESTAMP(3),
    "last_verified_at" TIMESTAMP(3),

    -- METADATA
    "notes" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    -- LINK TO ORIGINAL RECORDS
    "source_streamer_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "discovery_influencers_pkey" PRIMARY KEY ("id")
);

-- Unique constraints for platform IDs
CREATE UNIQUE INDEX IF NOT EXISTS "discovery_influencers_twitch_id_key" ON "discovery_influencers"("twitch_id") WHERE "twitch_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "discovery_influencers_youtube_id_key" ON "discovery_influencers"("youtube_id") WHERE "youtube_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "discovery_influencers_kick_id_key" ON "discovery_influencers"("kick_id") WHERE "kick_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "discovery_influencers_tiktok_id_key" ON "discovery_influencers"("tiktok_id") WHERE "tiktok_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "discovery_influencers_instagram_id_key" ON "discovery_influencers"("instagram_id") WHERE "instagram_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "discovery_influencers_x_id_key" ON "discovery_influencers"("x_id") WHERE "x_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "discovery_influencers_facebook_id_key" ON "discovery_influencers"("facebook_id") WHERE "facebook_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "discovery_influencers_linkedin_id_key" ON "discovery_influencers"("linkedin_id") WHERE "linkedin_id" IS NOT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS "discovery_influencers_country_idx" ON "discovery_influencers"("country");
CREATE INDEX IF NOT EXISTS "discovery_influencers_total_reach_idx" ON "discovery_influencers"("total_reach" DESC);
CREATE INDEX IF NOT EXISTS "discovery_influencers_platform_count_idx" ON "discovery_influencers"("platform_count" DESC);
CREATE INDEX IF NOT EXISTS "discovery_influencers_twitch_username_idx" ON "discovery_influencers"("twitch_username");
CREATE INDEX IF NOT EXISTS "discovery_influencers_youtube_username_idx" ON "discovery_influencers"("youtube_username");
CREATE INDEX IF NOT EXISTS "discovery_influencers_tiktok_username_idx" ON "discovery_influencers"("tiktok_username");
CREATE INDEX IF NOT EXISTS "discovery_influencers_instagram_username_idx" ON "discovery_influencers"("instagram_username");
