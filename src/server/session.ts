import { createHmac, timingSafeEqual } from "node:crypto";

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createOwnerSession(userId: number, secret: string, nowSeconds = Math.floor(Date.now() / 1000), ttlSeconds = 60 * 60 * 24 * 30) {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: nowSeconds + ttlSeconds })).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyOwnerSession(token: string | undefined, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): number | null {
  if (!token || !secret) return null;
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra) return null;
  const expected = signature(payload, secret);
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString()) as { userId?: unknown; expiresAt?: unknown };
    return Number.isSafeInteger(value.userId) && typeof value.expiresAt === "number" && value.expiresAt >= nowSeconds ? value.userId as number : null;
  } catch { return null; }
}
