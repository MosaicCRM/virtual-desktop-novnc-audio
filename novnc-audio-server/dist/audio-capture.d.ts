import { EventEmitter } from "node:events";
import type { AudioCaptureConfig, AudioCaptureEvents } from "./types.js";
export declare class AudioCapture extends EventEmitter<AudioCaptureEvents> {
    private config;
    private process;
    private isRunning;
    constructor(config: AudioCaptureConfig);
    static isAvailable(): boolean;
    static checkAvailability(): void;
    start(): void;
    stop(): void;
    getIsRunning(): boolean;
    getConfig(): Readonly<AudioCaptureConfig>;
}
