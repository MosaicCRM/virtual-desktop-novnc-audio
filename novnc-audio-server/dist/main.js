#!/usr/bin/env node
import { Command } from "commander";
import { AudioServer, AudioCodec } from "./index.js";
import { AudioCapture } from "./audio-capture.js";
const program = new Command();
program.name("novnc-audio").description("Standalone audio server for noVNC").version("0.8.0");
program
    .option("-p, --port <port>", "WebSocket port", "6090")
    .option("-H, --host <host>", "Host to bind to", "0.0.0.0")
    .option("--path <path>", "WebSocket path", "/audio")
    .option("-d, --device <device>", "PulseAudio device name", "default")
    .option("-r, --sample-rate <rate>", "Audio sample rate (Hz)", "48000")
    .option("-c, --channels <channels>", "Audio channels (1=mono, 2=stereo)", "2")
    .option("-b, --bitrate <bitrate>", "Opus bitrate (bps)", "64000")
    .option("-l, --latency <latency>", "Capture latency (microseconds)", "20000")
    .option("--no-monitor", "Do not append .monitor to device name")
    .option("--codec <codec>", "Audio codec (opus or pcm)", "opus")
    .action(async (options) => {
    try {
        AudioCapture.checkAvailability();
    }
    catch (error) {
        console.error("\n❌ System Requirements Not Met\n");
        if (error instanceof Error) {
            console.error(error.message);
        }
        console.error("\nExiting...\n");
        process.exit(1);
    }
    const port = parseInt(options.port, 10);
    const sampleRate = parseInt(options.sampleRate, 10);
    const channels = parseInt(options.channels, 10);
    const bitrate = parseInt(options.bitrate, 10);
    const latency = parseInt(options.latency, 10);
    const useMonitor = options.monitor !== false;
    if (isNaN(port) || port < 1 || port > 65535) {
        console.error("Error: Invalid port number");
        process.exit(1);
    }
    if (![8000, 12000, 16000, 24000, 48000].includes(sampleRate)) {
        console.error("Error: Sample rate must be 8000, 12000, 16000, 24000, or 48000");
        process.exit(1);
    }
    if (channels !== 1 && channels !== 2) {
        console.error("Error: Channels must be 1 or 2");
        process.exit(1);
    }
    const codec = options.codec.toLowerCase() === "opus" ? AudioCodec.OPUS : AudioCodec.PCM;
    const frameSize = (sampleRate * 20) / 1000;
    const config = {
        capture: {
            device: options.device,
            sampleRate,
            channels,
            format: "s16le",
            latency,
            useMonitor,
        },
        encoder: {
            sampleRate,
            channels,
            bitrate,
            frameSize,
        },
        websocket: {
            port,
            path: options.path,
            host: options.host,
        },
        codec,
    };
    const server = new AudioServer(config);
    const shutdown = async () => {
        console.log("\nReceived shutdown signal...");
        try {
            await server.stop();
            process.exit(0);
        }
        catch (error) {
            console.error("Error during shutdown:", error);
            process.exit(1);
        }
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    try {
        await server.start();
        setInterval(() => {
            const stats = server.getStats();
            console.log(`[Stats] Uptime: ${Math.floor(stats.uptime / 1000)}s, Frames: ${stats.frameCount}, Clients: ${stats.clientCount}, Codec: ${stats.codec}${stats.useNativeOpus ? " (native)" : " (passthrough)"}`);
        }, 30000);
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
});
program.parse();
//# sourceMappingURL=main.js.map