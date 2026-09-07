import { describe, expect, it } from "vitest";
import { createOwnerSession, verifyOwnerSession } from "./session";

describe("owner session", () => {
  it("round trips a signed owner session", () => {
    const token = createOwnerSession(314159, "secret-with-enough-length", 1000, 60);
    expect(verifyOwnerSession(token, "secret-with-enough-length", 1050)).toBe(314159);
  });

  it("rejects tampering, the wrong secret, and expiry", () => {
    const token = createOwnerSession(314159, "secret-with-enough-length", 1000, 60);
    expect(verifyOwnerSession(`${token}x`, "secret-with-enough-length", 1050)).toBeNull();
    expect(verifyOwnerSession(token, "different-secret-value", 1050)).toBeNull();
    expect(verifyOwnerSession(token, "secret-with-enough-length", 1061)).toBeNull();
  });
});
