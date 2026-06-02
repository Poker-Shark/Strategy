# Implementation Plan — Biz Ops Core

Each step ends green (`npm test`) before the next starts.

## Step 0 — Harness ✅
- Add `vitest`, `test`/`test:watch` scripts. Smoke test.

## Step 1 — Lock existing Treasury logic with tests
Before changing anything, pin current behavior so a refactor can't silently break it.
- `tests/treasury.constants.test.js` — `txHash`, `isReimbursable`, `isBusinessVendor`,
  `fmtMoney`.
- `tests/treasury.parsers.test.js` — `detectTransactionType`, `parseDate`, `parseCSVRow`,
  `parseChaseCSV` (header + positional), `classifyRow`, `filterToPokerShark`.

## Step 2 — Receipts
- `js/treasury/receipts.js` — `isValidReceiptUrl`, `hasReceipt`, `needsReceipt`,
  `receiptCoverage`. Pure.
- `tests/treasury.receipts.test.js` — thresholds, exempt types, coverage math, bad URLs.
- Wire-in (no test, DOM): `receipt_url` field in add/edit modal; 📎 in row; coverage card
  in dashboard; "Missing receipts" subtab using `needsReceipt`.
- `supabase-schema.sql` — `ALTER TABLE treasury_transactions ADD COLUMN IF NOT EXISTS
  receipt_url TEXT;`

## Step 3 — Business domain model
- `js/domain/model.js` — enums, `normalizeBusinessState`, `validateBusinessState`,
  helper selectors.
- `tests/domain.model.test.js` — normalization shape, every validation rule (happy +
  each failure), and that the real seeded `STATE` validates clean.

## Step 4 — Simplify
- `/simplify`-style pass over the new code: dedupe, drop dead branches, tighten.
- Re-run full suite green.

## Step 5 — Push
- Commit per step, open PR on `Poker-Shark/Strategy`.
