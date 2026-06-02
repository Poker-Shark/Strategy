import { describe, it, expect } from 'vitest';
import {
  detectTransactionType, parseDate, parseCSVRow, parseChaseCSV,
  parseFilenameMetadata, classifyRow, filterToPokerShark,
} from '../js/treasury/parsers.js';
import { POKER_SHARK_CARD } from '../js/treasury/constants.js';

describe('detectTransactionType', () => {
  it('classifies payments, credits, interest and fees', () => {
    expect(detectTransactionType('PAYMENT THANK YOU')).toBe('payment');
    expect(detectTransactionType('AUTOMATIC PAYMENT - THANK YOU')).toBe('payment');
    expect(detectTransactionType('STATEMENT CREDIT')).toBe('credit');
    expect(detectTransactionType('PURCHASE INTEREST CHARGE')).toBe('interest');
    expect(detectTransactionType('ANNUAL FEE')).toBe('fee');
    expect(detectTransactionType('FOREIGN TRANSACTION FEE')).toBe('fee');
  });
  it('defaults to purchase', () => {
    expect(detectTransactionType('RENDER.COM')).toBe('purchase');
    expect(detectTransactionType('')).toBe('purchase');
  });
});

describe('parseDate', () => {
  it('handles MM/DD/YYYY', () => expect(parseDate('03/15/2026')).toBe('2026-03-15'));
  it('passes through ISO', () => expect(parseDate('2026-03-15')).toBe('2026-03-15'));
  it('handles MM/DD/YY', () => expect(parseDate('3/5/26')).toBe('2026-03-05'));
  it('returns empty for junk', () => {
    expect(parseDate('')).toBe('');
    expect(parseDate('not a date')).toBe('');
  });
});

describe('parseCSVRow', () => {
  it('splits on unquoted commas', () => {
    expect(parseCSVRow('a,b,c')).toEqual(['a', 'b', 'c']);
  });
  it('respects quoted commas', () => {
    expect(parseCSVRow('a,"b, still b",c')).toEqual(['a', 'b, still b', 'c']);
  });
});

describe('parseFilenameMetadata', () => {
  it('extracts statement date and card from Chase filenames', () => {
    expect(parseFilenameMetadata('20260315-statements-8789-.pdf')).toEqual({
      statementDate: '2026-03-15', card: '8789', year: 2026, month: 3,
    });
  });
  it('returns null when the pattern does not match', () => {
    expect(parseFilenameMetadata('random.pdf')).toBeNull();
  });
});

describe('parseChaseCSV', () => {
  it('parses a header-labelled Chase export and normalizes the vendor', () => {
    const csv = [
      'Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
      '03/15/2026,03/16/2026,RENDER.COM monthly,Services,Sale,25.00,',
    ].join('\n');
    const rows = parseChaseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: '2026-03-15',
      vendor: 'Render',
      category: 'cloud_hosting',
      type: 'purchase',
      amount: 25,
      card: POKER_SHARK_CARD,
      source: 'csv',
    });
  });
  it('falls back to positional columns when headers are unrecognized', () => {
    const csv = [
      'a,b,c,d,e,f,g',
      '01/02/2026,xx,ANTHROPIC,xx,xx,12.50,xx',
    ].join('\n');
    const rows = parseChaseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: '2026-01-02', amount: 12.5, category: 'ai_tools' });
  });
  it('skips rows with no date or description', () => {
    const csv = ['Date,Description,Amount', ',,5.00', '03/01/2026,,5.00'].join('\n');
    expect(parseChaseCSV(csv)).toHaveLength(0);
  });
  it('returns [] for empty input', () => {
    expect(parseChaseCSV('')).toEqual([]);
    expect(parseChaseCSV('only-a-header')).toEqual([]);
  });
});

describe('classifyRow / filterToPokerShark', () => {
  const primary = { card: POKER_SHARK_CARD, flagged: false };
  const reimbursable = { card: '2757', flagged: true };
  const personal = { card: '2757', flagged: false };

  it('classifies by card and flag', () => {
    expect(classifyRow(primary)).toBe('primary');
    expect(classifyRow(reimbursable)).toBe('reimbursable');
    expect(classifyRow(personal)).toBe('personal');
  });
  it('filterToPokerShark drops personal spend, keeps the rest', () => {
    const { kept, dropped } = filterToPokerShark([primary, reimbursable, personal]);
    expect(kept).toEqual([primary, reimbursable]);
    expect(dropped).toEqual([personal]);
  });
});
