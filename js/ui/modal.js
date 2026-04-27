import { esc } from '../utils.js';

let activeModal = null;

export function showModal({ title, fields = [], onSave, onCancel }) {
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'sharedModal';

  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-title">${esc(title)}</div>
      <div class="modal-fields">
        ${fields.map(f => renderField(f)).join('')}
      </div>
      <div class="modal-actions">
        <button class="btn modal-save" id="modalSave">Save</button>
        <button class="btn" id="modalCancel">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  activeModal = overlay;

  // Wire action buttons
  fields.filter(f => f.type === 'action').forEach(f => {
    const btn = overlay.querySelector(`[data-action-key="${f.key}"]`);
    if (btn && f.action) btn.addEventListener('click', f.action);
  });

  // Focus first input
  const firstInput = overlay.querySelector('input, textarea, select');
  if (firstInput) setTimeout(() => firstInput.focus(), 50);

  // Wire save
  overlay.querySelector('#modalSave').addEventListener('click', () => {
    const values = {};
    let valid = true;
    fields.forEach(f => {
      const el = overlay.querySelector(`[data-field="${f.key}"]`);
      if (!el) return;
      let val;
      if (f.type === 'number') val = parseFloat(el.value);
      else if (f.type === 'checkbox') val = el.checked;
      else val = el.value;
      values[f.key] = val;
      if (f.required && f.type !== 'checkbox' && !String(el.value).trim()) {
        el.style.borderColor = 'var(--dire)';
        valid = false;
      }
    });
    if (!valid) return;
    closeModal();
    if (onSave) onSave(values);
  });

  // Wire cancel
  overlay.querySelector('#modalCancel').addEventListener('click', () => { closeModal(); if (onCancel) onCancel(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) { closeModal(); if (onCancel) onCancel(); } });

  // Enter to save, Escape to cancel
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); if (onCancel) onCancel(); }
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') { overlay.querySelector('#modalSave').click(); }
  });
}

export function showConfirm({ title, message, onConfirm, onCancel }) {
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'sharedModal';

  overlay.innerHTML = `
    <div class="modal-card" style="max-width:340px">
      <div class="modal-title">${esc(title)}</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:14px;line-height:1.5">${esc(message)}</div>
      <div class="modal-actions">
        <button class="btn" id="modalConfirm" style="background:var(--dire);color:#fff;border-color:var(--dire)">Confirm</button>
        <button class="btn" id="modalCancel">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  activeModal = overlay;

  overlay.querySelector('#modalConfirm').addEventListener('click', () => { closeModal(); if (onConfirm) onConfirm(); });
  overlay.querySelector('#modalCancel').addEventListener('click', () => { closeModal(); if (onCancel) onCancel(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) { closeModal(); if (onCancel) onCancel(); } });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); if (onCancel) onCancel(); } });
}

export function closeModal() {
  if (activeModal) { activeModal.remove(); activeModal = null; }
  const old = document.getElementById('sharedModal');
  if (old) old.remove();
}

function renderField(f) {
  const val = f.value !== undefined ? f.value : '';
  if (f.type === 'textarea') {
    return `<label class="mf-label">${esc(f.label || f.key)}
      <textarea class="mf-textarea" data-field="${f.key}">${esc(String(val))}</textarea>
    </label>`;
  }
  if (f.type === 'select') {
    return `<label class="mf-label">${esc(f.label || f.key)}
      <select class="mf-select" data-field="${f.key}">
        ${(f.options || []).map(o => {
          const optVal = typeof o === 'object' ? o.value : o;
          const optLabel = typeof o === 'object' ? o.label : o;
          return `<option value="${optVal}" ${optVal === val ? 'selected' : ''}>${esc(optLabel)}</option>`;
        }).join('')}
      </select>
    </label>`;
  }
  if (f.type === 'number') {
    return `<label class="mf-label">${esc(f.label || f.key)}
      <input class="mf-input" type="number" step="${f.step || 'any'}" data-field="${f.key}" value="${val}" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''}>
    </label>`;
  }
  if (f.type === 'date') {
    return `<label class="mf-label">${esc(f.label || f.key)}
      <input class="mf-input" type="date" data-field="${f.key}" value="${esc(String(val))}">
    </label>`;
  }
  if (f.type === 'checkbox') {
    return `<label class="mf-label" style="flex-direction:row;align-items:center;gap:8px">
      <input type="checkbox" data-field="${f.key}" ${val ? 'checked' : ''}>
      <span>${esc(f.label || f.key)}</span>
    </label>`;
  }
  if (f.type === 'action') {
    return `<button class="btn mf-action" data-action-key="${f.key}" style="width:100%;justify-content:center;color:var(--dire);font-size:11px;margin-top:4px">${esc(f.text || 'Action')}</button>`;
  }
  // Default: text
  return `<label class="mf-label">${esc(f.label || f.key)}
    <input class="mf-input" type="text" data-field="${f.key}" value="${esc(String(val))}" ${f.required ? 'required' : ''}>
  </label>`;
}
