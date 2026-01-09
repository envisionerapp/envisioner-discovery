#!/bin/bash
curl -s "http://localhost:8080/api/streamers?page=1&limit=1&search=juansguarnizo" | python3 -c "import sys, json; data = json.load(sys.stdin); print('panelImages:', data['streamers'][0].get('panelImages', 'NOT FOUND') if data.get('streamers') and len(data['streamers']) > 0 else 'NO STREAMERS')"
