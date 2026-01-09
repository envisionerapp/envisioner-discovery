-- Fix enum types for Discovery tables
-- Run after create_discovery_tables.sql

-- Create Platform enum (if not exists)
DO $$ BEGIN
    CREATE TYPE "Platform" AS ENUM ('TWITCH', 'YOUTUBE', 'KICK', 'FACEBOOK', 'TIKTOK', 'INSTAGRAM', 'X', 'LINKEDIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create Region enum (if not exists)
DO $$ BEGIN
    CREATE TYPE "Region" AS ENUM (
        'MEXICO', 'COLOMBIA', 'ARGENTINA', 'CHILE', 'PERU', 'VENEZUELA', 'ECUADOR', 'BOLIVIA',
        'PARAGUAY', 'URUGUAY', 'COSTA_RICA', 'PANAMA', 'GUATEMALA', 'EL_SALVADOR', 'HONDURAS',
        'NICARAGUA', 'DOMINICAN_REPUBLIC', 'PUERTO_RICO', 'BRAZIL',
        'USA', 'CANADA',
        'UK', 'SPAIN', 'GERMANY', 'FRANCE', 'ITALY', 'PORTUGAL', 'NETHERLANDS', 'SWEDEN',
        'NORWAY', 'DENMARK', 'FINLAND', 'POLAND', 'RUSSIA',
        'JAPAN', 'KOREA', 'CHINA', 'INDIA', 'INDONESIA', 'PHILIPPINES', 'THAILAND', 'VIETNAM',
        'MALAYSIA', 'SINGAPORE',
        'AUSTRALIA', 'NEW_ZEALAND',
        'WORLDWIDE', 'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create FraudStatus enum (if not exists)
DO $$ BEGIN
    CREATE TYPE "FraudStatus" AS ENUM ('CLEAN', 'SUSPICIOUS', 'FLAGGED', 'PENDING_REVIEW');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create CampaignStatus enum (if not exists)
DO $$ BEGIN
    CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'PENDING', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Alter discovery_creators: platform
ALTER TABLE discovery_creators
    ALTER COLUMN platform TYPE "Platform" USING platform::"Platform";

-- Alter discovery_creators: region
ALTER TABLE discovery_creators
    ALTER COLUMN region TYPE "Region" USING region::"Region";

-- Alter discovery_creators: fraudCheck (drop default, alter, restore default)
ALTER TABLE discovery_creators ALTER COLUMN "fraudCheck" DROP DEFAULT;
ALTER TABLE discovery_creators
    ALTER COLUMN "fraudCheck" TYPE "FraudStatus" USING "fraudCheck"::"FraudStatus";
ALTER TABLE discovery_creators ALTER COLUMN "fraudCheck" SET DEFAULT 'CLEAN'::"FraudStatus";

-- Alter discovery_scraping_logs to use Platform enum
ALTER TABLE discovery_scraping_logs
    ALTER COLUMN platform TYPE "Platform" USING platform::"Platform";

-- Alter discovery_streamer_campaigns to use CampaignStatus enum
ALTER TABLE discovery_streamer_campaigns ALTER COLUMN status DROP DEFAULT;
ALTER TABLE discovery_streamer_campaigns
    ALTER COLUMN status TYPE "CampaignStatus" USING status::"CampaignStatus";
ALTER TABLE discovery_streamer_campaigns ALTER COLUMN status SET DEFAULT 'ACTIVE'::"CampaignStatus";
