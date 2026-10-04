import { useEffect, useState } from "react";
import { App } from "./App";
import { Login } from "./components/Login";

type GateState = "loading" | "in" | "out";

interface SessionPayload {
  authenticated?: boolean;
  configured?: boolean;
  admin?: boolean;
}

export function Gate() {
  const [state, setState] = useState<GateState>("loading");
  const [configured, setConfigured] = useState(true);
  const [admin, setAdmin] = useState(false);

  function applySession(payload: SessionPayload) {
    setConfigured(payload.configured !== false);
    setAdmin(payload.admin === true);
    setState(payload.authenticated ? "in" : "out");
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/session", { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: SessionPayload) => applySession(payload))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAdmin(false);
        setState("out");
      });
    return () => controller.abort();
  }, []);

  async function refreshSession() {
    const response = await fetch("/api/session");
    applySession((await response.json()) as SessionPayload);
  }

  async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    setAdmin(false);
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
    return <Login configured={configured} onSuccess={() => void refreshSession()} />;
  }
  return <App admin={admin} onSignOut={() => void signOut()} />;
}
