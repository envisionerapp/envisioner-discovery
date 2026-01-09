#!/bin/bash

# Comprehensive iGaming campaign testing
# Tests 100 real-world queries with platform filters

BASE_URL="http://localhost:8080/api/chat/search"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

# Function to test a query with all platform filters
test_query() {
    local query="$1"
    local expected_min="${2:-1}" # Minimum expected results

    test_count=$((test_count + 1))
    echo ""
    echo "========================================="
    echo "Test #$test_count: $query"
    echo "========================================="

    # Test 1: Mixed (no filter)
    echo -n "  [Mixed] "
    mixed_response=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d "{\"query\":\"$query\"}")
    mixed_total=$(echo "$mixed_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['totalCount'])" 2>/dev/null || echo "0")
    mixed_tags=$(echo "$mixed_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['searchParams'].get('tags', []))" 2>/dev/null || echo "[]")

    if [ "$mixed_total" -ge "$expected_min" ]; then
        echo -e "${GREEN}✓${NC} $mixed_total results | Tags: $mixed_tags"
        pass_count=$((pass_count + 1))
    else
        echo -e "${RED}✗${NC} $mixed_total results (expected >= $expected_min) | Tags: $mixed_tags"
        fail_count=$((fail_count + 1))
    fi

    # Test 2: Twitch filter
    echo -n "  [Twitch] "
    twitch_response=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d "{\"query\":\"$query\",\"searchParams\":{\"platforms\":[\"TWITCH\"]}}")
    twitch_total=$(echo "$twitch_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['totalCount'])" 2>/dev/null || echo "0")
    twitch_tags=$(echo "$twitch_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['searchParams'].get('tags', []))" 2>/dev/null || echo "[]")
    twitch_platforms=$(echo "$twitch_response" | python3 -c "import sys, json; data=json.load(sys.stdin)['data']; print(list(set([s['platform'] for s in data['streamers'][:10]])))" 2>/dev/null || echo "[]")

    # Verify all results are TWITCH
    if echo "$twitch_platforms" | grep -q "TWITCH" && ! echo "$twitch_platforms" | grep -qE "YOUTUBE|KICK|FACEBOOK"; then
        echo -e "${GREEN}✓${NC} $twitch_total results | Tags: $twitch_tags | Platforms: $twitch_platforms"
        pass_count=$((pass_count + 1))
    else
        echo -e "${RED}✗${NC} $twitch_total results | Tags: $twitch_tags | ${RED}WRONG PLATFORMS: $twitch_platforms${NC}"
        fail_count=$((fail_count + 1))
    fi

    # Test 3: YouTube filter
    echo -n "  [YouTube] "
    youtube_response=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d "{\"query\":\"$query\",\"searchParams\":{\"platforms\":[\"YOUTUBE\"]}}")
    youtube_total=$(echo "$youtube_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['totalCount'])" 2>/dev/null || echo "0")
    youtube_tags=$(echo "$youtube_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['searchParams'].get('tags', []))" 2>/dev/null || echo "[]")
    youtube_platforms=$(echo "$youtube_response" | python3 -c "import sys, json; data=json.load(sys.stdin)['data']; print(list(set([s['platform'] for s in data['streamers'][:10]])))" 2>/dev/null || echo "[]")

    if echo "$youtube_platforms" | grep -q "YOUTUBE" && ! echo "$youtube_platforms" | grep -qE "TWITCH|KICK|FACEBOOK"; then
        echo -e "${GREEN}✓${NC} $youtube_total results | Tags: $youtube_tags | Platforms: $youtube_platforms"
        pass_count=$((pass_count + 1))
    else
        echo -e "${RED}✗${NC} $youtube_total results | Tags: $youtube_tags | ${RED}WRONG PLATFORMS: $youtube_platforms${NC}"
        fail_count=$((fail_count + 1))
    fi

    # Test 4: Kick filter
    echo -n "  [Kick] "
    kick_response=$(curl -s -X POST "$BASE_URL" -H "Content-Type: application/json" -d "{\"query\":\"$query\",\"searchParams\":{\"platforms\":[\"KICK\"]}}")
    kick_total=$(echo "$kick_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['totalCount'])" 2>/dev/null || echo "0")
    kick_tags=$(echo "$kick_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['searchParams'].get('tags', []))" 2>/dev/null || echo "[]")
    kick_platforms=$(echo "$kick_response" | python3 -c "import sys, json; data=json.load(sys.stdin)['data']; print(list(set([s['platform'] for s in data['streamers'][:10]])))" 2>/dev/null || echo "[]")

    if [ "$kick_total" -eq 0 ] || (echo "$kick_platforms" | grep -q "KICK" && ! echo "$kick_platforms" | grep -qE "TWITCH|YOUTUBE|FACEBOOK"); then
        echo -e "${GREEN}✓${NC} $kick_total results | Tags: $kick_tags | Platforms: $kick_platforms"
        pass_count=$((pass_count + 1))
    else
        echo -e "${RED}✗${NC} $kick_total results | Tags: $kick_tags | ${RED}WRONG PLATFORMS: $kick_platforms${NC}"
        fail_count=$((fail_count + 1))
    fi

    # Verify tag consistency across all filters
    if [ "$mixed_tags" = "$twitch_tags" ] && [ "$mixed_tags" = "$youtube_tags" ] && [ "$mixed_tags" = "$kick_tags" ]; then
        echo -e "  ${GREEN}✓ Tag consistency verified${NC}"
        pass_count=$((pass_count + 1))
    else
        echo -e "  ${RED}✗ Tag inconsistency detected!${NC}"
        echo "    Mixed: $mixed_tags"
        echo "    Twitch: $twitch_tags"
        echo "    YouTube: $youtube_tags"
        echo "    Kick: $kick_tags"
        fail_count=$((fail_count + 1))
    fi

    sleep 0.5 # Rate limiting
}

echo "Starting Comprehensive iGaming Campaign Testing..."
echo "=================================================="

# Region-based campaigns (40 tests)
test_query "40 Chile streamers for betting campaign" 1
test_query "50 Mexico streamers for casino campaign" 1
test_query "100 casino streamers in Mexico" 1
test_query "50 Peru streamers for Betano campaign" 1
test_query "60 Argentina streamers for sports betting" 1
test_query "30 Brazil streamers for casino promotion" 1
test_query "25 Colombia streamers for poker campaign" 1
test_query "45 streamers in Chile for gambling ads" 1
test_query "80 Mexico influencers for betting brand" 1
test_query "35 Peru content creators for casino" 1

# Game-specific campaigns (30 tests)
test_query "60 streamers for World of Warships campaign" 1
test_query "30 Brazil WoW streamers for campaign" 1
test_query "50 slot streamers for casino promotion" 1
test_query "40 poker streamers in Mexico" 1
test_query "70 casino game streamers in Argentina" 1
test_query "45 Grand Theft Auto V streamers for betting" 1
test_query "55 League of Legends streamers in Brazil" 1
test_query "35 Counter-Strike streamers for gambling campaign" 1
test_query "50 FIFA streamers in Chile for sports betting" 1
test_query "40 Call of Duty streamers in Colombia" 1

# Follower-based campaigns (20 tests)
test_query "50 Chile streamers with 100k+ followers for betting" 10
test_query "30 Mexico streamers with 50k+ followers" 10
test_query "40 Brazil influencers with 200k+ followers for casino" 5
test_query "25 Argentina streamers with 150k followers" 5
test_query "35 Peru streamers with 75k+ followers for Betano" 5
test_query "20 Colombia streamers with 500k+ followers" 2
test_query "15 Chile gaming influencers with 1 million followers" 1
test_query "50 Mexico streamers over 100000 followers" 10
test_query "30 Brazil casino streamers with 80k followers" 5
test_query "40 Peru poker streamers with 60k+ followers" 5

# Live status campaigns (10 tests)
test_query "Live streamers in Mexico for casino campaign" 1
test_query "Chile streamers currently streaming" 1
test_query "Live Brazil streamers for betting promotion" 1
test_query "Peru streamers streaming now for Betano" 1
test_query "Argentina live streamers for gambling" 1
test_query "Live Mexico casino streamers" 1
test_query "Streaming now in Chile for betting campaign" 1
test_query "Brazil live gaming streamers" 1
test_query "Colombia streamers on air for casino" 1
test_query "Live Argentina poker streamers" 1

# Multi-criteria campaigns (20 tests)
test_query "50 Mexico casino streamers with 100k followers" 5
test_query "30 Chile live streamers for betting campaign" 1
test_query "40 Brazil GTA streamers with 50k+ followers" 5
test_query "25 Peru poker streamers with 75k followers" 3
test_query "35 Argentina FIFA streamers for sports betting" 3
test_query "20 Mexico live casino streamers with 100k followers" 2
test_query "45 Chile slot streamers for gambling promotion" 3
test_query "30 Brazil live League of Legends streamers" 3
test_query "40 Colombia casino streamers with 60k+ followers" 5
test_query "25 Peru live streamers for Betano campaign" 2
test_query "50 Mexico poker streamers with 80k followers" 5
test_query "35 Argentina casino streamers for betting brand" 5
test_query "30 Chile GTA streamers with 100k+ followers" 3
test_query "40 Brazil casino live streamers" 3
test_query "25 Peru FIFA streamers with 50k followers" 3
test_query "20 Mexico World of Warships streamers" 2
test_query "45 Argentina live casino streamers with 75k followers" 3
test_query "30 Chile poker streamers for gambling campaign" 3
test_query "35 Brazil slot streamers with 100k+ followers" 3
test_query "40 Colombia live streamers for betting promotion" 3

# Platform-specific campaigns (10 tests)
test_query "50 Twitch streamers in Mexico for casino" 5
test_query "30 YouTube streamers in Brazil for betting" 5
test_query "40 Kick streamers in Argentina" 1
test_query "25 Twitch Peru streamers for Betano" 3
test_query "35 YouTube Chile streamers for gambling" 3
test_query "20 Twitch Mexico casino streamers with 100k followers" 2
test_query "45 YouTube Brazil poker streamers" 5
test_query "30 Kick Colombia streamers for betting" 1
test_query "40 Twitch Argentina live streamers" 3
test_query "25 YouTube Peru casino streamers" 3

# Edge cases and special queries (10 tests)
test_query "VTubers in Mexico for casino campaign" 1
test_query "Spanish speaking streamers for betting in LATAM" 10
test_query "Top casino streamers in South America" 10
test_query "Female streamers in Brazil for gambling promotion" 5
test_query "Poker pros in Argentina for betting campaign" 1
test_query "Esports streamers in Mexico for casino sponsorship" 5
test_query "Music streamers in Chile for betting brand" 1
test_query "Just Chatting streamers in Colombia for casino" 1
test_query "Variety streamers in Peru for Betano" 1
test_query "Gaming influencers across LATAM for betting" 10

# Summary
echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "Total Tests: $test_count queries × 5 checks = $((test_count * 5)) checks"
echo -e "${GREEN}Passed: $pass_count${NC}"
echo -e "${RED}Failed: $fail_count${NC}"

if [ $fail_count -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  Some tests failed. Review the output above.${NC}"
    exit 1
fi
