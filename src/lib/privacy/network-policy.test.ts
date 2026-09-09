import { describe, expect, it } from "vitest";

import { assertAllowedOutboundUrl } from "./network-policy";

describe("assertAllowedOutboundUrl", () => {
  it.each([
    "http://127.0.0.1:11434/api/chat",
    "/api/expenses",
  ])("allows approved destination %s", (url) => {
    expect(() => assertAllowedOutboundUrl(url)).not.toThrow();
  });

  it.each([
    "https://api.telegram.org/bot-token/sendMessage",
    "https://api.openai.com/v1/responses",
    "https://generativelanguage.googleapis.com/v1/models",
    "https://api.anthropic.com/v1/messages",
    "https://unknown.example/infer",
  ])("rejects hosted inference destination %s", (url) => {
    expect(() => assertAllowedOutboundUrl(url)).toThrow("Outbound destination is not allowed");
  });

  it("allows only the configured Supabase project", () => {
    expect(() => assertAllowedOutboundUrl("https://sample.supabase.co/rest/v1/transactions", "https://sample.supabase.co")).not.toThrow();
    expect(() => assertAllowedOutboundUrl("https://other.supabase.co/rest/v1/transactions", "https://sample.supabase.co")).toThrow("Outbound destination is not allowed");
  });
});
