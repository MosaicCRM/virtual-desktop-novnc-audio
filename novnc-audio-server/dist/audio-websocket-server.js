import { EventEmitter } from "node:events";
import { WebSocketServer, WebSocket } from "ws";
export class AudioWebSocketServer extends EventEmitter {
    constructor(config) {
        super();
        this.wss = null;
        this.clients = new Map();
        this.nextClientId = 1;
        this.isRunning = false;
        this.config = config;
    }
    start() {
        if (this.isRunning) {
            console.warn("AudioWebSocketServer is already running");
            return;
        }
        this.wss = new WebSocketServer({
            host: this.config.host,
            port: this.config.port,
            path: this.config.path,
        });
        this.wss.on("connection", (ws, req) => {
            const clientId = `client-${this.nextClientId++}`;
            const clientInfo = {
                id: clientId,
                ws,
                connectedAt: new Date(),
            };
            this.clients.set(clientId, clientInfo);
            console.log(`Client connected: ${clientId} (${req.socket.remoteAddress}) - Total clients: ${this.clients.size}`);
            this.emit("connection", clientId);
            ws.on("close", () => {
                this.clients.delete(clientId);
                console.log(`Client disconnected: ${clientId} - Remaining clients: ${this.clients.size}`);
                this.emit("disconnection", clientId);
            });
            ws.on("error", (error) => {
                console.error(`Client ${clientId} error:`, error.message);
                this.clients.delete(clientId);
            });
            ws.on("message", (data) => {
                let dataBuffer;
                if (data instanceof Buffer) {
                    dataBuffer = data;
                }
                else if (data instanceof ArrayBuffer) {
                    dataBuffer = Buffer.from(new Uint8Array(data));
                }
                else if (Array.isArray(data)) {
                    dataBuffer = Buffer.concat(data);
                }
                else {
                    dataBuffer = Buffer.from(data);
                }
                console.log(`Received message from ${clientId}:`, dataBuffer.length, "bytes");
            });
        });
        this.wss.on("error", (error) => {
            console.error("WebSocket server error:", error);
            this.emit("error", error);
        });
        this.isRunning = true;
        console.log(`Audio WebSocket server listening on ${this.config.host}:${this.config.port}${this.config.path}`);
    }
    stop() {
        return new Promise((resolve, reject) => {
            if (!this.isRunning || !this.wss) {
                resolve();
                return;
            }
            console.log("Stopping WebSocket server...");
            for (const [clientId, client] of this.clients) {
                client.ws.close(1001, "Server shutting down");
                console.log(`Closed connection: ${clientId}`);
            }
            this.clients.clear();
            this.wss.close((err) => {
                if (err) {
                    reject(err);
                }
                else {
                    this.isRunning = false;
                    this.wss = null;
                    console.log("WebSocket server stopped");
                    resolve();
                }
            });
        });
    }
    broadcast(frame) {
        if (this.clients.size === 0) {
            return;
        }
        const timestampBuffer = Buffer.allocUnsafe(8);
        timestampBuffer.writeBigUInt64BE(frame.timestamp);
        const codecBuffer = Buffer.from([frame.codec]);
        const frameBuffer = Buffer.concat([timestampBuffer, codecBuffer, frame.data]);
        let sentCount = 0;
        let errorCount = 0;
        for (const [clientId, client] of this.clients) {
            if (client.ws.readyState === WebSocket.OPEN) {
                try {
                    client.ws.send(frameBuffer, { binary: true });
                    sentCount++;
                }
                catch (error) {
                    errorCount++;
                    console.error(`Failed to send to ${clientId}:`, error instanceof Error ? error.message : "Unknown error");
                }
            }
        }
        if (sentCount > 0 && Math.random() < 0.01) {
            console.log(`Broadcast: ${sentCount} clients, ${frameBuffer.length} bytes${errorCount > 0 ? `, ${errorCount} errors` : ""}`);
        }
    }
    getClientCount() {
        return this.clients.size;
    }
    getClientIds() {
        return Array.from(this.clients.keys());
    }
    getIsRunning() {
        return this.isRunning;
    }
    getConfig() {
        return { ...this.config };
    }
}
//# sourceMappingURL=audio-websocket-server.js.map