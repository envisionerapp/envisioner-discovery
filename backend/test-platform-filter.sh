#!/bin/bash

echo "Testing: 'GTA streamers' with different platform filters"
echo ""

echo "1. No platform filter (mixed):"
curl -X POST http://localhost:8080/api/chat/search -H "Content-Type: application/json" -d '{"query":"GTA streamers"}' 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin)['data']; print(f\"Total: {data['totalCount']}, Tags: {data['searchParams'].get('tags', [])}, Sample platforms: {[s['platform'] for s in data['streamers'][:5]]}\"); print(f\"Sample usernames: {[s['username'] for s in data['streamers'][:3]]}\"); print(f\"Sample games: {[s.get('currentGame') or (s.get('topGames', [''])[0] if s.get('topGames') else '') for s in data['streamers'][:3]]}\")"
echo ""

echo "2. With Twitch filter:"
curl -X POST http://localhost:8080/api/chat/search -H "Content-Type: application/json" -d '{"query":"GTA streamers","searchParams":{"platforms":["TWITCH"]}}' 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin)['data']; print(f\"Total: {data['totalCount']}, Tags: {data['searchParams'].get('tags', [])}, Platforms: {set([s['platform'] for s in data['streamers']])}\"); print(f\"Sample usernames: {[s['username'] for s in data['streamers'][:3]]}\"); print(f\"Sample games: {[s.get('currentGame') or (s.get('topGames', [''])[0] if s.get('topGames') else '') for s in data['streamers'][:3]]}\")"
echo ""

echo "3. With YouTube filter:"
curl -X POST http://localhost:8080/api/chat/search -H "Content-Type: application/json" -d '{"query":"GTA streamers","searchParams":{"platforms":["YOUTUBE"]}}' 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin)['data']; print(f\"Total: {data['totalCount']}, Tags: {data['searchParams'].get('tags', [])}, Platforms: {set([s['platform'] for s in data['streamers']])}\"); print(f\"Sample usernames: {[s['username'] for s in data['streamers'][:3]]}\"); print(f\"Sample games: {[s.get('currentGame') or (s.get('topGames', [''])[0] if s.get('topGames') else '') for s in data['streamers'][:3]]}\")"
echo ""

echo "4. With Kick filter:"
curl -X POST http://localhost:8080/api/chat/search -H "Content-Type: application/json" -d '{"query":"GTA streamers","searchParams":{"platforms":["KICK"]}}' 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin)['data']; print(f\"Total: {data['totalCount']}, Tags: {data['searchParams'].get('tags', [])}, Platforms: {set([s['platform'] for s in data['streamers']])}\"); print(f\"Sample usernames: {[s['username'] for s in data['streamers'][:3]]}\"); print(f\"Sample games: {[s.get('currentGame') or (s.get('topGames', [''])[0] if s.get('topGames') else '') for s in data['streamers'][:3]]}\")"
