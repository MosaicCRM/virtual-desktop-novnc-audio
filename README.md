# Virtual Desktop with noVNC + PulseAudio Live Audio

A complete self-hosted browser-accessible virtual desktop based on Ubuntu + XFCE, featuring:
- **noVNC** web client with the audio controls right in the sliding sidebar (volume slider, mute/unmute, live connection status, "Click to Hear Audio" button)
- **PulseAudio low-latency audio capture** (~20 ms) streamed over WebSocket alongside the VNC feed, using zero-dependency PCM (100% browser-compatible) with Opus decoder support
- **Google Chrome** pre-installed with a welcome audio test page
- **x11vnc** with password authentication (`Novnc990`)
- **Nginx** reverse-proxy unifying VNC (`/ws`) and Audio (`/audio`) on a single port
- **Cloudflare Tunnel** for encrypted global HTTPS access
- **supervisord** managing all 7 services with automatic restart

## Access

- Direct auto-login URL: `https://fixes-they-voices-chronicle.trycloudflare.com/?autoconnect=true&password=Novnc990&resize=scale`
- Password: `Novnc990`

## Architecture

```
Display: Xvfb :1 (1600x900) -> x11vnc (5902) -> websockify (6900) \
Audio:   parec monitor      -> novnc-audio-server (6090)     ---> Nginx (8080) -> Cloudflare Tunnel -> Browser
GUI:     XFCE4 + Google Chrome
```

## License

MPL-2.0 / MIT (see components).
