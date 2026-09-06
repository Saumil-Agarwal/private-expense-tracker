import type { ExpenseDraft } from "@/domain/expense";

export type ExtractionInput = { text: string; date?: string };
export type ExtractionProgress = { stage: "loading" | "reading" | "parsing"; progress?: number };

export interface ExpenseExtractor {
  extract(input: ExtractionInput, onProgress?: (progress: ExtractionProgress) => void): Promise<ExpenseDraft>;
}
