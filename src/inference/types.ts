import type { ExpenseDraft } from "@/domain/expense";
import type { ParticipantCatalog, SplitIntent } from "./split-intent";

export type ExtractionInput = { text: string; date?: string };
export type ExtractionProgress = { stage: "loading" | "reading" | "parsing"; progress?: number };

export interface ExpenseExtractor {
  extract(input: ExtractionInput, onProgress?: (progress: ExtractionProgress) => void): Promise<ExpenseDraft>;
}

export type DraftInferenceResult = { draft: ExpenseDraft; splitIntent?: SplitIntent };

export interface ContextualExpenseExtractor {
  extract(input: ExtractionInput, catalog: ParticipantCatalog, onProgress?: (progress: ExtractionProgress) => void): Promise<DraftInferenceResult>;
}
