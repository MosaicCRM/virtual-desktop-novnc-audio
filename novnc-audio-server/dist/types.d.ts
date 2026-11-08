export interface AudioFrame {
    timestamp: bigint;
    codec: AudioCodec;
    data: Buffer;
}
export declare enum AudioCodec {
    PCM = 0,
    OPUS = 1
}
export interface AudioCaptureConfig {
    device: string;
    sampleRate: number;
    channels: number;
    format: string;
    latency: number;
    useMonitor: boolean;
}
export interface OpusEncoderConfig {
    sampleRate: number;
    channels: number;
    bitrate: number;
    frameSize: number;
}
export interface WebSocketServerConfig {
    port: number;
    path: string;
    host: string;
}
export interface AudioServerConfig {
    capture: AudioCaptureConfig;
    encoder: OpusEncoderConfig;
    websocket: WebSocketServerConfig;
    codec: AudioCodec;
}
export interface AudioCaptureEvents {
    data: [buffer: Buffer];
    error: [error: Error];
    close: [];
}
export interface WebSocketServerEvents {
    connection: [clientId: string];
    disconnection: [clientId: string];
    error: [error: Error];
}
