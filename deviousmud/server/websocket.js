/**
 * A small RFC 6455 WebSocket server implemented on top of Node's HTTP upgrade
 * event - no npm dependencies, so `git clone && npm start` is the whole setup.
 *
 * Supports what a game client needs: text frames, fragmentation, ping/pong,
 * close handshakes, and a payload size cap to keep a hostile client from
 * allocating unbounded memory.
 */

import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const OPCODE = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa
};

const MAX_MESSAGE_BYTES = 256 * 1024;

export class WebSocketConnection extends EventEmitter {
  constructor(socket, request) {
    super();
    this.socket = socket;
    this.request = request;
    this.open = true;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.fragmentOpcode = null;
    this.isAlive = true;
    this.remoteAddress = request.socket.remoteAddress;

    // A browser that closes its tab mid-frame produces ECONNRESET. EventEmitter
    // throws on an "error" event with no listener, which would take the whole
    // server down, so a connection always carries a default one.
    this.on('error', () => {});

    socket.on('data', (chunk) => this.onData(chunk));
    socket.on('close', () => this.onSocketClose());
    socket.on('error', (err) => {
      this.emit('error', err);
      this.onSocketClose();
      this.destroy();
    });
    socket.setTimeout(0);
    socket.setNoDelay(true);
  }

  onSocketClose() {
    if (!this.open) return;
    this.open = false;
    this.emit('close');
  }

  onData(chunk) {
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > MAX_MESSAGE_BYTES * 2) {
      this.close(1009, 'Message too large');
      return;
    }
    let frame = this.readFrame();
    while (frame) {
      this.handleFrame(frame);
      if (!this.open) return;
      frame = this.readFrame();
    }
  }

  /** Pulls one complete frame out of the buffer, or null if more data is needed. */
  readFrame() {
    const buf = this.buffer;
    if (buf.length < 2) return null;

    const fin = (buf[0] & 0x80) !== 0;
    const opcode = buf[0] & 0x0f;
    const masked = (buf[1] & 0x80) !== 0;
    let length = buf[1] & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (buf.length < offset + 2) return null;
      length = buf.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (buf.length < offset + 8) return null;
      const big = buf.readBigUInt64BE(offset);
      if (big > BigInt(MAX_MESSAGE_BYTES)) {
        this.close(1009, 'Message too large');
        return null;
      }
      length = Number(big);
      offset += 8;
    }

    if (length > MAX_MESSAGE_BYTES) {
      this.close(1009, 'Message too large');
      return null;
    }

    let mask = null;
    if (masked) {
      if (buf.length < offset + 4) return null;
      mask = buf.subarray(offset, offset + 4);
      offset += 4;
    }
    if (buf.length < offset + length) return null;

    const payload = Buffer.from(buf.subarray(offset, offset + length));
    if (mask) {
      for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
    }
    this.buffer = buf.subarray(offset + length);
    return { fin, opcode, payload };
  }

  handleFrame(frame) {
    switch (frame.opcode) {
      case OPCODE.TEXT:
      case OPCODE.BINARY:
        if (frame.fin) {
          this.emitMessage(frame.opcode, frame.payload);
        } else {
          this.fragmentOpcode = frame.opcode;
          this.fragments = [frame.payload];
        }
        break;
      case OPCODE.CONTINUATION:
        if (this.fragmentOpcode === null) break;
        this.fragments.push(frame.payload);
        if (frame.fin) {
          this.emitMessage(this.fragmentOpcode, Buffer.concat(this.fragments));
          this.fragments = [];
          this.fragmentOpcode = null;
        }
        break;
      case OPCODE.PING:
        this.sendFrame(OPCODE.PONG, frame.payload);
        break;
      case OPCODE.PONG:
        this.isAlive = true;
        break;
      case OPCODE.CLOSE:
        this.close(1000, '');
        break;
      default:
        this.close(1002, 'Unsupported opcode');
    }
  }

  emitMessage(opcode, payload) {
    if (opcode === OPCODE.TEXT) this.emit('message', payload.toString('utf8'));
    else this.emit('binary', payload);
  }

  sendFrame(opcode, payload = Buffer.alloc(0)) {
    if (!this.open || this.socket.destroyed) return false;
    const length = payload.length;
    let header;
    if (length < 126) {
      header = Buffer.alloc(2);
      header[1] = length;
    } else if (length < 65536) {
      header = Buffer.alloc(4);
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }
    header[0] = 0x80 | opcode; // FIN + opcode; server frames are never masked
    try {
      this.socket.write(Buffer.concat([header, payload]));
      return true;
    } catch {
      this.destroy();
      return false;
    }
  }

  send(text) {
    return this.sendFrame(OPCODE.TEXT, Buffer.from(String(text), 'utf8'));
  }

  sendJson(value) {
    return this.send(JSON.stringify(value));
  }

  ping() {
    this.isAlive = false;
    this.sendFrame(OPCODE.PING);
  }

  close(code = 1000, reason = '') {
    if (!this.open) return;
    const reasonBuf = Buffer.from(reason, 'utf8');
    const payload = Buffer.alloc(2 + reasonBuf.length);
    payload.writeUInt16BE(code, 0);
    reasonBuf.copy(payload, 2);
    this.sendFrame(OPCODE.CLOSE, payload);
    this.open = false;
    this.emit('close');
    setTimeout(() => this.destroy(), 50).unref?.();
  }

  destroy() {
    this.open = false;
    try {
      this.socket.destroy();
    } catch {
      /* already gone */
    }
  }
}

/**
 * Attaches a WebSocket endpoint to an existing http.Server.
 * @returns {{ clients: Set<WebSocketConnection>, close: () => void }}
 */
export function attachWebSocketServer(httpServer, { path = '/ws', onConnection, heartbeatMs = 30000 } = {}) {
  const clients = new Set();

  httpServer.on('upgrade', (request, socket) => {
    let url;
    try {
      url = new URL(request.url, 'http://localhost');
    } catch {
      socket.destroy();
      return;
    }
    if (url.pathname !== path) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }
    const key = request.headers['sec-websocket-key'];
    const version = request.headers['sec-websocket-version'];
    if (request.headers.upgrade?.toLowerCase() !== 'websocket' || !key || version !== '13') {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    const connection = new WebSocketConnection(socket, request);
    clients.add(connection);
    connection.on('close', () => clients.delete(connection));
    onConnection?.(connection, request);
  });

  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.isAlive) {
        client.destroy();
        clients.delete(client);
        continue;
      }
      client.ping();
    }
  }, heartbeatMs);
  heartbeat.unref?.();

  return {
    clients,
    close() {
      clearInterval(heartbeat);
      for (const client of clients) client.close(1001, 'Server shutting down');
      clients.clear();
    }
  };
}
