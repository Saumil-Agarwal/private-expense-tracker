import { parseExpenseText } from "./parser";
import type { ExpenseExtractor } from "./types";

export const manualExtractor: ExpenseExtractor = {
  async extract(input) {
    return parseExpenseText(input.text, input.date);
  },
};
