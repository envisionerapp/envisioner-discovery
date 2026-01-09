#!/bin/bash

keys=(
  "AIzaSyDzdtG_gCDRQhUbBjdmN0euebH9NEOP8yQ"
  "AIzaSyCHNIURBY5bnH1mMd2QAHHuOv9XAA1UV9U"
  "AIzaSyDzFhnS_2n5_Mo5al0hq0nZbC2DPNtsYsY"
  "AIzaSyDsQnJuGV6U5QApoLk1X575nBJVkjyfvBE"
  "AIzaSyBMIAxXrV2mbECTtqVvB4TOLft9EetYDMo"
)

for i in "${!keys[@]}"; do
  key="${keys[$i]}"
  echo "=== Key $((i+1)) ==="

  response=$(curl -s "https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&type=video&key=$key&maxResults=1")

  if echo "$response" | grep -q "quotaExceeded"; then
    echo "Status: QUOTA EXCEEDED"
  elif echo "$response" | grep -q "API key expired"; then
    echo "Status: EXPIRED/INVALID"
  elif echo "$response" | grep -q "items"; then
    echo "Status: WORKING ✓"
  else
    echo "Status: UNKNOWN ERROR"
    echo "$response" | head -5
  fi
  echo ""
done
