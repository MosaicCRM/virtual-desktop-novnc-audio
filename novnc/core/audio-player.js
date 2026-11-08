/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2024 The noVNC authors
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * Audio player using Web Audio API
 */

import * as Log from './util/logging.js';

export default class AudioPlayer {
    constructor() {
        this._audioContext = null;
        this._gainNode = null;
        this._enabled = true;
        this._volume = 1.0;
        this._muted = false;

        // Playback queue
        this._queue = [];
        this._suspendedBuffer = [];
        this._isPlaying = false;
        this._nextPlayTime = 0;

        // Audio format
        this._sampleRate = 48000;
        this._channels = 2;

        // Statistics
        this._stats = {
            framesPlayed: 0,
            framesDropped: 0,
            underruns: 0,
            queueSize: 0
        };
    }

    get enabled() {
        return this._enabled;
    }

    set enabled(value) {
        const wasEnabled = this._enabled;
        this._enabled = value;

        if (!value && wasEnabled) {
            // Disabling audio
            this.stop();
            Log.Info('Audio playback stopped');
        } else if (value && !wasEnabled) {
            // Re-enabling audio
            Log.Info('Audio playback resumed');
        }
    }

    get volume() {
        return this._volume;
    }

    set volume(value) {
        this._volume = Math.max(0, Math.min(1, value));
        if (this._gainNode) {
            this._gainNode.gain.value = this._muted ? 0 : this._volume;
        }
    }

    get muted() {
        return this._muted;
    }

    set muted(value) {
        this._muted = value;
        if (this._gainNode) {
            this._gainNode.gain.value = value ? 0 : this._volume;
        }
    }

    get stats() {
        this._stats.queueSize = this._queue.length;
        return this._stats;
    }

    async init() {
        if (this._audioContext) {
            return;
        }

        try {
            // Create audio context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this._audioContext = new AudioContext({
                sampleRate: this._sampleRate,
                latencyHint: 'interactive' // Low latency
            });

            // Create gain node for volume control
            this._gainNode = this._audioContext.createGain();
            this._gainNode.gain.value = this._muted ? 0 : this._volume;
            this._gainNode.connect(this._audioContext.destination);

            Log.Info('Audio player initialized: ' +
                     `${this._audioContext.sampleRate}Hz, ` +
                     `${this._audioContext.state}`);

            // Resume context if suspended (required by browser autoplay policy)
            if (this._audioContext.state === 'suspended') {
                Log.Info('Audio requires user interaction to start (click or press any key)');
                const banner = document.getElementById('noVNC_audio_banner');
                if (banner) banner.classList.remove('noVNC_hidden');

                // Wait for ANY user interaction (capture phase, window+document) to resume AudioContext
                const resumeAudioContext = async () => {
                    try {
                        if (this._audioContext && this._audioContext.state !== 'running') {
                            await this._audioContext.resume();
                        }
                        if (this._audioContext && this._audioContext.state === 'running') {
                            Log.Info('Audio playback enabled');
                            const banner = document.getElementById('noVNC_audio_banner');
                            if (banner) banner.classList.add('noVNC_hidden');
                            cleanup();
                            // Flush any frames buffered while suspended
                            if (this._suspendedBuffer && this._suspendedBuffer.length > 0) {
                                while (this._suspendedBuffer.length > 0) {
                                    this._queue.push(this._suspendedBuffer.shift());
                                }
                                if (!this._isPlaying) {
                                    this._startPlayback();
                                }
                            }
                            // Silent kick buffer
                            try {
                                const b = this._audioContext.createBuffer(1, 1, 48000);
                                const s = this._audioContext.createBufferSource();
                                s.buffer = b; s.connect(this._audioContext.destination); s.start();
                            } catch (_) {}
                        }
                    } catch (err) {
                        Log.Warn('Could not resume AudioContext: ' + err);
                    }
                };
                const events = ['click', 'keydown', 'keyup', 'touchstart', 'touchend', 'pointerdown', 'mousedown', 'mouseup'];
                const opts = { capture: true, passive: true };
                const cleanup = () => {
                    events.forEach(e => {
                        window.removeEventListener(e, resumeAudioContext, opts);
                        document.removeEventListener(e, resumeAudioContext, opts);
                    });
                };
                events.forEach(e => {
                    window.addEventListener(e, resumeAudioContext, opts);
                    document.addEventListener(e, resumeAudioContext, opts);
                });
                resumeAudioContext();
                this._resumeHelper = resumeAudioContext;
            }

        } catch (err) {
            Log.Error('Failed to initialize audio player: ' + err);
            throw err;
        }
    }

    async enqueue(pcmData, timestamp) {
        if (!this._enabled || !this._audioContext) {
            return;
        }

        try {
            // Don't enqueue if audio context is suspended - buffer last 15 frames
            if (this._audioContext.state === 'suspended') {
                if (this._suspendedBuffer.length < 15) {
                    this._suspendedBuffer.push({ pcmData, timestamp });
                }
                return;
            }

            // Add to queue
            this._queue.push({
                pcmData: pcmData,
                timestamp: timestamp
            });

            // Start playback if not already playing
            if (!this._isPlaying) {
                this._startPlayback();
            }

        } catch (err) {
            Log.Error('Error enqueueing audio: ' + err);
        }
    }

    _startPlayback() {
        this._isPlaying = true;
        this._nextPlayTime = this._audioContext.currentTime;
        this._processQueue();
    }

    _processQueue() {
        if (!this._isPlaying || !this._enabled) {
            return;
        }

        const currentTime = this._audioContext.currentTime;

        // Clean up old items from queue
        while (this._queue.length > 20) {
            this._queue.shift();
            this._stats.framesDropped++;
        }

        // Process available frames
        while (this._queue.length > 0) {
            const item = this._queue.shift();

            try {
                // Check if we're falling behind
                if (this._nextPlayTime < currentTime) {
                    this._nextPlayTime = currentTime;
                    this._stats.underruns++;
                }

                // Play the audio frame
                this._playPCM(item.pcmData, this._nextPlayTime);
                this._stats.framesPlayed++;

                // Calculate next play time
                const duration = item.pcmData.length / this._channels / this._sampleRate;
                this._nextPlayTime += duration;

            } catch (err) {
                Log.Error('Error playing audio frame: ' + err);
            }
        }

        // Schedule next processing
        if (this._isPlaying) {
            setTimeout(() => this._processQueue(), 20); // Check every 20ms
        }
    }

    _playPCM(pcmData, startTime) {
        // Create audio buffer
        const buffer = this._audioContext.createBuffer(
            this._channels,
            pcmData.length / this._channels,
            this._sampleRate
        );

        // Fill buffer with PCM data
        // pcmData is already Float32Array normalized to [-1.0, 1.0] from decoder
        for (let channel = 0; channel < this._channels; channel++) {
            const channelData = buffer.getChannelData(channel);
            for (let i = 0; i < channelData.length; i++) {
                // De-interleave channels (L, R, L, R... -> L L L... and R R R...)
                channelData[i] = pcmData[i * this._channels + channel];
            }
        }

        // Create source and play
        const source = this._audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this._gainNode);
        source.start(startTime);
    }

    stop() {
        this._isPlaying = false;
        this._queue = [];
        this._nextPlayTime = 0;
    }

    async resume() {
        if (this._audioContext && this._audioContext.state === 'suspended') {
            try {
                await this._audioContext.resume();
                Log.Info('Audio context resumed');
            } catch (err) {
                Log.Error('Failed to resume audio context: ' + err);
            }
        }
    }

    close() {
        this.stop();

        if (this._audioContext) {
            this._audioContext.close();
            this._audioContext = null;
            this._gainNode = null;
        }
    }
}
