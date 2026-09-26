export type Endpoint = {
  host: string;
  port: number;
  raw: string;
};

const PLAYIT_SUFFIXES = [
  ".ply.gg",
  ".playit.gg",
  ".playit.plus",
  ".joinmc.link",
  ".playit.cloud",
];

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

export function parseEndpoint(raw: string): Endpoint {
  const trimmed = raw.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  if (!trimmed) throw new Error("Paste a public address from playit.");

  const ipv6 = trimmed.match(/^\[([^\]]+)\]:(\d+)$/);
  if (ipv6) {
    const port = Number(ipv6[2]);
    assertPort(port);
    return { host: ipv6[1], port, raw: trimmed };
  }

  const lastColon = trimmed.lastIndexOf(":");
  if (lastColon > 0 && /^\d+$/.test(trimmed.slice(lastColon + 1))) {
    const host = trimmed.slice(0, lastColon).replace(/\.$/, "");
    const port = Number(trimmed.slice(lastColon + 1));
    assertPort(port);
    if (!host) throw new Error("Address is missing a host.");
    // Playit hostnames hide the real port in DNS. Ignore a typed 25565.
    if (isPlayitHost(host) && port === 25565) {
      return { host, port: 25565, raw: host };
    }
    return { host, port, raw: `${host}:${port}` };
  }

  const host = trimmed.replace(/\.$/, "");
  if (!host.includes(".")) throw new Error("That does not look like a playit address.");
  return { host, port: 25565, raw: host };
}

function assertPort(port: number) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Port must be between 1 and 65535.");
  }
}

export function formatEndpoint(ep: Endpoint): string {
  if (isPlayitHost(ep.host)) return ep.host;
  return `${ep.host}:${ep.port}`;
}

export function isPlayitHost(host: string): boolean {
  const h = host.toLowerCase();
  return PLAYIT_SUFFIXES.some((s) => h.endsWith(s) || h === s.slice(1));
}

export function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(h)) return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return true;
  return isPrivateIp(h);
}

function isPrivateIp(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0 || a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function assertSafeEndpoint(ep: Endpoint): void {
  if (isBlockedHost(ep.host)) {
    throw new Error("That address is not reachable from here. Use the public playit host.");
  }
}
