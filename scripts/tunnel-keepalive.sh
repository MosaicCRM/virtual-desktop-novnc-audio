#!/bin/bash
URL="https://fixes-they-voices-chronicle.trycloudflare.com"
ping_worker() {
    local id=$1
    while true; do
        TS=$(date +%s%N)
        curl -s -m 5 -o /dev/null -H 'Cache-Control: no-cache, no-store' "$URL/?ping=${id}_${TS}" >/dev/null 2>&1 || true
        sleep 8
    done
}
ping_worker A &
sleep 4
ping_worker B &
wait
