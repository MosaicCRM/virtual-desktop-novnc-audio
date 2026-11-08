#!/bin/bash
URL="https://fixes-they-voices-chronicle.trycloudflare.com"
while true; do
    TS=$(date +%s%N)
    curl -s -m 8 -o /dev/null -H 'Cache-Control: no-cache, no-store' "$URL/?ping=$TS" || true
    sleep 10
done
