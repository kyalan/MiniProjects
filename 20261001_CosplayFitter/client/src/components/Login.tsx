import { useState, type FormEvent } from "react";

interface LoginProps {
  configured: boolean;
  onSuccess: () => void;
}

export function Login({ configured, onSuccess }: LoginProps) {
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
    <main className="login-page">
      <form className="login-card" onSubmit={(event) => void submit(event)}>
        <p className="eyebrow">Cosplay Fitter</p>
        <h1>Sign in</h1>
        <p className="lede">The studio stays closed until this ID and password match the ones on the server.</p>
        {configured ? null : (
          <p className="banner" role="alert">
            Set APP_USER and APP_PASSWORD in .env.local, then restart.
          </p>
        )}
        <label className="field">
          <span className="field-label">ID</span>
          <input
            data-testid="login-id"
            autoComplete="username"
            value={id}
            onChange={(event) => setId(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            data-testid="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? (
          <p className="banner" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="generate" data-testid="login-submit" disabled={busy || !id || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
