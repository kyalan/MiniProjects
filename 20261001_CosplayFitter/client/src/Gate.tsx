import { useEffect, useState } from "react";
import { App } from "./App";
import { Login } from "./components/Login";

type GateState = "loading" | "in" | "out";

export function Gate() {
  const [state, setState] = useState<GateState>("loading");
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/session", { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: { authenticated?: boolean; configured?: boolean }) => {
        setConfigured(payload.configured !== false);
        setState(payload.authenticated ? "in" : "out");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("out");
      });
    return () => controller.abort();
  }, []);

  async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    setState("out");
  }

  if (state === "loading") {
    return (
      <main className="login-page">
        <p className="lede">Checking the sign-in…</p>
      </main>
    );
  }
  if (state === "out") {
    return <Login configured={configured} onSuccess={() => setState("in")} />;
  }
  return <App onSignOut={() => void signOut()} />;
}
