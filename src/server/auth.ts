import { verifyTelegramInitData } from "@/lib/telegram/init-data";
import { verifyOwnerSession } from "@/server/session";

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

export function authenticateOwnerRequest(request: Request): number {
  const allowedId = Number(process.env.TELEGRAM_ALLOWED_USER_ID);
  if (!Number.isSafeInteger(allowedId)) throw new Error("Owner authentication is not configured");
  const raw = request.headers.get("x-telegram-init-data");
  if (raw) return authenticateTelegramRequest(request);
  const cookie = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith("ledger_session="))?.slice("ledger_session=".length);
  const sessionId = verifyOwnerSession(cookie, process.env.LEDGER_SESSION_SECRET ?? "");
  if (sessionId === allowedId) return allowedId;
  if (process.env.NODE_ENV !== "production") return allowedId;
  throw new Error("Owner session is missing");
}
