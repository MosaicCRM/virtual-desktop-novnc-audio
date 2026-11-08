#!/bin/bash
set -e

LOG_DIR=/home/ubuntu/logs
mkdir -p "$LOG_DIR"

kill_pidfile() {
    local f=$1
    if [ -f "$f" ]; then
        kill $(cat "$f") 2>/dev/null || true
        rm -f "$f"
    fi
}

cleanup() {
    echo "Stopping services..."
    kill_pidfile /tmp/cf.pid
    kill_pidfile /tmp/audio.pid
    kill_pidfile /tmp/websock.pid
    kill_pidfile /tmp/vnc.pid
    kill_pidfile /tmp/xfce.pid
    kill_pidfile /tmp/xvfb.pid
    rm -rf /tmp/.X1-lock /tmp/.X11-unix/X1
    echo "Cleanup complete"
}

trap cleanup EXIT INT TERM

rm -rf /tmp/.X1-lock /tmp/.X11-unix/X1
sleep 1

# 1. PulseAudio (ensure running)
if ! pactl info >/dev/null 2>&1; then
    echo "[start] Starting PulseAudio..."
    pulseaudio --exit-idle-time=-1 --daemonize=yes 2>&1 || true
    sleep 2
fi
pactl load-module module-null-sink sink_name=virtual_speaker rate=48000 channels=2 format=s16le sink_properties=device.description=Virtual_Speaker 2>/dev/null || true
pactl set-default-sink virtual_speaker 2>/dev/null || true
pactl info | grep -E "Server String|Default Sink|Default Source"

# 2. Xvfb virtual display
echo "[start] Starting Xvfb :1..."
Xvfb :1 -screen 0 1600x900x24 -listen tcp -ac +extension GLX +render -noreset > "$LOG_DIR/xvfb.log" 2>&1 &
echo $! > /tmp/xvfb.pid
for i in $(seq 1 30); do
    if DISPLAY=:1 xdpyinfo >/dev/null 2>&1; then break; fi
    sleep 0.2
done
echo "[start] Xvfb ready"

# 3. XFCE Desktop
echo "[start] Starting XFCE desktop..."
DISPLAY=:1 dbus-run-session startxfce4 > "$LOG_DIR/xfce.log" 2>&1 &
echo $! > /tmp/xfce.pid
sleep 5

# 4. x11vnc on port 5902 with password authentication
echo "[start] Starting x11vnc..."
x11vnc -display :1 -rfbport 5902 -rfbauth /home/ubuntu/.vnc/passwd -forever -shared \
    -noxdamage -nowf -wait 10 -defer 5 -localhost -bg -o "$LOG_DIR/x11vnc.log" &
echo $! > /tmp/vnc.pid
sleep 1

# 5. websockify on 6900 -> 5902
echo "[start] Starting websockify..."
python3 -m websockify --heartbeat 30 6900 127.0.0.1:5902 > "$LOG_DIR/websockify.log" 2>&1 &
echo $! > /tmp/websock.pid
sleep 1

# 6. novnc-audio-server on 6090
echo "[start] Starting noVNC audio server..."
cd /home/ubuntu/apps/novnc-audio-server
node dist/main.js --port 6090 --device virtual_speaker --latency 20000 --bitrate 64000 > "$LOG_DIR/audio-server.log" 2>&1 &
echo $! > /tmp/audio.pid
sleep 2

# 7. Reload nginx
sudo service nginx reload || sudo service nginx restart

# 8. Cloudflare Tunnel
echo "[start] Starting Cloudflare Tunnel..."
cloudflared tunnel --url http://127.0.0.1:8080 --no-autoupdate > "$LOG_DIR/cloudflared.log" 2>&1 &
echo $! > /tmp/cf.pid
CF_URL=""
for i in $(seq 1 60); do
    URL=$(grep -oE "https://[a-zA-Z0-9.-]+\.trycloudflare\.com" "$LOG_DIR/cloudflared.log" 2>/dev/null | head -1)
    if [ -n "$URL" ]; then
        CF_URL="$URL"
        break
    fi
    sleep 1
done

echo "======================================================"
echo "  VIRTUAL COMPUTER READY"
echo "  Tunnel URL:       $CF_URL"
echo "  Direct backup:    https://8080-i1ctti6i8s5dtgpj8rn10-9ac9db38.us5.manus.computer/"
echo "  Web login (HTTP): admin / Novnc990"
echo "  VNC password:     Novnc990"
echo "======================================================"

# Keep alive
while true; do
    sleep 10
done
