import { describe, it, expect } from 'vitest';
import {
  txHash, isReimbursable, isBusinessVendor, fmtMoney,
  cardOptions, categoryOptions, PRIMARY_CARDS, POKER_SHARK_CARD,
} from '../js/treasury/constants.js';

describe('txHash', () => {
  it('builds a stable date|amount|desc[:30]|card key', () => {
    expect(txHash('2026-03-15', 25, 'RENDER.COM', '8789'))
      .toBe('2026-03-15|25.00|RENDER.COM|8789');
  });
  it('rounds amount to 2 decimals and truncates description to 30 chars', () => {
    const longDesc = 'A'.repeat(40);
    expect(txHash('2026-01-01', 9.005, longDesc, '4005'))
      .toBe(`2026-01-01|9.01|${'A'.repeat(30)}|4005`);
  });
  it('is identical for the same inputs (idempotent dedup)', () => {
    expect(txHash('2026-02-02', 10, 'X', '8789')).toBe(txHash('2026-02-02', 10, 'X', '8789'));
  });
});

describe('isReimbursable', () => {
  it('is false for primary cards', () => {
    expect(isReimbursable(POKER_SHARK_CARD)).toBe(false); // 8789
    expect(isReimbursable('4005')).toBe(false);           // Amex Platinum primary
  });
  it('is true for non-primary / unknown cards', () => {
    expect(isReimbursable('2757')).toBe(true);
    expect(isReimbursable('9999')).toBe(true);
  });
  it('only the two primary cards exist in PRIMARY_CARDS', () => {
    expect([...PRIMARY_CARDS].sort()).toEqual(['4005', '8789']);
  });
});

describe('isBusinessVendor', () => {
  it('matches known business vendor patterns case-insensitively', () => {
    expect(isBusinessVendor('render.com monthly')).toBe(true);
    expect(isBusinessVendor('ANTHROPIC CLAUDE')).toBe(true);
  });
  it('does not match unrelated personal spend', () => {
    expect(isBusinessVendor('STARBUCKS STORE 123')).toBe(false);
    expect(isBusinessVendor('')).toBe(false);
    expect(isBusinessVendor(null)).toBe(false);
  });
});

describe('fmtMoney', () => {
  it('formats USD with two decimals and thousands separators', () => {
    expect(fmtMoney(1234.5)).toBe('$1,234.50');
    expect(fmtMoney(0)).toBe('$0.00');
  });
  it('coerces non-numbers to $0.00', () => {
    expect(fmtMoney(undefined)).toBe('$0.00');
    expect(fmtMoney('not a number')).toBe('$0.00');
  });
});

describe('option builders', () => {
  it('cardOptions marks reimbursable cards', () => {
    const opts = cardOptions();
    const primary = opts.find(o => o.value === '8789');
    const reimb = opts.find(o => o.value === '2757');
    expect(primary.label).not.toContain('reimbursable');
    expect(reimb.label).toContain('reimbursable');
  });
  it('categoryOptions exposes every category', () => {
    expect(categoryOptions().length).toBeGreaterThan(5);
    expect(categoryOptions().every(o => o.value && o.label)).toBe(true);
  });
});
