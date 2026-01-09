-- Add new columns to discovery_creators table
ALTER TABLE discovery_creators ADD COLUMN IF NOT EXISTS total_views BIGINT DEFAULT 0;
ALTER TABLE discovery_creators ADD COLUMN IF NOT EXISTS total_likes BIGINT DEFAULT 0;
ALTER TABLE discovery_creators ADD COLUMN IF NOT EXISTS total_comments BIGINT DEFAULT 0;
ALTER TABLE discovery_creators ADD COLUMN IF NOT EXISTS total_shares BIGINT DEFAULT 0;
ALTER TABLE discovery_creators ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 0;
ALTER TABLE discovery_creators ADD COLUMN IF NOT EXISTS avg_viewers INTEGER DEFAULT 0;
ALTER TABLE discovery_creators ADD COLUMN IF NOT EXISTS minutes_watched BIGINT DEFAULT 0;
ALTER TABLE discovery_creators ADD COLUMN IF NOT EXISTS engagement_rate DOUBLE PRECISION DEFAULT 0;
ALTER TABLE discovery_creators ADD COLUMN IF NOT EXISTS primary_category VARCHAR(255);

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_creators_avg_viewers ON discovery_creators(avg_viewers DESC);
CREATE INDEX IF NOT EXISTS idx_creators_total_views ON discovery_creators(total_views DESC);
CREATE INDEX IF NOT EXISTS idx_creators_engagement_rate ON discovery_creators(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_creators_primary_category ON discovery_creators(primary_category);
CREATE INDEX IF NOT EXISTS idx_creators_last_scraped ON discovery_creators("lastScrapedAt" DESC);

-- Create favorites table
CREATE TABLE IF NOT EXISTS discovery_favorites (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  streamer_id TEXT NOT NULL REFERENCES discovery_creators(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, streamer_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON discovery_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_streamer ON discovery_favorites(streamer_id);

-- Create viewer polls table
CREATE TABLE IF NOT EXISTS discovery_viewer_polls (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  streamer_id TEXT NOT NULL REFERENCES discovery_creators(id) ON DELETE CASCADE,
  viewer_count INTEGER NOT NULL,
  polled_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_polls_streamer_date ON discovery_viewer_polls(streamer_id, polled_at DESC);
