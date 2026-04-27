import { showModal, showConfirm } from '../ui/modal.js';
import { esc } from '../utils.js';
import {
  POKER_SHARK_CARD, CATEGORIES, CARD_DEFAULTS, TX_TYPES,
  txHash, isReimbursable, fmtMoney,
  cardOptions, categoryOptions,
} from './constants.js';
import { normalizeVendor } from './vendor-rules.js';
import {
  getTransactions, insertTransaction, updateTransaction, deleteTransactionRow,
} from './state.js';

let activeSubTab = 'all';
let searchTerm = '';
let cardFilter = '';
let categoryFilter = '';
let _searchDebounce = null;

export function renderTransactions(container) {
  const allTxs = getTransactions();
  const counts = computeCounts(allTxs);
  const visibleTxs = applyFilters(allTxs);

  container.innerHTML = `
    <div class="treasury-toolbar">
      <div class="treasury-subtabs">
        ${subTabBtn('needs_review', `Needs Review (${counts.needs_review})`)}
        ${subTabBtn('poker_shark',  `Poker Shark Card (${counts.poker_shark})`)}
        ${subTabBtn('reimbursable', `Owner Reimbursements (${counts.reimbursable})`)}
        ${subTabBtn('all',          `All (${counts.all})`)}
      </div>
      <div class="treasury-filters">
        <input type="text" id="treasurySearch" class="treasury-input" placeholder="Search vendor / description / amount" value="${esc(searchTerm)}">
        <select id="treasuryFilterCard" class="treasury-input">
          <option value="">All cards</option>
          ${Object.entries(CARD_DEFAULTS).map(([id, c]) => `<option value="${id}" ${cardFilter === id ? 'selected' : ''}>x${id} ${c.label}</option>`).join('')}
        </select>
        <select id="treasuryFilterCategory" class="treasury-input">
          <option value="">All categories</option>
          ${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}" ${categoryFilter === k ? 'selected' : ''}>${v.name}</option>`).join('')}
        </select>
        <button class="btn treasury-add-btn" id="treasuryAddTxBtn">+ Add Transaction</button>
      </div>
    </div>
    <div class="treasury-table-wrap">
      <table class="treasury-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Vendor</th>
            <th>Description</th>
            <th class="num">Amount</th>
            <th>Card</th>
            <th>Category</th>
            <th>Type</th>
            <th>Reviewed</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${visibleTxs.length === 0
            ? `<tr><td colspan="9" class="treasury-empty-row">${allTxs.length === 0 ? 'No transactions yet — add one or import a statement.' : 'No matches for the current filters.'}</td></tr>`
            : visibleTxs.map(rowHTML).join('')}
        </tbody>
      </table>
    </div>
    <div class="treasury-row-count">${visibleTxs.length} of ${allTxs.length} transactions</div>
  `;

  container.querySelectorAll('.treasury-subtab').forEach(btn => {
    btn.addEventListener('click', () => { activeSubTab = btn.dataset.tab; renderTransactions(container); });
  });
  container.querySelector('#treasurySearch').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(() => {
      const focused = document.activeElement === e.target;
      const caret = e.target.selectionStart;
      renderTransactions(container);
      if (focused) {
        const input = container.querySelector('#treasurySearch');
        input.focus();
        if (caret != null) input.setSelectionRange(caret, caret);
      }
    }, 120);
  });
  container.querySelector('#treasuryFilterCard').addEventListener('change', (e) => {
    cardFilter = e.target.value;
    renderTransactions(container);
  });
  container.querySelector('#treasuryFilterCategory').addEventListener('change', (e) => {
    categoryFilter = e.target.value;
    renderTransactions(container);
  });
  container.querySelector('#treasuryAddTxBtn').addEventListener('click', () => openAddModal(container));
  container.querySelectorAll('[data-tx-edit]').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.txEdit, container));
  });
  container.querySelectorAll('[data-tx-toggle-reviewed]').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const id = cb.dataset.txToggleReviewed;
      try {
        await updateTransaction(id, { reviewed: e.target.checked });
        renderTransactions(container);
      } catch (err) {
        alert('Update failed: ' + err.message);
      }
    });
  });
}

function subTabBtn(tab, label) {
  return `<button class="treasury-subtab ${activeSubTab === tab ? 'active' : ''}" data-tab="${tab}">${label}</button>`;
}

function applyFilters(txs) {
  const s = searchTerm.toLowerCase();
  return txs.filter(t => {
    if (activeSubTab === 'needs_review' && t.reviewed) return false;
    if (activeSubTab === 'poker_shark' && t.card !== POKER_SHARK_CARD) return false;
    if (activeSubTab === 'reimbursable' && !t.reimbursable) return false;
    if (cardFilter && t.card !== cardFilter) return false;
    if (categoryFilter && t.category !== categoryFilter) return false;
    if (s && !`${t.vendor} ${t.raw_description} ${t.amount}`.toLowerCase().includes(s)) return false;
    return true;
  });
}

function computeCounts(txs) {
  const c = { needs_review: 0, poker_shark: 0, reimbursable: 0, all: txs.length };
  for (const t of txs) {
    if (!t.reviewed)                  c.needs_review++;
    if (t.card === POKER_SHARK_CARD)  c.poker_shark++;
    if (t.reimbursable)               c.reimbursable++;
  }
  return c;
}

function rowHTML(tx) {
  const cat = CATEGORIES[tx.category] || CATEGORIES.other_expense;
  const reimburseDot = tx.reimbursable ? `<span class="treasury-pill treasury-pill-reimburse" title="Owner reimbursable">↻</span>` : '';
  return `
    <tr class="${tx.reviewed ? '' : 'tr-needs-review'}">
      <td>${esc(tx.date)}</td>
      <td>${esc(tx.vendor)}</td>
      <td class="treasury-desc">${esc(tx.raw_description)}</td>
      <td class="num">${fmtMoney(tx.amount)}</td>
      <td>x${esc(tx.card)} ${reimburseDot}</td>
      <td><span class="treasury-cat-pill" style="color:${cat.color};border-color:${cat.color}">${cat.name}</span></td>
      <td>${esc(tx.type)}</td>
      <td><input type="checkbox" data-tx-toggle-reviewed="${tx.id}" ${tx.reviewed ? 'checked' : ''}></td>
      <td><button class="btn-mini" data-tx-edit="${tx.id}">Edit</button></td>
    </tr>
  `;
}

function openAddModal(container) {
  const today = new Date().toISOString().slice(0, 10);
  showModal({
    title: 'Add Transaction',
    fields: [
      { key: 'date', label: 'Date', type: 'date', value: today, required: true },
      { key: 'raw_description', label: 'Description / vendor (free text)', type: 'text', required: true },
      { key: 'amount', label: 'Amount ($)', type: 'number', step: '0.01', min: 0 },
      { key: 'card', label: 'Card', type: 'select', value: POKER_SHARK_CARD, options: cardOptions() },
      { key: 'category', label: 'Category', type: 'select', value: '', options: [{ value: '', label: '(auto from vendor rules)' }, ...categoryOptions()] },
      { key: 'type', label: 'Type', type: 'select', value: 'purchase', options: TX_TYPES.map(t => ({ value: t, label: t })) },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onSave: async (v) => {
      const norm = normalizeVendor(v.raw_description);
      const tx = {
        date: v.date,
        vendor: norm.vendor,
        raw_description: v.raw_description,
        amount: Number(v.amount) || 0,
        card: v.card,
        category: v.category || norm.category,
        type: v.type,
        notes: v.notes || '',
        reviewed: true,
        flagged: false,
        source: 'manual',
        reimbursable: isReimbursable(v.card),
        dedup_hash: txHash(v.date, Number(v.amount) || 0, v.raw_description, v.card),
      };
      try {
        await insertTransaction(tx);
        renderTransactions(container);
      } catch (e) {
        alert('Insert failed: ' + (e.message || e));
      }
    },
  });
}

function openEditModal(id, container) {
  const tx = getTransactions().find(t => t.id === id);
  if (!tx) return;
  showModal({
    title: 'Edit Transaction',
    fields: [
      { key: 'date', label: 'Date', type: 'date', value: tx.date, required: true },
      { key: 'vendor', label: 'Vendor (display name)', type: 'text', value: tx.vendor },
      { key: 'raw_description', label: 'Raw description', type: 'text', value: tx.raw_description },
      { key: 'amount', label: 'Amount ($)', type: 'number', step: '0.01', value: tx.amount },
      { key: 'card', label: 'Card', type: 'select', value: tx.card, options: cardOptions() },
      { key: 'category', label: 'Category', type: 'select', value: tx.category, options: categoryOptions() },
      { key: 'type', label: 'Type', type: 'select', value: tx.type, options: TX_TYPES.map(t => ({ value: t, label: t })) },
      { key: 'business_pct', label: 'Business %', type: 'number', value: tx.business_pct ?? 100, min: 0, max: 100 },
      { key: 'notes', label: 'Notes', type: 'textarea', value: tx.notes ?? '' },
      { key: 'reviewed', label: 'Mark as reviewed', type: 'checkbox', value: tx.reviewed },
      { key: '_delete', label: '', type: 'action', text: 'Delete this transaction', action: () => {
        showConfirm({
          title: 'Delete transaction?',
          message: `${tx.vendor} — ${fmtMoney(tx.amount)} on ${tx.date}. This cannot be undone.`,
          onConfirm: async () => {
            try {
              await deleteTransactionRow(id);
              renderTransactions(container);
            } catch (e) {
              alert('Delete failed: ' + (e.message || e));
            }
          },
        });
      }},
    ],
    onSave: async (v) => {
      const amount = Number(v.amount) || 0;
      const patch = {
        date: v.date,
        vendor: v.vendor,
        raw_description: v.raw_description,
        amount,
        card: v.card,
        category: v.category,
        type: v.type,
        business_pct: parseInt(v.business_pct) || 100,
        notes: v.notes || '',
        reviewed: !!v.reviewed,
        reimbursable: isReimbursable(v.card),
        dedup_hash: txHash(v.date, amount, v.raw_description, v.card),
      };
      try {
        await updateTransaction(id, patch);
        renderTransactions(container);
      } catch (e) {
        alert('Update failed: ' + (e.message || e));
      }
    },
  });
}

