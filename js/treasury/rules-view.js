import { showModal, showConfirm } from '../ui/modal.js';
import { esc } from '../utils.js';
import { CATEGORIES, DEFAULT_RULES, categoryOptions } from './constants.js';
import { effectiveRules } from './vendor-rules.js';
import { getRules, upsertRule, deleteRuleRow } from './state.js';

let ruleSearch = '';
let _searchDebounce = null;

export function renderRules(container) {
  const merged = effectiveRules();
  const userRules = getRules();
  const term = ruleSearch.trim().toLowerCase();

  const rows = Object.entries(merged)
    .filter(([pattern, r]) => !term || pattern.toLowerCase().includes(term) || r.vendor.toLowerCase().includes(term))
    .sort(([a], [b]) => a.localeCompare(b));

  container.innerHTML = `
    <div class="treasury-toolbar">
      <div class="treasury-rules-header">
        <span>${rows.length} rules visible (${Object.keys(DEFAULT_RULES).length} built-in, ${Object.keys(userRules).length} custom)</span>
      </div>
      <div class="treasury-filters">
        <input type="text" id="treasuryRuleSearch" class="treasury-input" placeholder="Search pattern or vendor" value="${esc(ruleSearch)}">
        <button class="btn treasury-add-btn" id="treasuryAddRuleBtn">+ Add Rule</button>
      </div>
    </div>
    <div class="treasury-table-wrap">
      <table class="treasury-table">
        <thead>
          <tr>
            <th>Pattern (matched against raw description, case-insensitive)</th>
            <th>Vendor</th>
            <th>Category</th>
            <th>Source</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.length === 0
            ? `<tr><td colspan="5" class="treasury-empty-row">No rules match "${esc(ruleSearch)}".</td></tr>`
            : rows.map(([pattern, r]) => ruleRowHTML(pattern, r, !!userRules[pattern])).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelector('#treasuryRuleSearch').addEventListener('input', (e) => {
    ruleSearch = e.target.value;
    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(() => {
      const focused = document.activeElement === e.target;
      const caret = e.target.selectionStart;
      renderRules(container);
      if (focused) {
        const input = container.querySelector('#treasuryRuleSearch');
        input.focus();
        if (caret != null) input.setSelectionRange(caret, caret);
      }
    }, 120);
  });
  container.querySelector('#treasuryAddRuleBtn').addEventListener('click', () => openAddRuleModal(container));
  container.querySelectorAll('[data-rule-edit]').forEach(btn => {
    btn.addEventListener('click', () => openEditRuleModal(btn.dataset.ruleEdit, container));
  });
  container.querySelectorAll('[data-rule-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteRulePrompt(btn.dataset.ruleDelete, container));
  });
}

function ruleRowHTML(pattern, rule, isCustom) {
  const cat = CATEGORIES[rule.category] || CATEGORIES.other_expense;
  return `
    <tr>
      <td><code>${esc(pattern)}</code></td>
      <td>${esc(rule.vendor)}</td>
      <td><span class="treasury-cat-pill" style="color:${cat.color};border-color:${cat.color}">${cat.name}</span></td>
      <td>${isCustom ? '<span class="treasury-pill treasury-pill-custom">Custom</span>' : '<span class="treasury-pill">Built-in</span>'}</td>
      <td>
        <button class="btn-mini" data-rule-edit="${esc(pattern)}">Edit</button>
        ${isCustom ? `<button class="btn-mini" data-rule-delete="${esc(pattern)}">Delete</button>` : ''}
      </td>
    </tr>
  `;
}

function openAddRuleModal(container) {
  showModal({
    title: 'Add Vendor Rule',
    fields: [
      { key: 'pattern', label: 'Pattern (substring of raw description)', type: 'text', required: true },
      { key: 'vendor', label: 'Display name', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'select', value: 'other_expense', options: categoryOptions() },
    ],
    onSave: async (v) => {
      const pattern = String(v.pattern).trim().toUpperCase();
      if (!pattern) return;
      try {
        await upsertRule({ pattern, vendor: v.vendor, category: v.category });
        renderRules(container);
      } catch (e) {
        alert('Save failed: ' + (e.message || e));
      }
    },
  });
}

function openEditRuleModal(pattern, container) {
  const merged = effectiveRules();
  const rule = merged[pattern];
  if (!rule) return;
  showModal({
    title: 'Edit Vendor Rule',
    fields: [
      { key: 'pattern', label: 'Pattern', type: 'text', value: pattern },
      { key: 'vendor',  label: 'Display name', type: 'text', value: rule.vendor, required: true },
      { key: 'category', label: 'Category', type: 'select', value: rule.category, options: categoryOptions() },
    ],
    onSave: async (v) => {
      const newPattern = String(v.pattern).trim().toUpperCase();
      if (!newPattern) return;
      try {
        // If pattern was renamed and old was a custom rule, delete the old row.
        if (newPattern !== pattern && getRules()[pattern]) {
          await deleteRuleRow(pattern);
        }
        await upsertRule({ pattern: newPattern, vendor: v.vendor, category: v.category });
        renderRules(container);
      } catch (e) {
        alert('Save failed: ' + (e.message || e));
      }
    },
  });
}

function deleteRulePrompt(pattern, container) {
  showConfirm({
    title: 'Delete custom rule?',
    message: `Remove "${pattern}". The built-in default (if any) will take over.`,
    onConfirm: async () => {
      try {
        await deleteRuleRow(pattern);
        renderRules(container);
      } catch (e) {
        alert('Delete failed: ' + (e.message || e));
      }
    },
  });
}

