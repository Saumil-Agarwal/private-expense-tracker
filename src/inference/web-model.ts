"use client";

import { ExpenseDraftSchema } from "@/domain/expense";
import { SplitIntentSchema } from "./split-intent";
import type { ContextualExpenseExtractor } from "./types";

const MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

export function createOnDeviceExtractor(): ContextualExpenseExtractor {
  return {
    async extract(input, catalog, onProgress) {
      onProgress?.({ stage: "loading", progress: 0 });
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      const engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback(report) { onProgress?.({ stage: "loading", progress: report.progress }); },
      });
      onProgress?.({ stage: "parsing" });
      const completion = await engine.chat.completions.create({
        messages: [{ role: "user", content: `Return JSON only with draft and optional splitIntent. draft contains merchant, amountPaise (integer), currency (INR), date (${input.date ?? new Date().toISOString().slice(0, 10)} if absent), category, status (draft or needs_review), notes, and source (on_device_model). splitIntent contains groupName, participantNames, mode (equal, exact, percentage, or unresolved), and shares as personName/value pairs. Known groups: ${catalog.groups.map((group) => `${group.name}: ${group.people.map((person) => person.name).join(", ")}`).join("; ")}. Known people: ${catalog.people.map((person) => person.name).join(", ")}. Use names only; never invent people or IDs. Expense: ${input.text}` }],
        response_format: { type: "json_object" },
      });
      const result = JSON.parse(completion.choices[0]?.message.content ?? "{}");
      return {
        draft: ExpenseDraftSchema.parse(result.draft),
        splitIntent: result.splitIntent ? SplitIntentSchema.parse(result.splitIntent) : undefined,
      };
    },
  };
}
