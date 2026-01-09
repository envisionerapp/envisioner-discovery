#!/bin/bash

# Sync tags from local database to production
# This will update existing streamers with their enriched tags

set -e

LOCAL_DB="postgresql://bheelz@localhost:5432/mielo"
PROD_DB="postgresql://mielo_dbms_user:UxAYpbAFawKzxltS9OBrq8UvzBQfwxu7@dpg-d33j19odl3ps738uaoi0-a.oregon-postgres.render.com/mielo_dbms"

echo "🔄 Syncing tags from local to production..."

# Export tags data from local
psql "$LOCAL_DB" -c "\COPY (SELECT username, tags FROM streamers WHERE tags IS NOT NULL) TO '/tmp/tags_sync.csv' WITH CSV HEADER"

echo "📤 Exported $(wc -l < /tmp/tags_sync.csv) rows from local database"

# Create temp table in production and import
psql "$PROD_DB" <<EOF
-- Create temporary table
CREATE TEMP TABLE temp_tags (
    username TEXT,
    tags TEXT
);

-- Import the CSV
\COPY temp_tags FROM '/tmp/tags_sync.csv' WITH CSV HEADER

-- Update streamers with enriched tags
UPDATE streamers s
SET tags = string_to_array(t.tags, ',')
FROM temp_tags t
WHERE s.username = t.username;

-- Show stats
SELECT
    COUNT(*) as updated_count,
    COUNT(CASE WHEN array_length(tags, 1) > 1 THEN 1 END) as multi_tag_count
FROM streamers
WHERE username IN (SELECT username FROM temp_tags);
EOF

echo "✅ Tags synced successfully!"

# Cleanup
rm /tmp/tags_sync.csv
