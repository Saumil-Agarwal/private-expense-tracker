import { assertAllowedOutboundUrl } from "@/lib/privacy/network-policy";

export async function sendTelegramMessage(input: { botToken: string; chatId: number; text: string; appUrl: string }): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${input.botToken}/sendMessage`;
  assertAllowedOutboundUrl(endpoint);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: input.chatId,
      text: input.text,
      reply_markup: { inline_keyboard: [[{ text: "Open Ledgerly", web_app: { url: input.appUrl } }]] },
    }),
  });
  if (!response.ok) throw new Error(`Telegram delivery failed (${response.status})`);
}

export async function setTelegramWebhook(input: { botToken: string; appUrl: string; webhookSecret: string }): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${input.botToken}/setWebhook`;
  assertAllowedOutboundUrl(endpoint);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: `${input.appUrl.replace(/\/$/, "")}/api/telegram/webhook`,
      secret_token: input.webhookSecret,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    }),
  });
  if (!response.ok) throw new Error(`Telegram webhook registration failed (${response.status})`);
}
