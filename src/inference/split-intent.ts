import { z } from "zod";

import { personNameKey } from "@/domain/person";
import { rupeesToPaise } from "@/domain/expense";
import { calculateAllocations, type Allocation } from "@/domain/splits";

export type CatalogPerson = { id: string; persistedId?: string; name: string };
export type CatalogGroup = { id: string; name: string; people: CatalogPerson[] };
export type ParticipantCatalog = { groups: CatalogGroup[]; people: CatalogPerson[] };

export const SplitIntentSchema = z.object({
  groupName: z.string().trim().min(1).nullable().default(null),
  participantNames: z.array(z.string().trim().min(1)).default([]),
  mode: z.enum(["equal", "exact", "percentage", "unresolved"]).default("unresolved"),
  shares: z.array(z.object({ personName: z.string().trim().min(1), value: z.number().nonnegative() })).default([]),
});

export type SplitIntent = z.infer<typeof SplitIntentSchema>;
export type ResolvedSplit = {
  group: CatalogGroup | null;
  people: CatalogPerson[];
  selectedIds: string[];
  allocations: Allocation[];
  status: "confirmed" | "needs_review";
  warning?: string;
};

export function resolveSplitIntent(rawIntent: SplitIntent, amountPaise: number, catalog: ParticipantCatalog): ResolvedSplit {
  const intent = SplitIntentSchema.parse(rawIntent);
  const groupMatches = intent.groupName ? catalog.groups.filter((group) => personNameKey(group.name) === personNameKey(intent.groupName!)) : [];
  const group = groupMatches.length === 1 ? groupMatches[0] : null;
  const allPeople = [...catalog.people, ...catalog.groups.flatMap((item) => item.people)];
  const peopleByKey = new Map<string, CatalogPerson[]>();
  for (const person of allPeople) {
    const key = personNameKey(person.name);
    const matches = peopleByKey.get(key) ?? [];
    if (!matches.some((match) => match.id === person.id)) matches.push(person);
    peopleByKey.set(key, matches);
  }
  const requestedNames = intent.participantNames.length ? intent.participantNames : group?.people.map((person) => person.name) ?? [];
  const people: CatalogPerson[] = [];
  let unresolved = Boolean(intent.groupName && !group);
  for (const name of requestedNames) {
    const matches = peopleByKey.get(personNameKey(name)) ?? [];
    if (matches.length !== 1) { unresolved = true; continue; }
    if (!people.some((person) => person.id === matches[0].id)) people.push(matches[0]);
  }
  const selectedIds = people.map((person) => person.id);
  let allocations: Allocation[] = [];
  if (!unresolved && selectedIds.length > 0 && intent.mode === "equal") {
    allocations = calculateAllocations({ mode: "equal", totalPaise: amountPaise, personIds: selectedIds }).allocations;
  } else if (!unresolved && intent.mode === "exact") {
    const resolvedShares = intent.shares.map((share) => ({ share, matches: peopleByKey.get(personNameKey(share.personName)) ?? [] }));
    const shareIds = resolvedShares.flatMap(({ matches }) => matches.length === 1 ? [matches[0].id] : []);
    unresolved = resolvedShares.some(({ matches }) => matches.length !== 1)
      || new Set(shareIds).size !== shareIds.length
      || shareIds.length !== selectedIds.length
      || shareIds.some((id) => !selectedIds.includes(id));
    if (!unresolved) allocations = resolvedShares.map(({ share, matches }) => ({ personId: matches[0].id, amountPaise: rupeesToPaise(share.value) }));
    if (allocations.reduce((sum, allocation) => sum + allocation.amountPaise, 0) !== amountPaise) unresolved = true;
  } else if (!unresolved && intent.mode === "percentage") {
    const resolvedShares = intent.shares.map((share) => ({ share, matches: peopleByKey.get(personNameKey(share.personName)) ?? [] }));
    const shareIds = resolvedShares.flatMap(({ matches }) => matches.length === 1 ? [matches[0].id] : []);
    unresolved = resolvedShares.some(({ matches }) => matches.length !== 1)
      || new Set(shareIds).size !== shareIds.length
      || shareIds.length !== selectedIds.length
      || shareIds.some((id) => !selectedIds.includes(id))
      || Math.abs(intent.shares.reduce((sum, share) => sum + share.value, 0) - 100) > 0.0001;
    if (!unresolved) {
      allocations = resolvedShares.map(({ share, matches }) => ({ personId: matches[0].id, amountPaise: Math.floor(amountPaise * share.value / 100) }));
      let remainder = amountPaise - allocations.reduce((sum, allocation) => sum + allocation.amountPaise, 0);
      for (let index = 0; remainder > 0; index = (index + 1) % allocations.length, remainder--) allocations[index].amountPaise += 1;
    }
  } else {
    unresolved = true;
  }
  if (unresolved) allocations = [];
  return {
    group,
    people,
    selectedIds,
    allocations,
    status: unresolved ? "needs_review" : "confirmed",
    warning: unresolved ? "Check the inferred people and split." : undefined,
  };
}
