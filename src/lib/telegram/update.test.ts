import { describe, expect, it } from "vitest";

import { planTelegramResponse } from "./update";

describe("planTelegramResponse", () => {
  it("opens the Mini App for start", () => {
    expect(planTelegramResponse({ text: "/start", appUrl: "https://ledger.example" })).toMatchObject({ kind: "mini_app", url: "https://ledger.example/expenses/new" });
  });

  it("parses a deterministic expense command", () => {
    expect(planTelegramResponse({ text: "/expense 2400 Amazon Fresh", appUrl: "https://ledger.example" })).toMatchObject({
      kind: "draft",
      amountPaise: 240000,
      merchant: "Amazon Fresh",
    });
  });

  it("redirects receipt images to private on-device intake", () => {
    expect(planTelegramResponse({ hasPhoto: true, appUrl: "https://ledger.example" }).kind).toBe("receipt_redirect");
  });
});
