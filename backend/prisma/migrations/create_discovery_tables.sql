-- Create Discovery Tables (separate from existing Envisioner tables)
-- Run this manually: psql DATABASE_URL -f create_discovery_tables.sql

-- Discovery Users
CREATE TABLE IF NOT EXISTS discovery_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  password TEXT NOT NULL,
  "mfaEnabled" BOOLEAN DEFAULT false,
  "mfaSecret" TEXT,
  "lastLogin" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Discovery Creators (main table)
CREATE TABLE IF NOT EXISTS discovery_creators (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "profileUrl" TEXT NOT NULL,
  "avatarUrl" TEXT,
  followers INTEGER DEFAULT 0,
  "currentViewers" INTEGER,
  "highestViewers" INTEGER,
  "lastStreamed" TIMESTAMP,
  "isLive" BOOLEAN DEFAULT false,
  "currentGame" TEXT,
  "topGames" TEXT[],
  tags TEXT[],
  region TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  "socialLinks" JSONB DEFAULT '[]',
  "usesCamera" BOOLEAN DEFAULT false,
  "isVtuber" BOOLEAN DEFAULT false,
  "fraudCheck" TEXT DEFAULT 'CLEAN',
  notes TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  "lastScrapedAt" TIMESTAMP,

  -- iGaming Intelligence
  igaming_intelligence JSONB,
  igaming_score INTEGER DEFAULT 0,
  audience_psychology JSONB,
  brand_safety_score INTEGER DEFAULT 0,
  gambling_compatibility BOOLEAN DEFAULT false,
  last_intelligence_update TIMESTAMP,
  risk_assessment JSONB,
  conversion_potential JSONB,

  -- Enriched Web Data
  profile_description TEXT,
  banner_text TEXT,
  panel_texts TEXT[],
  panel_images JSONB,
  about_section TEXT,
  external_links JSONB,
  stream_titles JSONB,
  chat_keywords TEXT[],
  community_posts JSONB,
  content_analysis JSONB,
  web_presence JSONB,
  last_enrichment_update TIMESTAMP,

  -- Performance feedback from Envisioner
  historical_cpa DOUBLE PRECISION,
  historical_conversions INTEGER DEFAULT 0,
  historical_campaigns INTEGER DEFAULT 0,
  avg_roi DOUBLE PRECISION,
  last_performance_sync TIMESTAMP,

  UNIQUE(platform, username)
);

-- Indexes for discovery_creators
CREATE INDEX IF NOT EXISTS idx_discovery_creators_live ON discovery_creators("isLive");
CREATE INDEX IF NOT EXISTS idx_discovery_creators_platform ON discovery_creators(platform);
CREATE INDEX IF NOT EXISTS idx_discovery_creators_region ON discovery_creators(region);
CREATE INDEX IF NOT EXISTS idx_discovery_creators_followers ON discovery_creators(followers DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_creators_viewers ON discovery_creators("currentViewers" DESC);

-- Discovery Cached Stats
CREATE TABLE IF NOT EXISTS discovery_cached_stats (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Discovery Campaigns
CREATE TABLE IF NOT EXISTS discovery_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  rules JSONB DEFAULT '[]',
  "isActive" BOOLEAN DEFAULT true,
  "startDate" TIMESTAMP,
  "endDate" TIMESTAMP,
  budget DOUBLE PRECISION,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Discovery Streamer Campaigns
CREATE TABLE IF NOT EXISTS discovery_streamer_campaigns (
  id TEXT PRIMARY KEY,
  "streamerId" TEXT NOT NULL REFERENCES discovery_creators(id) ON DELETE CASCADE,
  "campaignId" TEXT NOT NULL REFERENCES discovery_campaigns(id) ON DELETE CASCADE,
  "assignedBy" TEXT NOT NULL REFERENCES discovery_users(id),
  "assignedAt" TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  status TEXT DEFAULT 'ACTIVE',
  UNIQUE("streamerId", "campaignId")
);

-- Discovery Conversations
CREATE TABLE IF NOT EXISTS discovery_conversations (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES discovery_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Discovery Chat Messages
CREATE TABLE IF NOT EXISTS discovery_chat_messages (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES discovery_users(id) ON DELETE CASCADE,
  "conversationId" TEXT NOT NULL REFERENCES discovery_conversations(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  response TEXT,
  "streamersReturned" TEXT[],
  timestamp TIMESTAMP DEFAULT NOW(),
  "processingTime" INTEGER
);

-- Discovery Scraping Logs
CREATE TABLE IF NOT EXISTS discovery_scraping_logs (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  "recordsFound" INTEGER DEFAULT 0,
  "recordsUpdated" INTEGER DEFAULT 0,
  errors TEXT[] DEFAULT '{}',
  "startedAt" TIMESTAMP DEFAULT NOW(),
  "completedAt" TIMESTAMP,
  duration INTEGER
);

-- Discovery System Config
CREATE TABLE IF NOT EXISTS discovery_system_config (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Discovery Assignments (links to Envisioner)
CREATE TABLE IF NOT EXISTS discovery_assignments (
  id TEXT PRIMARY KEY,
  discovery_creator_id TEXT NOT NULL,
  envisioner_influencer_id TEXT,
  assigned_at TIMESTAMP DEFAULT NOW(),
  envisioner_campaign_id TEXT,
  last_performance_sync TIMESTAMP,
  total_conversions INTEGER DEFAULT 0,
  total_spent DOUBLE PRECISION DEFAULT 0,
  avg_cpa DOUBLE PRECISION
);

-- Discovery Searches
CREATE TABLE IF NOT EXISTS discovery_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  filters JSONB NOT NULL,
  results_count INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Discovery iGaming Campaigns
CREATE TABLE IF NOT EXISTS discovery_igaming_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL,
  target_demographics JSONB,
  budget INTEGER,
  expected_roi DOUBLE PRECISION,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Discovery Campaign Performance
CREATE TABLE IF NOT EXISTS discovery_campaign_performance (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES discovery_igaming_campaigns(id) ON DELETE CASCADE,
  streamer_id TEXT NOT NULL REFERENCES discovery_creators(id) ON DELETE CASCADE,
  predicted_performance JSONB,
  actual_performance JSONB,
  performance_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Many-to-many relation table for chat messages and streamers
CREATE TABLE IF NOT EXISTS _ChatMessageStreamers (
  "A" TEXT NOT NULL REFERENCES discovery_chat_messages(id) ON DELETE CASCADE,
  "B" TEXT NOT NULL REFERENCES discovery_creators(id) ON DELETE CASCADE,
  PRIMARY KEY ("A", "B")
);

CREATE INDEX IF NOT EXISTS idx_chatmessagestreamers_b ON _ChatMessageStreamers("B");
