import { rupeesToPaise } from "@/domain/expense";

export type TelegramResponsePlan =
  | { kind: "mini_app"; text: string; url: string }
  | { kind: "draft"; text: string; url: string; merchant: string; amountPaise: number }
  | { kind: "receipt_redirect"; text: string; url: string }
  | { kind: "help"; text: string; url: string };

export function planTelegramResponse(input: { text?: string; hasPhoto?: boolean; appUrl: string }): TelegramResponsePlan {
  const url = `${input.appUrl.replace(/\/$/, "")}/expenses/new`;
  if (input.hasPhoto) {
    return { kind: "receipt_redirect", url, text: "For private on-device reading, open the app and select the receipt there. The image will stay on your device." };
  }
  const text = input.text?.trim() ?? "";
  const match = text.match(/^\/expense\s+(?:₹|rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)\s+(.+)$/i);
  if (match) {
    const merchant = match[2].trim();
    const amountPaise = rupeesToPaise(match[1]);
    const draftUrl = `${url}?text=${encodeURIComponent(`₹${match[1]} ${merchant}`)}`;
    return { kind: "draft", merchant, amountPaise, url: draftUrl, text: `Draft: ₹${match[1]} at ${merchant}. Open the private review screen to choose category and split.` };
  }
  if (text === "/start") return { kind: "mini_app", url, text: "Add an expense privately. Receipt reading and language processing happen on your device." };
  return { kind: "help", url, text: "Use /expense 2400 Amazon Fresh, or open the app for natural language, receipts and flexible splits." };
}
