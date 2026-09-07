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
3. Copy `.env.example` to `.env.local` and populate the required values.
4. Run the Supabase migration in `supabase/migrations`.
5. Insert one `profiles` row with your Telegram numeric user ID.
6. Start the app with `pnpm dev`.

On the new-expense screen, type any ownership instruction first and paste a screenshot into the text box, or choose an image. The local Next.js route sends the in-memory image bytes to Ollama at `127.0.0.1`; Ollama does not need permission to open the original Desktop file. Group `201` currently resolves to Me, Anish, and Sanjeev. Set `OLLAMA_RECEIPT_MODEL` to try another installed multimodal model.

The Telegram webhook is `/api/telegram/webhook`. Configure Telegram's secret token to match `TELEGRAM_WEBHOOK_SECRET` and set the Mini App URL to `/expenses/new` on the production domain.

## Commands

- `pnpm test` — unit, security, schema and component tests
- `pnpm lint` — static checks
- `pnpm build` — production build
