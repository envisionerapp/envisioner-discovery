#!/bin/bash

# Live Enrichment Monitor
echo "🔴 LIVE ENRICHMENT MONITOR"
echo "Press Ctrl+C to stop"
echo ""

while true; do
    clear
    echo "═══════════════════════════════════════════════════════════════"
    echo "🔴 LIVE ENRICHMENT MONITOR - $(date '+%H:%M:%S')"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""

    # Get status
    STATUS=$(curl -s http://localhost:8080/api/enrichment/status)

    if [ $? -eq 0 ]; then
        echo "$STATUS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('success'):
        d = data['data']
        total = d['totalStreamers']
        enriched = d['enrichedStreamers']
        unenriched = d['unenrichedStreamers']
        recent = d['recentlyEnriched24h']
        percent = d['percentComplete']

        print(f'📊 PROGRESS:')
        print(f'  Total Streamers: {total:,}')
        print(f'  Enriched: {enriched:,} ({percent}%)')
        print(f'  Remaining: {unenriched:,}')
        print(f'  Enriched Today: {recent:,}')
        print()

        # Progress bar
        bar_width = 50
        filled = int(bar_width * enriched / total)
        bar = '█' * filled + '░' * (bar_width - filled)
        print(f'  [{bar}] {percent}%')
        print()

        # Estimate time remaining (assuming ~60 seconds per streamer with retries)
        if recent > 0:
            rate = recent / 24  # per hour
            hours_remaining = unenriched / rate if rate > 0 else 0
            print(f'⏱️  ESTIMATED TIME REMAINING: {hours_remaining:.1f} hours')
            print(f'📈 ENRICHMENT RATE: {rate:.1f} streamers/hour')
        else:
            print(f'⏱️  ESTIMATED TIME REMAINING: Calculating...')
        print()
except Exception as e:
    print(f'Error: {e}')
"

        echo "═══════════════════════════════════════════════════════════════"
        echo ""
        echo "📋 RECENT BACKEND LOGS:"
        tail -n 10 /tmp/backend.log 2>/dev/null | grep -E "(Enriching|enriched|Successfully|Error|Advanced)" | tail -5

    else
        echo "❌ Backend not responding on port 8080"
        echo "   Make sure the backend server is running"
    fi

    echo ""
    echo "Refreshing in 5 seconds... (Ctrl+C to stop)"
    sleep 5
done
