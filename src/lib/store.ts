import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Endpoint } from "./endpoint";
import type { GameStatus, LogLine } from "./types";
import { demoBootLog, demoStatus } from "./demo";

export type AppMode = "live" | "demo";

export type Connection = {
  game: Endpoint;
  console: Endpoint;
  rconPassword: string;
  label: string;
};

type DeckState = {
  mode: AppMode | null;
  connection: Connection | null;
  status: GameStatus | null;
  logs: LogLine[];
  lastError: string | null;
  connectLive: (connection: Connection, status: GameStatus) => void;
  connectDemo: () => void;
  disconnect: () => void;
  setStatus: (status: GameStatus) => void;
  pushLog: (line: Omit<LogLine, "id" | "at"> & { id?: string; at?: number }) => void;
  clearLogs: () => void;
  setLastError: (error: string | null) => void;
  updateConnection: (patch: Partial<Connection>) => void;
};

function nid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useDeck = create<DeckState>()(
  persist(
    (set, get) => ({
      mode: null,
      connection: null,
      status: null,
      logs: [],
      lastError: null,
      connectLive: (connection, status) =>
        set({
          mode: "live",
          connection,
          status,
          lastError: null,
          logs: [
            {
              id: nid(),
              at: Date.now(),
              kind: "sys",
              text: `Linked ${connection.game.host}:${connection.game.port} · console ${connection.console.host}:${connection.console.port}`,
            },
          ],
        }),
      connectDemo: () =>
        set({
          mode: "demo",
          connection: {
            game: { host: "demo.ply.gg", port: 25565, raw: "demo.ply.gg:25565" },
            console: { host: "demo.ply.gg", port: 25575, raw: "demo.ply.gg:25575" },
            rconPassword: "demo",
            label: "Demo world",
          },
          status: demoStatus(),
          logs: demoBootLog(),
          lastError: null,
        }),
      disconnect: () =>
        set({
          mode: null,
          connection: null,
          status: null,
          logs: [],
          lastError: null,
        }),
      setStatus: (status) => set({ status }),
      pushLog: (line) => {
        const next: LogLine = {
          id: line.id ?? nid(),
          at: line.at ?? Date.now(),
          kind: line.kind,
          text: line.text,
        };
        const logs = [...get().logs, next].slice(-400);
        set({ logs });
      },
      clearLogs: () => set({ logs: [] }),
      setLastError: (lastError) => set({ lastError }),
      updateConnection: (patch) => {
        const current = get().connection;
        if (!current) return;
        set({ connection: { ...current, ...patch } });
      },
    }),
    {
      name: "outpost-deck",
      partialize: (s) => ({
        mode: s.mode,
        connection: s.connection,
      }),
    },
  ),
);
