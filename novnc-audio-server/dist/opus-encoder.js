import DiscordOpus from "@discordjs/opus";
export class OpusEncoder {
    constructor(config) {
        this.encoder = null;
        this.useNativeOpus = false;
        this.buffer = Buffer.alloc(0);
        this.config = config;
        this.frameByteSize = config.frameSize * config.channels * 2;
        this.initialize();
    }
    initialize() {
        try {
            const { OpusEncoder: DiscordOpusEncoder } = DiscordOpus;
            this.encoder = new DiscordOpusEncoder(this.config.sampleRate, this.config.channels);
            this.encoder.setBitrate(this.config.bitrate);
            this.useNativeOpus = true;
            console.log("✓ Using @discordjs/opus encoder");
        }
        catch (error) {
            console.error("✗ Failed to initialize @discordjs/opus:", error);
            console.warn("⚠ Falling back to passthrough mode (PCM).");
            console.warn("  For production use, ensure @discordjs/opus is properly installed.");
            this.useNativeOpus = false;
        }
    }
    encode(pcmBuffer) {
        if (!this.useNativeOpus || !this.encoder) {
            return pcmBuffer;
        }
        try {
            this.buffer = Buffer.concat([this.buffer, pcmBuffer]);
            const encodedFrames = [];
            while (this.buffer.length >= this.frameByteSize) {
                const frame = this.buffer.subarray(0, this.frameByteSize);
                const encoded = this.encoder.encode(frame, this.config.frameSize);
                encodedFrames.push(Buffer.from(encoded));
                this.buffer = this.buffer.subarray(this.frameByteSize);
            }
            return encodedFrames.length > 0 ? Buffer.concat(encodedFrames) : Buffer.alloc(0);
        }
        catch (error) {
            console.error("Opus encoding error:", error);
            this.buffer = Buffer.alloc(0);
            return Buffer.alloc(0);
        }
    }
    isNativeOpus() {
        return this.useNativeOpus;
    }
    getConfig() {
        return { ...this.config };
    }
    destroy() {
        if (this.encoder && typeof this.encoder.destroy === "function") {
            this.encoder.destroy();
        }
        this.encoder = null;
    }
}
//# sourceMappingURL=opus-encoder.js.map