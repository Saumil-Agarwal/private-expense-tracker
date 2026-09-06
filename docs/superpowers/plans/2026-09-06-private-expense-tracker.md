# Private Expense Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a private Telegram Mini App that parses expenses on-device, stores only confirmed structured records in Supabase, and runs continuously on Vercel.

**Architecture:** A mobile-first Next.js application hosts the Mini App and Telegram webhook. Browser-only OCR and language-model adapters create validated drafts; server routes validate Telegram identity and persist confirmed records to a Supabase schema protected by RLS. Direct Telegram commands use deterministic parsing and never invoke a hosted model.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Zod, Supabase Postgres, Telegram Bot API, Vitest, Testing Library, Playwright, browser OCR, WebLLM-compatible on-device inference, Ollama development adapter.

**Spec:** `docs/superpowers/specs/2026-09-06-private-expense-tracker-design.md`

## Global Constraints

- No hosted LLM endpoint may receive expense text, OCR text, receipt images, prompts, or model responses.
- Receipt images selected in the Mini App remain in browser memory and are never uploaded.
- All persisted financial rows belong to one verified Telegram user.
- Every exposed Supabase table has RLS enabled; the service-role key remains server-only.
- All model output is schema-validated and user-confirmed before persistence.
- Unknown allocations remain unresolved and do not contribute to settlement totals.
- Dependency versions and the lockfile are committed.

---

### Task 1: Application foundation and privacy guard

**Files:**
- Create: `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `src/lib/privacy/network-policy.ts`
- Test: `src/lib/privacy/network-policy.test.ts`

**Interfaces:**
- Produces: `assertAllowedOutboundUrl(url: string): void`
- Produces: responsive application shell and test/build scripts.

- [ ] Write a failing Vitest test proving Telegram, Supabase and same-origin URLs are allowed while hosted model domains are rejected.
- [ ] Run `npm test -- src/lib/privacy/network-policy.test.ts` and confirm failure because the module does not exist.
- [ ] Scaffold the pinned Next.js application and implement `assertAllowedOutboundUrl` with an explicit allow-list, rejecting unknown AI inference hosts.
- [ ] Run the focused test, `npm run lint`, and `npm run build`; confirm all pass.
- [ ] Commit with `feat: scaffold private expense tracker`.

### Task 2: Domain model and split engine

**Files:**
- Create: `src/domain/expense.ts`, `src/domain/splits.ts`, `src/domain/currency.ts`
- Test: `src/domain/expense.test.ts`, `src/domain/splits.test.ts`

**Interfaces:**
- Produces: `ExpenseDraftSchema`, `ConfirmedExpenseSchema`, `ExpenseDraft`, `ConfirmedExpense`.
- Produces: `calculateAllocations(input: SplitInput): AllocationResult` where totals are integer paise.

- [ ] Write failing tests for personal, equal, exact, percentage, weighted, shared-remainder, unresolved, and rounding cases.
- [ ] Run `npm test -- src/domain` and confirm the missing exports fail.
- [ ] Implement Zod schemas, paise conversion helpers, and allocation algorithms that either reconcile exactly or return an explicit remainder.
- [ ] Run domain tests and confirm all pass.
- [ ] Commit with `feat: add expense model and split engine`.

### Task 3: Supabase schema and access control

**Files:**
- Create: `supabase/config.toml`
- Create through CLI: `supabase/migrations/<timestamp>_initial_expense_schema.sql`
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/types.ts`
- Test: `src/lib/supabase/schema.test.ts`

**Interfaces:**
- Produces tables and policies listed in the specification.
- Produces: `createServerSupabaseClient(): SupabaseClient` available only in server modules.

- [ ] Write a schema contract test that checks every user-owned table declares `user_id`, enables RLS, and defines no anonymous permissive policy.
- [ ] Generate the migration with `supabase migration new initial_expense_schema` rather than inventing a timestamp.
- [ ] Implement tables, constraints, indexes, ownership policies, and a security-invoker monthly summary view.
- [ ] Run schema tests and Supabase local migration verification when Docker is available.
- [ ] Commit with `feat: add secure expense database schema`.

### Task 4: Telegram identity and webhook

**Files:**
- Create: `src/lib/telegram/init-data.ts`, `src/lib/telegram/api.ts`, `src/lib/telegram/update.ts`
- Create: `src/app/api/telegram/webhook/route.ts`
- Test: `src/lib/telegram/init-data.test.ts`, `src/app/api/telegram/webhook/route.test.ts`

**Interfaces:**
- Produces: `verifyTelegramInitData(raw: string, botToken: string, maxAgeSeconds: number): TelegramIdentity`.
- Produces: `POST /api/telegram/webhook` with secret-header verification, update deduplication, allow-listing, `/start`, `/expense`, and image redirection.

- [ ] Write failing tests using fixed HMAC fixtures for valid, altered, expired and unauthorized Telegram data.
- [ ] Write failing webhook tests for invalid secret, duplicate update, `/start`, deterministic `/expense`, and direct image responses.
- [ ] Implement identity verification using Web Crypto/Node crypto and constant-time comparison; implement the webhook without logging payload bodies.
- [ ] Run focused tests and confirm all pass.
- [ ] Commit with `feat: add secure Telegram intake`.

### Task 5: On-device extraction adapters

**Files:**
- Create: `src/inference/types.ts`, `src/inference/parser.ts`, `src/inference/manual.ts`, `src/inference/web-model.ts`, `src/inference/ollama.ts`, `src/inference/ocr.ts`
- Create: `src/workers/ocr.worker.ts`
- Test: `src/inference/parser.test.ts`, `src/inference/privacy.test.ts`

**Interfaces:**
- Produces: `ExpenseExtractor.extract(input: ExtractionInput): Promise<ExpenseDraft>`.
- Produces: `extractReceiptText(file: File): Promise<string>` executed in a browser worker.
- Produces client-only web-model and localhost-only Ollama adapters.

- [ ] Write failing parsing tests for representative restaurant, grocery, Amazon, transit and uncertain-split inputs.
- [ ] Write a static privacy test that rejects hosted inference URLs, server imports, and receipt-upload requests in inference modules.
- [ ] Implement deterministic parsing fallback, browser worker OCR, lazy on-device model loading, strict JSON extraction, and local Ollama development mode.
- [ ] Run inference and privacy tests and confirm all pass.
- [ ] Commit with `feat: add on-device expense extraction`.

### Task 6: Persistence API and expense interface

**Files:**
- Create: `src/app/api/expenses/route.ts`, `src/app/api/expenses/[id]/route.ts`, `src/app/api/dashboard/route.ts`
- Create: `src/components/expense-entry.tsx`, `src/components/expense-review.tsx`, `src/components/split-editor.tsx`, `src/components/transaction-list.tsx`, `src/components/monthly-summary.tsx`, `src/components/unresolved-queue.tsx`
- Create: `src/app/expenses/page.tsx`, `src/app/review/page.tsx`, `src/app/summary/page.tsx`, `src/app/settings/page.tsx`
- Test: `src/app/api/expenses/route.test.ts`, `src/components/split-editor.test.tsx`

**Interfaces:**
- Produces authenticated CRUD routes accepting only `ConfirmedExpenseSchema` payloads.
- Produces mobile entry, confirmation, split, history, unresolved and summary flows.

- [ ] Write failing API tests for valid save, invalid totals, unauthorized access and cross-user access.
- [ ] Write failing component tests for editing extracted fields, unresolved save, rounding assignment and final confirmation.
- [ ] Implement server routes, focused components and accessible mobile navigation.
- [ ] Run API/component tests, lint and build; confirm all pass.
- [ ] Commit with `feat: add expense review and ledger`.

### Task 7: PWA, Mini App integration and end-to-end tests

**Files:**
- Create: `public/manifest.webmanifest`, `public/icons/*`
- Create: `src/components/telegram-provider.tsx`, `src/components/install-status.tsx`
- Create: `playwright.config.ts`, `e2e/expense-flow.spec.ts`, `e2e/privacy.spec.ts`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`

**Interfaces:**
- Produces installable mobile web application and Telegram theme/identity bridge.
- Produces end-to-end coverage of manual and locally extracted expense flows.

- [ ] Write failing Playwright tests for app launch, text extraction review, flexible split, unresolved queue, monthly summary and absence of receipt/model network calls.
- [ ] Add the manifest, icons, Telegram client bridge, theme mapping and local draft retry storage.
- [ ] Run Playwright tests at mobile and desktop viewport sizes.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, and the production dependency audit.
- [ ] Commit with `feat: complete Telegram Mini App experience`.

### Task 8: Provision GitHub, Supabase, Vercel and Telegram

**Files:**
- Create: `.env.example`, `.gitignore`, `README.md`
- Modify: provider-managed `.vercel/project.json` and local Supabase linkage metadata without committing secrets.

**Interfaces:**
- Produces a private GitHub repository, linked Supabase project, linked Vercel project, production deployment and configured Telegram webhook/Mini App.

- [ ] Create the private GitHub repository and push `main`; verify repository visibility is private.
- [ ] Create/link the Supabase project, apply the committed migration, run database advisors, and verify RLS with authenticated and unauthorized test queries.
- [ ] Create/link the Vercel project, configure required environment variables by name without printing values, and deploy production.
- [ ] Configure the Telegram webhook secret and Mini App URL, then send a synthetic `/start` update and one sandbox transaction.
- [ ] Verify health, app load, Supabase persistence, dashboard totals, unauthorized rejection and zero hosted-LLM requests.
- [ ] Commit documentation with `docs: add deployment and privacy verification` and push `main`.
