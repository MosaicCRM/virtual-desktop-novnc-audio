import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { execSync } from "child_process";
export class AudioCapture extends EventEmitter {
    constructor(config) {
        super();
        this.process = null;
        this.isRunning = false;
        this.config = config;
    }
    static isAvailable() {
        try {
            execSync("command -v parec", { stdio: "ignore" });
            return true;
        }
        catch {
            return false;
        }
    }
    static checkAvailability() {
        if (!AudioCapture.isAvailable()) {
            const errorMessage = `PulseAudio is not installed or 'parec' command not found.

This audio server requires PulseAudio to capture system audio.

Installation instructions:

  Ubuntu/Debian:
    sudo apt-get update
    sudo apt-get install pulseaudio pulseaudio-utils

  Fedora/RHEL:
    sudo dnf install pulseaudio pulseaudio-utils

  Arch Linux:
    sudo pacman -S pulseaudio

Note: This server is designed for Linux environments with PulseAudio.
      macOS and Windows are not currently supported for audio capture.`;
            throw new Error(errorMessage);
        }
    }
    start() {
        if (this.isRunning) {
            console.warn("AudioCapture is already running");
            return;
        }
        const deviceName = this.config.useMonitor ? `${this.config.device}.monitor` : this.config.device;
        const args = [
            "--device",
            deviceName,
            "--format",
            this.config.format,
            "--rate",
            this.config.sampleRate.toString(),
            "--channels",
            this.config.channels.toString(),
            "--latency-msec",
            Math.floor(this.config.latency / 1000).toString(),
        ];
        console.log(`Starting audio capture: parec ${args.join(" ")}`);
        try {
            this.process = spawn("parec", args, {
                stdio: ["ignore", "pipe", "pipe"],
            });
            this.isRunning = true;
            this.process.stdout?.on("data", (chunk) => {
                this.emit("data", chunk);
            });
            this.process.stderr?.on("data", (chunk) => {
                const message = chunk.toString("utf-8").trim();
                if (message) {
                    console.error("[parec stderr]:", message);
                }
            });
            this.process.on("exit", (code, signal) => {
                this.isRunning = false;
                if (code !== 0 && code !== null) {
                    const error = new Error(`parec process exited with code ${code}${signal ? ` (signal: ${signal})` : ""}`);
                    this.emit("error", error);
                }
                this.emit("close");
            });
            this.process.on("error", (error) => {
                this.isRunning = false;
                this.emit("error", error);
            });
        }
        catch (error) {
            this.isRunning = false;
            this.emit("error", error instanceof Error ? error : new Error("Failed to start audio capture"));
        }
    }
    stop() {
        if (!this.isRunning || !this.process) {
            return;
        }
        console.log("Stopping audio capture...");
        this.process.stdout?.removeAllListeners();
        this.process.stderr?.removeAllListeners();
        this.process.removeAllListeners();
        this.process.kill("SIGTERM");
        this.process = null;
        this.isRunning = false;
    }
    getIsRunning() {
        return this.isRunning;
    }
    getConfig() {
        return { ...this.config };
    }
}
//# sourceMappingURL=audio-capture.js.map