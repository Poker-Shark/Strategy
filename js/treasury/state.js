import { supabase } from '../supabase.js';
import { invalidateEffectiveRules } from './vendor-rules.js';

let _txs = [];
let _revenue = [];
let _rules = {};       // { pattern: { pattern, vendor, category, ... } }
let _loaded = false;
let _loading = null;   // shared in-flight promise

const _changeListeners = [];

export function getTransactions() { return _txs; }
export function getRevenue() { return _revenue; }
export function getRules() { return _rules; }
export function isLoaded() { return _loaded; }

export function onTreasuryChange(cb) { _changeListeners.push(cb); }
function notifyChange() { for (const cb of _changeListeners) cb(); }

export function loadTreasury({ force = false } = {}) {
  if (_loaded && !force) return Promise.resolve();
  if (_loading) return _loading;
  if (!supabase) return Promise.reject(new Error('Supabase not configured'));

  _loading = (async () => {
    const [txRes, revRes, ruleRes] = await Promise.all([
      supabase.from('treasury_transactions').select('*').order('date', { ascending: false }),
      supabase.from('treasury_revenue').select('*').order('date', { ascending: false }),
      supabase.from('treasury_vendor_rules').select('*'),
    ]);
    if (txRes.error) throw txRes.error;
    if (revRes.error) throw revRes.error;
    if (ruleRes.error) throw ruleRes.error;

    _txs = txRes.data || [];
    _revenue = revRes.data || [];
    _rules = (ruleRes.data || []).reduce((acc, r) => { acc[r.pattern] = r; return acc; }, {});
    _loaded = true;
    invalidateEffectiveRules();
    notifyChange();
  })();

  _loading.finally(() => { _loading = null; });
  return _loading;
}

export async function insertTransaction(tx) {
  const { data, error } = await supabase
    .from('treasury_transactions')
    .insert(tx)
    .select()
    .single();
  if (error) throw error;
  _txs.unshift(data);
  notifyChange();
  return data;
}

export async function bulkInsertTransactions(rows) {
  // Dedup at the DB level via the UNIQUE constraint on dedup_hash.
  // With ignoreDuplicates, .select() returns only the rows that were actually inserted.
  const { data, error } = await supabase
    .from('treasury_transactions')
    .upsert(rows, { onConflict: 'dedup_hash', ignoreDuplicates: true })
    .select();
  if (error) throw error;
  const inserted = data || [];
  _txs = [..._txs, ...inserted].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (inserted.length > 0) notifyChange();
  return inserted;
}

export async function updateTransaction(id, patch) {
  const { data, error } = await supabase
    .from('treasury_transactions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  const idx = _txs.findIndex(t => t.id === id);
  if (idx >= 0) _txs[idx] = data;
  notifyChange();
  return data;
}

export async function deleteTransactionRow(id) {
  const { error } = await supabase.from('treasury_transactions').delete().eq('id', id);
  if (error) throw error;
  _txs = _txs.filter(t => t.id !== id);
  notifyChange();
}

export async function insertRevenue(rev) {
  const { data, error } = await supabase
    .from('treasury_revenue')
    .insert(rev)
    .select()
    .single();
  if (error) throw error;
  _revenue.unshift(data);
  notifyChange();
  return data;
}

export async function deleteRevenueRow(id) {
  const { error } = await supabase.from('treasury_revenue').delete().eq('id', id);
  if (error) throw error;
  _revenue = _revenue.filter(r => r.id !== id);
  notifyChange();
}

export async function upsertRule(rule) {
  const { data, error } = await supabase
    .from('treasury_vendor_rules')
    .upsert(rule, { onConflict: 'pattern' })
    .select()
    .single();
  if (error) throw error;
  _rules[rule.pattern] = data;
  invalidateEffectiveRules();
  return data;
}

export async function deleteRuleRow(pattern) {
  const { error } = await supabase.from('treasury_vendor_rules').delete().eq('pattern', pattern);
  if (error) throw error;
  delete _rules[pattern];
  invalidateEffectiveRules();
}
