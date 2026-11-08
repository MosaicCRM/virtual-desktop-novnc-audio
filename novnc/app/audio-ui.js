/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2024 The noVNC authors
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * Audio UI controls
 */

import * as Log from '../core/util/logging.js';

const AudioUI = {
    rfb: null,

    init(rfb) {
        Log.Debug(">> AudioUI.init");

        this.rfb = rfb;

        // Get UI elements
        this.audioButton = document.getElementById('noVNC_audio_button');
        this.audioPanel = document.getElementById('noVNC_audio_panel');
        this.audioEnabledCheckbox = document.getElementById('noVNC_setting_audio_enabled');
        this.audioVolumeSlider = document.getElementById('noVNC_setting_audio_volume');
        this.audioMuteButton = document.getElementById('noVNC_audio_mute_button');
        this.audioStatusIndicator = document.getElementById('noVNC_audio_status');
        this.resumeButton = document.getElementById('noVNC_audio_resume_button');

        // Setup event listeners
        if (this.audioButton) {
            this.audioButton.addEventListener('click', () => { this.togglePanel(); this.resumeAudio(); });
        }
        if (this.audioPanel) {
            this.audioPanel.addEventListener('click', () => this.resumeAudio(), { passive: true });
        }

        if (this.audioEnabledCheckbox) {
            this.audioEnabledCheckbox.addEventListener('change', this.handleEnabledChange.bind(this));
        }

        if (this.audioVolumeSlider) {
            this.audioVolumeSlider.addEventListener('input', this.handleVolumeChange.bind(this));
        }

        if (this.audioMuteButton) {
            this.audioMuteButton.addEventListener('click', this.toggleMute.bind(this));
        }
        if (this.resumeButton) {
            this.resumeButton.addEventListener('click', this.resumeAudio.bind(this));
        }

        // Listen to RFB audio events
        rfb.addEventListener('audioconnected', this.handleAudioConnected.bind(this));
        rfb.addEventListener('audiodisconnected', this.handleAudioDisconnected.bind(this));
        rfb.addEventListener('audioerror', this.handleAudioError.bind(this));

        // Initialize UI state
        this.updateUI();
        if (rfb.audioEnabled) {
            this.handleAudioConnected({ detail: {} });
        }
        window.AudioUI = AudioUI;

        Log.Debug("<< AudioUI.init");
    },

    togglePanel() {
        if (!this.audioPanel) return;

        if (this.audioPanel.classList.contains('noVNC_open')) {
            this.audioPanel.classList.remove('noVNC_open');
        } else {
            this.audioPanel.classList.add('noVNC_open');
        }
    },

    handleEnabledChange(e) {
        const enabled = e.target.checked;

        if (enabled) {
            this.rfb.enableAudio();
        } else {
            this.rfb.disableAudio();
        }

        this.updateUI();
    },

    handleVolumeChange(e) {
        const volume = parseFloat(e.target.value) / 100;
        this.rfb.setAudioVolume(volume);

        // Update volume display
        const volumeValue = document.getElementById('noVNC_audio_volume_value');
        if (volumeValue) {
            volumeValue.textContent = e.target.value + '%';
        }
    },

    toggleMute() {
        if (!this.rfb) return;

        const isMuted = this.audioMuteButton.dataset.muted === 'true';
        this.rfb.setAudioMuted(!isMuted);

        // Update button state
        this.audioMuteButton.dataset.muted = !isMuted;

        if (!isMuted) {
            this.audioMuteButton.src = 'app/images/audio-muted.svg';
            this.audioMuteButton.title = 'Unmute';
        } else {
            this.audioMuteButton.src = 'app/images/audio.svg';
            this.audioMuteButton.title = 'Mute';
        }
    },

    async resumeAudio() {
        try {
            const pc = this.rfb?._audioPlayer?._audioContext;
            if (pc && pc.state !== 'running') {
                await pc.resume();
            }
            if (this.rfb && !this.rfb._audioEnabled) {
                this.rfb.enableAudio();
            }
            if (this.resumeButton) {
                this.resumeButton.textContent = (pc && pc.state === 'running') ? '\u2714 Audio Active' : '\u25B6 Click to Hear Audio';
            }
            this.updateUI();
        } catch (e) {
            Log.Warn('resumeAudio: ' + e);
        }
    },

    handleAudioConnected(e) {
        Log.Info("Audio UI: connected");
        this.updateStatus('connected', 'Audio connected');
        this.updateUI();
    },

    handleAudioDisconnected(e) {
        Log.Info("Audio UI: disconnected");
        this.updateStatus('disconnected', 'Audio disconnected');
        this.updateUI();
    },

    handleAudioError(e) {
        Log.Warn("Audio UI: error - " + e.detail.error);
        this.updateStatus('error', 'Audio error');
    },

    updateStatus(state, message) {
        if (!this.audioStatusIndicator) return;

        this.audioStatusIndicator.textContent = message;
        this.audioStatusIndicator.className = 'noVNC_audio_status_' + state;
    },

    updateUI() {
        if (!this.rfb) return;

        const audioSupported = this.rfb.audioEnabled;

        // Always show the audio button in the sidebar (never hide)
        if (this.audioButton) {
            this.audioButton.classList.remove('noVNC_hidden');
            this.audioButton.title = audioSupported ? 'Audio controls' : 'Audio controls (connecting...)';
        }

        // Update checkbox
        if (this.audioEnabledCheckbox) {
            this.audioEnabledCheckbox.checked = audioSupported;
        }
    },

    cleanup() {
        // Remove event listeners
        if (this.audioButton) {
            this.audioButton.removeEventListener('click', this.togglePanel);
        }

        if (this.audioEnabledCheckbox) {
            this.audioEnabledCheckbox.removeEventListener('change', this.handleEnabledChange);
        }

        if (this.audioVolumeSlider) {
            this.audioVolumeSlider.removeEventListener('input', this.handleVolumeChange);
        }

        if (this.audioMuteButton) {
            this.audioMuteButton.removeEventListener('click', this.toggleMute);
        }

        this.rfb = null;
    }
};

export default AudioUI;
