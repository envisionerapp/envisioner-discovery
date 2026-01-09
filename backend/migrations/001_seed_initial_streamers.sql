-- Migration: Seed initial LATAM streamers data
-- This runs automatically on production deployment

BEGIN;

-- Only run if streamers table is empty
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM streamers) = 0 THEN

    -- Insert sample data (you'd replace with your actual data)
    INSERT INTO streamers (
      platform, username, "displayName", "profileUrl", followers,
      region, language, "topGames", tags, "fraudCheck",
      "usesCamera", "isVtuber", "createdAt", "updatedAt"
    ) VALUES
    ('TWITCH', 'elrubius', 'ElRubius', 'https://twitch.tv/elrubius', 15000000,
     'SPAIN', 'es', '{"Just Chatting"}', '{"GAMING"}', 'CLEAN',
     false, false, NOW(), NOW()),

    ('YOUTUBE', 'fernanfloo', 'Fernanfloo', 'https://youtube.com/@fernanfloo', 45000000,
     'EL_SALVADOR', 'es', '{"Gaming"}', '{"GAMING"}', 'CLEAN',
     false, false, NOW(), NOW()),

    -- Add more streamers here...
    ('KICK', 'westcol', 'Westcol', 'https://kick.com/westcol', 1938437,
     'COLOMBIA', 'es', '{"Special Events"}', '{"GAMING"}', 'CLEAN',
     false, false, NOW(), NOW());

    RAISE NOTICE 'Seeded % streamers', (SELECT COUNT(*) FROM streamers);

  ELSE
    RAISE NOTICE 'Streamers table already contains data, skipping seed';
  END IF;
END $$;

COMMIT;