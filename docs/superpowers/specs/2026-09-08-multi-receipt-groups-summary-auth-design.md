# Multi-receipt, Groups, Summary, and Standalone Access Design

## Goal

Make Ledgerly usable from both Telegram and a normal browser, combine multiple receipt screenshots into one reviewed expense, persist reusable groups, support expenses that exclude the owner, and show transparent date-filtered settlement workings.

## Capture and draft flow

Pasting or choosing images adds them to a pending screenshot queue. It never starts inference. The queue shows filenames and remove controls. Pressing **Create draft** sends all queued images together with the typed instructions to the receipt endpoint. The endpoint asks Ollama to interpret all images as parts of one expense and returns one draft, one combined item list, and one proposed allocation. Text-only draft creation remains available.

The API accepts one or more image fields, limits each image to 10 MB, and limits a draft to ten screenshots. If local Ollama is unavailable, the UI falls back to on-device OCR for every queued image, joins the extracted text, and creates one reviewable draft.

## Groups and participants

Groups and people are persisted in the existing `groups`, `group_members`, and `people` tables. A groups API lists groups and creates a named group with a unique, non-empty member list. The expense editor can create and select groups.

Selecting a group loads its members into the split editor. Each member has an explicit checkbox for the current expense. **Me is selected by default**, but can be unchecked; excluding the owner is never inferred automatically. Equal and exact splits use only checked participants. A confirmed expense must allocate its complete amount among at least one participant.

Transactions gain an optional `group_id`, allowing summaries to identify the group used for an expense without changing existing records.

## Summary and workings

The expenses GET endpoint accepts inclusive `from` and `to` ISO dates and returns each transaction with its category, group, and named allocations. The summary page exposes date inputs. It displays:

- each expense as `merchant total → participant shares`;
- a total share for every participant in the selected dates;
- the final recorded expense total for those dates;
- the number and amount of unresolved expenses, which are not silently attributed to anybody.

The arithmetic is computed by a pure domain helper and covered with unit tests, including rounding, an expense excluding Me, and unresolved expenses.

## Authentication

Telegram Mini App requests continue to use signed Telegram init data. For a normal browser, the owner enters `LEDGER_ACCESS_KEY`; a session endpoint verifies it and sets an HttpOnly, SameSite=Strict, signed cookie. The signing key is `LEDGER_SESSION_SECRET`. The server resolves either a verified Telegram identity or a valid standalone session to the configured `TELEGRAM_ALLOWED_USER_ID` owner profile. In development only, requests from the app can use the configured owner automatically.

The UI shows an unlock form when an API returns 401, then retries after the session is established. Secrets are never stored in browser storage or returned by the API.

## Errors and verification

Partial database writes are rolled back where necessary. User-facing messages distinguish authentication, inference, validation, and storage failures. New domain, route, and component behavior is test-driven. Completion requires the complete unit suite, lint, and production build to pass before pushing `main`.
