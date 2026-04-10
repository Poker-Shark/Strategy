import { STATE, saveLocal } from '../state.js';
import { label } from '../labels.js';
import { showModal, showConfirm } from '../ui/modal.js';
import { esc } from '../utils.js';

export function renderIntelPanel() {
  const panel = document.getElementById('intelPanel');
  const collapsed = STATE.intelCollapsed;
  panel.classList.toggle('collapsed', collapsed);

  let html = `<button class="panel-toggle" id="intelToggle">${collapsed ? '◀' : label('intelHeader') + ' ▶'}</button>`;

  ['mid', 'top', 'bot'].forEach(lane => {
    const data = STATE.intel[lane];
    html += `<div class="intel-card">
      <div class="intel-title ${lane}">${data.title} <span style="float:right;font-size:9px;color:var(--text3)">${data.status}</span></div>
      ${data.items.map(i => `
        <div class="intel-row intel-item-row" data-lane="${lane}" data-item-id="${i.id}">
          <div class="dot ${i.type} intel-type-btn" title="Click to cycle type"></div>
          <span class="intel-text-btn" title="Click to edit">${esc(i.text)}</span>
          <button class="intel-delete-btn" title="Delete">✕</button>
        </div>
      `).join('')}
      <button class="btn intel-add-btn" data-lane="${lane}" style="width:100%;justify-content:center;font-size:9px;margin-top:4px">+ Add</button>
    </div>`;
  });

  html += `<div class="intel-card">
    <div class="intel-title" style="color:var(--dire)">${label('direSection')}</div>
    ${STATE.dire.map(d => `<div class="competitor-entry">
      <div class="comp-icon">?</div>
      <div style="flex:1">
        <div class="comp-name">${d.name}</div>
        <div class="comp-detail">${d.desc}</div>
        <div class="threat-bar"><div class="threat-fill" style="width:${d.threat}%;background:${d.color}"></div></div>
      </div>
    </div>`).join('')}
  </div>`;

  panel.innerHTML = html;

  // Toggle
  document.getElementById('intelToggle').addEventListener('click', () => {
    STATE.intelCollapsed = !STATE.intelCollapsed;
    renderIntelPanel();
    panel.addEventListener('transitionend', function h() {
      panel.removeEventListener('transitionend', h);
      window.dispatchEvent(new Event('resize'));
    });
    saveLocal();
  });

  // Delegated click handler for intel items
  panel.addEventListener('click', (e) => {
    const row = e.target.closest('.intel-item-row');

    // Cycle type (green → orange → red → gray → green)
    if (e.target.closest('.intel-type-btn') && row) {
      const lane = row.dataset.lane, id = row.dataset.itemId;
      const item = findItem(lane, id);
      if (item) {
        const cycle = ['green', 'orange', 'red', 'gray'];
        item.type = cycle[(cycle.indexOf(item.type) + 1) % cycle.length];
        saveLocal(); renderIntelPanel();
      }
      return;
    }

    // Edit text
    if (e.target.closest('.intel-text-btn') && row) {
      const lane = row.dataset.lane, id = row.dataset.itemId;
      const item = findItem(lane, id);
      if (item) {
        showModal({
          title: 'Edit Intel',
          fields: [
            { key: 'text', label: 'Status update', type: 'textarea', value: item.text, required: true },
            { key: 'type', label: 'Type', type: 'select', value: item.type, options: [
              { value: 'green', label: 'Green — on track' },
              { value: 'orange', label: 'Orange — at risk' },
              { value: 'red', label: 'Red — blocked / critical' },
              { value: 'gray', label: 'Gray — not started' },
            ]},
          ],
          onSave: (v) => { item.text = v.text; item.type = v.type; saveLocal(); renderIntelPanel(); },
        });
      }
      return;
    }

    // Delete
    if (e.target.closest('.intel-delete-btn') && row) {
      const lane = row.dataset.lane, id = row.dataset.itemId;
      showConfirm({
        title: 'Delete this intel item?',
        message: 'This cannot be undone.',
        onConfirm: () => {
          STATE.intel[lane].items = STATE.intel[lane].items.filter(i => i.id !== id);
          saveLocal(); renderIntelPanel();
        },
      });
      return;
    }

    // Add
    const addBtn = e.target.closest('.intel-add-btn');
    if (addBtn) {
      const lane = addBtn.dataset.lane;
      showModal({
        title: 'Add Intel',
        fields: [
          { key: 'text', label: 'Status update', type: 'textarea', required: true },
          { key: 'type', label: 'Type', type: 'select', value: 'green', options: [
            { value: 'green', label: 'Green — on track' },
            { value: 'orange', label: 'Orange — at risk' },
            { value: 'red', label: 'Red — blocked / critical' },
            { value: 'gray', label: 'Gray — not started' },
          ]},
        ],
        onSave: (v) => {
          STATE.intel[lane].items.push({ id: 'i' + Date.now(), text: v.text, type: v.type });
          saveLocal(); renderIntelPanel();
        },
      });
    }
  });
}

function findItem(lane, id) {
  return (STATE.intel[lane]?.items || []).find(i => i.id === id);
}
