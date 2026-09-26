import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { demoCommand } from "@/lib/demo";
import { runConsoleCommand } from "@/lib/relay";
import { useDeck } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { LogKind } from "@/lib/types";

const HISTORY_KEY = "outpost-cmd-history";

export function ConsolePanel() {
  const logs = useDeck((s) => s.logs);
  const mode = useDeck((s) => s.mode);
  const connection = useDeck((s) => s.connection);
  const pushLog = useDeck((s) => s.pushLog);
  const clearLogs = useDeck((s) => s.clearLogs);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>(() => readHistory());
  const [histIdx, setHistIdx] = useState(-1);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  async function send(command: string) {
    const cmd = command.trim().replace(/^\//, "");
    if (!cmd || busy) return;
    if (!connection) return;
    setBusy(true);
    pushLog({ kind: "in", text: `> ${cmd}` });
    const nextHist = [cmd, ...history.filter((h) => h !== cmd)].slice(0, 50);
    setHistory(nextHist);
    writeHistory(nextHist);
    setHistIdx(-1);
    setValue("");
    try {
      const result =
        mode === "demo"
          ? demoCommand(cmd)
          : await runConsoleCommand({
              data: {
                host: connection.console.host,
                port: connection.console.port,
                password: connection.rconPassword,
                command: cmd,
              },
            });
      if (result.ok) {
        pushLog({ kind: "out", text: result.body });
      } else {
        pushLog({ kind: "err", text: result.error || "Command failed." });
      }
    } catch (err) {
      pushLog({
        kind: "err",
        text: err instanceof Error ? err.message : "Command failed.",
      });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(value);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      if (next >= 0 && history[next]) {
        setHistIdx(next);
        setValue(history[next]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = histIdx - 1;
      if (next < 0) {
        setHistIdx(-1);
        setValue("");
      } else if (history[next]) {
        setHistIdx(next);
        setValue(history[next]);
      }
    }
  }

  const canType = Boolean(connection && (mode === "demo" || connection.rconPassword));

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl bg-panel shadow-[var(--shadow-border)]">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-ink">Console</p>
          <p className="text-xs text-ink-faint">
            {mode === "demo"
              ? "Demo session · commands stay on this device"
              : canType
                ? `${connection?.console.host}:${connection?.console.port}`
                : "Add an RCON password in settings to send commands"}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={clearLogs} aria-label="Clear console">
          <Trash2 />
        </Button>
      </header>
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 font-mono text-sm leading-relaxed"
      >
        {logs.length === 0 ? (
          <p className="text-ink-faint">Waiting for output.</p>
        ) : (
          logs.map((line) => (
            <p key={line.id} className={cn("break-words whitespace-pre-wrap", tone(line.kind))}>
              <span className="mr-3 text-ink-faint tabular-nums">
                {formatTime(line.at)}
              </span>
              {line.text}
            </p>
          ))
        )}
      </div>
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 border-t border-line p-3"
      >
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder={canType ? "list · say hello · save-all" : "RCON password required"}
          disabled={!canType || busy}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="text-term"
        />
        <Button type="submit" size="icon" disabled={!canType || busy || !value.trim()} aria-label="Send">
          <ArrowUp />
        </Button>
      </form>
    </section>
  );
}

function tone(kind: LogKind) {
  if (kind === "in") return "text-ink";
  if (kind === "out") return "text-term";
  if (kind === "err") return "text-bad";
  return "text-ink-soft";
}

function formatTime(at: number) {
  const d = new Date(at);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeHistory(items: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota */
  }
}
