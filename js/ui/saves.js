import { STATE, saveLocal, loadLocal } from '../state.js';
import { esc } from '../utils.js';
import { showModal } from './modal.js';

const SAVES_KEY = 'ps-strategy-saves';

export function saveToSlot(name) {
  const saves = getAllSaves();
  saves[name] = JSON.stringify(STATE);
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
}

export function loadFromSlot(name, onLoaded) {
  const saves = getAllSaves();
  if (!saves[name]) return false;
  Object.assign(STATE, JSON.parse(saves[name]));
  saveLocal(); // persist to primary storage + push undo history
  if (onLoaded) onLoaded();
  return true;
}

export function deleteSlot(name) {
  if (name === 'auto') return;
  const saves = getAllSaves();
  delete saves[name];
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
}

export function getSlotNames() {
  return Object.keys(getAllSaves()).filter(n => n !== 'auto');
}

function getAllSaves() {
  try {
    const s = localStorage.getItem(SAVES_KEY);
    return s ? JSON.parse(s) : {};
  } catch (e) { return {}; }
}

export function showSaveLoadModal(onLoaded) {
  const existing = document.getElementById('saveLoadModal');
  if (existing) existing.remove();

  const names = getSlotNames();

  const overlay = document.createElement('div');
  overlay.id = 'saveLoadModal';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:360px">
      <div class="modal-title">Save / Load</div>
      <div style="margin-bottom:10px">
        <button class="btn modal-save" id="saveAsBtn" style="width:100%;justify-content:center">Save As New Slot...</button>
      </div>
      <div class="save-slot-list">
        <div class="save-slot-item" data-slot="auto">
          <span class="save-slot-name">Auto-save (current)</span>
          <button class="btn save-load-btn" data-slot="auto">Load</button>
        </div>
        ${names.map(n => `
          <div class="save-slot-item" data-slot="${esc(n)}">
            <span class="save-slot-name">${esc(n)}</span>
            <button class="btn save-load-btn" data-slot="${esc(n)}">Load</button>
            <button class="btn save-delete-btn" data-slot="${esc(n)}" style="color:var(--dire)">✕</button>
          </div>
        `).join('')}
      </div>
      <div class="modal-actions" style="margin-top:12px">
        <button class="btn" id="saveLoadClose">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('saveLoadClose').addEventListener('click', () => overlay.remove());

  document.getElementById('saveAsBtn').addEventListener('click', () => {
    showModal({
      title: 'Save As',
      fields: [{ key: 'name', label: 'Save name', type: 'text', required: true }],
      onSave: (v) => {
        if (v.name === 'auto') return;
        saveToSlot(v.name);
        overlay.remove();
        showSaveLoadModal(onLoaded);
      },
    });
  });

  overlay.querySelectorAll('.save-load-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      loadFromSlot(btn.dataset.slot, onLoaded);
      overlay.remove();
    });
  });

  overlay.querySelectorAll('.save-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm(`Delete "${btn.dataset.slot}"?`)) return;
      deleteSlot(btn.dataset.slot);
      overlay.remove();
      showSaveLoadModal(onLoaded);
    });
  });
}
