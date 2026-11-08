/*
 * Audio decoder supporting multiple codecs
 */

import * as Log from './util/logging.js';

// Audio codec types
export const AudioCodec = {
    PCM_S16LE: 0x00,  // Raw PCM 16-bit little-endian
    OPUS: 0x01,       // Opus codec
    AAC: 0x02,        // AAC codec (future)
    MP3: 0x03         // MP3 codec (future)
};

// Local bundle first, CDN fallback
const OPUS_DECODER_CDN_URLS = [
    './vendor/opus-decoder/opus-decoder.esm.js',
    'https://cdn.jsdelivr.net/npm/opus-decoder@0.7.10/+esm',
    'https://esm.sh/opus-decoder@0.7.10'
];

export default class AudioDecoder {
    constructor() {
        this._opusDecoder = null;
        this._opusDecoderReady = false;
        this._opusWarnLogged = false; // Prevent spam logs
        this._opusFirstPacketLogged = false; // Debug flag
        this._useOpusPCMFallback = false; // Auto-fallback for passthrough mode
        this._opusFallbackEnabled = false; // Log flag
        this._sampleRate = 48000;
        this._channels = 2;
    }

    async init() {
        Log.Info('Initializing audio decoder...');

        // Try to load Opus decoder from CDN
        for (const cdnUrl of OPUS_DECODER_CDN_URLS) {
            try {
                const module = await import(/* @vite-ignore */ cdnUrl);

                if (module.OpusDecoder) {
                    this._opusDecoder = new module.OpusDecoder({
                        sampleRate: this._sampleRate,
                        channels: this._channels,
                    });

                    await this._opusDecoder.ready;

                    const hasDecodeFrame = typeof this._opusDecoder.decodeFrame === 'function';
                    const hasDecodeFrames = typeof this._opusDecoder.decodeFrames === 'function';
                    const hasDecode = typeof this._opusDecoder.decode === 'function';

                    if (hasDecodeFrame || hasDecodeFrames || hasDecode) {
                        this._opusDecoderReady = true;
                        Log.Info(`Opus decoder ready (${this._sampleRate}Hz, ${this._channels}ch)`);
                        return;
                    }
                    this._opusDecoder = null;
                }
            } catch (err) {
                // Try next CDN
            }
        }

        // Fallback to PCM-only mode
        Log.Warn('Opus decoder unavailable, using PCM only');
    }

    /**
     * Decode audio data based on codec type
     * @param {Uint8Array} data - Encoded audio data
     * @param {number} codec - Codec type (AudioCodec enum)
     * @returns {Float32Array} Decoded PCM data
     */
    decode(data, codec) {
        switch (codec) {
            case AudioCodec.PCM_S16LE:
                return this._decodePCM(data);

            case AudioCodec.OPUS:
                return this._decodeOpus(data);

            case AudioCodec.AAC:
            case AudioCodec.MP3:
                Log.Warn(`Codec ${codec} not yet supported`);
                return new Float32Array(0);

            default:
                Log.Error(`Unknown codec: ${codec}`);
                return new Float32Array(0);
        }
    }

    /**
     * Decode raw PCM S16LE data
     * @param {Uint8Array} data - Raw PCM data
     * @returns {Float32Array} Decoded PCM data
     */
    _decodePCM(data) {
        // Convert Uint8Array to Int16Array (little-endian) — slice to guarantee even byte offset
        const int16Array = new Int16Array(data.slice().buffer, 0, Math.floor(data.length / 2));

        // Convert Int16 to Float32
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
            // Normalize to [-1.0, 1.0]
            float32Array[i] = int16Array[i] / 32768.0;
        }

        return float32Array;
    }

    /**
     * Decode Opus data
     * @param {Uint8Array} data - Opus encoded data
     * @returns {Float32Array} Decoded PCM data
     */
    _decodeOpus(data) {
        // If server is in passthrough mode, it might send PCM with Opus codec flag
        // Check if we should use PCM fallback
        if (this._useOpusPCMFallback) {
            return this._decodePCM(data);
        }

        if (!this._opusDecoderReady || !this._opusDecoder) {
            // Only log once to avoid spamming console
            if (!this._opusWarnLogged) {
                Log.Error('Opus decoder not available. Check network connection to CDN.');
                Log.Info('Fallback: Configure audio server to use PCM codec (--codec PCM)');
                this._opusWarnLogged = true;
            }
            return new Float32Array(0);
        }


        try {
            // Try different decode methods (opus-decoder API variations)
            let decoded = null;

            if (typeof this._opusDecoder.decodeFrame === 'function') {
                // opus-decoder v0.7.x uses decodeFrame()
                decoded = this._opusDecoder.decodeFrame(data);
            } else if (typeof this._opusDecoder.decodeFrames === 'function') {
                // Some versions use decodeFrames()
                decoded = this._opusDecoder.decodeFrames([data]);
            } else if (typeof this._opusDecoder.decode === 'function') {
                // Fallback to decode()
                decoded = this._opusDecoder.decode(data);
            } else {
                Log.Error('No suitable decode method found on Opus decoder');
                return new Float32Array(0);
            }

            // Handle different return value formats
            if (!decoded) {
                Log.Error('Opus decode returned null/undefined');
                return new Float32Array(0);
            }

            // Format 1: { channelData: Float32Array[], samplesDecoded: number }
            if (decoded.channelData && Array.isArray(decoded.channelData)) {
                const channels = decoded.channelData;
                const samplesPerChannel = channels[0].length;

                // Interleave channels into a single Float32Array
                // Format: [L, R, L, R, ...] for stereo
                const pcmData = new Float32Array(samplesPerChannel * channels.length);

                for (let i = 0; i < samplesPerChannel; i++) {
                    for (let ch = 0; ch < channels.length; ch++) {
                        pcmData[i * channels.length + ch] = channels[ch][i];
                    }
                }

                return pcmData;
            }

            // Format 2: Direct Float32Array (already interleaved)
            if (decoded instanceof Float32Array) {
                return decoded;
            }

            // Format 3: Array of Float32Array (non-interleaved channels)
            if (Array.isArray(decoded)) {
                const channels = decoded;
                const samplesPerChannel = channels[0].length;
                const pcmData = new Float32Array(samplesPerChannel * channels.length);

                for (let i = 0; i < samplesPerChannel; i++) {
                    for (let ch = 0; ch < channels.length; ch++) {
                        pcmData[i * channels.length + ch] = channels[ch][i];
                    }
                }

                return pcmData;
            }

            Log.Error('Opus decode returned unknown format:', typeof decoded);
            return new Float32Array(0);
        } catch (err) {
            // Check if this is an Opus decode error (invalid packet or memory access)
            // These errors indicate the data is not valid Opus (likely PCM passthrough)
            const isOpusError = err.message && (
                err.message.includes('OPUS_INVALID_PACKET') ||
                err.message.includes('OPUS_') ||
                err.message.includes('libopus') ||
                err.message.includes('memory access out of bounds')
            );

            if (isOpusError) {
                // Only log once and enable PCM fallback
                if (!this._opusFallbackEnabled) {
                    Log.Info('Server using Opus passthrough mode, switching to PCM decoding');
                    this._useOpusPCMFallback = true;
                    this._opusFallbackEnabled = true;
                }
                return this._decodePCM(data);
            }

            Log.Error('Opus decode error: ' + err.message);
            return new Float32Array(0);
        }
    }

    /**
     * Decode Opus using Web Audio API's native decoder (if available)
     * This is an alternative method for browsers with native Opus support
     */
    async _decodeOpusNative(data, audioContext) {
        try {
            // Create an Opus audio file header (simplified)
            // In practice, you'd need a proper Ogg container
            const audioBuffer = await audioContext.decodeAudioData(data.buffer);

            // Extract PCM data
            const pcmData = new Float32Array(
                audioBuffer.length * audioBuffer.numberOfChannels
            );

            for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
                const channelData = audioBuffer.getChannelData(ch);
                for (let i = 0; i < channelData.length; i++) {
                    pcmData[i * audioBuffer.numberOfChannels + ch] = channelData[i];
                }
            }

            return pcmData;
        } catch (err) {
            Log.Error('Native Opus decode error: ' + err);
            return new Float32Array(0);
        }
    }
}
