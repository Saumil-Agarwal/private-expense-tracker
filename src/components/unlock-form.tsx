"use client";
import { useState } from "react";

export function UnlockForm({ onUnlocked }: { onUnlocked: () => void }) {
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function unlock() {
    setBusy(true); setError("");
    const response = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accessKey }) });
    setBusy(false);
    if (!response.ok) return setError("That access key did not work.");
    onUnlocked();
  }
  return <div className="unlock-card"><strong>Unlock your ledger</strong><p>Enter your private browser access key, or open Ledgerly from Telegram.</p><label>Access key<input type="password" value={accessKey} onChange={(event) => setAccessKey(event.target.value)} /></label><button className="button-primary" type="button" disabled={busy || !accessKey} onClick={unlock}>{busy ? "Unlocking…" : "Unlock"}</button>{error && <p role="alert">{error}</p>}</div>;
}
