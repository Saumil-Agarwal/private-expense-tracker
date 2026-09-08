# Local-only Ledgerly Design

## Goal

Convert Ledgerly from a Telegram-aware application with standalone browser authentication into a local-first, single-user application. The root URL opens the Overview directly, local use requires no authentication or browser access key, and Telegram is removed from the application and database vocabulary.

The change must preserve existing expenses, groups, people, categories, and allocations. Receipt images and inference remain local. Only confirmed structured expense data is sent to Supabase.

## Architecture

The browser renders the Next.js application and calls same-origin route handlers for expenses, groups, and receipt inference. The route handlers use a shared local-owner context to resolve the one application profile and perform database operations through the server-only Supabase client. The browser never receives the Supabase secret.

Text parsing remains an immediate in-browser operation. Receipt interpretation is invoked only after the user explicitly creates a draft. The local receipt endpoint sends the queued in-memory images to Ollama at `127.0.0.1:11434`; if Ollama fails, the browser may use the existing on-device OCR fallback. No Telegram script, webhook, bot API, or external inference service participates in the flow.

The root route redirects directly to `/summary`. The primary screens are Overview, Expenses, Groups, and Add expense.

## Local owner identity

The schema retains `profiles` and the `user_id` foreign keys on user-owned records. This preserves the existing relational model and leaves a clean ownership boundary if authentication is added in the future.

A migration replaces the Telegram identity with a stable, non-secret profile key:

- add `profiles.profile_key`;
- assign `local-owner` to the existing single owner profile;
- make `profile_key` unique and non-null;
- remove `profiles.telegram_user_id`;
- drop the unused `telegram_updates` table;
- remove `telegram` from the allowed transaction source values.

The application remains explicitly single-user. A shared server helper resolves the profile whose key is `local-owner`, creating it with display name `Owner` if it does not exist. Concurrent creation is handled through a unique constraint and a read-after-conflict path so owner resolution is deterministic.

Existing records keep their profile UUID and therefore retain every current relationship. The migration must reject an ambiguous multi-profile database rather than silently assigning or merging multiple owners.

## Authentication removal

All Telegram and standalone-authentication surfaces are removed:

- Telegram client libraries, provider, script, globals, setup UI, setup route, and webhook route;
- Telegram init-data headers and server verification;
- browser unlock form, access-key endpoint, signed session cookie, and session helpers;
- Telegram and ledger access/session environment variables;
- Telegram network-policy allowance and Telegram-specific tests.

Expense and group route handlers no longer branch on authentication or return authentication-specific errors. They call the local-owner helper directly.

This architecture is safe only while the Next.js application is local and not exposed to untrusted clients. The README must state that deploying this version on a public network exposes the ledger APIs without user authentication. Reintroducing deployment requires an explicit authentication design.

## Expense validation and errors

Merchant remains required because a non-empty label is necessary to identify a transaction. The editor validates the trimmed merchant before sending a request. If it is empty, the merchant field displays `Enter a merchant name`, receives invalid accessibility state, and the save request is not sent.

Other client validation failures are converted into concise user-facing messages rather than rendering Zod's serialized issue array. The API also returns a stable validation error shape for malformed requests so client and server validation remain consistent.

The local-owner and database layers return operational messages without classifying failures as authentication errors.

## Groups

A dedicated `/groups` page is linked from the application navigation. It lists saved groups and their members and provides a structured creation form. Members are added individually, and `Me` can be explicitly included or excluded. Saving creates the group and its people through the groups API and updates the list without leaving the page.

The Add expense flow continues to allow group selection and offers the same group creation control inline. Creating a group inline preserves the current expense draft and selects the new group immediately. This iteration supports creating, viewing, and reusing groups; editing and deleting groups are deferred.

## Financial reconciliation

The Overview independently recalculates financial invariants from the raw transaction and allocation rows returned by the expense API. All arithmetic uses integer paise.

For every confirmed expense, the sum of its allocations must equal its recorded amount. The workings display `Verified` when they match and `Mismatch by ₹X` when they do not. Unresolved expenses remain explicitly outside participant allocations.

The summary also proves both aggregate equations:

`confirmed expense total = sum of participant totals`

`recorded total = confirmed expense total + unresolved total`

The UI displays the confirmed, unresolved, participant, and recorded totals together with a reconciliation result. A stored inconsistency is surfaced rather than hidden or silently repaired.

## Performance

The normal application shell performs no Telegram SDK download, Telegram polling, session check, or unlock round trip. `/` redirects immediately to Overview.

Text draft creation continues to use the deterministic parser and does not initialize model code. Ollama and browser OCR work runs only after a receipt draft is requested. Heavy browser model code remains dynamically imported only when the user explicitly chooses the on-device model.

No speculative inference or automatic processing is added.

## Deterministic verification

Implementation follows test-first red-green cycles. Automated coverage must include:

- root navigation resolves to `/summary`;
- local expense and group requests do not require Telegram headers or a session;
- local owner resolution selects or creates exactly the `local-owner` profile;
- the migration preserves the existing profile UUID and rejects ambiguous profile state;
- blank or whitespace-only merchant input shows `Enter a merchant name` and performs no save request;
- valid expense submission still sends the expected structured payload;
- each confirmed expense is verified against the sum of its allocations;
- a one-paise allocation mismatch is detected and reported;
- participant totals equal the confirmed expense total for balanced data;
- confirmed plus unresolved expenses equal the recorded total;
- equal-split remainder paise are assigned deterministically;
- groups can be created, loaded, and selected without losing an expense draft;
- Telegram and access-key references are absent from runtime source, environment examples, and current setup documentation;
- the outbound network policy permits only local Ollama and configured Supabase destinations.

The repository exposes one deterministic verification command that runs, in order, the complete Vitest suite, ESLint, and the production Next.js build. Completion is reported only after that command exits successfully and the merchant regression test has demonstrated the expected red-green cycle.

## Scope boundaries

This change does not remove Supabase, add Supabase Auth, expose Ollama to the browser, redesign the expense screens, or flatten user-owned tables. It does not make the application safe for public deployment. Telegram can be reconsidered later as a separate integration with its own authentication and ingestion design.
