import { useEffect, useState, type FormEvent } from "react";
import { App } from "./App";

type AuthState = "checking" | "in" | "out";

export function AuthGate() {
  const [state, setState] = useState<AuthState>("checking");
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth", { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as { configured?: boolean };
        setConfigured(payload.configured !== false);
        setState(response.ok ? "in" : "out");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("out");
      });
    return () => controller.abort();
  }, []);

  if (state === "checking") {
    return (
      <main className="gate">
        <p className="eyebrow">Fashion Fitter</p>
        <h1>Fitting Studio</h1>
        <p className="lede">Checking the studio…</p>
      </main>
    );
  }

  if (state === "out") {
    return <LoginForm configured={configured} onSuccess={() => setState("in")} />;
  }

  return (
    <App
      onLogout={() => {
        void fetch("/api/logout", { method: "POST" }).finally(() => setState("out"));
      }}
    />
  );
}

function LoginForm({ configured, onSuccess }: { configured: boolean; onSuccess: () => void }) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Sign-in failed.");
      }
      onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="gate">
      <form className="gate-card" onSubmit={(event) => void submit(event)}>
        <p className="eyebrow">Fashion Fitter</p>
        <h1>Sign in</h1>
        <p className="lede">The studio asks for an ID and password before it shows a fitting.</p>
        <label className="field">
          <span className="field-label">ID</span>
          <input
            data-testid="login-id"
            name="username"
            type="text"
            autoComplete="username"
            value={id}
            onChange={(event) => setId(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            data-testid="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? (
          <p className="banner" role="alert" data-testid="login-error">
            {error}
          </p>
        ) : null}
        <button className="generate" type="submit" data-testid="login-submit" disabled={busy || !id.trim() || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="hint">
          {configured
            ? "The ID and password are read from .env.local in the project folder. Change APP_LOGIN_ID and APP_LOGIN_PASSWORD there, then restart the studio."
            : "This studio has no login yet. In the project folder, copy .env.example to .env.local if needed, set APP_LOGIN_ID and APP_LOGIN_PASSWORD, then restart."}
        </p>
      </form>
    </main>
  );
}
