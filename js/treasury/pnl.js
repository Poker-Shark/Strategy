import { esc } from '../utils.js';
import { showModal, showConfirm } from '../ui/modal.js';
import { CATEGORIES, REVENUE_CATEGORIES, fmtMoney } from './constants.js';
import { getTransactions, getRevenue, insertRevenue, deleteRevenueRow } from './state.js';

let from = defaultFrom();
let to = defaultTo();
let showRevenueEditor = false;

export function renderPnL(container) {
  const years = availableTaxYears();
  const activeYear = matchYear(from, to);

  container.innerHTML = `
    <div class="treasury-pnl-toolbar">
      <div class="treasury-pnl-years">
        ${years.map(y => `<button class="treasury-pnl-year ${activeYear === y ? 'active' : ''}" data-year="${y}">${y}</button>`).join('')}
        <button class="treasury-pnl-year ${activeYear === 'all' ? 'active' : ''}" data-year="all">All time</button>
      </div>
      <label class="treasury-pnl-field">From <input type="date" id="treasuryPnlFrom" class="treasury-input" value="${from}"></label>
      <label class="treasury-pnl-field">To <input type="date" id="treasuryPnlTo" class="treasury-input" value="${to}"></label>
      <button class="btn treasury-add-btn" id="treasuryRevToggleBtn">${showRevenueEditor ? 'Hide Revenue Editor' : 'Edit Revenue'}</button>
      <button class="btn-mini" id="treasuryPnlExportBtn">Export CSV</button>
    </div>

    ${showRevenueEditor ? renderRevenueEditor() : ''}

    <div id="treasuryPnlBody" class="treasury-pnl-body"></div>
  `;

  container.querySelectorAll('.treasury-pnl-year').forEach(btn => {
    btn.addEventListener('click', () => {
      const y = btn.dataset.year;
      if (y === 'all') {
        const allYears = availableTaxYears();
        from = allYears.length ? `${allYears[0]}-01-01` : defaultFrom();
        to = `${allYears.length ? allYears[allYears.length - 1] : new Date().getFullYear()}-12-31`;
      } else {
        from = `${y}-01-01`;
        to = `${y}-12-31`;
      }
      renderPnL(container);
    });
  });

  container.querySelector('#treasuryPnlFrom').addEventListener('change', e => { from = e.target.value; renderPnL(container); });
  container.querySelector('#treasuryPnlTo').addEventListener('change', e => { to = e.target.value; renderPnL(container); });
  container.querySelector('#treasuryRevToggleBtn').addEventListener('click', () => {
    showRevenueEditor = !showRevenueEditor;
    renderPnL(container);
  });
  container.querySelector('#treasuryPnlExportBtn').addEventListener('click', exportPnLCSV);

  if (showRevenueEditor) {
    container.querySelector('#treasuryRevAddBtn').addEventListener('click', () => openAddRevenue(container));
    container.querySelectorAll('[data-rev-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteRevenuePrompt(btn.dataset.revDelete, container));
    });
  }

  renderPnLBody(container);
}

function renderRevenueEditor() {
  const rev = getRevenue().filter(r => r.date >= from && r.date <= to);
  return `
    <div class="treasury-card">
      <div class="treasury-pnl-rev-head">
        <h3>Revenue Entries (${rev.length} in range)</h3>
        <button class="btn treasury-add-btn" id="treasuryRevAddBtn">+ Add Revenue</button>
      </div>
      <div class="treasury-table-wrap">
        <table class="treasury-table">
          <thead>
            <tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th></th></tr>
          </thead>
          <tbody>
            ${rev.length === 0
              ? '<tr><td colspan="5" class="treasury-empty-row">No revenue entries in this range.</td></tr>'
              : rev.map(r => `
                <tr>
                  <td>${esc(r.date)}</td>
                  <td>${esc(r.description)}</td>
                  <td>${esc((REVENUE_CATEGORIES[r.category] || { name: r.category }).name)}</td>
                  <td class="num">${fmtMoney(r.amount)}</td>
                  <td><button class="btn-mini" data-rev-delete="${esc(r.id)}">Delete</button></td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openAddRevenue(container) {
  const today = new Date().toISOString().slice(0, 10);
  showModal({
    title: 'Add Revenue',
    fields: [
      { key: 'date', label: 'Date', type: 'date', value: today, required: true },
      { key: 'description', label: 'Description', type: 'text', required: true },
      { key: 'amount', label: 'Amount ($)', type: 'number', step: '0.01', required: true, min: 0 },
      { key: 'category', label: 'Category', type: 'select', value: 'app_revenue',
        options: Object.entries(REVENUE_CATEGORIES).map(([k, v]) => ({ value: k, label: v.name })) },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onSave: async (v) => {
      try {
        await insertRevenue({
          date: v.date,
          description: v.description,
          amount: Number(v.amount) || 0,
          category: v.category,
          notes: v.notes || '',
        });
        renderPnL(container);
      } catch (e) {
        alert('Insert failed: ' + (e.message || e));
      }
    },
  });
}

function deleteRevenuePrompt(id, container) {
  showConfirm({
    title: 'Delete revenue entry?',
    message: 'This cannot be undone.',
    onConfirm: async () => {
      try {
        await deleteRevenueRow(id);
        renderPnL(container);
      } catch (e) {
        alert('Delete failed: ' + (e.message || e));
      }
    },
  });
}

function renderPnLBody(container) {
  const months = monthsBetween(from, to);
  if (months.length === 0) {
    container.querySelector('#treasuryPnlBody').innerHTML =
      '<div class="treasury-empty">Pick a valid date range.</div>';
    return;
  }

  const rev = bucketRevenue(months);
  const { catMonthly, otherMonthly } = bucketTransactions(months);

  const cogsCats = Object.keys(CATEGORIES).filter(k => CATEGORIES[k].section === 'cogs');
  const opexCats = Object.keys(CATEGORIES).filter(k => CATEGORIES[k].section === 'opex');

  const cogsTotal = sumCategories(cogsCats, catMonthly, months);
  const opexTotal = sumCategories(opexCats, catMonthly, months);
  const grossProfit = subtractTotals(rev, cogsTotal, months);
  const otherTotal = computeOtherTotal(otherMonthly, months);
  const netIncome = combineForNet(rev, cogsTotal, opexTotal, otherTotal, months);

  const colWidth = Math.max(80, Math.floor(560 / (months.length + 1)));

  container.querySelector('#treasuryPnlBody').innerHTML = `
    <div class="treasury-pnl-title">Poker Shark LLC — Profit &amp; Loss</div>
    <div class="treasury-pnl-subtitle">${formatRange(from, to)}</div>

    <div class="treasury-pnl-table" style="--treasury-col:${colWidth}px">
      <div class="treasury-pnl-row treasury-pnl-headrow">
        <span class="treasury-pnl-label"></span>
        ${months.map(m => `<span class="treasury-pnl-col">${esc(m.label)}</span>`).join('')}
        <span class="treasury-pnl-col"><strong>Total</strong></span>
      </div>

      <div class="treasury-pnl-section">REVENUE</div>
      ${pnlRow('Revenue', rev, months, colWidth)}
      ${totalRow('TOTAL REVENUE', rev, months, colWidth)}

      <div class="treasury-pnl-section">COST OF GOODS SOLD</div>
      ${cogsCats.map(k => pnlRow(CATEGORIES[k].name, catMonthly[k], months, colWidth, true)).join('')}
      ${totalRow('TOTAL COGS', cogsTotal, months, colWidth, true)}

      ${totalRow('GROSS PROFIT', grossProfit, months, colWidth)}

      <div class="treasury-pnl-section">OPERATING EXPENSES</div>
      ${opexCats.map(k => pnlRow(CATEGORIES[k].name, catMonthly[k], months, colWidth, true)).join('')}
      ${totalRow('TOTAL OPERATING EXPENSES', opexTotal, months, colWidth, true)}

      <div class="treasury-pnl-section">OTHER INCOME / (EXPENSES)</div>
      ${pnlRow('Credit Card Interest', otherMonthly.interest, months, colWidth, true)}
      ${pnlRow('Fees', otherMonthly.fees, months, colWidth, true)}
      ${pnlRow('Credits / Rewards', otherMonthly.credits, months, colWidth)}
      ${totalRow('TOTAL OTHER', otherTotal, months, colWidth)}

      ${totalRow('NET INCOME', netIncome, months, colWidth)}
    </div>
  `;
}

function bucketRevenue(months) {
  const bucket = {};
  for (const m of months) bucket[m.label] = 0;
  for (const r of getRevenue()) {
    if (r.date < from || r.date > to) continue;
    const lbl = monthLabel(r.date);
    if (lbl in bucket) bucket[lbl] += Number(r.amount || 0);
  }
  return bucket;
}

function bucketTransactions(months) {
  const labels = new Set(months.map(m => m.label));
  const catMonthly = {};
  for (const k of Object.keys(CATEGORIES)) {
    catMonthly[k] = {};
    for (const m of months) catMonthly[k][m.label] = 0;
  }
  const otherMonthly = { interest: {}, fees: {}, credits: {} };
  for (const m of months) {
    otherMonthly.interest[m.label] = 0;
    otherMonthly.fees[m.label] = 0;
    otherMonthly.credits[m.label] = 0;
  }

  for (const t of getTransactions()) {
    if (t.date < from || t.date > to) continue;
    const lbl = monthLabel(t.date);
    if (!labels.has(lbl)) continue;
    const adj = Number(t.amount) * (Number(t.business_pct ?? 100) / 100);

    if (t.type === 'purchase') {
      const cat = catMonthly[t.category] ? t.category : 'other_expense';
      catMonthly[cat][lbl] += adj;
    } else if (t.type === 'interest') {
      otherMonthly.interest[lbl] += adj;
    } else if (t.type === 'fee') {
      otherMonthly.fees[lbl] += adj;
    } else if (t.type === 'credit') {
      otherMonthly.credits[lbl] += adj;
    }
  }
  return { catMonthly, otherMonthly };
}

function sumCategories(cats, catMonthly, months) {
  const out = {};
  for (const m of months) {
    out[m.label] = cats.reduce((s, k) => s + (catMonthly[k][m.label] || 0), 0);
  }
  return out;
}

function subtractTotals(a, b, months) {
  const out = {};
  for (const m of months) out[m.label] = (a[m.label] || 0) - (b[m.label] || 0);
  return out;
}

function computeOtherTotal(other, months) {
  const out = {};
  for (const m of months) {
    out[m.label] = -(other.interest[m.label] + other.fees[m.label]) + other.credits[m.label];
  }
  return out;
}

function combineForNet(rev, cogs, opex, otherTotal, months) {
  const out = {};
  for (const m of months) {
    out[m.label] = (rev[m.label] || 0) - (cogs[m.label] || 0) - (opex[m.label] || 0) + (otherTotal[m.label] || 0);
  }
  return out;
}

function pnlRow(label, byMonth, months, colWidth, isNeg = false) {
  const vals = months.map(m => byMonth[m.label] || 0);
  const total = vals.reduce((s, v) => s + v, 0);
  if (total === 0 && vals.every(v => v === 0)) return '';
  return `
    <div class="treasury-pnl-row">
      <span class="treasury-pnl-label">${esc(label)}</span>
      ${vals.map(v => `<span class="treasury-pnl-col ${isNeg && v > 0 ? 'neg' : ''}">${v === 0 ? '–' : (isNeg ? `(${fmtMoney(v)})` : fmtMoney(v))}</span>`).join('')}
      <span class="treasury-pnl-col ${isNeg && total > 0 ? 'neg' : ''}"><strong>${total === 0 ? '–' : (isNeg ? `(${fmtMoney(total)})` : fmtMoney(total))}</strong></span>
    </div>
  `;
}

function totalRow(label, byMonth, months, colWidth, isNeg = false) {
  const vals = months.map(m => byMonth[m.label] || 0);
  const total = vals.reduce((s, v) => s + v, 0);
  return `
    <div class="treasury-pnl-row treasury-pnl-totalrow">
      <span class="treasury-pnl-label"><strong>${esc(label)}</strong></span>
      ${vals.map(v => `<span class="treasury-pnl-col ${v < 0 ? 'neg' : ''}"><strong>${formatPnLCell(v, isNeg)}</strong></span>`).join('')}
      <span class="treasury-pnl-col ${total < 0 ? 'neg' : ''}"><strong>${formatPnLCell(total, isNeg)}</strong></span>
    </div>
  `;
}

function formatPnLCell(v, isNeg) {
  if (v === 0) return '–';
  if (v < 0) return `(${fmtMoney(Math.abs(v))})`;
  return isNeg ? `(${fmtMoney(v)})` : fmtMoney(v);
}

function monthLabel(date) {
  const [y, m] = date.split('-').map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

function monthsBetween(fromDate, toDate) {
  if (!fromDate || !toDate || fromDate > toDate) return [];
  const months = [];
  const f = new Date(fromDate + 'T00:00:00Z');
  const t = new Date(toDate + 'T00:00:00Z');
  const cursor = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), 1));
  while (cursor <= t) {
    months.push({
      label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

// Tax years that have any tx or revenue data, oldest first.
function availableTaxYears() {
  const set = new Set();
  for (const t of getTransactions()) if (t.date) set.add(t.date.slice(0, 4));
  for (const r of getRevenue())      if (r.date) set.add(r.date.slice(0, 4));
  if (set.size === 0) set.add(String(new Date().getFullYear()));
  return [...set].sort();
}

// Returns 'YYYY' if from/to exactly span a calendar year, else null.
function matchYear(f, t) {
  const m = f.match(/^(\d{4})-01-01$/);
  if (m && t === `${m[1]}-12-31`) return m[1];
  return null;
}

function defaultFrom() {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 3);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
function defaultTo() {
  const d = new Date();
  // Last day of current month
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}
function formatRange(f, t) {
  const fd = new Date(f + 'T00:00:00Z');
  const td = new Date(t + 'T00:00:00Z');
  const opts = { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
  return `${fd.toLocaleDateString('en-US', opts)} — ${td.toLocaleDateString('en-US', opts)}`;
}

function exportPnLCSV() {
  const months = monthsBetween(from, to);
  const rev = bucketRevenue(months);
  const { catMonthly, otherMonthly } = bucketTransactions(months);
  const header = ['Line', ...months.map(m => m.label), 'Total'];
  const rows = [header];

  rows.push(rowFor('Revenue', rev, months));
  for (const k of Object.keys(CATEGORIES)) {
    rows.push(rowFor(CATEGORIES[k].name, catMonthly[k], months));
  }
  rows.push(rowFor('Interest', otherMonthly.interest, months));
  rows.push(rowFor('Fees', otherMonthly.fees, months));
  rows.push(rowFor('Credits/Rewards', otherMonthly.credits, months));

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `poker-shark-pnl-${from}-to-${to}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function rowFor(label, byMonth, months) {
  const vals = months.map(m => (byMonth[m.label] || 0).toFixed(2));
  const total = vals.reduce((s, v) => s + parseFloat(v), 0).toFixed(2);
  return [label, ...vals, total];
}
