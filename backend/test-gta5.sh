#!/bin/bash

echo "Testing: 'Grand Theft Auto V streamers'"
echo ""

echo "1. Mixed (no platform filter):"
curl -X POST http://localhost:8080/api/chat/search -H "Content-Type: application/json" -d '{"query":"Grand Theft Auto V streamers"}' 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin)['data']; print(f\"Total: {data['totalCount']}, Tags: {data['searchParams'].get('tags', [])}, Platforms: {data['searchParams'].get('platforms', 'none')}\"); print(f\"Sample platforms: {[s['platform'] for s in data['streamers'][:5]]}\"); print(f\"Sample games: {[s.get('currentGame') or (s.get('topGames', [''])[0] if s.get('topGames') else '') for s in data['streamers'][:3]]}\")"
echo ""

echo "2. With Twitch filter:"
curl -X POST http://localhost:8080/api/chat/search -H "Content-Type: application/json" -d '{"query":"Grand Theft Auto V streamers","searchParams":{"platforms":["TWITCH"]}}' 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin)['data']; print(f\"Total: {data['totalCount']}, Tags: {data['searchParams'].get('tags', [])}, Platforms: {data['searchParams'].get('platforms', [])}\"); print(f\"Sample games: {[s.get('currentGame') or (s.get('topGames', [''])[0] if s.get('topGames') else '') for s in data['streamers'][:3]]}\")"
echo ""

echo "3. Back to Mixed:"
curl -X POST http://localhost:8080/api/chat/search -H "Content-Type: application/json" -d '{"query":"Grand Theft Auto V streamers","searchParams":{}}' 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin)['data']; print(f\"Total: {data['totalCount']}, Tags: {data['searchParams'].get('tags', [])}, Platforms: {data['searchParams'].get('platforms', 'none')}\"); print(f\"Sample games: {[s.get('currentGame') or (s.get('topGames', [''])[0] if s.get('topGames') else '') for s in data['streamers'][:3]]}\")"
