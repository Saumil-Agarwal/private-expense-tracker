"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";

export function TelegramSetupForm() {
  const [secret, setSecret] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState("saving");
    setMessage("");
    const response = await fetch("/api/telegram/setup", {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setState("error");
      setMessage(result.error ?? "Setup failed");
      return;
    }
    setSecret("");
    setState("done");
    setMessage("Telegram is connected. Send your bot a message to start.");
  }

  return (
    <form className="setup-card" onSubmit={submit}>
      <label htmlFor="webhook-secret">Telegram webhook secret</label>
      <input
        id="webhook-secret"
        type="password"
        autoComplete="off"
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
        placeholder="Use the value saved in Vercel"
        required
      />
      <button className="button-primary" disabled={state === "saving"} type="submit">
        {state === "saving" ? <LoaderCircle className="spin" size={17} /> : state === "done" ? <CheckCircle2 size={17} /> : null}
        Connect Telegram
      </button>
      {message ? <p className={state === "error" ? "setup-error" : "setup-success"}>{message}</p> : null}
      <small>The secret is sent only to your own Vercel function and is never stored in this browser.</small>
    </form>
  );
}
