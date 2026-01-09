#!/bin/bash

# Script to check production database status
# Usage: DATABASE_URL="your-prod-url" ./check-prod-db.sh

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is not set"
    echo "Usage: DATABASE_URL='your-production-db-url' ./check-prod-db.sh"
    exit 1
fi

echo "🔍 Checking production database..."
echo ""

# Check if users table exists and has data
echo "📊 Users in database:"
psql "$DATABASE_URL" -c "SELECT email, \"mfaEnabled\" FROM users LIMIT 5;" 2>/dev/null || echo "❌ Could not query users table"
echo ""

# Check migration status
echo "🔄 Checking migration status:"
npx prisma migrate status
echo ""

# Check if stream_titles column exists
echo "🗂️  Checking if stream_titles column exists:"
psql "$DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'streamers' AND column_name = 'stream_titles';" 2>/dev/null
echo ""

echo "✅ To apply pending migrations, run:"
echo "   npx prisma migrate deploy"
