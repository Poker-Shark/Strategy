// Receipt tracking — pure logic, no DOM/network.
//
// A "receipt" here is a LINK to the stored document (Box / Google Drive / etc.),
// kept on the transaction as `receipt_url`. Tax/audit prep cares about one thing:
// which business purchases over a meaningful amount are missing their backup doc.
//
// Receipts are only expected for *business purchases*. Payments, credits, interest
// and fees have no receipt, and tiny purchases below the threshold are exempt
// (the IRS de-minimis convention — keep receipts for spend at/over $75 by default).

export const RECEIPT_THRESHOLD = 75;

export function isValidReceiptUrl(url) {
  if (typeof url !== 'string') return false;
  const s = url.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function hasReceipt(tx) {
  return isValidReceiptUrl(tx && tx.receipt_url);
}

// Business spend that the receipt rule applies to: a purchase whose business share
// of the amount lands at/over the threshold. business_pct defaults to 100.
export function isReceiptExpected(tx, { threshold = RECEIPT_THRESHOLD } = {}) {
  if (!tx || tx.type !== 'purchase') return false;
  const businessAmount = Math.abs(Number(tx.amount) || 0) * (Number(tx.business_pct ?? 100) / 100);
  return businessAmount >= threshold;
}

// A transaction that SHOULD have a receipt but doesn't — the audit-risk set.
export function needsReceipt(tx, opts = {}) {
  return isReceiptExpected(tx, opts) && !hasReceipt(tx);
}

// Portfolio view for the dashboard + "Missing receipts" worklist.
// covered  — expected & has receipt
// missing  — expected & no receipt   (the worklist)
// exempt   — not expected (sub-threshold purchase, or non-purchase)
export function receiptCoverage(txs, opts = {}) {
  const out = { covered: 0, missing: 0, exempt: 0, total: 0, pct: 100, missingAmount: 0, missingRows: [] };
  for (const tx of txs || []) {
    out.total++;
    if (!isReceiptExpected(tx, opts)) { out.exempt++; continue; }
    if (hasReceipt(tx)) { out.covered++; continue; }
    out.missing++;
    out.missingAmount += Math.abs(Number(tx.amount) || 0);
    out.missingRows.push(tx);
  }
  const expected = out.covered + out.missing;
  out.pct = expected === 0 ? 100 : Math.round((out.covered / expected) * 100);
  return out;
}
