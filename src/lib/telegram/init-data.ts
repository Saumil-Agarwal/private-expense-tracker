import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramIdentity = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export function verifyTelegramInitData(raw: string, botToken: string, maxAgeSeconds = 300): TelegramIdentity {
  const params = new URLSearchParams(raw);
  const receivedHash = params.get("hash");
  if (!receivedHash) throw new Error("Missing Telegram signature");
  params.delete("hash");

  const dataCheck = [...params.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secret).update(dataCheck).digest("hex");
  const received = Buffer.from(receivedHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("Invalid Telegram signature");

  const authDate = Number(params.get("auth_date"));
  if (!Number.isInteger(authDate) || Date.now() / 1000 - authDate > maxAgeSeconds) throw new Error("Telegram session expired");
  const user = params.get("user");
  if (!user) throw new Error("Telegram user is missing");
  return JSON.parse(user) as TelegramIdentity;
}
