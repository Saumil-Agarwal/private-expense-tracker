import { verifyTelegramInitData } from "@/lib/telegram/init-data";

export function authenticateTelegramRequest(request: Request): number {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const allowedId = Number(process.env.TELEGRAM_ALLOWED_USER_ID);
  if (!botToken || !Number.isSafeInteger(allowedId)) throw new Error("Telegram authentication is not configured");
  const raw = request.headers.get("x-telegram-init-data");
  if (!raw) {
    if (process.env.NODE_ENV !== "production" && request.headers.get("x-dev-user-id") === String(allowedId)) return allowedId;
    throw new Error("Telegram identity is missing");
  }
  const identity = verifyTelegramInitData(raw, botToken, 3600);
  if (identity.id !== allowedId) throw new Error("Telegram user is not allowed");
  return identity.id;
}
