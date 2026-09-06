export type Allocation = { personId: string; amountPaise: number };

export type SplitInput =
  | { mode: "personal"; totalPaise: number; ownerId: string }
  | { mode: "equal"; totalPaise: number; personIds: string[] }
  | { mode: "exact"; totalPaise: number; amounts: Record<string, number> }
  | { mode: "percentage"; totalPaise: number; percentages: Record<string, number> }
  | { mode: "weighted"; totalPaise: number; weights: Record<string, number> }
  | { mode: "shared-remainder"; totalPaise: number; ownerId: string; personalPaise: number; personIds: string[] }
  | { mode: "unresolved"; totalPaise: number };

export type AllocationResult = { allocations: Allocation[]; remainderPaise: number; resolved: boolean };

function distribute(totalPaise: number, entries: Array<[string, number]>): Allocation[] {
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= 0 || entries.length === 0) return [];

  const floors = entries.map(([personId, weight]) => ({ personId, amountPaise: Math.floor((totalPaise * weight) / totalWeight) }));
  let remaining = totalPaise - floors.reduce((sum, item) => sum + item.amountPaise, 0);
  for (let index = 0; remaining > 0; index = (index + 1) % floors.length) {
    floors[index].amountPaise += 1;
    remaining -= 1;
  }
  return floors;
}

function result(totalPaise: number, allocations: Allocation[]): AllocationResult {
  const allocated = allocations.reduce((sum, allocation) => sum + allocation.amountPaise, 0);
  return { allocations, remainderPaise: totalPaise - allocated, resolved: allocated === totalPaise };
}

export function calculateAllocations(input: SplitInput): AllocationResult {
  if (!Number.isInteger(input.totalPaise) || input.totalPaise <= 0) throw new Error("Expense total must be positive integer paise");

  switch (input.mode) {
    case "unresolved":
      return { allocations: [], remainderPaise: input.totalPaise, resolved: false };
    case "personal":
      return result(input.totalPaise, [{ personId: input.ownerId, amountPaise: input.totalPaise }]);
    case "equal":
      return result(input.totalPaise, distribute(input.totalPaise, input.personIds.map((id) => [id, 1])));
    case "exact":
      return result(input.totalPaise, Object.entries(input.amounts).map(([personId, amountPaise]) => ({ personId, amountPaise })));
    case "percentage":
      return result(input.totalPaise, distribute(input.totalPaise, Object.entries(input.percentages)));
    case "weighted":
      return result(input.totalPaise, distribute(input.totalPaise, Object.entries(input.weights)));
    case "shared-remainder": {
      if (input.personalPaise < 0 || input.personalPaise > input.totalPaise) throw new Error("Personal amount must be within the expense total");
      const shared = distribute(input.totalPaise - input.personalPaise, input.personIds.map((id) => [id, 1]));
      const merged = new Map<string, number>(shared.map((item) => [item.personId, item.amountPaise]));
      merged.set(input.ownerId, (merged.get(input.ownerId) ?? 0) + input.personalPaise);
      return result(input.totalPaise, [...merged].map(([personId, amountPaise]) => ({ personId, amountPaise })));
    }
  }
}
