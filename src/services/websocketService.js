const { WebSocketServer } = require('ws');

class WebSocketService {
  constructor(server) {
    this.wss = new WebSocketServer({ server });
    this.connected = new Set();

    this.wss.on('connection', (ws) => {
      this.connected.add(ws);
      ws.send(JSON.stringify({
        type: 'system',
        message: 'Connected to GoldenHour live stream',
        timestamp: new Date().toISOString()
      }));

      ws.on('close', () => this.connected.delete(ws));
    });
  }

  broadcast(event, payload) {
    const message = JSON.stringify({ type: event, payload, timestamp: new Date().toISOString() });
    this.connected.forEach((socket) => {
      if (socket.readyState === 1) {
        socket.send(message);
      }
    });
  }
}

module.exports = WebSocketService;
