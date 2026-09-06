import { ExpenseDraftSchema, rupeesToPaise, type ExpenseDraft } from "@/domain/expense";

const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/amazon\s*(fresh|grocery)|amazon.*grocer/i, "Amazon groceries"],
  [/dmart|nature'?s basket|supermarket|grocer/i, "Supermarkets"],
  [/uber|ola|cab/i, "Cab"],
  [/restaurant|cafe|dinner|lunch|burma burma|bastian/i, "Restaurants"],
  [/bus|redbus/i, "Bus"],
];

function extractMerchant(text: string, amountToken: string): string {
  let merchant = text
    .replace(amountToken, " ")
    .replace(/(?:₹|rs\.?|inr)/gi, " ")
    .replace(/^\s*(?:paid|spent|payment|expense)\s+/i, "")
    .replace(/^\s*(?:at|to)\s+/i, "")
    .replace(/\b(?:using|via|on)\s+(?:my\s+)?[a-z0-9 -]*(?:card|account|upi|wallet)\b.*$/i, "")
    .replace(/\b(?:split unknown|unknown split|needs review)\b.*$/i, "")
    .replace(/\b(?:groceries|grocery|restaurant|cab|bus)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!merchant) merchant = "Unspecified merchant";
  return merchant;
}

export function parseExpenseText(text: string, date = new Date().toISOString().slice(0, 10)): ExpenseDraft {
  const amountMatch = text.match(/(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amountMatch) throw new Error("Could not find an amount");
  const merchant = extractMerchant(text, amountMatch[0]);
  const category = CATEGORY_RULES.find(([pattern]) => pattern.test(`${merchant} ${text}`))?.[1];
  const unresolved = /split\s+(?:is\s+)?unknown|unknown\s+split|not sure.*split/i.test(text);
  return ExpenseDraftSchema.parse({
    merchant,
    amountPaise: rupeesToPaise(amountMatch[1]),
    currency: "INR",
    category,
    date,
    status: unresolved ? "needs_review" : "draft",
    notes: unresolved ? "Split unknown" : undefined,
    source: "manual",
  });
}
