import * as Log from './util/logging.js';
import { getAsyncClipboardStatus } from './util/browser.js';

export default class AsyncClipboard {
    constructor(target) {
        this._target = target || null;

        this._isAvailable = null;
        this._lastClipboardText = ''; // Track last read text to avoid duplicates
        this._hasInitialRead = false; // Track if we've done initial clipboard read
        this._isGrabbed = false; // Track if already grabbed to avoid duplicate initialization

        this._eventHandlers = {
            'focus': this._handleFocus.bind(this),
            'paste': this._handlePaste.bind(this),
            'click': this._handleClick.bind(this),
            'keydown': this._handleKeydown.bind(this),
        };

        // ===== EVENT HANDLERS =====

        this.onpaste = () => {};
        this.onsendkeys = null; // Callback to send Ctrl+V keypress
    }

    // ===== PRIVATE METHODS =====

    async _ensureAvailable() {
        if (this._isAvailable !== null) return this._isAvailable;
        try {
            const status = await getAsyncClipboardStatus();
            this._isAvailable = (status === 'available');
            if (this._isAvailable) {
                Log.Info("Async clipboard is available");
            } else {
                Log.Warn("Async clipboard is not available: " + status);
            }
        } catch (error) {
            Log.Error("Failed to check clipboard availability: ", error);
            this._isAvailable = false;
        }
        return this._isAvailable;
    }

    async _readClipboard(forceUpdate = false) {
        if (!(await this._ensureAvailable())) return;

        try {
            const text = await navigator.clipboard.readText();

            if (!text) {
                return;
            }

            // Check if content has changed
            const hasChanged = text !== this._lastClipboardText;

            if (hasChanged || forceUpdate) {
                this._lastClipboardText = text;
                // Log.Debug("Clipboard read" + (forceUpdate ? " (forced)" : "") + ": " + text.substring(0, 40) + "...");

                // Call onpaste to send content to server
                this.onpaste(text);
            }
        } catch (error) {
            // Log detailed error for debugging
            if (error.name === 'NotAllowedError') {
                Log.Warn("Clipboard read permission denied (NotAllowedError)");
            } else {
                Log.Error("Clipboard read failed: " + error.name + " - " + error.message);
            }
        }
    }

    async _handleFocus(event) {
        // Read clipboard when focus is gained, in case content was copied while unfocused
        await this._readClipboard();
    }

    async _handlePaste(event) {
        // Prevent default paste behavior
        event.preventDefault();
        event.stopPropagation();

        // Try to read from clipboard API first
        await this._readClipboard();
    }

    async _handleClick(event) {
        // On first click after connection, try to read clipboard
        // This is a valid user gesture that allows clipboard access
        if (!this._hasInitialRead) {
            this._hasInitialRead = true;
            await this._readClipboard();
            Log.Info("Initial clipboard read attempted on first click");
        }
    }

    async _handleKeydown(event) {
        // Check for Ctrl+V (Windows/Linux) or Cmd+V (Mac) paste shortcut first
        const isCtrlV = (event.ctrlKey || event.metaKey) &&
                        event.key === 'v' &&
                        !event.shiftKey &&
                        !event.altKey;

        // On first keydown after connection, try to read clipboard
        // This is a valid user gesture that allows clipboard access
        if (!this._hasInitialRead) {
            this._hasInitialRead = true;
            // If it's Ctrl+V, we'll handle it below, otherwise just read
            if (!isCtrlV) {
                await this._readClipboard();
                Log.Info("Initial clipboard read attempted on first keypress");
            }
        }

        if (isCtrlV) {
            // Stop the event from reaching keyboard.js
            event.stopPropagation();
            event.stopImmediatePropagation();
            event.preventDefault();

            Log.Debug("Paste shortcut detected, handling clipboard paste");
            // Force update: even if content hasn't changed, user explicitly wants to paste
            await this._readClipboard(true);
            // Mark this as initial read if not done yet
            this._hasInitialRead = true;

            // After sending clipboard content, simulate the Ctrl+V keypress
            // This ensures clipboard content arrives at server before the keypress
            setTimeout(() => {
                if (this.onsendkeys) {
                    Log.Debug("Sending Ctrl+V keypress after clipboard sync");
                    this.onsendkeys();
                }
            }, 100);
        }
    }

    // ===== PUBLIC METHODS =====

    async writeClipboard(text) {
        // Ensure availability is checked before writing
        const isAvailable = await this._ensureAvailable();
        if (!isAvailable) return false;

        try {
            // Debug: show character codes
            // let charCodes = "";
            // for (let i = 0; i < Math.min(10, text.length); i++) {
                // charCodes += "U+" + text.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0') + " ";
            // }
            // Log.Debug("Writing clipboard chars: " + charCodes);
            // Log.Debug("Writing clipboard text: " + text.substring(0, 40) + "...");

            await navigator.clipboard.writeText(text);
            this._lastClipboardText = text; // Update last known text
            return true;
        } catch (error) {
            Log.Error("Clipboard write failed: ", error);
            return false;
        }
    }

    grab() {
        if (!this._target) return;
        if (this._isGrabbed) {
            return;
        }

        this._hasInitialRead = false; // Reset on grab
        this._isGrabbed = true;

        this._ensureAvailable()
            .then(async (isAvailable) => {
                if (isAvailable) {
                    this._target.addEventListener('focus', this._eventHandlers.focus);
                    this._target.addEventListener('paste', this._eventHandlers.paste);
                    this._target.addEventListener('click', this._eventHandlers.click);
                    // Use capture phase for keydown to handle it before keyboard.js
                    this._target.addEventListener('keydown', this._eventHandlers.keydown, true);
                    Log.Info("Async clipboard event listeners registered");

                    // Immediately read clipboard on connection so server has content ready
                    // This ensures the first Ctrl+V will work
                    await this._readClipboard();
                    Log.Info("Initial clipboard sync completed");
                }
            });
    }

    ungrab() {
        if (!this._target) return;
        this._target.removeEventListener('focus', this._eventHandlers.focus);
        this._target.removeEventListener('paste', this._eventHandlers.paste);
        this._target.removeEventListener('click', this._eventHandlers.click);
        // Remove with capture phase option
        this._target.removeEventListener('keydown', this._eventHandlers.keydown, true);
        this._isGrabbed = false;
    }
}
