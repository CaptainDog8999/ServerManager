import { useState } from "react";
import { CloudSun, Copy, List, Save, Sun, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatEndpoint } from "@/lib/endpoint";
import { demoCommand } from "@/lib/demo";
import { runConsoleCommand } from "@/lib/relay";
import { useDeck } from "@/lib/store";
import { cn } from "@/lib/utils";

const QUICK = [
  { id: "list", label: "List players", command: "list", icon: List },
  { id: "save", label: "Save world", command: "save-all", icon: Save },
  { id: "weather", label: "Clear weather", command: "weather clear", icon: CloudSun },
  { id: "day", label: "Set daytime", command: "time set day", icon: Sun },
] as const;

export function OverviewPanel({ onRun }: { onRun: (command: string) => Promise<void> }) {
  const status = useDeck((s) => s.status);
  const connection = useDeck((s) => s.connection);
  const mode = useDeck((s) => s.mode);
  const [copied, setCopied] = useState(false);
  const [sayOpen, setSayOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [stopOpen, setStopOpen] = useState(false);

  if (!connection) return null;
  if (!status) {
    return <p className="text-sm text-ink-soft">Checking the game tunnel…</p>;
  }

  const join = formatEndpoint(connection.game);

  async function copyJoin() {
    try {
      await navigator.clipboard.writeText(join);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-col gap-4">
      <div className="rounded-xl bg-panel p-5 shadow-[var(--shadow-border)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-wide text-ink-faint uppercase">Players</p>
            <p className="mt-1 font-mono text-4xl leading-none font-medium tracking-tight tabular-nums text-ink">
              {status.playersOnline}
              <span className="text-ink-soft">/{status.playersMax || "-"}</span>
            </p>
          </div>
          <Badge variant={status.online ? "ok" : "bad"}>
            <span
              className={cn(
                "size-1.5 rounded-full",
                status.online ? "live-dot bg-ok" : "bg-bad",
              )}
            />
            {status.online ? "Online" : "Offline"}
          </Badge>
        </div>
        <p className="mt-4 text-sm leading-normal text-ink-soft">{status.motd || "No MOTD"}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Stat label="Version" value={status.version ?? "—"} />
          <Stat
            label="Latency"
            value={status.latencyMs != null ? `${status.latencyMs} ms` : "—"}
          />
        </dl>
        <div className="mt-4 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-mono text-xs text-ink-faint">{join}</p>
          <Button variant="secondary" size="sm" onClick={copyJoin}>
            <Copy />
            {copied ? "Copied" : "Copy join"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-panel p-5 shadow-[var(--shadow-border)]">
        <p className="text-sm font-medium text-ink">Who is in</p>
        {status.sample.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">
            {status.playersOnline === 0
              ? "Empty world."
              : "The ping did not include names. Run list from the console."}
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {status.sample.map((p) => (
              <li
                key={p.id}
                className="rounded-md bg-panel-2 px-3 py-2 font-mono text-sm text-ink shadow-[var(--shadow-border)]"
              >
                {p.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl bg-panel p-5 shadow-[var(--shadow-border)]">
        <p className="text-sm font-medium text-ink">Quick run</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {QUICK.map((q) => (
            <Button
              key={q.id}
              variant="secondary"
              className="h-12 justify-start"
              onClick={() => void onRun(q.command)}
            >
              <q.icon />
              {q.label}
            </Button>
          ))}
          <Button
            variant="secondary"
            className="h-12 justify-start"
            onClick={() => setSayOpen(true)}
          >
            <Volume2 />
            Broadcast
          </Button>
          <Button
            variant="danger"
            className="h-12 justify-start"
            onClick={() => setStopOpen(true)}
          >
            Stop server
          </Button>
        </div>
        {mode === "live" && !connection.rconPassword ? (
          <p className="mt-3 text-xs text-warn">
            Status works without a password. Commands need RCON.
          </p>
        ) : null}
      </div>

      <Dialog open={sayOpen} onOpenChange={setSayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Broadcast</DialogTitle>
            <DialogDescription>Sends a server chat message to everyone online.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const text = message.trim();
              if (!text) return;
              void onRun(`say ${text}`);
              setMessage("");
              setSayOpen(false);
            }}
          >
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Night restart in 10 minutes"
              className="font-sans"
              maxLength={200}
            />
            <Button type="submit" className="w-full" disabled={!message.trim()}>
              Send
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={stopOpen} onOpenChange={setStopOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop the server?</DialogTitle>
            <DialogDescription>
              This sends the stop command over RCON. You cannot start it again from this page —
              someone has to launch the process on the machine.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStopOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                void onRun("stop");
                setStopOpen(false);
              }}
            >
              Send stop
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-ink">{value}</dd>
    </div>
  );
}

export async function executeCommand(command: string) {
  const { mode, connection, pushLog } = useDeck.getState();
  if (!connection) return;
  pushLog({ kind: "in", text: `> ${command}` });
  try {
    const result =
      mode === "demo"
        ? demoCommand(command)
        : await runConsoleCommand({
            data: {
              host: connection.console.host,
              port: connection.console.port,
              password: connection.rconPassword,
              command,
            },
          });
    if (result.ok) pushLog({ kind: "out", text: result.body });
    else pushLog({ kind: "err", text: result.error || "Command failed." });
  } catch (err) {
    pushLog({ kind: "err", text: err instanceof Error ? err.message : "Command failed." });
  }
}
