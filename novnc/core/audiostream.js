/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2024 The noVNC authors
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * Audio WebSocket stream handler
 */

import * as Log from './util/logging.js';
import EventTargetMixin from './util/eventtarget.js';

export default class AudioStream extends EventTargetMixin {
    constructor(url) {
        super();
        
        this._url = url;
        this._ws = null;
        this._connected = false;
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 5;
        this._reconnectDelay = 1000; // ms
        this._reconnectTimer = null;
        
        // Statistics
        this._stats = {
            packetsReceived: 0,
            bytesReceived: 0,
            lastPacketTime: 0,
            connectionStartTime: 0
        };
    }
    
    get connected() {
        return this._connected;
    }
    
    get stats() {
        return this._stats;
    }
    
    connect() {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            Log.Warn('Audio stream already connected');
            return;
        }
        
        Log.Info(`Connecting to audio stream: ${this._url}`);
        
        try {
            this._ws = new WebSocket(this._url);
            this._ws.binaryType = 'arraybuffer';
            
            this._ws.onopen = this._onOpen.bind(this);
            this._ws.onmessage = this._onMessage.bind(this);
            this._ws.onerror = this._onError.bind(this);
            this._ws.onclose = this._onClose.bind(this);
        } catch (err) {
            Log.Error('Failed to create audio WebSocket: ' + err);
            this._handleConnectionError(err);
        }
    }
    
    disconnect() {
        Log.Info('Disconnecting audio stream');
        
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
        
        if (this._ws) {
            this._ws.onopen = null;
            this._ws.onmessage = null;
            this._ws.onerror = null;
            this._ws.onclose = null;
            
            if (this._ws.readyState === WebSocket.OPEN ||
                this._ws.readyState === WebSocket.CONNECTING) {
                this._ws.close();
            }
            
            this._ws = null;
        }
        
        this._connected = false;
    }
    
    _onOpen() {
        Log.Info('Audio stream connected');
        this._connected = true;
        this._reconnectAttempts = 0;
        this._stats.connectionStartTime = Date.now();
        
        this.dispatchEvent(new CustomEvent('connected', {
            detail: { url: this._url }
        }));
    }
    
    _onMessage(event) {
        if (!this._connected) return;
        
        try {
            const data = new Uint8Array(event.data);
            
            // Update statistics
            this._stats.packetsReceived++;
            this._stats.bytesReceived += data.length;
            this._stats.lastPacketTime = Date.now();
            
            // Parse audio frame: [timestamp(8)][codec(1)][data]
            if (data.length < 9) {
                Log.Warn('Audio packet too small: ' + data.length);
                return;
            }
            
            const timestamp = this._parseTimestamp(data.subarray(0, 8));
            const codec = data[8];
            const audioData = data.subarray(9);
            
            // Dispatch audio frame event
            this.dispatchEvent(new CustomEvent('audioframe', {
                detail: {
                    timestamp: timestamp,
                    codec: codec,
                    data: audioData
                }
            }));
            
        } catch (err) {
            Log.Error('Error processing audio message: ' + err);
        }
    }
    
    _onError(event) {
        Log.Error('Audio WebSocket error: ' + event);
        this._handleConnectionError(event);
    }
    
    _onClose(event) {
        Log.Info(`Audio stream closed (code: ${event.code}, reason: ${event.reason})`);
        this._connected = false;
        
        this.dispatchEvent(new CustomEvent('disconnected', {
            detail: {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean
            }
        }));
        
        // Attempt reconnection if not a clean close
        if (!event.wasClean && this._reconnectAttempts < this._maxReconnectAttempts) {
            this._attemptReconnect();
        }
    }
    
    _handleConnectionError(error) {
        this.dispatchEvent(new CustomEvent('error', {
            detail: { error: error }
        }));
    }
    
    _attemptReconnect() {
        this._reconnectAttempts++;
        const delay = this._reconnectDelay * Math.pow(2, this._reconnectAttempts - 1);
        
        Log.Info(`Attempting audio reconnect ${this._reconnectAttempts}/${this._maxReconnectAttempts} in ${delay}ms`);
        
        this._reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }
    
    _parseTimestamp(bytes) {
        // Parse 8-byte timestamp (big-endian)
        const view = new DataView(bytes.buffer, bytes.byteOffset, 8);
        
        // JavaScript's Number can safely represent integers up to 2^53
        // For millisecond timestamps, this gives us ~285 million years
        const high = view.getUint32(0);
        const low = view.getUint32(4);
        
        return high * 0x100000000 + low;
    }
}



