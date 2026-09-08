# Local-only Ledgerly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Telegram and browser authentication, open directly on Overview, add reusable group creation, and display deterministic expense and aggregate reconciliation.

**Architecture:** Same-origin Next.js route handlers resolve one stable `local-owner` profile through a focused server helper and keep the Supabase secret server-side. Pure domain functions perform all paise-based reconciliation, while client components render the results and validate expense input before calling the APIs.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod 4, Supabase, Vitest, Testing Library, ESLint

**Spec:** `docs/superpowers/specs/2026-09-09-local-only-ledgerly-design.md`

## Global Constraints

- Preserve existing expenses, groups, people, categories, allocations, and the existing profile UUID.
- The app is single-user and local-only; public deployment is explicitly unsupported without adding authentication.
- All money calculations use integer paise.
- The browser never receives the Supabase secret and receipt inference only calls Ollama on `127.0.0.1:11434`.
- Do not modify the user's unrelated `next-env.d.ts`, `pnpm-workspace.yaml`, or `finances.numbers` changes.
- Follow red-green TDD for every behavior change and run the full deterministic verification command before pushing `main`.

---

### Task 1: Deterministic Financial Reconciliation

**Files:**
- Modify: `src/domain/summary.ts`
- Modify: `src/domain/summary.test.ts`
- Modify: `src/components/ledger-view.tsx`
- Create: `src/components/ledger-view.test.tsx`

**Interfaces:**
- Consumes: `SummaryTransaction` rows with integer `amount_paise` and allocation amounts.
- Produces: `calculateSummary(transactions)` with `confirmedTotalPaise`, `participantTotalPaise`, `recordedTotalPaise`, `unresolved`, `balanced`, and per-expense `differencePaise`/`balanced` workings.

- [ ] **Step 1: Write failing domain tests**

Add literal fixtures proving a balanced confirmed expense, a one-paise mismatch, and the aggregate equations. The key assertions are:

```ts
expect(result.confirmedTotalPaise).toBe(13000);
expect(result.participantTotalPaise).toBe(13000);
expect(result.finalTotalPaise).toBe(14000);
expect(result.balanced).toBe(true);
expect(result.workings[0]).toMatchObject({ allocatedPaise: 9000, differencePaise: 0, balanced: true });
expect(mismatch.workings[0]).toMatchObject({ allocatedPaise: 9999, differencePaise: 1, balanced: false });
expect(mismatch.balanced).toBe(false);
```

- [ ] **Step 2: Run the summary tests and verify RED**

Run: `pnpm test src/domain/summary.test.ts`

Expected: FAIL because the reconciliation properties do not exist.

- [ ] **Step 3: Implement pure reconciliation**

Compute confirmed totals, allocation totals, unresolved totals, and per-expense differences in one pass. Treat unresolved expenses as separate from allocation verification; set aggregate `balanced` only when every confirmed expense balances and confirmed total equals participant total.

- [ ] **Step 4: Run the summary tests and verify GREEN**

Run: `pnpm test src/domain/summary.test.ts`

Expected: PASS.

- [ ] **Step 5: Write a failing Overview component test**

Stub only the external `fetch` boundary with a complete transaction response. Assert that the rendered Overview shows `Verified` for balanced data, the confirmed/unresolved/recorded equation, and `Mismatch by ₹0.01` for a one-paise discrepancy.

- [ ] **Step 6: Run the component test and verify RED**

Run: `pnpm test src/components/ledger-view.test.tsx`

Expected: FAIL because reconciliation status is not rendered.

- [ ] **Step 7: Render reconciliation results**

Update `LedgerView` to show the aggregate equation and a verification badge on every working. Keep unresolved expenses labeled separately and remove its authentication/unlock branch as part of the local-only rendering contract.

- [ ] **Step 8: Run focused tests and commit**

Run: `pnpm test src/domain/summary.test.ts src/components/ledger-view.test.tsx`

Expected: PASS.

Commit:

```bash
git add src/domain/summary.ts src/domain/summary.test.ts src/components/ledger-view.tsx src/components/ledger-view.test.tsx
git commit -m "feat: reconcile expense totals deterministically"
```

### Task 2: Local Owner Context and Schema Migration

**Files:**
- Create: `src/server/local-owner.ts`
- Create: `src/server/local-owner.test.ts`
- Create: `supabase/migrations/20260909120000_replace_telegram_owner.sql`
- Modify: `src/lib/supabase/schema.test.ts`
- Modify: `src/app/api/expenses/route.ts`
- Modify: `src/app/api/groups/route.ts`

**Interfaces:**
- Produces: `getLocalOwnerContext(): Promise<{ userId: string; supabase: SupabaseClient }>`.
- Consumes: `createServerSupabaseClient()` and the `profiles.profile_key = "local-owner"` unique constraint.

- [ ] **Step 1: Write failing local-owner tests**

Use a narrow Supabase boundary double that mirrors `from("profiles").select(...).eq(...).maybeSingle()` and insert behavior. Prove an existing profile ID is returned, a missing profile is created, and a unique-conflict retry returns the concurrently created profile.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm test src/server/local-owner.test.ts`

Expected: FAIL because `getLocalOwnerContext` does not exist.

- [ ] **Step 3: Implement local owner resolution**

Create the server-only helper with the constant profile key `local-owner`. Read first, insert only when missing, and re-read on PostgreSQL unique violation `23505`. Throw `Local owner profile could not be resolved` for any other failure.

- [ ] **Step 4: Run and verify GREEN**

Run: `pnpm test src/server/local-owner.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing schema assertions**

Extend the schema test to execute/read the complete migration set and assert the resulting migration declares `profile_key`, drops `telegram_updates`, drops `telegram_user_id`, and replaces the transaction source constraint. Assert the migration raises an exception when more than one profile exists before conversion.

- [ ] **Step 6: Run schema tests and verify RED**

Run: `pnpm test src/lib/supabase/schema.test.ts`

Expected: FAIL because the new migration is absent.

- [ ] **Step 7: Add the preservation migration**

Write an idempotence-conscious transaction that locks `profiles`, checks `count(*) <= 1`, adds nullable `profile_key`, assigns `local-owner` to the existing row, adds uniqueness/non-null constraints, drops Telegram policies/table/column, and recreates the transaction source constraint without `telegram`.

- [ ] **Step 8: Switch API routes to the local owner helper**

Remove request-based authentication and duplicated profile upserts from both route files. Use `getLocalOwnerContext()` and return `400` for validation errors and `500` for operational failures; do not return `401`.

- [ ] **Step 9: Run focused tests and commit**

Run: `pnpm test src/server/local-owner.test.ts src/lib/supabase/schema.test.ts src/server/ledger.test.ts`

Expected: PASS.

Commit:

```bash
git add src/server/local-owner.ts src/server/local-owner.test.ts supabase/migrations/20260909120000_replace_telegram_owner.sql src/lib/supabase/schema.test.ts src/app/api/expenses/route.ts src/app/api/groups/route.ts
git commit -m "refactor: resolve a stable local owner"
```

### Task 3: Remove Telegram and Browser Authentication

**Files:**
- Delete: `src/lib/telegram/`
- Delete: `src/app/api/telegram/`
- Delete: `src/components/telegram-provider.tsx`
- Delete: `src/components/telegram-setup-form.tsx`
- Delete: `src/app/setup/page.tsx`
- Delete: `src/components/unlock-form.tsx`
- Delete: `src/app/api/session/route.ts`
- Delete: `src/server/auth.ts`
- Delete: `src/server/session.ts`
- Delete: `src/server/session.test.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/expense-entry.tsx`
- Modify: `src/components/group-picker.tsx`
- Modify: `src/components/ledger-view.tsx`
- Modify: `src/lib/privacy/network-policy.ts`
- Modify: `src/lib/privacy/network-policy.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Browser route calls use same-origin fetch with no identity header.
- Outbound network policy allows relative URLs, configured Supabase HTTPS hosts, and local Ollama only.

- [ ] **Step 1: Change the network-policy test to reject Telegram**

Replace the Telegram-allowed expectation with:

```ts
expect(() => assertAllowedOutboundUrl("https://api.telegram.org/bot-token/sendMessage")).toThrow("Outbound destination is not allowed");
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm test src/lib/privacy/network-policy.test.ts`

Expected: FAIL because Telegram is still approved.

- [ ] **Step 3: Remove Telegram and auth runtime surfaces**

Delete the listed files, remove the external script/provider from the root layout, remove unlock state and `x-telegram-init-data` headers from components, remove Telegram from the outbound allowlist, and remove Telegram/access/session variables from `.env.example`.

- [ ] **Step 4: Run focused tests and type-aware lint**

Run: `pnpm test src/lib/privacy/network-policy.test.ts src/components/expense-entry.test.tsx src/components/ledger-view.test.tsx`

Run: `pnpm lint`

Expected: both commands PASS with no stale imports or browser globals.

- [ ] **Step 5: Commit**

```bash
git add -A src/lib/telegram src/app/api/telegram src/components/telegram-provider.tsx src/components/telegram-setup-form.tsx src/app/setup/page.tsx src/components/unlock-form.tsx src/app/api/session/route.ts src/server/auth.ts src/server/session.ts src/server/session.test.ts src/app/layout.tsx src/components/expense-entry.tsx src/components/group-picker.tsx src/components/ledger-view.tsx src/lib/privacy/network-policy.ts src/lib/privacy/network-policy.test.ts .env.example
git commit -m "refactor: remove Telegram and browser authentication"
```

### Task 4: Direct Overview and Merchant Validation

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/expense-entry.tsx`
- Modify: `src/components/expense-entry.test.tsx`
- Modify: `src/app/api/expenses/route.ts`
- Create: `src/app/api/expenses/route.test.ts`

**Interfaces:**
- Root page invokes Next.js `redirect("/summary")`.
- Expense editor exposes `Enter a merchant name` through accessible field error markup and makes no POST when merchant is blank.
- Invalid API payloads return `{ error: string, fieldErrors?: Record<string, string[]> }` with status `400`.

- [ ] **Step 1: Write failing merchant regression tests**

Create a text draft, blank the Merchant input, choose a valid split, press Confirm and save, then assert `Enter a merchant name`, `aria-invalid="true"`, and no `/api/expenses` POST. Add a valid-save case that asserts a same-origin POST without Telegram headers.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm test src/components/expense-entry.test.tsx`

Expected: FAIL with the current raw Zod error behavior.

- [ ] **Step 3: Implement field validation and readable errors**

Use `ConfirmedExpenseSchema.safeParse`. Map the first merchant issue to the field message, focus/mark the field invalid, and map other failures to a concise `Check the highlighted expense details` message. Send only successfully parsed data.

- [ ] **Step 4: Add a failing API validation test**

POST a complete expense body with a whitespace merchant and assert status `400`, error `Invalid expense details`, and `fieldErrors.merchant = ["Enter a merchant name"]` without invoking Supabase.

- [ ] **Step 5: Implement stable API validation output**

Separate JSON/schema validation from persistence errors and translate Zod merchant issues to the stable field message.

- [ ] **Step 6: Replace the landing page with redirect**

Use `redirect("/summary")` from `next/navigation`; remove the marketing landing markup so direct local navigation has no intermediate page.

- [ ] **Step 7: Run focused tests and commit**

Run: `pnpm test src/components/expense-entry.test.tsx src/app/api/expenses/route.test.ts`

Expected: PASS.

Commit:

```bash
git add src/app/page.tsx src/components/expense-entry.tsx src/components/expense-entry.test.tsx src/app/api/expenses/route.ts src/app/api/expenses/route.test.ts
git commit -m "fix: validate merchant before saving"
```

### Task 5: Dedicated and Inline Group Creation

**Files:**
- Create: `src/components/group-manager.tsx`
- Create: `src/components/group-manager.test.tsx`
- Create: `src/app/groups/page.tsx`
- Modify: `src/components/group-picker.tsx`
- Modify: `src/components/expense-entry.tsx`
- Modify: `src/components/app-nav.tsx`
- Modify: `src/app/api/groups/route.ts`
- Create: `src/app/api/groups/route.test.ts`

**Interfaces:**
- `GroupManager` accepts `compact?: boolean` and `onCreated?: (group: ExpenseGroup) => void`.
- Group API consumes `{ name: string; memberNames: string[] }` and returns `{ group: ExpenseGroup }`.
- `GroupPicker` loads groups and selects an inline-created group without resetting `ExpenseEntry` draft state.

- [ ] **Step 1: Write failing GroupManager component tests**

Assert a user can enter a group name, add `Me`, add `Rahul`, remove a member, and submit the literal payload `{ name: "Flatmates", memberNames: ["Me", "Rahul"] }`. Assert the returned group appears in the list and `onCreated` receives it.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm test src/components/group-manager.test.tsx`

Expected: FAIL because `GroupManager` does not exist.

- [ ] **Step 3: Implement the reusable manager and Groups page**

Build accessible individual-member controls with non-empty, case-insensitive uniqueness checks. Render existing groups and members. Add `/groups` with the normal app shell and navigation.

- [ ] **Step 4: Reuse GroupManager inline**

Replace the comma-separated creation UI in `GroupPicker` with compact `GroupManager`. On creation, append and select the returned group while leaving the parent draft untouched.

- [ ] **Step 5: Add navigation and API behavior tests**

Add a Groups link to `AppNav`. Test the groups route accepts a group without `Me`, deduplicates member names case-insensitively, and returns validation errors without authentication branches.

- [ ] **Step 6: Run focused tests and commit**

Run: `pnpm test src/components/group-manager.test.tsx src/components/expense-entry.test.tsx src/app/api/groups/route.test.ts`

Expected: PASS.

Commit:

```bash
git add src/components/group-manager.tsx src/components/group-manager.test.tsx src/app/groups/page.tsx src/components/group-picker.tsx src/components/expense-entry.tsx src/components/app-nav.tsx src/app/api/groups/route.ts src/app/api/groups/route.test.ts
git commit -m "feat: add reusable expense groups"
```

### Task 6: Documentation and Full Verification Gate

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Modify: `src/domain/expense.ts`
- Modify: any current tests that intentionally enumerate transaction sources

**Interfaces:**
- Produces: `pnpm verify`, running `pnpm test && pnpm lint && pnpm build` in that order.

- [ ] **Step 1: Update local-only documentation and domain vocabulary**

Document direct Overview startup, local Supabase/Ollama setup, group creation, visible reconciliation, and the warning that the app has no public-network authentication. Remove current Telegram/access-key instructions. Remove `telegram` from the expense source schema and update affected fixtures.

- [ ] **Step 2: Add the deterministic repository verification command**

Add to `package.json`:

```json
"verify": "pnpm test && pnpm lint && pnpm build"
```

- [ ] **Step 3: Check for stale runtime references**

Run: `rg -n "Telegram|TELEGRAM|telegram|LEDGER_ACCESS_KEY|LEDGER_SESSION_SECRET|ledger_session|x-telegram-init-data" src README.md .env.example supabase/migrations/20260909120000_replace_telegram_owner.sql`

Expected: only deliberate historical migration identifiers needed to remove old schema objects; no current runtime or setup reference.

- [ ] **Step 4: Run deterministic product verification**

Run: `pnpm verify`

Expected: Vitest reports zero failed tests, ESLint exits zero, and Next.js production build exits zero.

- [ ] **Step 5: Review the complete diff and protect unrelated changes**

Run: `git status --short`

Run: `git diff --check HEAD`

Run: `git diff HEAD -- next-env.d.ts pnpm-workspace.yaml finances.numbers`

Expected: no whitespace errors; the three unrelated user-owned paths have not been included in implementation commits.

- [ ] **Step 6: Commit documentation and verification command**

```bash
git add README.md package.json src/domain/expense.ts
git commit -m "docs: describe local-only verified workflow"
```

- [ ] **Step 7: Verify branch and push main**

Run: `git branch --show-current`

Expected: `main`.

Run: `git status --short`

Expected: only the user's pre-existing unrelated changes remain.

Run: `git push origin main`

Expected: push succeeds after the fresh `pnpm verify` run.
