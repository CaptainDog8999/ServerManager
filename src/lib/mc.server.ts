import net from "node:net";
import dns from "node:dns/promises";
import { flattenMotd } from "./motd";
import { assertSafeEndpoint, type Endpoint } from "./endpoint";
import type { GameStatus, RconResult } from "./types";

const TIMEOUT_MS = 12000;

async function resolveMinecraftTarget(host: string, port: number): Promise<{ host: string; port: number }> {
  try {
    const records = await dns.resolveSrv(`_minecraft._tcp.${host}`);
    records.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
    const rec = records[0];
    if (rec?.name && rec.port) {
      return { host: rec.name.replace(/\.$/, ""), port: rec.port };
    }
  } catch {
    // No SRV — use the address as pasted.
  }
  return { host, port };
}

function writeVarInt(value: number): Buffer {
  const parts: number[] = [];
  let v = value >>> 0;
  while (true) {
    if ((v & ~0x7f) === 0) {
      parts.push(v);
      break;
    }
    parts.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  return Buffer.from(parts);
}

function writeString(s: string): Buffer {
  const buf = Buffer.from(s, "utf8");
  return Buffer.concat([writeVarInt(buf.length), buf]);
}

function writeUShort(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n & 0xffff, 0);
  return b;
}

function frame(payload: Buffer): Buffer {
  return Buffer.concat([writeVarInt(payload.length), payload]);
}

class Reader {
  offset = 0;
  constructor(private buf: Buffer) {}
  remaining() {
    return this.buf.length - this.offset;
  }
  varInt(): number {
    let n = 0;
    let shift = 0;
    while (true) {
      if (this.offset >= this.buf.length) throw new Error("truncated");
      const b = this.buf[this.offset++]!;
      n |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return n >>> 0;
      shift += 7;
      if (shift > 35) throw new Error("varint too long");
    }
  }
  bytes(n: number): Buffer {
    if (this.remaining() < n) throw new Error("truncated");
    const s = this.buf.subarray(this.offset, this.offset + n);
    this.offset += n;
    return s;
  }
}

function emptyStatus(error: string | null, extra?: Partial<GameStatus>): GameStatus {
  return {
    online: false,
    latencyMs: null,
    version: null,
    protocol: null,
    motd: "",
    playersOnline: 0,
    playersMax: 0,
    sample: [],
    favicon: null,
    error,
    probedAt: Date.now(),
    kind: "unknown",
    httpStatus: null,
    httpTitle: null,
    ...extra,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export async function pingMinecraft(ep: Endpoint): Promise<GameStatus> {
  assertSafeEndpoint(ep);
  const started = Date.now();
  const target = await resolveMinecraftTarget(ep.host, ep.port);
  try {
    const handshake = frame(
      Buffer.concat([
        writeVarInt(0x00),
        writeVarInt(764),
        writeString(ep.host),
        writeUShort(target.port),
        writeVarInt(1),
      ]),
    );
    const request = frame(writeVarInt(0x00));
    const packet = await withTimeout(
      readMcPacket(target.host, target.port, Buffer.concat([handshake, request])),
      TIMEOUT_MS,
      "Timed out waiting for the game tunnel.",
    );
    const reader = new Reader(packet);
    const id = reader.varInt();
    if (id !== 0) return emptyStatus("The game tunnel did not speak Minecraft status.");
    const jsonLen = reader.varInt();
    const json = reader.bytes(jsonLen).toString("utf8");
    const data = JSON.parse(json) as {
      version?: { name?: string; protocol?: number };
      players?: { max?: number; online?: number; sample?: { id: string; name: string }[] };
      description?: unknown;
      favicon?: string;
    };
    const sample = Array.isArray(data.players?.sample)
      ? data.players.sample
          .filter((p) => p && typeof p.name === "string")
          .slice(0, 40)
          .map((p) => ({ id: String(p.id ?? p.name), name: p.name }))
      : [];
    return {
      online: true,
      latencyMs: Date.now() - started,
      version: data.version?.name ?? "Minecraft",
      protocol: data.version?.protocol ?? null,
      motd: flattenMotd(data.description) || "Server online",
      playersOnline: data.players?.online ?? 0,
      playersMax: data.players?.max ?? 0,
      sample,
      favicon: typeof data.favicon === "string" ? data.favicon : null,
      error: null,
      probedAt: Date.now(),
      kind: "minecraft",
      httpStatus: null,
      httpTitle: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reach the game tunnel.";
    return emptyStatus(message);
  }
}

function readMcPacket(host: string, port: number, payload: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port, noDelay: true, family: 4 });
    let buf = Buffer.alloc(0);
    const fail = (e: Error) => {
      socket.destroy();
      reject(e);
    };
    socket.on("error", (e) => fail(e instanceof Error ? e : new Error(String(e))));
    socket.on("connect", () => socket.write(payload));
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      try {
        const r = new Reader(buf);
        const len = r.varInt();
        if (r.remaining() < len) return;
        const packet = r.bytes(len);
        socket.destroy();
        resolve(packet);
      } catch {
        // wait for more bytes
      }
    });
    socket.on("close", () => {
      if (buf.length === 0) fail(new Error("The game tunnel closed without a reply."));
    });
  });
}

function rconPacket(id: number, type: number, body: string): Buffer {
  const bodyBuf = Buffer.from(body, "utf8");
  const len = 4 + 4 + bodyBuf.length + 2;
  const buf = Buffer.alloc(4 + len);
  buf.writeInt32LE(len, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  bodyBuf.copy(buf, 12);
  buf[12 + bodyBuf.length] = 0;
  buf[13 + bodyBuf.length] = 0;
  return buf;
}

function parseRconPackets(buf: Buffer): { id: number; type: number; body: string }[] {
  const out: { id: number; type: number; body: string }[] = [];
  let offset = 0;
  while (offset + 4 <= buf.length) {
    const len = buf.readInt32LE(offset);
    if (len < 10 || offset + 4 + len > buf.length) break;
    const id = buf.readInt32LE(offset + 4);
    const type = buf.readInt32LE(offset + 8);
    const body = buf.toString("utf8", offset + 12, offset + 4 + len - 2);
    out.push({ id, type, body });
    offset += 4 + len;
  }
  return out;
}

export async function runRcon(
  ep: Endpoint,
  password: string,
  command: string,
): Promise<RconResult> {
  assertSafeEndpoint(ep);
  if (!password) return { ok: false, body: "", error: "RCON password is empty." };
  if (!command.trim()) return { ok: false, body: "", error: "Type a command first." };
  if (command.length > 256) return { ok: false, body: "", error: "Command is too long." };
  if (command.includes("\0")) return { ok: false, body: "", error: "Invalid command." };

  const target = await resolveMinecraftTarget(ep.host, ep.port);
  try {
    const body = await withTimeout(
      rconExchange(target.host, target.port, password, command.trim()),
      TIMEOUT_MS,
      "Timed out waiting for the console tunnel.",
    );
    return { ok: true, body: body || "(no output)", error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "RCON failed.";
    return { ok: false, body: "", error: message };
  }
}

function rconExchange(host: string, port: number, password: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port, noDelay: true, family: 4 });
    let buf = Buffer.alloc(0);
    let authed = false;
    const fail = (e: Error) => {
      socket.destroy();
      reject(e);
    };
    socket.on("error", (e) => fail(e instanceof Error ? e : new Error(String(e))));
    socket.on("connect", () => {
      socket.write(rconPacket(1, 3, password));
    });
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const packets = parseRconPackets(buf);
      if (packets.length === 0) return;
      if (!authed) {
        const auth = packets[0]!;
        if (auth.id === -1) {
          fail(new Error("RCON password was rejected."));
          return;
        }
        if (auth.id !== 1) return;
        authed = true;
        buf = Buffer.alloc(0);
        socket.write(rconPacket(2, 2, command));
        return;
      }
      const replies = packets.filter((p) => p.id === 2);
      if (replies.length === 0) return;
      socket.destroy();
      resolve(replies.map((p) => p.body).join(""));
    });
    socket.on("close", () => {
      if (!authed) reject(new Error("The console tunnel closed before login."));
    });
  });
}

export async function probeHttp(ep: Endpoint): Promise<GameStatus> {
  assertSafeEndpoint(ep);
  const started = Date.now();
  try {
    const raw = await withTimeout(
      httpGet(ep.host, ep.port),
      TIMEOUT_MS,
      "Timed out waiting for HTTP on that tunnel.",
    );
    const statusMatch = raw.match(/^HTTP\/\d(?:\.\d)?\s+(\d+)/);
    const status = statusMatch ? Number(statusMatch[1]) : 0;
    const server = raw.match(/^server:\s*(.+)$/im)?.[1]?.trim() ?? null;
    const title = raw.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
    if (!statusMatch) {
      return emptyStatus("That tunnel did not reply with HTTP.");
    }
    return {
      online: status > 0 && status < 500,
      latencyMs: Date.now() - started,
      version: server,
      protocol: null,
      motd: title || `HTTP ${status}`,
      playersOnline: 0,
      playersMax: 0,
      sample: [],
      favicon: null,
      error: null,
      probedAt: Date.now(),
      kind: "http",
      httpStatus: status,
      httpTitle: title,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "HTTP probe failed.";
    return emptyStatus(message);
  }
}

function httpGet(host: string, port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port, noDelay: true, family: 4 });
    let buf = Buffer.alloc(0);
    const fail = (e: Error) => {
      socket.destroy();
      reject(e);
    };
    socket.on("error", (e) => fail(e instanceof Error ? e : new Error(String(e))));
    socket.on("connect", () => {
      socket.write(
        `GET / HTTP/1.1\r\nHost: ${host}:${port}\r\nConnection: close\r\nAccept: text/html,*/*\r\n\r\n`,
      );
    });
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (buf.length > 32_000) {
        socket.destroy();
        resolve(buf.subarray(0, 32_000).toString("latin1"));
      }
    });
    socket.on("end", () => resolve(buf.toString("latin1")));
    socket.on("close", () => {
      if (buf.length) resolve(buf.toString("latin1"));
      else fail(new Error("HTTP tunnel closed without a reply."));
    });
  });
}

export async function testRconAuth(ep: Endpoint, password: string): Promise<{ ok: boolean; detail: string }> {
  const result = await runRcon(ep, password, "list");
  if (result.ok) return { ok: true, detail: result.body.trim() || "RCON accepted." };
  return { ok: false, detail: result.error || "RCON failed." };
}
