"use client";

import { ExpenseDraftSchema } from "@/domain/expense";
import type { ExpenseExtractor } from "./types";

const MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

export function createOnDeviceExtractor(): ExpenseExtractor {
  return {
    async extract(input, onProgress) {
      onProgress?.({ stage: "loading", progress: 0 });
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      const engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback(report) { onProgress?.({ stage: "loading", progress: report.progress }); },
      });
      onProgress?.({ stage: "parsing" });
      const completion = await engine.chat.completions.create({
        messages: [{ role: "user", content: `Return JSON only. Extract merchant, amountPaise (integer), currency (INR), date (${input.date ?? new Date().toISOString().slice(0, 10)} if absent), category, status (draft or needs_review), notes, and source (on_device_model). Never guess unreadable values. Expense: ${input.text}` }],
        response_format: { type: "json_object" },
      });
      return ExpenseDraftSchema.parse(JSON.parse(completion.choices[0]?.message.content ?? "{}"));
    },
  };
}
