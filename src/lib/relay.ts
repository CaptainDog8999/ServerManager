import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parseEndpoint, formatEndpoint } from "./endpoint";
import type { GameStatus, ProbeReport, RconResult } from "./types";

const endpointInput = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  raw: z.string().max(300).optional(),
});

function asEndpoint(data: { host: string; port: number; raw?: string }) {
  return parseEndpoint(data.raw || `${data.host}:${data.port}`);
}

export const probeGameTunnel = createServerFn({ method: "POST" })
  .validator(endpointInput)
  .handler(async ({ data }): Promise<GameStatus> => {
    const { pingMinecraft, probeHttp } = await import("./mc.server");
    const ep = asEndpoint(data);
    const mc = await pingMinecraft(ep);
    if (mc.online) return mc;
    const http = await probeHttp(ep);
    if (http.kind === "http") return http;
    return mc.error ? mc : http;
  });

export const runConsoleCommand = createServerFn({ method: "POST" })
  .validator(
    z.object({
      host: z.string().min(1).max(255),
      port: z.number().int().min(1).max(65535),
      raw: z.string().max(300).optional(),
      password: z.string().min(1).max(200),
      command: z.string().min(1).max(256),
    }),
  )
  .handler(async ({ data }): Promise<RconResult> => {
    const { runRcon } = await import("./mc.server");
    const ep = asEndpoint(data);
    return runRcon(ep, data.password, data.command);
  });

export const connectTunnels = createServerFn({ method: "POST" })
  .validator(
    z.object({
      gameRaw: z.string().min(1).max(300),
      consoleRaw: z.string().min(1).max(300),
      password: z.string().max(200),
    }),
  )
  .handler(async ({ data }): Promise<ProbeReport> => {
    const { pingMinecraft, probeHttp, testRconAuth } = await import("./mc.server");
    const gameEp = parseEndpoint(data.gameRaw);
    const consoleEp = parseEndpoint(data.consoleRaw);

    const [gameA, gameB] = await Promise.all([pingMinecraft(gameEp), pingMinecraft(consoleEp)]);

    let game = gameA.online ? gameA : gameB.online ? gameB : gameA;
    let swapped = false;
    if (!gameA.online && gameB.online) swapped = true;
    if (!game.online) {
      const http = await probeHttp(gameEp);
      if (http.kind === "http") game = http;
    }

    let consoleKind: ProbeReport["console"]["kind"] = "unknown";
    let ok = false;
    let detail = "Could not identify the console tunnel.";

    if (data.password) {
      const rconTarget = swapped ? gameEp : consoleEp;
      const auth = await testRconAuth(rconTarget, data.password);
      if (auth.ok) {
        consoleKind = "rcon";
        ok = true;
        detail = auth.detail;
      } else if (!swapped) {
        const alt = await testRconAuth(gameEp, data.password);
        if (alt.ok) {
          swapped = true;
          consoleKind = "rcon";
          ok = true;
          detail = alt.detail;
        } else {
          consoleKind = "unknown";
          ok = false;
          detail = auth.detail;
        }
      } else {
        detail = auth.detail;
      }
    } else if (gameB.online && !swapped) {
      consoleKind = "minecraft";
      detail = `Second tunnel is a Minecraft server (${formatEndpoint(consoleEp)}), not RCON.`;
    } else {
      const http = await probeHttp(consoleEp);
      if (http.kind === "http") {
        consoleKind = "http";
        ok = http.online;
        detail = http.motd || `HTTP ${http.httpStatus}`;
      } else {
        detail = "Add the RCON password to open the live console.";
      }
    }

    return {
      game,
      console: { kind: consoleKind, ok, detail, swapped },
    };
  });
