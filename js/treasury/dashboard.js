import { esc } from '../utils.js';
import { CATEGORIES, CARD_DEFAULTS, fmtMoney } from './constants.js';
import { getTransactions, getRevenue } from './state.js';

export function renderDashboard(container) {
  const txs = getTransactions();
  const purchases = txs.filter(t => t.type === 'purchase');
  const revenue = getRevenue();

  let totalExpenses = 0;
  let uncategorized = 0;
  for (const t of purchases) {
    totalExpenses += Number(t.amount) * (Number(t.business_pct ?? 100) / 100);
    if (!t.category || t.category === 'other_expense') uncategorized++;
  }
  const totalRevenue = revenue.reduce((s, r) => s + Number(r.amount || 0), 0);
  const netIncome = totalRevenue - totalExpenses;

  container.innerHTML = `
    <div class="treasury-summary-cards">
      ${summaryCard('Total Revenue', fmtMoney(totalRevenue), `${revenue.length} entries`, 'pos')}
      ${summaryCard('Total Expenses', fmtMoney(totalExpenses), `${purchases.length} purchases`, 'neg')}
      ${summaryCard('Net Income', formatSigned(netIncome), 'Poker Shark LLC', netIncome >= 0 ? 'pos' : 'neg')}
      ${summaryCard('Needs Review', String(uncategorized), 'uncategorized purchases', uncategorized > 0 ? 'warn' : '')}
    </div>
    <div class="treasury-chart-grid">
      <div class="treasury-card"><h3>Monthly Expenses</h3><div id="treasuryChartMonthly"></div></div>
      <div class="treasury-card"><h3>Expenses by Category</h3><div id="treasuryChartCategory"></div></div>
      <div class="treasury-card"><h3>Top Vendors by Spend</h3><div id="treasuryChartVendors"></div></div>
      <div class="treasury-card"><h3>Spending by Card</h3><div id="treasuryChartCards"></div></div>
    </div>
  `;

  renderMonthlyChart(purchases);
  renderCategoryChart(purchases);
  renderTopVendorsChart(purchases);
  renderCardChart(purchases);
}

function summaryCard(label, value, sub, tone) {
  return `
    <div class="treasury-summary-card">
      <div class="treasury-summary-label">${esc(label)}</div>
      <div class="treasury-summary-value treasury-tone-${tone}">${esc(value)}</div>
      <div class="treasury-summary-sub">${esc(sub)}</div>
    </div>
  `;
}

function formatSigned(n) {
  return n < 0 ? `(${fmtMoney(Math.abs(n))})` : fmtMoney(n);
}

function renderMonthlyChart(purchases) {
  const totals = new Map();
  for (const t of purchases) {
    const key = monthKey(t.date);
    totals.set(key, (totals.get(key) || 0) + Number(t.amount));
  }
  const entries = [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, total]) => [keyToLabel(key), total]);
  hbar('treasuryChartMonthly', entries, 'var(--radiant)');
}

function renderCategoryChart(purchases) {
  const totals = {};
  for (const t of purchases) {
    const cat = t.category || 'other_expense';
    totals[cat] = (totals[cat] || 0) + Number(t.amount);
  }
  const entries = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, total]) => [(CATEGORIES[cat] || { name: cat }).name, total, CATEGORIES[cat]?.color || '#7a9e8c']);
  hbar('treasuryChartCategory', entries.map(([n, v]) => [n, v]), (_, i) => entries[i][2]);
}

function renderTopVendorsChart(purchases) {
  const totals = {};
  for (const t of purchases) {
    const v = t.vendor || t.raw_description;
    totals[v] = (totals[v] || 0) + Number(t.amount);
  }
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 8);
  hbar('treasuryChartVendors', entries, 'var(--blue)');
}

function renderCardChart(purchases) {
  const totals = {};
  for (const t of purchases) {
    const label = `x${t.card} ${CARD_DEFAULTS[t.card]?.label || ''}`;
    totals[label] = (totals[label] || 0) + Number(t.amount);
  }
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const colors = ['var(--radiant)', 'var(--blue)', 'var(--gold)', 'var(--orange)'];
  hbar('treasuryChartCards', entries, (_, i) => colors[i % colors.length]);
}

function hbar(elId, entries, colorFn) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (entries.length === 0) {
    el.innerHTML = '<div class="treasury-chart-empty">No data yet</div>';
    return;
  }
  const max = Math.max(...entries.map(e => e[1])) || 1;
  el.innerHTML = entries.map(([label, total], i) => {
    const pct = (total / max * 100).toFixed(1);
    const color = typeof colorFn === 'function' ? colorFn(label, i) : colorFn;
    return `
      <div class="treasury-hbar">
        <span class="treasury-hbar-label" title="${esc(label)}">${esc(label)}</span>
        <span class="treasury-hbar-track"><span class="treasury-hbar-fill" style="width:${pct}%;background:${color}"></span></span>
        <span class="treasury-hbar-value">${fmtMoney(total)}</span>
      </div>
    `;
  }).join('');
}

function monthKey(date) {
  // YYYY-MM, sortable
  return (date || '').slice(0, 7);
}
function keyToLabel(key) {
  // 2026-03 → "Mar 26"
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}
