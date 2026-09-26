import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Deck } from "@/components/deck";
import { SetupScreen } from "@/components/setup-screen";
import { demoBootLog, demoStatus } from "@/lib/demo";
import { useDeck } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const mode = useDeck((s) => s.mode);
  const setStatus = useDeck((s) => s.setStatus);
  const connection = useDeck((s) => s.connection);
  const logs = useDeck((s) => s.logs);

  useEffect(() => {
    if (mode !== "demo") return;
    setStatus(demoStatus());
    if (logs.length === 0) {
      useDeck.setState({ logs: demoBootLog() });
    }
  }, [mode, logs.length, setStatus]);

  if (!mode || !connection) return <SetupScreen />;
  return <Deck />;
}
