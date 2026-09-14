import { ExpenseDraftSchema, rupeesToPaise, type ExpenseDraft } from "@/domain/expense";
import type { ParticipantCatalog, SplitIntent } from "./split-intent";

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
    .replace(/\b(?:split\s+(?:equally\s*)?(?:with|among|between)|split\s+equally|with)\b.*$/i, "")
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

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentions(text: string, name: string) {
  return new RegExp(`\\b${escaped(name)}\\b`, "iu").test(text);
}

export function parseExpenseInstruction(text: string, date: string, catalog: ParticipantCatalog): { draft: ExpenseDraft; splitIntent?: SplitIntent } {
  const draft = parseExpenseText(text, date);
  const group = catalog.groups.find((candidate) => mentions(text, candidate.name));
  const exactShares = catalog.people.flatMap((person) => {
    const match = text.match(new RegExp(`\\b${escaped(person.name)}\\b\\s*(?:[:=-]?\\s*)(?:₹|rs\\.?|inr)\\s*([\\d,]+(?:\\.\\d{1,2})?)`, "iu"));
    return match ? [{ personName: person.name, value: Number(match[1].replaceAll(",", "")) }] : [];
  });
  const percentageShares = catalog.people.flatMap((person) => {
    const match = text.match(new RegExp(`\\b${escaped(person.name)}\\b\\s*(?:[:=-]?\\s*)([\\d.]+)\\s*%`, "iu"));
    return match ? [{ personName: person.name, value: Number(match[1]) }] : [];
  });
  const participantNames = exactShares.length
    ? exactShares.map((share) => share.personName)
    : percentageShares.length
      ? percentageShares.map((share) => share.personName)
      : group ? [] : catalog.people.filter((person) => mentions(text, person.name)).map((person) => person.name);
  let mode: SplitIntent["mode"] = "unresolved";
  let shares: SplitIntent["shares"] = [];
  if (exactShares.length) { mode = "exact"; shares = exactShares; }
  else if (percentageShares.length) { mode = "percentage"; shares = percentageShares; }
  else if (group || (participantNames.length && /\b(?:split|with|among|between)\b/i.test(text))) mode = "equal";
  if (!group && !participantNames.length && mode === "unresolved") return { draft };
  return { draft, splitIntent: { groupName: group?.name ?? null, participantNames, mode, shares } };
}
