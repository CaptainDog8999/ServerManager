import type { GameStatus, LogLine, RconResult } from "./types";

const DEMO_PLAYERS = [
  { id: "a", name: "Maple" },
  { id: "b", name: "Torin" },
  { id: "c", name: "Ness" },
  { id: "d", name: "Juniper" },
];

export function demoStatus(): GameStatus {
  return {
    online: true,
    latencyMs: 18,
    version: "Paper 1.21.4",
    protocol: 769,
    motd: "Weekend survival · keep inventory · no griefing",
    playersOnline: DEMO_PLAYERS.length,
    playersMax: 20,
    sample: DEMO_PLAYERS,
    favicon: null,
    error: null,
    probedAt: Date.now(),
    kind: "minecraft",
    httpStatus: null,
    httpTitle: null,
  };
}

export function demoBootLog(): LogLine[] {
  const now = Date.now();
  const lines: Array<[LogKind, string, number]> = [
    ["sys", "Demo console · no real server is connected", 8000],
    ["sys", "Done (12.4s)! For help, type \"help\"", 7400],
    ["out", "Preparing spawn area: 100%", 6200],
    ["in", "Maple joined the game", 4100],
    ["in", "Torin joined the game", 2800],
    ["in", "Ness joined the game", 1600],
    ["in", "Juniper joined the game", 400],
    ["out", "<Maple> anyone have oak logs?", 120],
  ];
  return lines.map(([kind, text, ago], i) => ({
    id: `boot-${i}`,
    at: now - ago,
    kind,
    text,
  }));
}

type LogKind = LogLine["kind"];

export function demoCommand(command: string): RconResult {
  const cmd = command.trim();
  const head = cmd.split(/\s+/)[0]?.toLowerCase() ?? "";
  const rest = cmd.slice(head.length).trim();

  if (head === "list") {
    return {
      ok: true,
      body: `There are ${DEMO_PLAYERS.length} of a max of 20 players online: ${DEMO_PLAYERS.map((p) => p.name).join(", ")}`,
      error: null,
    };
  }
  if (head === "seed") return { ok: true, body: "Seed: [1847261933]", error: null };
  if (head === "save-all" || head === "save") {
    return { ok: true, body: "Saved the game", error: null };
  }
  if (head === "help") {
    return {
      ok: true,
      body: "Demo commands: list, say, save-all, weather, time, seed, whitelist, stop",
      error: null,
    };
  }
  if (head === "say") {
    return { ok: true, body: `[Server] ${rest || "hello"}`, error: null };
  }
  if (head === "weather") {
    return { ok: true, body: `Set the weather to ${rest || "clear"}`, error: null };
  }
  if (head === "time") {
    return { ok: true, body: `Set the time to ${rest || "day"}`, error: null };
  }
  if (head === "whitelist") {
    return { ok: true, body: "Whitelist is empty (demo)", error: null };
  }
  if (head === "stop") {
    return { ok: true, body: "Stopping the server (demo only — the real process is untouched)", error: null };
  }
  if (head === "kick" || head === "ban") {
    const who = rest.split(/\s+/)[0] || "player";
    return { ok: true, body: `Kicked ${who} (demo)`, error: null };
  }
  return { ok: true, body: `Unknown or unhandled in demo: ${cmd}`, error: null };
}
