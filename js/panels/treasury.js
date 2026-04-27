import { label } from '../labels.js';
import { esc } from '../utils.js';
import { loadTreasury, isLoaded } from '../treasury/state.js';
import { renderTransactions } from '../treasury/transactions-view.js';
import { renderRules } from '../treasury/rules-view.js';
import { renderImport } from '../treasury/import-view.js';
import { renderDashboard } from '../treasury/dashboard.js';
import { renderPnL } from '../treasury/pnl.js';

let treasuryOpen = false;
let activeTab = 'transactions';

export function toggleTreasury(closeOthers) {
  treasuryOpen = !treasuryOpen;
  document.getElementById('treasuryDrawer').classList.toggle('open', treasuryOpen);
  document.getElementById('treasuryBtn').classList.toggle('active', treasuryOpen);
  if (treasuryOpen) {
    if (closeOthers) closeOthers();
    openTreasury();
  }
}

export function closeTreasury() {
  treasuryOpen = false;
  document.getElementById('treasuryDrawer').classList.remove('open');
  document.getElementById('treasuryBtn').classList.remove('active');
}

async function openTreasury() {
  renderShell();
  if (!isLoaded()) {
    setBody('<div class="treasury-empty">Loading…</div>');
    try {
      await loadTreasury();
    } catch (e) {
      setBody(`<div class="treasury-error">Failed to load treasury: ${esc(e.message || String(e))}</div>`);
      return;
    }
  }
  renderActiveTab();
}

function renderShell() {
  const drawer = document.getElementById('treasuryDrawer');
  const tabs = [
    { id: 'dashboard',    name: 'Dashboard' },
    { id: 'transactions', name: 'Transactions' },
    { id: 'rules',        name: 'Rules' },
    { id: 'pnl',          name: 'P&L' },
    { id: 'import',       name: 'Import' },
  ];
  drawer.innerHTML = `
    <div class="treasury-header">
      <span class="treasury-title">${label('treasuryTitle')}</span>
      <div class="treasury-tabs">
        ${tabs.map(t => `<button class="treasury-tab ${t.id === activeTab ? 'active' : ''}" data-tab="${t.id}">${t.name}</button>`).join('')}
      </div>
      <button class="treasury-close" id="treasuryClose" aria-label="Close treasury">×</button>
    </div>
    <div class="treasury-body" id="treasuryBody"></div>
  `;
  document.getElementById('treasuryClose').addEventListener('click', () => toggleTreasury());
  drawer.querySelectorAll('.treasury-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      drawer.querySelectorAll('.treasury-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
      renderActiveTab();
    });
  });
}

function renderActiveTab() {
  const body = document.getElementById('treasuryBody');
  if (!body) return;
  if (activeTab === 'dashboard')         renderDashboard(body);
  else if (activeTab === 'transactions') renderTransactions(body);
  else if (activeTab === 'rules')        renderRules(body);
  else if (activeTab === 'pnl')          renderPnL(body);
  else if (activeTab === 'import')       renderImport(body);
  else setBody(`<div class="treasury-empty">Unknown tab "${esc(activeTab)}".</div>`);
}

function setBody(html) {
  const body = document.getElementById('treasuryBody');
  if (body) body.innerHTML = html;
}
