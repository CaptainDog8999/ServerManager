import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEndpoint, parseEndpoint } from "@/lib/endpoint";
import { useDeck } from "@/lib/store";

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const connection = useDeck((s) => s.connection);
  const updateConnection = useDeck((s) => s.updateConnection);
  const disconnect = useDeck((s) => s.disconnect);
  const mode = useDeck((s) => s.mode);
  const [label, setLabel] = useState(connection?.label ?? "");
  const [gameRaw, setGameRaw] = useState(connection ? formatEndpoint(connection.game) : "");
  const [consoleRaw, setConsoleRaw] = useState(
    connection ? formatEndpoint(connection.console) : "",
  );
  const [password, setPassword] = useState(connection?.rconPassword ?? "");
  const [error, setError] = useState<string | null>(null);

  function save() {
    try {
      const game = parseEndpoint(gameRaw);
      const cons = parseEndpoint(consoleRaw);
      updateConnection({
        label: label.trim() || "Server",
        game,
        console: cons,
        rconPassword: password,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-medium tracking-tight text-ink">Tunnels</h2>
        <p className="mt-1 text-sm leading-normal text-ink-soft">
          Addresses stay on this phone or computer. Changing them does not restart the game process.
        </p>
      </header>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="set-label">Name</Label>
          <Input
            id="set-label"
            className="font-sans"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={mode === "demo"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="set-game">Game tunnel</Label>
          <Input
            id="set-game"
            value={gameRaw}
            onChange={(e) => setGameRaw(e.target.value)}
            disabled={mode === "demo"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="set-console">Console tunnel</Label>
          <Input
            id="set-console"
            value={consoleRaw}
            onChange={(e) => setConsoleRaw(e.target.value)}
            disabled={mode === "demo"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="set-pass">RCON password</Label>
          <Input
            id="set-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={mode === "demo"}
            autoComplete="off"
          />
        </div>
      </div>

      {error ? <p className="text-sm text-bad">{error}</p> : null}

      <div className="flex flex-col gap-2">
        <Button onClick={save} disabled={mode === "demo"}>
          Save
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            disconnect();
            onClose();
          }}
        >
          Disconnect
        </Button>
      </div>
    </div>
  );
}
