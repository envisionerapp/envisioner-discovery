-- Safe Cleanup Migration: Remove unused columns
-- Generated: 2026-01-11
--
-- This migration removes columns that are never read in the codebase.
-- All columns have default values so existing rows won't be affected.

-- ============================================
-- STREAMER MODEL (discovery_creators table)
-- ============================================

-- Remove last_synced_by (write-only, never queried)
ALTER TABLE discovery_creators DROP COLUMN IF EXISTS last_synced_by;

-- Remove last_intelligence_update (write-only timestamp)
ALTER TABLE discovery_creators DROP COLUMN IF EXISTS last_intelligence_update;

-- ============================================
-- INFLUENCER MODEL (discovery_influencers table)
-- ============================================

-- Remove avg_engagement_rate (defined but never calculated or used)
ALTER TABLE discovery_influencers DROP COLUMN IF EXISTS avg_engagement_rate;

-- Remove notes (never referenced in Influencer model)
ALTER TABLE discovery_influencers DROP COLUMN IF EXISTS notes;

-- Remove GDPR placeholder fields (never implemented)
ALTER TABLE discovery_influencers DROP COLUMN IF EXISTS data_source;
ALTER TABLE discovery_influencers DROP COLUMN IF EXISTS deletion_requested;
ALTER TABLE discovery_influencers DROP COLUMN IF EXISTS deletion_requested_at;

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these queries after migration to verify:
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'discovery_creators'
-- AND column_name IN ('last_synced_by', 'last_intelligence_update');
-- (Should return 0 rows)
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'discovery_influencers'
-- AND column_name IN ('avg_engagement_rate', 'notes', 'data_source', 'deletion_requested', 'deletion_requested_at');
-- (Should return 0 rows)
