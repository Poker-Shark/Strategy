import { DEFAULT_RULES } from './constants.js';
import { getRules } from './state.js';

let _cache = null;

export function invalidateEffectiveRules() {
  _cache = null;
}

// Defaults overlaid by user-saved rules. Pattern keys are pre-uppercased so
// normalizeVendor() doesn't have to do it on every comparison in hot loops.
export function effectiveRules() {
  if (_cache) return _cache;
  const merged = {};
  for (const [pattern, rule] of Object.entries(DEFAULT_RULES)) {
    merged[pattern.toUpperCase()] = { vendor: rule.vendor, category: rule.category };
  }
  for (const [pattern, rule] of Object.entries(getRules())) {
    merged[pattern.toUpperCase()] = { vendor: rule.vendor, category: rule.category };
  }
  _cache = merged;
  return merged;
}

// Longest-match-wins: a description matching both 'AWS' and 'AMAZON WEB SERV'
// resolves to the latter.
export function normalizeVendor(rawDescription) {
  if (!rawDescription) return { vendor: '', category: 'other_expense', matchedPattern: null };
  const upper = rawDescription.toUpperCase();
  const rules = effectiveRules();

  let bestMatch = null;
  let bestPattern = null;
  let bestLen = 0;
  for (const pattern in rules) {
    if (pattern.length > bestLen && upper.includes(pattern)) {
      bestMatch = rules[pattern];
      bestPattern = pattern;
      bestLen = pattern.length;
    }
  }
  if (bestMatch) {
    return { vendor: bestMatch.vendor, category: bestMatch.category, matchedPattern: bestPattern };
  }
  const vendor = rawDescription.split(/\s{2,}|\t/)[0].slice(0, 30).trim();
  return { vendor: vendor || rawDescription, category: 'other_expense', matchedPattern: null };
}
