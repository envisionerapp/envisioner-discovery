#!/bin/bash

echo "🗑️ CLEARING ALL PRODUCTION STREAMERS..."
echo ""
echo "Please provide your production database URL:"
echo "(Copy the External URL from Render Connect dropdown)"
echo ""
read -p "Production Database URL: " DB_URL

if [ -z "$DB_URL" ]; then
    echo "❌ No database URL provided. Exiting."
    exit 1
fi

echo ""
echo "🔄 Connecting to production database..."
echo "🗑️ Running TRUNCATE command..."

# Run the truncate command
psql "$DB_URL" -c "TRUNCATE TABLE streamers RESTART IDENTITY CASCADE;"

if [ $? -eq 0 ]; then
    echo "✅ SUCCESS! All streamers cleared from production"

    # Verify by counting
    echo "🔍 Verifying clearance..."
    REMAINING=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM streamers;" | xargs)
    echo "📊 Remaining streamers: $REMAINING"

    if [ "$REMAINING" = "0" ]; then
        echo "🎉 PERFECT! Production database is completely empty!"
    else
        echo "⚠️ Warning: $REMAINING streamers still remain"
    fi
else
    echo "❌ Failed to clear production database"
    echo "Make sure the database URL is correct and you have write access"
fi