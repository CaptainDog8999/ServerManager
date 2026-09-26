import { useState, type FormEvent, type ReactNode } from "react";
import { Cable, Lock, Server, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseEndpoint, formatEndpoint } from "@/lib/endpoint";
import { connectTunnels } from "@/lib/relay";
import { useDeck } from "@/lib/store";

export function SetupScreen() {
  const connectLive = useDeck((s) => s.connectLive);
  const connectDemo = useDeck((s) => s.connectDemo);
  const [gameRaw, setGameRaw] = useState("");
  const [consoleRaw, setConsoleRaw] = useState("");
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("Survival");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConnect(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let game;
    let cons;
    try {
      game = parseEndpoint(gameRaw);
      cons = parseEndpoint(consoleRaw);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check the addresses.");
      return;
    }
    setBusy(true);
    try {
      const report = await connectTunnels({
        data: { gameRaw: formatEndpoint(game), consoleRaw: formatEndpoint(cons), password },
      });
      const gameEp = report.console.swapped ? cons : game;
      const consoleEp = report.console.swapped ? game : cons;
      if (!report.game.online) {
        setError(
          report.game.error ||
            "Could not reach the game tunnel. Confirm the addresses from playit and that the agent is running.",
        );
        return;
      }
      connectLive(
        {
          game: gameEp,
          console: consoleEp,
          rconPassword: password,
          label: label.trim() || "Server",
        },
        report.game,
      );
      if (password && !report.console.ok) {
        useDeck.getState().pushLog({
          kind: "err",
          text: report.console.detail,
        });
        useDeck.getState().setLastError(report.console.detail);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
      <div className="stagger-in space-y-8">
        <header className="space-y-3">
          <p className="font-mono text-xs tracking-widest text-ink-faint uppercase">Remote deck</p>
          <h1 className="font-sans text-4xl leading-tight font-medium tracking-tight text-ink">Outpost</h1>
          <p className="max-w-md text-sm leading-normal text-ink-soft">
            A phone-friendly console for a game server sitting behind playit. Paste the two public
            addresses from your playit dashboard — one for the game, one for RCON.
          </p>
        </header>

        <form onSubmit={onConnect} className="space-y-5 rounded-xl bg-panel p-5 shadow-[var(--shadow-border)]">
          <Field
            id="label"
            label="Server name"
            icon={<Server className="size-3.5" />}
          >
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="font-sans"
              maxLength={40}
              autoComplete="off"
            />
          </Field>
          <Field
            id="game"
            label="Game tunnel"
            icon={<Cable className="size-3.5" />}
            hint="The public host:port players join — Java status is read from this."
          >
            <Input
              id="game"
              value={gameRaw}
              onChange={(e) => setGameRaw(e.target.value)}
              placeholder="name.at.ply.gg:25565"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </Field>
          <Field
            id="console"
            label="Console tunnel"
            icon={<TerminalSquare className="size-3.5" />}
            hint="Point this playit tunnel at the RCON port (often 25575)."
          >
            <Input
              id="console"
              value={consoleRaw}
              onChange={(e) => setConsoleRaw(e.target.value)}
              placeholder="name.at.ply.gg:25575"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </Field>
          <Field
            id="password"
            label="RCON password"
            icon={<Lock className="size-3.5" />}
            hint="From server.properties · enable-rcon=true. Stored only on this device."
          >
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="optional if you only need status"
              autoComplete="off"
            />
          </Field>

          {error ? <p className="text-sm text-bad">{error}</p> : null}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy ? "Checking tunnels…" : "Open deck"}
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={connectDemo}>
              Try the demo
            </Button>
          </div>
        </form>

        <ol className="space-y-2 text-sm leading-normal text-ink-soft">
          <li>
            <span className="font-mono text-ink-faint">01</span> Enable RCON on the server
            (`enable-rcon=true`, `rcon.port`, `rcon.password`).
          </li>
          <li>
            <span className="font-mono text-ink-faint">02</span> In playit, add a second tunnel
            whose local port is that RCON port.
          </li>
          <li>
            <span className="font-mono text-ink-faint">03</span> A webpage cannot speak Minecraft
            TCP itself — Outpost talks to those public addresses for you.
          </li>
        </ol>
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  icon,
  hint,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
  icon: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-2">
        <span className="text-ink-faint">{icon}</span>
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs leading-normal text-ink-faint">{hint}</p> : null}
    </div>
  );
}
