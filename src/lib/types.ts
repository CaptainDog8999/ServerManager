export type PlayerSample = {
  id: string;
  name: string;
};

export type GameStatus = {
  online: boolean;
  latencyMs: number | null;
  version: string | null;
  protocol: number | null;
  motd: string;
  playersOnline: number;
  playersMax: number;
  sample: PlayerSample[];
  favicon: string | null;
  error: string | null;
  probedAt: number;
  kind: "minecraft" | "http" | "unknown";
  httpStatus: number | null;
  httpTitle: string | null;
};

export type RconResult = {
  ok: boolean;
  body: string;
  error: string | null;
};

export type LogKind = "in" | "out" | "sys" | "err";

export type LogLine = {
  id: string;
  at: number;
  kind: LogKind;
  text: string;
};

export type ProbeReport = {
  game: GameStatus;
  console: {
    kind: "rcon" | "minecraft" | "http" | "unknown";
    ok: boolean;
    detail: string;
    swapped: boolean;
  };
};
