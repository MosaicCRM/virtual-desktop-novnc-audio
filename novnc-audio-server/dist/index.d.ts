import type { AudioServerConfig } from "./types.js";
export declare class AudioServer {
    private config;
    private capture;
    private encoder;
    private wsServer;
    private startTime;
    private frameCount;
    private isRunning;
    constructor(config: AudioServerConfig);
    private setupEventHandlers;
    private handleAudioData;
    start(): Promise<void>;
    stop(): Promise<void>;
    getStats(): {
        isRunning: boolean;
        frameCount: number;
        clientCount: number;
        uptime: number;
        codec: string;
        useNativeOpus: boolean;
    };
}
export * from "./types.js";
export { AudioCapture } from "./audio-capture.js";
export { OpusEncoder } from "./opus-encoder.js";
export { AudioWebSocketServer } from "./audio-websocket-server.js";
