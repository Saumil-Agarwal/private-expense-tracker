import { describe, expect, it } from "vitest";

import { assertAllowedOutboundUrl } from "./network-policy";

describe("assertAllowedOutboundUrl", () => {
  it.each([
    "https://api.telegram.org/bot-token/sendMessage",
    "https://sample.supabase.co/rest/v1/transactions",
    "http://127.0.0.1:11434/api/chat",
    "/api/expenses",
  ])("allows approved destination %s", (url) => {
    expect(() => assertAllowedOutboundUrl(url)).not.toThrow();
  });

  it.each([
    "https://api.openai.com/v1/responses",
    "https://generativelanguage.googleapis.com/v1/models",
    "https://api.anthropic.com/v1/messages",
    "https://unknown.example/infer",
  ])("rejects hosted inference destination %s", (url) => {
    expect(() => assertAllowedOutboundUrl(url)).toThrow("Outbound destination is not allowed");
  });
});
