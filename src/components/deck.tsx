import { useEffect, useState, type ReactNode } from "react";
import { LayoutGrid, RefreshCw, Settings, TerminalSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConsolePanel } from "@/components/console-panel";
import { executeCommand, OverviewPanel } from "@/components/overview-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { demoStatus } from "@/lib/demo";
import { probeGameTunnel } from "@/lib/relay";
import { useDeck } from "@/lib/store";
import { cn } from "@/lib/utils";

type Tab = "overview" | "console";

export function Deck() {
  const mode = useDeck((s) => s.mode);
  const connection = useDeck((s) => s.connection);
  const status = useDeck((s) => s.status);
  const lastError = useDeck((s) => s.lastError);
  const setLastError = useDeck((s) => s.setLastError);
  const setStatus = useDeck((s) => s.setStatus);
  const [tab, setTab] = useState<Tab>("overview");
  const [settings, setSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!connection || mode !== "live") return;
    let cancelled = false;

    async function tick() {
      if (!connection) return;
      try {
        const next = await probeGameTunnel({
          data: {
            host: connection.game.host,
            port: connection.game.port,
            raw: connection.game.raw,
          },
        });
        if (!cancelled) setStatus(next);
      } catch {
        /* keep last snapshot */
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [connection, mode, setStatus]);

  async function refresh() {
    if (!connection) return;
    setRefreshing(true);
    try {
      if (mode === "demo") {
        setStatus(demoStatus());
      } else {
        const next = await probeGameTunnel({
          data: {
            host: connection.game.host,
            port: connection.game.port,
            raw: connection.game.raw,
          },
        });
        setStatus(next);
      }
    } finally {
      setRefreshing(false);
    }
  }

  const online = Boolean(status?.online);

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pt-4 pb-24 md:pb-6">
      <header className="mb-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs tracking-widest text-ink-faint uppercase">Outpost</p>
          <h1 className="truncate text-lg font-medium tracking-tight text-ink">
            {connection?.label ?? "Server"}
          </h1>
        </div>
        <Badge variant={online ? "ok" : "bad"} className="shrink-0">
          <span className={cn("size-1.5 rounded-full", online ? "live-dot bg-ok" : "bg-bad")} />
          {online ? "Live" : "Down"}
        </Badge>
        {status?.latencyMs != null ? (
          <span className="hidden font-mono text-xs tabular-nums text-ink-soft sm:inline">
            {status.latencyMs} ms
          </span>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void refresh()}
          aria-label="Refresh status"
          disabled={refreshing}
        >
          <RefreshCw className={cn(refreshing && "animate-spin")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSettings((v) => !v)}
          aria-label="Settings"
        >
          <Settings />
        </Button>
      </header>

      {lastError ? (
        <p className="mb-4 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
          {lastError}
          <button
            type="button"
            className="ml-3 text-ink-soft underline-offset-2 hover:underline"
            onClick={() => setLastError(null)}
          >
            Dismiss
          </button>
        </p>
      ) : null}

      {settings ? (
        <div className="mx-auto w-full max-w-md rounded-xl bg-panel p-5 shadow-[var(--shadow-border)]">
          <SettingsPanel onClose={() => setSettings(false)} />
        </div>
      ) : (
        <>
          <div className="hidden min-h-0 flex-1 grid-cols-[minmax(280px,400px)_1fr] gap-4 md:grid">
            <div className="min-h-0 overflow-y-auto pr-1">
              <OverviewPanel onRun={executeCommand} />
            </div>
            <div className="flex min-h-[520px] flex-col">
              <ConsolePanel />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col md:hidden">
            {tab === "overview" ? (
              <OverviewPanel onRun={executeCommand} />
            ) : (
              <div className="flex min-h-[60dvh] flex-1 flex-col">
                <ConsolePanel />
              </div>
            )}
          </div>
        </>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
          <TabButton
            active={tab === "overview" && !settings}
            onClick={() => {
              setSettings(false);
              setTab("overview");
            }}
            icon={<LayoutGrid className="size-4" />}
            label="Deck"
          />
          <TabButton
            active={tab === "console" && !settings}
            onClick={() => {
              setSettings(false);
              setTab("console");
            }}
            icon={<TerminalSquare className="size-4" />}
            label="Console"
          />
        </div>
      </nav>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-12 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors duration-150",
        active ? "bg-panel-2 text-ink" : "text-ink-soft",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
