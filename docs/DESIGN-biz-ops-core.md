# Design Spec — Biz Ops Core

**Goal:** Turn the Strategy War Room from a *video-game-with-business-labels* into an
*actually well-designed business operations tool* that still uses the Dota 2 map as its
metaphor for business reality.

## The problem with today's app

The app already maps the business onto a Dota 2 map (lanes = workstreams, towers =
milestones, Roshan = main competitor, fog = the unknown), and it has a `biz`↔`dota`
label toggle. But the **toggle is a veneer**: the underlying data is game-first.

- Team members are "heroes" with `hp`, `mp`, `level`, `vision`, and a free-text `dota:`
  analogy field. Their actual business attributes (hours/week, morale, role, workstream)
  are *encoded into game stats* instead of being first-class.
- There is a literal gold **economy**, an item **shop** (Divine Rapier, Mask of Madness),
  **spawn**/**ward**/**neutral camps** with `gold`/`xp` numbers — pure game mechanics with
  no validated business meaning.
- Nothing **validates** the business state. An exec can put a member with no role on a lane
  that doesn't exist, give a milestone a status that isn't real, or place an entity off the
  map — and nothing catches it.

The bookkeeping module (**Treasury**) is the opposite: it's a genuinely good biz-ops tool
(PDF/CSV statement import, vendor-rule categorization, COGS/OPEX P&L, reimbursable
detection, dedup). But it tracks **expenses only** — there is **no concept of a receipt**,
even though "track receipts and expenses" is the #1 requirement (and receipts are what an
accountant/auditor actually asks for at tax time).

## What "well designed biz ops tool" means here

Keep the map metaphor. Make the **business model canonical** and **validated**, and close
the receipts gap. Concretely, three slices:

### Slice 1 — Test harness
Vitest (Vite-native). Every slice below ships with green tests before the next begins.
Pure logic only; no DOM/network in tests.

### Slice 2 — Receipts (requirement #1: "track receipts and expenses")
A receipt = a link to the stored document (Box / Google Drive — the stack they already use),
attached to a transaction. No blob upload; a URL is enough and is auditable.

- `treasury_transactions.receipt_url TEXT` (new column; migration in `supabase-schema.sql`).
- `js/treasury/receipts.js` — **pure** logic:
  - `hasReceipt(tx)` — truthy receipt link present.
  - `needsReceipt(tx, { threshold })` — a business purchase at/over the threshold that lacks
    a receipt (the audit-risk set). Payments/credits/fees and sub-threshold spend are exempt.
  - `receiptCoverage(txs, opts)` — `{ covered, missing, exempt, total, pct, missingAmount }`
    for a dashboard card and a "Missing receipts" worklist.
  - `isValidReceiptUrl(url)` — http(s) only.
- UI: receipt link field in the add/edit transaction modal; 📎 indicator in the row; a
  "Receipt coverage" card + "Missing receipts" sub-tab driven entirely by `receipts.js`.

### Slice 3 — Business domain model (requirements #2 & #3: map = business reality; execs describe state, org, deployment)
`js/domain/model.js` — the canonical, business-first model the map renders, with validation.

- **Enums** (the only legal values): `WORKSTREAM_STATUS`, `MILESTONE_STATUS`,
  `MEMBER_STATUS`, `COMPETITOR_LEVEL`.
- **`normalizeBusinessState(state)`** — projects the legacy game `STATE` into a clean
  business object:
  - `workstreams` (lanes) — id, name, status, lane.
  - `milestones` (towers) — id, workstream, name, description, status, order.
  - `team` (heroes) — id, name, role, workstream, **hoursPerWeek** (was `hp`),
    **morale** (was `mp`), status, note. Game-only fields dropped.
  - `competitors` (dire + Roshan) — id, name, threat, note.
  - `unknowns` (fog) — the parts of the map still dark.
  - `bets` (shop items) — strategic investments with progress.
  - `deployments` — where each member sits on the map (x/y), i.e. "deployment on the map".
- **`validateBusinessState(model)`** — returns `{ ok, issues[] }`. Catches: unknown enum
  values, members with no role/workstream, milestones on a non-existent workstream,
  duplicate ids, coordinates outside 0–100, empty required names, deployments referencing
  unknown members. This is what makes "describe the current business state" *reliable*.

The model is **additive** — it reads the existing `STATE` and does not rewrite the renderer.
It becomes the backbone the UI can migrate onto incrementally, and it gives execs a single
validated description of "where the business is."

## Out of scope (this iteration)
- Rewriting the canvas/SVG renderer or fog engine.
- Uploading receipt files as blobs (links only, by design).
- Removing the Dota visuals — the metaphor stays; only the *data model* gets de-gamified.

## Acceptance
- `npm test` green.
- Receipts: can attach/clear a receipt link; dashboard shows coverage; missing-receipts
  worklist is correct against unit tests.
- Domain model: `validateBusinessState` flags every malformed-state case in the test suite
  and passes the real seeded state.
