import { STATE, saveLocal } from '../state.js';
import { formatNum, formatShort } from '../utils.js';
import { showModal } from '../ui/modal.js';
import { label } from '../labels.js';
import { getTransactions, isLoaded as treasuryLoaded } from '../treasury/state.js';

// Trailing-90-day average monthly burn from Treasury, or null if no data.
function computeMonthlyBurn() {
  if (!treasuryLoaded()) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  let total = 0;
  let any = false;
  for (const t of getTransactions()) {
    if (t.type !== 'purchase') continue;
    if (t.date < cutoffStr) continue;
    total += Number(t.amount) * (Number(t.business_pct ?? 100) / 100);
    any = true;
  }
  return any ? total / 3 : null;
}

export function renderEconomy() {
  const e = STATE.economy;
  const el = document.getElementById('economySlot');
  if (!el) return;

  const pctAllocated = (e.sharesAllocated / e.sharesTotal * 100).toFixed(0);
  const pctReserved = (e.sharesReserved / e.sharesTotal * 100).toFixed(0);
  const pctRemaining = (e.sharesRemaining / e.sharesTotal * 100).toFixed(0);

  const burn = computeMonthlyBurn();
  const autoRunway = burn && burn > 0 && e.gold > 0
    ? `${(e.gold / burn).toFixed(1)} mo`
    : null;
  const runwayDisplay = autoRunway || e.runway;
  const runwayTitle = autoRunway
    ? `Auto: $${burn.toFixed(0)}/mo burn (trailing 90 days) · click to override`
    : 'Click to edit';

  el.innerHTML = `
    <div class="econ-row">
      <div class="metric"><span>${label('gold')}</span><span class="val gold econ-edit" data-field="gold">$${formatNum(e.gold)}</span></div>
      <div class="metric" title="${runwayTitle}">
        <span>${label('runway')}</span>
        <span class="val green econ-edit ${autoRunway ? 'auto' : ''}" data-field="runway">${runwayDisplay}${autoRunway ? '<span class="econ-live-dot"></span>' : ''}</span>
      </div>
    </div>
    <div class="shares-row" title="Shares: ${formatNum(e.sharesRemaining)} remaining / ${formatNum(e.sharesTotal)} total">
      <span class="shares-label">${label('shares')}</span>
      <div class="shares-bar">
        <div class="shares-seg allocated" style="width:${pctAllocated}%"></div>
        <div class="shares-seg reserved" style="width:${pctReserved}%"></div>
        <div class="shares-seg remaining" style="width:${pctRemaining}%"></div>
      </div>
      <span class="shares-val econ-edit" data-field="shares">${formatShort(e.sharesRemaining)}</span>
    </div>
  `;

  el.querySelectorAll('.econ-edit').forEach(btn => {
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => editEconomy(btn.dataset.field));
  });
}

function editEconomy(field) {
  const e = STATE.economy;

  if (field === 'gold') {
    showModal({
      title: 'Edit ' + label('gold'),
      fields: [{ key: 'gold', label: label('gold') + ' ($)', type: 'number', value: e.gold, min: 0 }],
      onSave: (v) => { e.gold = v.gold; saveLocal(); renderEconomy(); },
    });
  } else if (field === 'runway') {
    showModal({
      title: 'Edit ' + label('runway'),
      fields: [{ key: 'runway', label: label('runway'), type: 'text', value: e.runway }],
      onSave: (v) => { e.runway = v.runway || '0'; saveLocal(); renderEconomy(); },
    });
  } else {
    showModal({
      title: 'Edit ' + label('shares'),
      fields: [
        { key: 'allocated', label: 'Allocated', type: 'number', value: e.sharesAllocated, min: 0 },
        { key: 'reserved', label: 'Reserved', type: 'number', value: e.sharesReserved, min: 0 },
        { key: 'remaining', label: 'Remaining', type: 'number', value: e.sharesRemaining, min: 0 },
        { key: 'total', label: 'Total', type: 'number', value: e.sharesTotal, min: 0 },
      ],
      onSave: (v) => {
        e.sharesAllocated = v.allocated; e.sharesReserved = v.reserved;
        e.sharesRemaining = v.remaining; e.sharesTotal = v.total;
        saveLocal(); renderEconomy();
      },
    });
  }
}
