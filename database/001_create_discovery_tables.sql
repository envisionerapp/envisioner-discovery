-- =============================================
-- ENVISIONER DISCOVERY - DATABASE SCHEMA
-- Run this in Neon SQL Editor
-- =============================================

-- Drop existing tables if re-running (careful in production!)
-- DROP TABLE IF EXISTS discovery_scrape_logs CASCADE;
-- DROP TABLE IF EXISTS discovery_favorites CASCADE;
-- DROP TABLE IF EXISTS discovery_viewer_polls CASCADE;
-- DROP TABLE IF EXISTS discovery_creators CASCADE;
-- DROP TYPE IF EXISTS platform_enum CASCADE;

-- =============================================
-- PLATFORMS ENUM (matches frontend exactly)
-- =============================================
CREATE TYPE platform_enum AS ENUM (
  'twitch', 'youtube', 'kick', 'facebook',
  'tiktok', 'instagram', 'x', 'linkedin'
);

-- =============================================
-- MAIN TABLE: discovery_creators
-- One row per platform account
-- =============================================
CREATE TABLE discovery_creators (
  id SERIAL PRIMARY KEY,

  -- Identity (required)
  platform platform_enum NOT NULL,
  platform_id VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  avatar_url TEXT,
  bio TEXT,

  -- Location (matches frontend REGIONS)
  region VARCHAR(100),
  language VARCHAR(50),

  -- Followers (all platforms)
  followers BIGINT DEFAULT 0,

  -- Social metrics (Instagram/TikTok/FB/X/LinkedIn)
  total_views BIGINT DEFAULT 0,
  total_likes BIGINT DEFAULT 0,
  total_comments BIGINT DEFAULT 0,
  total_shares BIGINT DEFAULT 0,

  -- Streaming metrics (Twitch/Kick/YouTube)
  duration_minutes INTEGER DEFAULT 0,
  peak_viewers INTEGER DEFAULT 0,
  avg_viewers INTEGER DEFAULT 0,
  minutes_watched BIGINT DEFAULT 0,

  -- Engagement (calculated by backend)
  engagement_rate DECIMAL(5,2) DEFAULT 0,

  -- Content (matches frontend CATEGORIES)
  primary_category VARCHAR(255),
  tags TEXT[] DEFAULT '{}',
  social_links JSONB DEFAULT '{}',

  -- Live status
  is_live BOOLEAN DEFAULT FALSE,
  current_viewers INTEGER DEFAULT 0,
  last_stream_title TEXT,
  last_stream_game VARCHAR(255),

  -- iGaming intelligence
  igaming_score INTEGER DEFAULT 0,
  igaming_history TEXT[] DEFAULT '{}',
  brand_safety_flags TEXT[] DEFAULT '{}',

  -- Performance (from Envisioner campaigns)
  historical_cpa DECIMAL(10,2),
  historical_conversions INTEGER DEFAULT 0,
  historical_campaigns INTEGER DEFAULT 0,
  avg_roi DECIMAL(5,2),

  -- Cross-platform linking (manual)
  linked_creator_id INTEGER REFERENCES discovery_creators(id),

  -- Timestamps
  last_live_at TIMESTAMP,
  last_scraped_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(platform, platform_id)
);

-- =============================================
-- VIEWER POLLS: For calculating avg_viewers
-- =============================================
CREATE TABLE discovery_viewer_polls (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER REFERENCES discovery_creators(id) ON DELETE CASCADE,
  viewer_count INTEGER NOT NULL,
  polled_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- FAVORITES: User bookmarks
-- =============================================
CREATE TABLE discovery_favorites (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  creator_id INTEGER REFERENCES discovery_creators(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, creator_id)
);

-- =============================================
-- SCRAPE LOGS: API usage tracking
-- =============================================
CREATE TABLE discovery_scrape_logs (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER REFERENCES discovery_creators(id),
  platform platform_enum NOT NULL,
  scrape_type VARCHAR(50),
  status VARCHAR(50),
  api_credits_used INTEGER DEFAULT 1,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- INDEXES: For fast filtering
-- =============================================

-- Main filters
CREATE INDEX idx_creators_platform ON discovery_creators(platform);
CREATE INDEX idx_creators_region ON discovery_creators(region);
CREATE INDEX idx_creators_category ON discovery_creators(primary_category);
CREATE INDEX idx_creators_followers ON discovery_creators(followers DESC);
CREATE INDEX idx_creators_engagement ON discovery_creators(engagement_rate DESC);
CREATE INDEX idx_creators_last_scraped ON discovery_creators(last_scraped_at DESC);
CREATE INDEX idx_creators_avg_viewers ON discovery_creators(avg_viewers DESC);
CREATE INDEX idx_creators_views ON discovery_creators(total_views DESC);
CREATE INDEX idx_creators_is_live ON discovery_creators(is_live);

-- Search
CREATE INDEX idx_creators_username ON discovery_creators(username);
CREATE INDEX idx_creators_display_name ON discovery_creators(display_name);

-- Polls
CREATE INDEX idx_polls_creator ON discovery_viewer_polls(creator_id, polled_at DESC);

-- Favorites
CREATE INDEX idx_favorites_user ON discovery_favorites(user_id);
CREATE INDEX idx_favorites_creator ON discovery_favorites(creator_id);

-- Scrape logs
CREATE INDEX idx_scrape_logs_date ON discovery_scrape_logs(created_at DESC);
CREATE INDEX idx_scrape_logs_creator ON discovery_scrape_logs(creator_id);

-- =============================================
-- VERIFY CREATION
-- =============================================
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name LIKE 'discovery_%'
ORDER BY table_name;
