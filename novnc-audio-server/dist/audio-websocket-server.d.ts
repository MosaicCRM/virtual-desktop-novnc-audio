import { EventEmitter } from "node:events";
import type { WebSocketServerConfig, WebSocketServerEvents, AudioFrame } from "./types.js";
export declare class AudioWebSocketServer extends EventEmitter<WebSocketServerEvents> {
    private config;
    private wss;
    private clients;
    private nextClientId;
    private isRunning;
    constructor(config: WebSocketServerConfig);
    start(): void;
    stop(): Promise<void>;
    broadcast(frame: AudioFrame): void;
    getClientCount(): number;
    getClientIds(): string[];
    getIsRunning(): boolean;
    getConfig(): Readonly<WebSocketServerConfig>;
}
