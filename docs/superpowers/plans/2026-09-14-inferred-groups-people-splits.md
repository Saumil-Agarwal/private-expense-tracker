# Inferred Groups, People, and Splits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically select saved groups and people and calculate a proposed split from expense instructions, while letting users choose any existing person manually.

**Architecture:** A pure inference resolver converts model/parser name-based intent into stable saved IDs and validated allocations. Owner-scoped APIs provide a participant catalog; receipt and text inference consume names only, while the expense UI controls the selected group, participants, and editable split.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Supabase, Vitest, Testing Library, local Ollama/WebLLM.

**Spec:** `docs/superpowers/specs/2026-09-14-inferred-groups-people-splits-design.md`

## Global Constraints

- Resolve names after trimming whitespace and comparing case-insensitively.
- Preserve persisted display spelling and stable person IDs; use `me` for the owner.
- Never include database IDs in model prompts or create people from inferred unknown names.
- Only domain code calculates allocations; confirmed allocations must equal the expense total.
- Catalog failures must not discard the current expense input or receipt queue.
- Before pushing `main`, run `pnpm verify`.

---

### Task 1: Owner-scoped people catalog

**Files:**
- Create: `src/app/api/people/route.ts`
- Create: `src/app/api/people/route.test.ts`
- Modify: `src/components/group-picker.tsx`

**Interfaces:**
- Produces: `GET /api/people -> { people: GroupPerson[] }`, ordered by name, with owner ID mapped to `me`.
- Produces: exported `GroupPerson`, `ExpenseGroup`, and `ParticipantCatalog` types for inference and UI consumers.

- [ ] **Step 1: Write the failing route test**

```ts
it("returns saved people with the stable owner ID", async () => {
  mockPeople([{ id: "owner-person", name: "Me", is_owner: true }, { id: "rahul-id", name: "Rahul", is_owner: false }]);
  const response = await GET();
  await expect(response.json()).resolves.toEqual({ people: [
    { id: "me", persistedId: "owner-person", name: "Me" },
    { id: "rahul-id", persistedId: "rahul-id", name: "Rahul" },
  ] });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run src/app/api/people/route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the people route**

Use `getLocalOwnerContext()`, select `id,name,is_owner` from `people`, filter by `user_id` and `is_active`, order by `name`, map owner identity to `me`, and return the same error shape as the groups route.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm vitest run src/app/api/people/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/people/route.ts src/app/api/people/route.test.ts src/components/group-picker.tsx
git commit -m "feat: expose saved people catalog"
```

### Task 2: Resolve name-based split intent

**Files:**
- Create: `src/inference/split-intent.ts`
- Create: `src/inference/split-intent.test.ts`
- Modify: `src/domain/splits.ts`
- Modify: `src/domain/splits.test.ts`

**Interfaces:**
- Produces: `SplitIntentSchema` with `{ groupName, participantNames, mode, shares }` where `mode` is `equal | exact | percentage | unresolved`.
- Produces: `resolveSplitIntent(intent, amountPaise, catalog): ResolvedSplit` returning `{ group, people, selectedIds, allocations, status, warning? }`.
- Produces: percentage allocation support that distributes rounding remainder deterministically.

- [ ] **Step 1: Write failing resolver tests**

Cover literal expectations for: `Flatmates` resolving to its complete member list and equal paise split; `Rahul` and `Priya` resolving without a group; exact rupee shares; percentages totaling 100; unknown/ambiguous names returning `needs_review` while retaining recognized IDs.

```ts
expect(resolveSplitIntent({ groupName: "flatmates", participantNames: [], mode: "equal", shares: [] }, 10001, catalog)).toMatchObject({
  group: { id: "group-1" }, selectedIds: ["me", "rahul-id"],
  allocations: [{ personId: "me", amountPaise: 5001 }, { personId: "rahul-id", amountPaise: 5000 }], status: "confirmed",
});
```

- [ ] **Step 2: Run resolver tests and verify RED**

Run: `pnpm vitest run src/inference/split-intent.test.ts src/domain/splits.test.ts`

Expected: FAIL because the schema, resolver, and percentage calculation are absent.

- [ ] **Step 3: Implement minimal schema and resolver**

Index groups and people with `personNameKey`. Prefer an exact normalized group match, resolve explicit participant names independently, reject duplicate/unknown matches, and call `calculateAllocations` for equal/exact modes. Convert percentage weights to paise using floor values plus ordered remainder distribution; reject totals other than 100.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm vitest run src/inference/split-intent.test.ts src/domain/splits.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/inference/split-intent.ts src/inference/split-intent.test.ts src/domain/splits.ts src/domain/splits.test.ts
git commit -m "feat: resolve inferred split intent"
```

### Task 3: Infer splits from text instructions

**Files:**
- Modify: `src/inference/parser.ts`
- Modify: `src/inference/parser.test.ts`
- Modify: `src/inference/types.ts`
- Modify: `src/inference/web-model.ts`

**Interfaces:**
- Produces: `DraftInferenceResult = { draft: ExpenseDraft; splitIntent?: SplitIntent }`.
- Produces: `parseExpenseInstruction(text, date, catalog): DraftInferenceResult` while keeping `parseExpenseText` compatible.
- Changes: `ExpenseExtractor.extract` returns `DraftInferenceResult` and accepts an optional participant catalog.

- [ ] **Step 1: Write failing text inference tests**

```ts
expect(parseExpenseInstruction("Dinner ₹1200 with Rahul and Priya, split equally", "2026-09-14", catalog).splitIntent).toEqual({
  groupName: null, participantNames: ["Rahul", "Priya"], mode: "equal", shares: [],
});
expect(parseExpenseInstruction("Cab ₹900 split with Flatmates", "2026-09-14", catalog).splitIntent?.groupName).toBe("Flatmates");
```

Also test exact syntax such as `Rahul ₹700, Priya ₹500` and unknown names remaining unresolved.

- [ ] **Step 2: Run parser tests and verify RED**

Run: `pnpm vitest run src/inference/parser.test.ts`

Expected: FAIL because split intent is not returned.

- [ ] **Step 3: Implement deterministic text intent parsing and richer model prompt**

Parse only explicit saved group/person names present in the instruction. Recognize `split equally`, `split with <group>`, exact rupee shares, and percentage shares. Update WebLLM JSON instructions to return expense fields plus the name-based split intent using a compact name catalog; validate through `SplitIntentSchema` and `ExpenseDraftSchema`.

- [ ] **Step 4: Run parser tests and verify GREEN**

Run: `pnpm vitest run src/inference/parser.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/inference/parser.ts src/inference/parser.test.ts src/inference/types.ts src/inference/web-model.ts
git commit -m "feat: infer splits from expense text"
```

### Task 4: Replace hard-coded receipt groups with saved catalog

**Files:**
- Modify: `src/app/api/inference/receipt/route.ts`
- Modify: `src/app/api/inference/receipt/route.test.ts`
- Modify: `src/inference/receipt.ts`
- Modify: `src/inference/receipt.test.ts`

**Interfaces:**
- Consumes: `SplitIntentSchema`, `resolveSplitIntent`, and saved catalog types.
- Changes: `buildReceiptResult(raw, date, catalog, model)` resolves saved names and returns stable person/group IDs.

- [ ] **Step 1: Write failing receipt tests**

Mock owner-scoped saved groups containing persisted IDs, return `groupName: "Flatmates"` from Ollama, and assert the response uses those saved IDs rather than `LOCAL_GROUPS`. Add a people-only instruction result and an unknown-name review result.

- [ ] **Step 2: Run receipt tests and verify RED**

Run: `pnpm vitest run src/inference/receipt.test.ts src/app/api/inference/receipt/route.test.ts`

Expected: FAIL because receipt inference still uses the hard-coded `201` group.

- [ ] **Step 3: Implement catalog-backed receipt inference**

Load groups and people through `getLocalOwnerContext()` before calling Ollama. Put only names in the prompt. Extend the JSON schema with participant names, split mode, and shares. Resolve the response using domain code, retain personal-item behavior, and remove `LOCAL_GROUPS`.

- [ ] **Step 4: Run receipt tests and verify GREEN**

Run: `pnpm vitest run src/inference/receipt.test.ts src/app/api/inference/receipt/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/inference/receipt/route.ts src/app/api/inference/receipt/route.test.ts src/inference/receipt.ts src/inference/receipt.test.ts
git commit -m "feat: infer receipt splits from saved groups"
```

### Task 5: Controlled inferred group and editable participant UI

**Files:**
- Modify: `src/components/group-picker.tsx`
- Create: `src/components/group-picker.test.tsx`
- Modify: `src/components/split-editor.tsx`
- Modify: `src/components/split-editor.test.tsx`
- Modify: `src/components/expense-entry.tsx`
- Modify: `src/components/expense-entry.test.tsx`

**Interfaces:**
- Changes: `GroupPicker` receives `{ groups, selectedId, onSelect }` instead of privately owning selection/catalog state.
- Changes: `SplitEditor` receives `availablePeople`, `initialSelectedIds`, and `initialAllocations` in addition to current props.
- Consumes: `DraftInferenceResult` and `resolveSplitIntent` to initialize editor state.

- [ ] **Step 1: Write failing component tests**

Assert that a receipt/text inference result selects the matching group option, renders inferred allocation amounts, and submits saved IDs. Assert that choosing `Rahul` from an “Existing person” select adds `rahul-id` without manual entry. Assert changing groups invalidates the old confirmed split.

- [ ] **Step 2: Run component tests and verify RED**

Run: `pnpm vitest run src/components/group-picker.test.tsx src/components/split-editor.test.tsx src/components/expense-entry.test.tsx`

Expected: FAIL because selection and initial split state are not controlled.

- [ ] **Step 3: Implement controlled editor state**

Load `/api/groups` and `/api/people` in `ExpenseEntry`, preserving the draft on either failure. Resolve inference into `group`, `participants`, and `split`. Pass controlled selection to `GroupPicker`; seed `SplitEditor` from inferred values and expose saved-person selection plus existing manual entry. On group/participant changes, emit `{ status: "needs_review", allocations: [] }` until the user recalculates.

- [ ] **Step 4: Run component tests and verify GREEN**

Run: `pnpm vitest run src/components/group-picker.test.tsx src/components/split-editor.test.tsx src/components/expense-entry.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run related route/domain tests**

Run: `pnpm vitest run src/app/api/expenses/route.test.ts src/app/api/groups/route.test.ts src/inference/parser.test.ts src/inference/receipt.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/group-picker.tsx src/components/group-picker.test.tsx src/components/split-editor.tsx src/components/split-editor.test.tsx src/components/expense-entry.tsx src/components/expense-entry.test.tsx
git commit -m "feat: populate and edit inferred expense splits"
```

### Task 6: Full verification and integration

**Files:**
- Modify only files needed to correct failures caused by Tasks 1–5.

**Interfaces:**
- Consumes all preceding deliverables.
- Produces a verified build ready for `main`.

- [ ] **Step 1: Run complete verification**

Run: `pnpm verify`

Expected: all Vitest tests pass, ESLint exits zero, and `next build` completes.

- [ ] **Step 2: Inspect the final patch**

Run: `git diff --check && git status --short && git log --oneline -8`

Expected: no whitespace errors; only intentional untracked local files remain.

- [ ] **Step 3: Push the approved implementation**

```bash
git push origin main
```

Expected: local `main` and `origin/main` point to the same implementation commit.
