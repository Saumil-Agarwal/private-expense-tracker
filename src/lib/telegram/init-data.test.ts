import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyTelegramInitData } from "./init-data";

const token = "123456:test-token";

function signedInitData(overrides: Record<string, string> = {}) {
  const fields = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "query-1",
    user: JSON.stringify({ id: 314159, first_name: "Saumil" }),
    ...overrides,
  });
  const dataCheck = [...fields.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  fields.set("hash", createHmac("sha256", secret).update(dataCheck).digest("hex"));
  return fields.toString();
}

describe("verifyTelegramInitData", () => {
  it("returns the verified Telegram identity", () => {
    expect(verifyTelegramInitData(signedInitData(), token, 300)).toMatchObject({ id: 314159, first_name: "Saumil" });
  });

  it("rejects altered data", () => {
    expect(() => verifyTelegramInitData(signedInitData().replace("Saumil", "Mallory"), token, 300)).toThrow("Invalid Telegram signature");
  });

  it("rejects expired data", () => {
    const old = String(Math.floor(Date.now() / 1000) - 301);
    expect(() => verifyTelegramInitData(signedInitData({ auth_date: old }), token, 300)).toThrow("Telegram session expired");
  });
});
