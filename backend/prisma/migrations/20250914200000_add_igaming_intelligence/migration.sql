-- Add iGaming intelligence fields to streamers table
ALTER TABLE "public"."streamers" ADD COLUMN "igaming_intelligence" JSONB;
ALTER TABLE "public"."streamers" ADD COLUMN "igaming_score" INTEGER DEFAULT 0;
ALTER TABLE "public"."streamers" ADD COLUMN "audience_psychology" JSONB;
ALTER TABLE "public"."streamers" ADD COLUMN "brand_safety_score" INTEGER DEFAULT 0;
ALTER TABLE "public"."streamers" ADD COLUMN "gambling_compatibility" BOOLEAN DEFAULT false;
ALTER TABLE "public"."streamers" ADD COLUMN "last_intelligence_update" TIMESTAMP;
ALTER TABLE "public"."streamers" ADD COLUMN "risk_assessment" JSONB;
ALTER TABLE "public"."streamers" ADD COLUMN "conversion_potential" JSONB;

-- Create indexes for efficient querying
CREATE INDEX "idx_igaming_score" ON "public"."streamers"("igaming_score" DESC);
CREATE INDEX "idx_brand_safety_score" ON "public"."streamers"("brand_safety_score" DESC);
CREATE INDEX "idx_gambling_compatibility" ON "public"."streamers"("gambling_compatibility");
CREATE INDEX "idx_last_intelligence_update" ON "public"."streamers"("last_intelligence_update");

-- Add iGaming campaign tracking
CREATE TABLE IF NOT EXISTS "public"."igaming_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campaign_type" TEXT NOT NULL,
    "target_demographics" JSONB,
    "budget" INTEGER,
    "expected_roi" DECIMAL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "status" TEXT DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "igaming_campaigns_pkey" PRIMARY KEY ("id")
);

-- Add campaign-streamer performance tracking
CREATE TABLE IF NOT EXISTS "public"."campaign_performance" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "streamer_id" TEXT NOT NULL,
    "predicted_performance" JSONB,
    "actual_performance" JSONB,
    "performance_score" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_performance_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "public"."campaign_performance" ADD CONSTRAINT "campaign_performance_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."igaming_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."campaign_performance" ADD CONSTRAINT "campaign_performance_streamer_id_fkey" FOREIGN KEY ("streamer_id") REFERENCES "public"."streamers"("id") ON DELETE CASCADE ON UPDATE CASCADE;