import { afterEach, describe, expect, it, vi } from "vitest";

import { setTelegramWebhook } from "./api";

describe("setTelegramWebhook", () => {
  afterEach(() => vi.restoreAllMocks());

  it("registers the app webhook with Telegram's secret token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

    await setTelegramWebhook({
      botToken: "123:bot-token",
      appUrl: "https://ledger.example",
      webhookSecret: "webhook-secret",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bot123:bot-token/setWebhook",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          url: "https://ledger.example/api/telegram/webhook",
          secret_token: "webhook-secret",
          allowed_updates: ["message"],
          drop_pending_updates: false,
        }),
      }),
    );
  });

  it("fails when Telegram rejects registration", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("no", { status: 400 }));
    await expect(setTelegramWebhook({ botToken: "123:x", appUrl: "https://ledger.example", webhookSecret: "secret" }))
      .rejects.toThrow("Telegram webhook registration failed (400)");
  });
});
