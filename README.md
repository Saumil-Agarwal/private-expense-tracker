# Ledgerly

A local-first, single-user expense tracker. Receipt OCR and language-model inference run locally; only confirmed structured transactions are stored in Supabase.

## Privacy model

- No OpenAI, Anthropic, Gemini, or hosted inference endpoint is configured.
- Receipt files stay in browser memory and are never uploaded.
- Browser inference uses WebLLM; local development may use Ollama at `127.0.0.1:11434`.
- Supabase receives only the structured information explicitly confirmed by the user.

## Local setup

1. Install dependencies with `pnpm install`.
2. Install and open Ollama, then run `ollama pull qwen3.5:9b-q4_K_M`.
3. Copy `.env.example` to `.env.local` and populate the Supabase values.
4. Run the Supabase migration in `supabase/migrations`.
5. Start the app with `pnpm dev` and open `http://localhost:3000`; it redirects directly to Overview.

On the new-expense screen, type any ownership instruction and paste or choose up to ten screenshots. Images stay queued until you press **Create draft**, then Ollama reads them together as one expense. The local Next.js route sends the in-memory image bytes to Ollama at `127.0.0.1`; Ollama does not need permission to open the original Desktop file. Set `OLLAMA_RECEIPT_MODEL` to try another installed multimodal model.

Use **Groups** in the navigation to create reusable participant groups with individual member controls, or create one without leaving an expense draft. Group members begin selected for an expense; **Me** is included by default but can be removed or unchecked.

The Overview accepts an inclusive date range and independently reconciles every confirmed expense against its participant allocations. It also verifies that confirmed expenses equal all participant shares and that confirmed plus unresolved expenses equal the final recorded total. All calculations use integer paise.

## Local-only safety boundary

This version intentionally has no user authentication. Run it only on your local machine or another trusted, non-public network. Do not deploy it to a public URL without adding an authentication design first. Supabase credentials remain server-only and are never sent to the browser.

## Commands

- `pnpm test` — unit, security, schema and component tests
- `pnpm lint` — static checks
- `pnpm build` — production build
- `pnpm verify` — deterministic gate: complete tests, lint, and production build
