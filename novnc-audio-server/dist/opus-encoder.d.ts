import type { OpusEncoderConfig } from "./types.js";
export declare class OpusEncoder {
    private config;
    private encoder;
    private useNativeOpus;
    private buffer;
    private readonly frameByteSize;
    constructor(config: OpusEncoderConfig);
    private initialize;
    encode(pcmBuffer: Buffer): Buffer;
    isNativeOpus(): boolean;
    getConfig(): Readonly<OpusEncoderConfig>;
    destroy(): void;
}
