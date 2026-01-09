#!/bin/bash

# Quick 20-query test for iGaming campaigns
BASE_URL="http://localhost:8080/api/chat/search"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

pass=0
fail=0
total=0

test_query() {
    local query="$1"
    total=$((total + 1))

    echo ""
    echo "Test #$total: $query"

    # Mixed
    mixed=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d "{\"query\":\"$query\"}")
    mixed_total=$(echo "$mixed" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['totalCount'])" 2>/dev/null || echo "ERROR")
    mixed_tags=$(echo "$mixed" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['searchParams'].get('tags', []))" 2>/dev/null || echo "ERROR")

    # Twitch
    twitch=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d "{\"query\":\"$query\",\"searchParams\":{\"platforms\":[\"TWITCH\"]}}")
    twitch_total=$(echo "$twitch" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['totalCount'])" 2>/dev/null || echo "ERROR")
    twitch_tags=$(echo "$twitch" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['searchParams'].get('tags', []))" 2>/dev/null || echo "ERROR")
    twitch_plats=$(echo "$twitch" | python3 -c "import sys, json; data=json.load(sys.stdin)['data']; print(list(set([s['platform'] for s in data['streamers'][:10]])))" 2>/dev/null || echo "ERROR")

    # Check tag consistency
    if [ "$mixed_tags" = "$twitch_tags" ]; then
        # Check platform correctness
        if [ "$twitch_total" = "0" ] || (echo "$twitch_plats" | grep -q "TWITCH" && ! echo "$twitch_plats" | grep -qE "YOUTUBE|KICK"); then
            echo -e "  ${GREEN}✓${NC} Mixed: $mixed_total | Twitch: $twitch_total | Tags: $mixed_tags"
            pass=$((pass + 1))
        else
            echo -e "  ${RED}✗${NC} Mixed: $mixed_total | Twitch: $twitch_total | Tags: $mixed_tags | ${RED}BAD PLATFORMS: $twitch_plats${NC}"
            fail=$((fail + 1))
        fi
    else
        echo -e "  ${RED}✗${NC} TAG MISMATCH | Mixed tags: $mixed_tags | Twitch tags: $twitch_tags"
        fail=$((fail + 1))
    fi

    sleep 0.3
}

echo "Quick iGaming Campaign Testing (20 queries)"
echo "==========================================="

# Diverse test cases
test_query "casino streamers in Mexico"
test_query "Grand Theft Auto V streamers"
test_query "50 Chile streamers for betting campaign"
test_query "poker streamers"
test_query "streamers in Brazil with 100k followers"
test_query "live streamers in Argentina"
test_query "slot streamers for casino promotion"
test_query "FIFA streamers in Mexico"
test_query "Counter-Strike streamers"
test_query "League of Legends streamers in Chile"
test_query "gambling streamers in Peru"
test_query "sports betting streamers in Colombia"
test_query "Minecraft streamers in Brazil"
test_query "casino streamers with 50k+ followers"
test_query "World of Warships streamers"
test_query "live casino streamers in Mexico"
test_query "poker streamers with 75k followers"
test_query "GTA streamers in Argentina"
test_query "Call of Duty streamers"
test_query "VTubers in Mexico"

echo ""
echo "========================================="
echo "Results: ${GREEN}$pass passed${NC}, ${RED}$fail failed${NC} out of $total"
if [ $fail -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
