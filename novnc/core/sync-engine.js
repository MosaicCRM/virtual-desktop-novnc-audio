/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2024 The noVNC authors
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * Audio-Video synchronization engine
 */

import * as Log from './util/logging.js';

export default class SyncEngine {
    constructor() {
        this._enabled = false;
        this._masterClock = 'video'; // 'video' or 'audio' or 'system'
        
        this._audioTimestamp = 0;
        this._videoTimestamp = 0;
        this._systemStartTime = Date.now();
        
        // Sync parameters
        this._tolerance = 40; // ms - acceptable drift
        this._maxDrift = 200; // ms - maximum drift before correction
        
        // Statistics
        this._stats = {
            totalDrift: 0,
            driftCount: 0,
            corrections: 0,
            avgDrift: 0
        };
        
        // Sync interval
        this._syncInterval = null;
        this._syncIntervalMs = 50; // Check every 50ms
    }
    
    get enabled() {
        return this._enabled;
    }
    
    set enabled(value) {
        this._enabled = value;
        
        if (value) {
            this._start();
        } else {
            this._stop();
        }
    }
    
    get stats() {
        return this._stats;
    }
    
    get currentDrift() {
        return this._audioTimestamp - this._videoTimestamp;
    }
    
    _start() {
        if (this._syncInterval) {
            return;
        }
        
        Log.Info('Starting audio-video sync engine');
        this._systemStartTime = Date.now();
        
        this._syncInterval = setInterval(() => {
            this._checkSync();
        }, this._syncIntervalMs);
    }
    
    _stop() {
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
            this._syncInterval = null;
            Log.Info('Stopped audio-video sync engine');
        }
    }
    
    updateAudioTimestamp(timestamp) {
        this._audioTimestamp = timestamp;
    }
    
    updateVideoTimestamp(timestamp) {
        this._videoTimestamp = timestamp;
    }
    
    _checkSync() {
        if (!this._enabled) {
            return;
        }
        
        const drift = this.currentDrift;
        
        // Update statistics
        this._stats.totalDrift += Math.abs(drift);
        this._stats.driftCount++;
        this._stats.avgDrift = this._stats.totalDrift / this._stats.driftCount;
        
        // Check if correction is needed
        if (Math.abs(drift) > this._tolerance) {
            Log.Debug(`Audio-Video drift: ${drift.toFixed(2)}ms`);
            
            if (Math.abs(drift) > this._maxDrift) {
                Log.Warn(`Large A/V drift detected: ${drift.toFixed(2)}ms, correcting...`);
                this._correctSync(drift);
                this._stats.corrections++;
            }
        }
    }
    
    _correctSync(drift) {
        // Emit sync correction event for audio/video players to handle
        // The specific correction strategy depends on the player implementation
        
        if (drift > 0) {
            // Audio is ahead of video
            Log.Debug('Audio ahead, suggesting skip frames');
            // Could emit event: { action: 'skip_audio_frames', amount: drift }
        } else {
            // Audio is behind video  
            Log.Debug('Audio behind, suggesting insert silence');
            // Could emit event: { action: 'insert_silence', amount: -drift }
        }
    }
    
    /**
     * Calculate expected timestamp based on system time
     * Useful when timestamps from server are not available
     */
    calculateExpectedTimestamp() {
        return Date.now() - this._systemStartTime;
    }
    
    /**
     * Reset sync engine
     */
    reset() {
        this._audioTimestamp = 0;
        this._videoTimestamp = 0;
        this._systemStartTime = Date.now();
        this._stats = {
            totalDrift: 0,
            driftCount: 0,
            corrections: 0,
            avgDrift: 0
        };
    }
}



