import { describe, it, expect } from 'vitest';
import {
  isValidReceiptUrl, hasReceipt, isReceiptExpected, needsReceipt,
  receiptCoverage, RECEIPT_THRESHOLD,
} from '../js/treasury/receipts.js';

const purchase = (over) => ({ type: 'purchase', amount: over ? 100 : 10, business_pct: 100 });

describe('isValidReceiptUrl', () => {
  it('accepts http(s) links', () => {
    expect(isValidReceiptUrl('https://drive.google.com/file/abc')).toBe(true);
    expect(isValidReceiptUrl('http://box.com/x')).toBe(true);
  });
  it('rejects empty, non-http, and non-strings', () => {
    expect(isValidReceiptUrl('')).toBe(false);
    expect(isValidReceiptUrl('   ')).toBe(false);
    expect(isValidReceiptUrl('not a url')).toBe(false);
    expect(isValidReceiptUrl('ftp://x/y')).toBe(false);
    expect(isValidReceiptUrl('javascript:alert(1)')).toBe(false);
    expect(isValidReceiptUrl(null)).toBe(false);
    expect(isValidReceiptUrl(undefined)).toBe(false);
  });
});

describe('hasReceipt', () => {
  it('is true only when a valid receipt_url is present', () => {
    expect(hasReceipt({ receipt_url: 'https://box.com/r/1' })).toBe(true);
    expect(hasReceipt({ receipt_url: '' })).toBe(false);
    expect(hasReceipt({})).toBe(false);
    expect(hasReceipt(null)).toBe(false);
  });
});

describe('isReceiptExpected', () => {
  it('expects receipts for purchases at/over the threshold', () => {
    expect(isReceiptExpected({ type: 'purchase', amount: RECEIPT_THRESHOLD })).toBe(true);
    expect(isReceiptExpected({ type: 'purchase', amount: 500 })).toBe(true);
  });
  it('exempts sub-threshold purchases', () => {
    expect(isReceiptExpected({ type: 'purchase', amount: 10 })).toBe(false);
  });
  it('exempts non-purchase types entirely', () => {
    for (const type of ['payment', 'credit', 'fee', 'interest']) {
      expect(isReceiptExpected({ type, amount: 9999 })).toBe(false);
    }
  });
  it('uses the business share of the amount, not the gross', () => {
    // $200 at 30% business = $60 < $75 → not expected
    expect(isReceiptExpected({ type: 'purchase', amount: 200, business_pct: 30 })).toBe(false);
    // $200 at 50% business = $100 ≥ $75 → expected
    expect(isReceiptExpected({ type: 'purchase', amount: 200, business_pct: 50 })).toBe(true);
  });
  it('honors a custom threshold', () => {
    expect(isReceiptExpected({ type: 'purchase', amount: 30 }, { threshold: 25 })).toBe(true);
    expect(isReceiptExpected({ type: 'purchase', amount: 30 }, { threshold: 50 })).toBe(false);
  });
});

describe('needsReceipt', () => {
  it('is true for an expected purchase with no receipt', () => {
    expect(needsReceipt(purchase(true))).toBe(true);
  });
  it('is false once a receipt is attached', () => {
    expect(needsReceipt({ ...purchase(true), receipt_url: 'https://box.com/r/1' })).toBe(false);
  });
  it('is false for exempt (sub-threshold) purchases', () => {
    expect(needsReceipt(purchase(false))).toBe(false);
  });
});

describe('receiptCoverage', () => {
  const txs = [
    { type: 'purchase', amount: 100, receipt_url: 'https://box.com/a' }, // covered
    { type: 'purchase', amount: 200 },                                   // missing
    { type: 'purchase', amount: 300 },                                   // missing
    { type: 'purchase', amount: 10 },                                    // exempt (small)
    { type: 'payment', amount: 5000 },                                   // exempt (type)
  ];
  it('buckets covered / missing / exempt and totals', () => {
    const c = receiptCoverage(txs);
    expect(c).toMatchObject({ covered: 1, missing: 2, exempt: 2, total: 5 });
  });
  it('coverage pct is covered / expected', () => {
    // expected = 3, covered = 1 → 33%
    expect(receiptCoverage(txs).pct).toBe(33);
  });
  it('sums the missing amount and lists missing rows', () => {
    const c = receiptCoverage(txs);
    expect(c.missingAmount).toBe(500);
    expect(c.missingRows.map(r => r.amount)).toEqual([200, 300]);
  });
  it('is 100% when nothing is expected', () => {
    expect(receiptCoverage([{ type: 'purchase', amount: 5 }]).pct).toBe(100);
    expect(receiptCoverage([]).pct).toBe(100);
  });
});
