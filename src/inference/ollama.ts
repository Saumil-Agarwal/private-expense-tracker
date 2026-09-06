import { ExpenseDraftSchema } from "@/domain/expense";
import { assertAllowedOutboundUrl } from "@/lib/privacy/network-policy";
import type { ExpenseExtractor } from "./types";

export function createOllamaExtractor(model = "gemma3:4b"): ExpenseExtractor {
  return {
    async extract(input) {
      const endpoint = "http://127.0.0.1:11434/api/chat";
      assertAllowedOutboundUrl(endpoint);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: "json",
          messages: [{ role: "user", content: `Extract this expense as JSON with merchant, amountPaise, currency INR, date, category, status, notes and source ollama. Do not guess missing values.\n\n${input.text}` }],
        }),
      });
      if (!response.ok) throw new Error("Local Ollama is unavailable");
      const result = (await response.json()) as { message?: { content?: string } };
      return ExpenseDraftSchema.parse(JSON.parse(result.message?.content ?? "{}"));
    },
  };
}
