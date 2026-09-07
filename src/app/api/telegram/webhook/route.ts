import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram/api";
import { planTelegramResponse } from "@/lib/telegram/update";

type TelegramUpdate = {
  update_id: number;
  message?: { chat: { id: number }; from?: { id: number }; text?: string; photo?: unknown[] };
};

export async function POST(request: Request) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret || request.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const message = update.message;
  if (!message?.from) return NextResponse.json({ ok: true });

  const allowedUserId = Number(process.env.TELEGRAM_ALLOWED_USER_ID);
  if (!Number.isSafeInteger(allowedUserId) || message.from.id !== allowedUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServerSupabaseClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert({ telegram_user_id: allowedUserId, display_name: "Owner" }, { onConflict: "telegram_user_id" })
    .select("id")
    .single();
  if (profileError || !profile) return NextResponse.json({ error: "Owner profile is not configured" }, { status: 503 });

  const { error: dedupeError } = await supabase.from("telegram_updates").insert({ user_id: profile.id, telegram_update_id: update.update_id });
  if (dedupeError?.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
  if (dedupeError) return NextResponse.json({ error: "Unable to record update" }, { status: 503 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!appUrl || !botToken) return NextResponse.json({ error: "Bot environment is incomplete" }, { status: 503 });
  const plan = planTelegramResponse({ text: message.text, hasPhoto: Boolean(message.photo?.length), appUrl });
  await sendTelegramMessage({ botToken, chatId: message.chat.id, text: plan.text, appUrl: plan.url });
  return NextResponse.json({ ok: true });
}
