import { AudioCapture } from "./audio-capture.js";
import { OpusEncoder } from "./opus-encoder.js";
import { AudioWebSocketServer } from "./audio-websocket-server.js";
import { AudioCodec } from "./types.js";
export class AudioServer {
    constructor(config) {
        this.startTime = null;
        this.frameCount = 0;
        this.isRunning = false;
        this.config = config;
        this.capture = new AudioCapture(config.capture);
        this.encoder = new OpusEncoder(config.encoder);
        this.wsServer = new AudioWebSocketServer(config.websocket);
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.capture.on("data", (buffer) => {
            this.handleAudioData(buffer);
        });
        this.capture.on("error", (error) => {
            console.error("Audio capture error:", error);
        });
        this.capture.on("close", () => {
            console.log("Audio capture closed");
        });
        this.wsServer.on("connection", (clientId) => {
            console.log(`✓ Client connected: ${clientId}`);
        });
        this.wsServer.on("disconnection", (clientId) => {
            console.log(`✗ Client disconnected: ${clientId}`);
        });
        this.wsServer.on("error", (error) => {
            console.error("WebSocket server error:", error);
        });
    }
    handleAudioData(pcmBuffer) {
        if (!this.isRunning || !this.startTime) {
            return;
        }
        try {
            const encodedData = this.config.codec === AudioCodec.PCM
                ? pcmBuffer
                : this.encoder.encode(pcmBuffer);
            if (encodedData.length === 0) {
                return;
            }
            const now = process.hrtime.bigint();
            const elapsedMs = (now - this.startTime) / 1000000n;
            const actualCodec = (this.config.codec === AudioCodec.OPUS && this.encoder.isNativeOpus())
                ? AudioCodec.OPUS
                : AudioCodec.PCM;
            const frame = {
                timestamp: elapsedMs,
                codec: actualCodec,
                data: encodedData,
            };
            this.wsServer.broadcast(frame);
            this.frameCount++;
            if (this.frameCount % 1000 === 0) {
                const clients = this.wsServer.getClientCount();
                const encodedSize = encodedData.length;
                const pcmSize = pcmBuffer.length;
                const compressionRatio = pcmSize > 0 ? (pcmSize / encodedSize).toFixed(2) : "N/A";
                console.log(`Stats: ${this.frameCount} frames, ${clients} clients, compression: ${compressionRatio}x`);
            }
        }
        catch (error) {
            console.error("Error processing audio frame:", error);
        }
    }
    async start() {
        if (this.isRunning) {
            console.warn("AudioServer is already running");
            return;
        }
        console.log("Starting noVNC Audio Server...");
        const actualCodec = this.encoder.isNativeOpus()
            ? (this.config.codec === 0x01 ? "Opus" : "PCM")
            : "PCM (passthrough)";
        console.log("Configuration:", {
            device: this.config.capture.device,
            sampleRate: this.config.capture.sampleRate,
            channels: this.config.capture.channels,
            codec: actualCodec,
            port: this.config.websocket.port,
            path: this.config.websocket.path,
        });
        this.wsServer.start();
        await new Promise((resolve) => setTimeout(resolve, 100));
        this.startTime = process.hrtime.bigint();
        this.capture.start();
        this.isRunning = true;
        console.log("✓ Audio server started successfully");
        console.log(`Listening on ws://${this.config.websocket.host}:${this.config.websocket.port}${this.config.websocket.path}`);
    }
    async stop() {
        if (!this.isRunning) {
            return;
        }
        console.log("Stopping audio server...");
        this.isRunning = false;
        this.capture.stop();
        await this.wsServer.stop();
        this.encoder.destroy();
        console.log("✓ Audio server stopped");
    }
    getStats() {
        return {
            isRunning: this.isRunning,
            frameCount: this.frameCount,
            clientCount: this.wsServer.getClientCount(),
            uptime: this.startTime ? Number((process.hrtime.bigint() - this.startTime) / 1000000n) : 0,
            codec: this.config.codec === 0x01 ? "Opus" : "PCM",
            useNativeOpus: this.encoder.isNativeOpus(),
        };
    }
}
export * from "./types.js";
export { AudioCapture } from "./audio-capture.js";
export { OpusEncoder } from "./opus-encoder.js";
export { AudioWebSocketServer } from "./audio-websocket-server.js";
//# sourceMappingURL=index.js.map