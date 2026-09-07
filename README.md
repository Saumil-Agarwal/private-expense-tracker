# Ledgerly

A private expense tracker built as a Telegram Mini App. Receipt OCR and language-model inference run in the browser; only confirmed structured transactions are sent to the Vercel API and stored in Supabase.

## Privacy model

- No OpenAI, Anthropic, Gemini, or hosted inference endpoint is configured.
- Receipt files stay in browser memory and are never uploaded.
- Browser inference uses WebLLM; local development may use Ollama at `127.0.0.1:11434`.
- Telegram and Supabase receive only the information explicitly sent or confirmed by the user.

## Local setup

1. Install dependencies with `pnpm install`.
2. Install and open Ollama, then run `ollama pull qwen3.5:9b-q4_K_M`.
3. Copy `.env.example` to `.env.local` and populate the required values. Set `LEDGER_ACCESS_KEY` to the private key you will type when using Ledgerly outside Telegram, and set `LEDGER_SESSION_SECRET` to a random value of at least 16 characters.
4. Run the Supabase migration in `supabase/migrations`.
5. Insert one `profiles` row with your Telegram numeric user ID.
6. Start the app with `pnpm dev`.

On the new-expense screen, type any ownership instruction and paste or choose up to ten screenshots. Images stay queued until you press **Create draft**, then Ollama reads them together as one expense. The local Next.js route sends the in-memory image bytes to Ollama at `127.0.0.1`; Ollama does not need permission to open the original Desktop file. Set `OLLAMA_RECEIPT_MODEL` to try another installed multimodal model.

Use **Create group** in the expense form to save reusable participant groups. Group members begin selected for an expense; **Me** is included by default but can be unchecked. The Summary screen accepts an inclusive date range and shows the arithmetic for every expense, each participant's combined share, unresolved expenses, and the final recorded total.

When opened from Telegram, Ledgerly verifies Telegram's signed Mini App identity. When opened directly in a browser, enter `LEDGER_ACCESS_KEY` once to receive a secure, HttpOnly owner session cookie.

The Telegram webhook is `/api/telegram/webhook`. Configure Telegram's secret token to match `TELEGRAM_WEBHOOK_SECRET` and set the Mini App URL to `/expenses/new` on the production domain.

## Commands

- `pnpm test` — unit, security, schema and component tests
- `pnpm lint` — static checks
- `pnpm build` — production build
