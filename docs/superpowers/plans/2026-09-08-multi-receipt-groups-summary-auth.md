# Multi-receipt, Groups, Summary, and Standalone Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combine queued screenshots into one expense, persist reusable groups, allow explicit participant inclusion, expose date-filtered workings, and support secure standalone-browser saving.

**Architecture:** Extend the existing Next.js route and Supabase boundaries with focused auth, groups, and summary helpers. Keep calculation logic pure, keep UI state local to the relevant component, and preserve Telegram verification while adding a signed owner session.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Supabase, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-09-08-multi-receipt-groups-summary-auth-design.md`

## Global Constraints

- One draft accepts 1–10 screenshots, each no larger than 10 MB.
- Screenshot paste/select only queues files; only **Create draft** starts inference.
- **Me is selected by default** and can be explicitly excluded.
- Telegram verification remains supported; browser access uses an HttpOnly signed session.
- Unresolved expenses are never attributed to a participant.
- Preserve unrelated user changes already present in the worktree.

---

### Task 1: Receipt batch contract

**Files:**
- Modify: `src/app/api/inference/receipt/route.ts`
- Modify: `src/components/expense-entry.tsx`
- Test: `src/app/api/inference/receipt/route.test.ts`
- Test: `src/components/expense-entry.test.tsx`

**Interfaces:**
- Consumes: multipart fields named `images`, plus `instructions`
- Produces: the existing `ReceiptResult` contract for one combined expense

- [ ] Write route and component tests proving two pasted files remain queued until **Create draft**, then travel in one request.
- [ ] Run the focused tests and confirm they fail because the current paste handler processes only one `image` immediately.
- [ ] Add a file queue, removal controls, combined OCR fallback, and multi-image route parsing/prompting.
- [ ] Run the focused tests and full receipt tests until green.
- [ ] Commit the receipt batch increment.

### Task 2: Explicit participant inclusion

**Files:**
- Modify: `src/components/split-editor.tsx`
- Test: `src/components/split-editor.test.tsx`

**Interfaces:**
- Consumes: `people: Person[]`
- Produces: confirmed allocations containing only explicitly selected people

- [ ] Write tests proving Me begins selected, can be unchecked, and equal split excludes unchecked people.
- [ ] Run the focused test and confirm the current chip-only participant UI fails it.
- [ ] Implement accessible participant checkboxes and filter every split calculation through them.
- [ ] Run the focused tests until green.
- [ ] Commit the participant increment.

### Task 3: Persisted groups

**Files:**
- Create: `src/app/api/groups/route.ts`
- Create: `src/app/api/groups/route.test.ts`
- Create: `src/components/group-picker.tsx`
- Create: `src/components/group-picker.test.tsx`
- Modify: `src/components/expense-entry.tsx`
- Modify: `src/domain/expense.ts`
- Modify: `src/app/api/expenses/route.ts`
- Create: `supabase/migrations/20260908120000_add_transaction_group.sql`
- Modify: `src/lib/supabase/types.ts`

**Interfaces:**
- Produces: `Group = { id: string; name: string; people: Person[] }`; GET `/api/groups`; POST `/api/groups` with `{ name, memberNames }`; optional `groupId` on confirmed expenses
- Consumes: owner resolution from Task 5 when available; until then the existing owner helper

- [ ] Write failing group validation, route mapping, picker, and expense-schema tests.
- [ ] Run them and confirm failures are feature-specific.
- [ ] Implement the migration, group route, picker, and transaction group persistence.
- [ ] Run focused tests and schema tests until green.
- [ ] Commit the groups increment.

### Task 4: Date-filtered workings

**Files:**
- Create: `src/domain/summary.ts`
- Create: `src/domain/summary.test.ts`
- Modify: `src/app/api/expenses/route.ts`
- Modify: `src/components/ledger-view.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `calculateSummary(transactions)` returning expense workings, participant totals, final total, and unresolved totals
- GET `/api/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD` returns named allocations and optional group

- [ ] Write failing pure calculation tests for shares, owner exclusion, unresolved expenses, and final totals.
- [ ] Run the focused tests and confirm the helper is absent.
- [ ] Implement the helper, inclusive route filters, date controls, and workings UI.
- [ ] Run summary, ledger, and route tests until green.
- [ ] Commit the summary increment.

### Task 5: Secure standalone owner session

**Files:**
- Create: `src/server/session.ts`
- Create: `src/server/session.test.ts`
- Create: `src/app/api/session/route.ts`
- Create: `src/components/unlock-form.tsx`
- Modify: `src/server/auth.ts`
- Modify: `src/components/expense-entry.tsx`
- Modify: `src/components/ledger-view.tsx`
- Modify: `.env.example`

**Interfaces:**
- Produces: signed `ledger_session` cookie and `authenticateOwnerRequest(request): number`
- Consumes: `LEDGER_ACCESS_KEY`, `LEDGER_SESSION_SECRET`, `TELEGRAM_ALLOWED_USER_ID`, or signed Telegram init data

- [ ] Write failing signature, expiry, wrong-key, API 401, and unlock/retry tests.
- [ ] Run focused tests and confirm failures match the missing standalone flow.
- [ ] Implement HMAC session helpers, session route, owner authentication fallback, and unlock UI.
- [ ] Run auth and affected component/route tests until green.
- [ ] Commit the authentication increment.

### Task 6: Final verification and delivery

**Files:**
- Modify: `README.md`

- [ ] Document multi-image capture, group setup, date summaries, and the two standalone environment variables.
- [ ] Run `pnpm test` and require zero failures.
- [ ] Run `pnpm lint` and require zero errors.
- [ ] Run `pnpm build` and require a successful production build.
- [ ] Inspect `git diff --check`, `git status --short`, and the final diff without including unrelated user files.
- [ ] Commit documentation and any verification-only corrections.
- [ ] Push the verified `main` branch to `origin/main`.
