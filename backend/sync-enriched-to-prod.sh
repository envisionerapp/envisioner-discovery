#!/bin/bash
set -e

echo "🔄 Syncing enriched streamer data to production..."

# Export deduped enriched data
psql postgresql://bheelz@localhost:5432/mielo -c "
COPY (
  SELECT DISTINCT ON (platform, username) *
  FROM streamers
  ORDER BY platform, username, \"updatedAt\" DESC
) TO STDOUT WITH (FORMAT CSV, HEADER)" > /tmp/streamers-deduped.csv

echo "✅ Exported $(wc -l < /tmp/streamers-deduped.csv) streamers"

# Clear production and import
export PROD_DB="postgresql://mielo_dbms_user:UxAYpbAFawKzxltS9OBrq8UvzBQfwxu7@dpg-d33j19odl3ps738uaoi0-a.oregon-postgres.render.com/mielo_dbms"

psql "$PROD_DB" -c "DELETE FROM streamers;"
echo "✅ Cleared production"

psql "$PROD_DB" -c "\COPY streamers FROM '/tmp/streamers-deduped.csv' WITH (FORMAT CSV, HEADER)"
echo "✅ Imported to production"

# Verify
psql "$PROD_DB" -c "SELECT COUNT(*) as total, COUNT(CASE WHEN array_length(tags, 1) > 1 THEN 1 END) as enriched FROM streamers;"
echo "✅ Done!"
