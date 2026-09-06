# Private expense tracker design

## Objective

Build a single-user expense tracker that can be opened from Telegram, deployed on Vercel, and backed by Supabase. Natural-language and receipt interpretation must run on the user's device. The application must not send expense prompts, receipt images, or extracted receipt text to a hosted LLM.

## Privacy boundary

- Telegram may carry ordinary bot messages and launch the Mini App.
- Vercel may receive Telegram webhooks and confirmed structured transactions.
- Supabase may store confirmed structured transactions and configuration.
- Receipt images selected inside the Mini App remain in browser memory and are not uploaded.
- OCR and language-model inference run in the browser.
- The application contains no OpenAI, Anthropic, Gemini, or other hosted inference integration.
- Model weights are downloaded as static files and cached by the browser. Inference prompts and outputs stay on the device.
- Direct receipt attachments sent to the Telegram bot are not downloaded for processing. The bot replies with a link to open the Mini App and select the image there.

## Architecture

### Web application

A TypeScript Next.js application is deployed on Vercel. It serves both the Telegram Mini App and a responsive standalone interface. It contains:

- Expense entry and review screens
- On-device text parsing
- On-device OCR for screenshots and receipts
- Split editor
- Unresolved-expense queue
- Transaction history and filters
- Monthly summary
- CSV export

The UI is mobile-first because most entries will originate from Telegram.

### Telegram bot

Telegram sends webhook updates to a Vercel Function. The bot supports:

- `/start` and an `Add expense` Mini App button
- Plain structured messages such as `/expense 2400 Amazon Fresh`
- A response directing image uploads to the Mini App
- Links to unresolved expenses and the monthly summary
- Allow-listing of one Telegram user ID
- Webhook-secret verification and update deduplication

The bot does not call an LLM. Structured slash-command parsing is deterministic.

### On-device processing

The first release uses two local browser stages:

1. OCR converts a selected receipt image into text in browser memory.
2. A compact browser-compatible instruction model converts typed or OCR text into a constrained expense JSON object.

The initial text model is a compact Qwen instruction model supported by the selected browser inference runtime. The model choice is encapsulated behind an inference adapter so it can be replaced without changing the ledger or UI. The application validates all model output against a strict schema and always displays a confirmation screen before saving.

Ollama is supported as a development-only alternative on `localhost`. Production never attempts to contact the user's Mac.

### Persistence

Supabase Postgres is the system of record. Supabase Storage is not used for receipt images in the first release.

Core tables:

- `profiles`: the single allowed user and Telegram identity
- `accounts`: bank/card/cash nicknames
- `categories`: expense categories
- `people`: participants available for splits
- `groups`: reusable participant groups
- `group_members`: membership and default weights
- `transactions`: date, merchant, total, account, category, status and notes
- `transaction_items`: optional receipt line items
- `allocations`: per-person exact allocated amount
- `merchant_rules`: deterministic merchant-to-category/account defaults
- `telegram_updates`: processed update IDs for deduplication

Every user-owned table includes `user_id`. Row-level security is enabled on all exposed tables. The browser never receives a Supabase service-role key. Database operations go through authenticated application routes after Telegram Mini App `initData` validation. Public and anonymous table access is denied.

## Transaction lifecycle

1. The user opens the Mini App from Telegram.
2. The user types an expense or selects a screenshot.
3. OCR and parsing run on the device.
4. The app validates the proposed transaction and displays all extracted fields.
5. The user corrects category, account, items, participants, or split.
6. The split engine verifies that allocations equal the transaction total.
7. The confirmed structured record is sent to the Vercel API.
8. The API verifies Telegram `initData`, validates the payload again, and writes it to Supabase.
9. The UI shows the saved record and updates monthly totals.

Unknown information is preserved rather than guessed. A transaction may be saved with `needs_review` status, missing participants, or unallocated amount. Such transactions appear in the unresolved queue and are excluded from person-level settlement totals until resolved.

## Splits

The editor supports:

- Personal expense
- Equal split
- Exact amounts
- Percentages
- Weighted shares
- Item-level ownership followed by shared remainder
- Participants that vary per transaction

Stored allocations are normalized to exact currency amounts. Percentages and weights are input methods, not the final accounting representation. Rounding differences are displayed and must be assigned before confirmation.

## Summaries

The dashboard provides:

- Spending by month and category
- Spending by account
- Personal versus shared spending
- Amount allocated to each participant
- Unresolved transaction count and value
- Recent transactions

The existing category names from `finances.numbers` will be used as initial category suggestions. The Numbers file is not modified.

## Security and secrets

- Telegram bot token, webhook secret, Supabase URL, publishable key and server secret are Vercel environment variables.
- Secret values never enter the repository or client bundle.
- Telegram webhook requests are authenticated.
- Telegram Mini App `initData` is validated server-side before every protected operation.
- Payloads are schema-validated in both browser and server.
- Logs exclude receipt text, transaction notes, tokens and request bodies.
- Rate limiting applies to Telegram and application write endpoints.
- Dependency versions and the lockfile are committed.

## Error handling

- Unsupported browser inference shows a clear compatibility message and offers deterministic manual entry.
- Model download and OCR failures never discard the user's typed text.
- Invalid extraction remains editable and cannot be saved until required accounting fields pass validation.
- Duplicate Telegram updates are ignored.
- Duplicate transaction candidates are shown to the user rather than silently rejected.
- Supabase write failures preserve the confirmed draft locally for retry.

## Verification

Automated tests cover:

- Expense schema validation
- Equal, exact, percentage and weighted split calculations
- Currency rounding
- Telegram webhook authentication and deduplication
- Telegram Mini App identity validation
- Row ownership expectations in migrations
- API rejection of invalid or unauthorized requests
- Privacy regression: no hosted model endpoint or receipt upload path

Browser tests cover text entry, screenshot-to-review, confirmation, unresolved expenses, dashboard totals and mobile layout. Deployment verification covers the Vercel health endpoint, Telegram webhook, Supabase schema and RLS advisors.

## Provisioning and delivery

1. Create a private GitHub repository.
2. Scaffold the Next.js application locally and push the initial commit.
3. Create and link a new Supabase project.
4. Apply and verify database migrations and RLS policies.
5. Create and link a new Vercel project from the GitHub repository.
6. Add secrets through provider environment controls.
7. Create or connect the Telegram bot and configure its webhook and Mini App URL.
8. Deploy, run end-to-end tests, and verify that no hosted LLM calls occur.

## Acceptance criteria

- The user can open the application from Telegram on a phone.
- Typed expenses and locally selected screenshots can become editable transaction drafts using on-device processing.
- No receipt image, OCR text, or LLM prompt is sent to a hosted inference service.
- Confirmed transactions persist in Supabase and appear in transaction history and monthly summaries.
- Flexible and unresolved splits behave as defined.
- Only the configured Telegram user can read or write financial data.
- The code is stored in a private GitHub repository and the application is deployed on Vercel.
