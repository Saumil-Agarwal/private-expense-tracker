import { NextResponse } from "next/server";

import { setTelegramWebhook } from "@/lib/telegram/api";

export async function POST(request: Request) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const suppliedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!webhookSecret || suppliedSecret !== webhookSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const allowedUserId = Number(process.env.TELEGRAM_ALLOWED_USER_ID);
  if (!botToken || !appUrl || !Number.isSafeInteger(allowedUserId)) {
    return NextResponse.json({ error: "Telegram environment is incomplete" }, { status: 503 });
  }

  try {
    await setTelegramWebhook({ botToken, appUrl, webhookSecret });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Telegram setup failed" },
      { status: 502 },
    );
  }
}
