#!/bin/bash
# Manual 10-test verification

test_query() {
    echo ""
    echo "========= $1 ========="
    echo "Mixed:"
    curl -s -X POST http://localhost:8080/api/chat/search -H "Content-Type: application/json" -d "{\"query\":\"$1\"}" | python3 -c "import sys, json; d=json.load(sys.stdin)['data']; print(f'  Total: {d[\"totalCount\"]}, Tags: {d[\"searchParams\"].get(\"tags\", [])}, Platforms: {list(set([s[\"platform\"] for s in d[\"streamers\"][:5]]))[: 3]}')"
    echo "Twitch:"
    curl -s -X POST http://localhost:8080/api/chat/search -H "Content-Type: application/json" -d "{\"query\":\"$1\",\"searchParams\":{\"platforms\":[\"TWITCH\"]}}" | python3 -c "import sys, json; d=json.load(sys.stdin)['data']; plats=list(set([s[\"platform\"] for s in d[\"streamers\"][:10]])); print(f'  Total: {d[\"totalCount\"]}, Tags: {d[\"searchParams\"].get(\"tags\", [])}, Platforms: {plats}')"
    sleep 0.5
}

test_query "casino streamers in Mexico"
test_query "Grand Theft Auto V streamers"
test_query "poker streamers"
test_query "50 Chile streamers for betting"
test_query "League of Legends streamers in Brazil"
test_query "FIFA streamers"
test_query "live streamers in Argentina"
test_query "gambling streamers with 100k followers"
test_query "World of Warships campaign"
test_query "Counter-Strike streamers"
