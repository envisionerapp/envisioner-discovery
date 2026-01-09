#!/bin/bash

# Script to sync local database to production
# Usage: PROD_DATABASE_URL="your-prod-url" ./sync-to-production.sh

if [ -z "$PROD_DATABASE_URL" ]; then
    echo "❌ PROD_DATABASE_URL environment variable is not set"
    echo ""
    echo "Usage:"
    echo "  PROD_DATABASE_URL='postgresql://user:pass@host/db' ./sync-to-production.sh"
    echo ""
    echo "Get your production URL from:"
    echo "  1. Go to Render Dashboard"
    echo "  2. Click on your PostgreSQL database"
    echo "  3. Copy the 'External Database URL'"
    exit 1
fi

echo "🚀 Starting production database sync..."
echo ""

# Step 1: Apply migrations to production
echo "📦 Step 1: Applying migrations to production..."
DATABASE_URL="$PROD_DATABASE_URL" npx prisma migrate deploy
if [ $? -ne 0 ]; then
    echo "❌ Migration failed. Aborting."
    exit 1
fi
echo "✅ Migrations applied successfully"
echo ""

# Step 2: Dump local database
echo "📤 Step 2: Creating backup of local database..."
pg_dump postgresql://bheelz@localhost:5432/mielo > /tmp/mielo_local_backup.sql
if [ $? -ne 0 ]; then
    echo "❌ Local database dump failed. Aborting."
    exit 1
fi
echo "✅ Local database backed up to /tmp/mielo_local_backup.sql"
echo ""

# Step 3: Show what will be synced
echo "📊 Step 3: Checking what will be synced..."
echo ""
echo "Local database stats:"
psql postgresql://bheelz@localhost:5432/mielo -c "SELECT 'Users' as table, COUNT(*) as count FROM users UNION ALL SELECT 'Streamers', COUNT(*) FROM streamers UNION ALL SELECT 'Campaigns', COUNT(*) FROM campaigns;"
echo ""

read -p "⚠️  This will REPLACE all data in production. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Sync cancelled"
    exit 0
fi

# Step 4: Clear production tables (keep schema)
echo ""
echo "🗑️  Step 4: Clearing production data..."
psql "$PROD_DATABASE_URL" -c "TRUNCATE users, streamers, campaigns, conversations, messages, notes, tags RESTART IDENTITY CASCADE;" 2>/dev/null
echo "✅ Production data cleared"
echo ""

# Step 5: Restore local data to production
echo "📥 Step 5: Restoring local data to production..."
psql "$PROD_DATABASE_URL" < /tmp/mielo_local_backup.sql
if [ $? -ne 0 ]; then
    echo "❌ Restore failed. Check errors above."
    exit 1
fi
echo "✅ Data restored successfully"
echo ""

# Step 6: Verify production data
echo "📊 Step 6: Verifying production database..."
psql "$PROD_DATABASE_URL" -c "SELECT 'Users' as table, COUNT(*) as count FROM users UNION ALL SELECT 'Streamers', COUNT(*) FROM streamers UNION ALL SELECT 'Campaigns', COUNT(*) FROM campaigns;"
echo ""

echo "🎉 Production database sync complete!"
echo ""
echo "You can now login to production with the same credentials as local:"
psql postgresql://bheelz@localhost:5432/mielo -c "SELECT email FROM users WHERE email LIKE '%@miela.cc';"
