import { STATE, STATE_VERSION, saveLocal, loadLocal, undo, redo, capturePhaseSnapshot, applyPhaseSnapshot } from './state.js';
import { preloadPortraits, HERO_PORTRAITS } from './data/heroes.js';
import { Camera } from './map/camera.js';
import { drawTerrain } from './map/terrain.js';
import { drawSvgLayer } from './map/svg-layer.js';
import { drawFog } from './map/fog.js';
import { drawMinimap, updateMinimapViewport } from './map/minimap.js';
import { renderDraftPanel } from './panels/draft.js';
import { renderIntelPanel } from './panels/intel.js';
import { renderEconomy } from './panels/economy.js';
import { toggleShop } from './panels/shop.js';
import { toggleTasks, closeTasks, setTaskUpdateCallback } from './panels/tasks.js';
import { openHeroDetail, closeHeroDetail } from './panels/hero-detail.js';
import { initTooltip } from './interactions/tooltip.js';
import { showBriefing, hideBriefing, toggleBriefing, isBriefingVisible } from './panels/briefing.js';
import { initEntityDrag } from './interactions/entity-drag.js';
import { initConnections } from './interactions/connections.js';
import { showSaveLoadModal } from './ui/saves.js';
import { showModal, showConfirm, closeModal } from './ui/modal.js';
import { exportMapImage } from './ui/export-image.js';
import { detectLane, downloadBlob } from './utils.js';
import { label, getMode, setMode, onModeChange } from './labels.js';
import { initAuth, onAuthChange, getUser } from './auth.js';
import { initAuthUI } from './ui/auth-ui.js';
import { loadFromCloud, suppressSync, forceSyncToCloud } from './cloud-sync.js';

// ── DOM refs ──
const terrainCanvas = document.getElementById('mapTerrain');
const terrainCtx = terrainCanvas.getContext('2d');
const fogCanvas = document.getElementById('fogCanvas');
const fogCtx = fogCanvas.getContext('2d');
const svgRoot = document.getElementById('mapSvg');
const mapWrap = document.getElementById('mapWrap');
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapWrap = document.getElementById('minimapWrap');
const zoomLevelEl = document.getElementById('zoomLevel');

// ── Camera ──
const camera = new Camera();
let W = 0, H = 0;

function resize() {
  W = mapWrap.clientWidth; H = mapWrap.clientHeight;
  terrainCanvas.width = W; terrainCanvas.height = H;
  fogCanvas.width = W; fogCanvas.height = H;
  drawAll();
}

function drawAll() { drawTerrain(terrainCtx, W, H, camera, STATE); drawDynamic(); }

function drawDynamic() {
  drawSvgLayer(svgRoot, W, H, STATE, camera);
  drawFog(fogCtx, W, H, STATE, camera);
  drawMinimap(minimapCanvas, STATE);
  updateCamera();
}

function drawPan() {
  drawTerrain(terrainCtx, W, H, camera, STATE);
  drawSvgLayer(svgRoot, W, H, STATE, camera);
  drawFog(fogCtx, W, H, STATE, camera);
  updateCamera();
}

function updateCamera() {
  updateMinimapViewport(camera, minimapWrap, W, H);
  zoomLevelEl.textContent = camera.zoom.toFixed(1) + 'x';
}

function fullRefresh() {
  renderDraftPanel(drawDynamic);
  renderEconomy();
  drawDynamic();
}

// ── Interactions: Tooltip ──
const { hide: hideTooltip } = initTooltip(svgRoot);

// ── Interactions: Entity drag on map ──
let wardMode = false;
const entityDrag = initEntityDrag(svgRoot, mapWrap, camera, () => ({ W, H }), drawDynamic);
initConnections(svgRoot, () => ({ W, H }));

// ── Interactions: Pan & Zoom ──
let panState = null;

mapWrap.addEventListener('pointerdown', (e) => {
  if (e.target.closest('[data-hero-map]') || e.target.closest('[data-tower-id]') || e.target.closest('[data-camp-id]')) return;
  if (e.target.closest('[data-tt-title]') || wardMode || entityDrag.isActive()) return;
  if (e.button !== 0) return;
  panState = { startX: e.clientX, startY: e.clientY, startCamX: camera.x, startCamY: camera.y };
  mapWrap.classList.add('panning');
  mapWrap.setPointerCapture(e.pointerId);
});

mapWrap.addEventListener('pointermove', (e) => {
  if (!panState) return;
  const dx = e.clientX - panState.startX, dy = e.clientY - panState.startY;
  const v = camera.getView(W, H);
  camera.x = Math.max(0, Math.min(100, panState.startCamX - (dx / W) * v.w));
  camera.y = Math.max(0, Math.min(100, panState.startCamY - (dy / H) * v.h));
  drawPan();
});

mapWrap.addEventListener('pointerup', () => { panState = null; mapWrap.classList.remove('panning'); });

mapWrap.addEventListener('wheel', (e) => {
  e.preventDefault();
  camera.zoomBy(e.deltaY > 0 ? -0.15 : 0.15, e.clientX, e.clientY, mapWrap.getBoundingClientRect(), W, H);
  drawPan();
}, { passive: false });

document.getElementById('zoomIn').addEventListener('click', () => { camera.zoom = Math.min(camera.maxZoom, camera.zoom + 0.5); drawPan(); });
document.getElementById('zoomOut').addEventListener('click', () => { camera.zoom = Math.max(camera.minZoom, camera.zoom - 0.5); drawPan(); });
document.getElementById('zoomReset').addEventListener('click', () => { camera.toggleBirdseye(); drawPan(); });

// ── Minimap navigation ──
minimapWrap.addEventListener('click', (e) => {
  const rect = minimapCanvas.getBoundingClientRect();
  camera.panTo(((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100);
  drawPan();
});
minimapWrap.addEventListener('dblclick', () => { camera.toggleBirdseye(); drawPan(); });

// ── Panel hero click → open detail ──
document.getElementById('draftPanel').addEventListener('click', (e) => {
  const card = e.target.closest('[data-hero-id]');
  if (!card) return;
  const heroId = card.dataset.heroId;
  if (!heroId) return;
  const hero = STATE.heroes.find(h => h.id === heroId);
  if (hero && hero.status !== 'empty') openHeroDetail(heroId, fullRefresh);
});

// ── SVG click — hero detail, roshan, camps ──
svgRoot.addEventListener('click', e => {
  // Hero click → open detail popup
  const heroG = e.target.closest('[data-hero-map]');
  if (heroG) { openHeroDetail(heroG.dataset.heroMap, fullRefresh); return; }

  const rosh = e.target.closest('[data-roshan]');
  if (rosh && STATE.roshan) {
    const cycle = ['alive', 'slain', 'respawning'];
    STATE.roshan.status = cycle[(cycle.indexOf(STATE.roshan.status) + 1) % cycle.length];
    saveLocal(); drawDynamic(); return;
  }
  const camp = e.target.closest('[data-camp-id]');
  if (camp) {
    const c = (STATE.neutralCamps || []).find(nc => nc.id === camp.dataset.campId);
    if (c) { c.status = c.status === 'stacked' ? 'cleared' : 'stacked'; saveLocal(); drawDynamic(); }
    return;
  }

  // Ward click → edit name/desc or delete
  // Minion click → edit
  const minionG = e.target.closest('[data-minion-id]');
  if (minionG) {
    const m = (STATE.minions || []).find(mi => mi.id === minionG.dataset.minionId);
    if (!m) return;
    const fields = [
      { key: 'label', label: 'Label', type: 'text', value: m.label },
      { key: 'count', label: 'Count', type: 'number', value: m.count, min: 0 },
      { key: 'lane', label: 'Lane', type: 'select', value: m.lane, options: ['mid', 'top', 'bot'] },
    ];
    if (m.type === 'super') fields.splice(1, 0, { key: 'name', label: 'Name', type: 'text', value: m.name || '' });
    fields.push({ key: '_delete', label: '', type: 'action', text: 'Delete this group', action: () => {
      closeModal(); STATE.minions = STATE.minions.filter(mi => mi.id !== m.id); saveLocal(); drawDynamic();
    }});
    showModal({
      title: m.label || m.type,
      fields,
      onSave: (v) => {
        m.label = v.label || m.label; m.count = v.count; m.lane = v.lane;
        if (m.type === 'super' && v.name !== undefined) m.name = v.name;
        saveLocal(); drawDynamic();
      },
    });
    return;
  }

  const wardG = e.target.closest('[data-ward-id]');
  if (wardG) {
    const wd = STATE.wards.find(w => w.id === wardG.dataset.wardId);
    if (!wd) return;
    showModal({
      title: label('wardLabel') + ': ' + wd.name,
      fields: [
        { key: 'name', label: 'Name', type: 'text', value: wd.name, required: true },
        { key: 'desc', label: 'Description', type: 'textarea', value: wd.desc },
        { key: '_delete', label: '', type: 'action', text: 'Delete this ' + label('wardLabel').toLowerCase(), action: () => {
          closeModal();
          STATE.wards = STATE.wards.filter(w => w.id !== wd.id);
          STATE.fogHoles = STATE.fogHoles.filter(f => f.wardId !== wd.id);
          saveLocal(); drawDynamic();
        }},
      ],
      onSave: (v) => { wd.name = v.name; wd.desc = v.desc || ''; saveLocal(); drawDynamic(); },
    });
  }
});

// ── Ward + Fog edit (shared fogCanvas) ──
function toggleWardMode() {
  if (STATE.fogEditMode) return;
  wardMode = !wardMode;
  document.getElementById('wardBtn').classList.toggle('active', wardMode);
  updateFogCanvas();
}

function toggleFogEdit() {
  if (wardMode) return;
  STATE.fogEditMode = !STATE.fogEditMode;
  document.getElementById('fogEditBtn').classList.toggle('active', STATE.fogEditMode);
  updateFogCanvas();
  drawDynamic(); saveLocal();
}

function updateFogCanvas() {
  const interactive = wardMode || STATE.fogEditMode;
  fogCanvas.style.pointerEvents = interactive ? 'auto' : 'none';
  fogCanvas.style.cursor = interactive ? 'crosshair' : 'default';
}

fogCanvas.addEventListener('click', (e) => {
  const rect = mapWrap.getBoundingClientRect();
  const pos = camera.screenToMap(e.clientX, e.clientY, rect, W, H);

  if (STATE.fogEditMode) {
    const zones = STATE.fogZones || [];
    const hit = zones.findIndex(z => Math.hypot(z.x - pos.x, z.y - pos.y) < z.r * 0.6);
    if (hit >= 0) zones.splice(hit, 1);
    else zones.push({ x: Math.round(pos.x), y: Math.round(pos.y), r: 15 });
    drawDynamic(); saveLocal(); return;
  }

  if (!wardMode) return;
  toggleWardMode();
  showModal({
    title: label('wardBtn'),
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'desc', label: 'Description', type: 'textarea' },
    ],
    onSave: (v) => {
      const wardId = 'w' + Date.now();
      STATE.wards.push({ id: wardId, x: pos.x, y: pos.y, name: v.name, desc: v.desc || '', r: 6 });
      STATE.fogHoles.push({ x: pos.x, y: pos.y, r: 6, wardId });
      drawDynamic(); saveLocal();
    },
  });
});

// ── Controls ──
function toggleFog() { STATE.fogEnabled = !STATE.fogEnabled; document.getElementById('fogBtn').classList.toggle('active', STATE.fogEnabled); drawDynamic(); saveLocal(); }
function resetFog() { STATE.fogHoles = [{ x:8, y:85, r:18 }, { x:15, y:78, r:10 }]; STATE.wards.forEach(wd => STATE.fogHoles.push({ x:wd.x, y:wd.y, r:6, wardId:wd.id })); drawDynamic(); saveLocal(); }

function setPhase(phase) {
  // Save current phase snapshot
  STATE.phases[STATE.phase] = capturePhaseSnapshot();
  // Load target phase (clone from current if first visit)
  if (!STATE.phases[phase]) STATE.phases[phase] = capturePhaseSnapshot();
  applyPhaseSnapshot(STATE.phases[phase]);
  STATE.phase = phase;
  document.querySelectorAll('.phase-tab').forEach(t => t.classList.toggle('active', t.dataset.phase === phase));
  updateLabels();
  fullRefresh(); renderIntelPanel(); drawAll(); saveLocal();
}

function exportState() {
  downloadBlob(new Blob([JSON.stringify(STATE, null, 2)], { type: 'application/json' }), 'strategy-' + new Date().toISOString().slice(0, 10) + '.json');
}

function importState() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { try { Object.assign(STATE, JSON.parse(ev.target.result)); fullRefresh(); renderIntelPanel(); drawAll(); saveLocal(); } catch(err) { alert('Invalid file'); } };
    r.readAsText(f);
  };
  input.click();
}

// ── Wire buttons ──
document.getElementById('fogBtn').addEventListener('click', toggleFog);
document.getElementById('wardBtn').addEventListener('click', toggleWardMode);
document.getElementById('resetFogBtn').addEventListener('click', resetFog);
// Camera navigation for briefing lane clicks
function onEnterWarRoom(targetLane) {
  if (targetLane) {
    const laneHeroes = STATE.heroes.filter(h => h.lane === targetLane);
    const positions = laneHeroes.map(h => STATE.heroPositions[h.id]).filter(Boolean);
    if (positions.length > 0) {
      camera.panTo(
        positions.reduce((s, p) => s + p.x, 0) / positions.length,
        positions.reduce((s, p) => s + p.y, 0) / positions.length
      );
      camera.zoom = 2.0;
    }
  }
  drawPan();
}

document.getElementById('briefingBtn').addEventListener('click', () => toggleBriefing(onEnterWarRoom, fullRefresh));
document.getElementById('shopBtn').addEventListener('click', () => toggleShop());
document.getElementById('taskBtn').addEventListener('click', () => { closeTasks(); toggleTasks(); });
document.getElementById('fogEditBtn').addEventListener('click', toggleFogEdit);
document.getElementById('spawnBtn').addEventListener('click', () => {
  showModal({
    title: label('spawnBtn'),
    fields: [
      { key: 'type', label: 'Type', type: 'select', value: 'basic', options: [
        { value: 'basic', label: 'Basic — Paying Users' },
        { value: 'wizard', label: 'Wizard — Community Leaders / Recruiters' },
        { value: 'super', label: 'Super — Sponsors / Influencers / Partners' },
      ]},
      { key: 'count', label: 'How many?', type: 'number', value: 1, min: 0 },
      { key: 'name', label: 'Name (super minions only)', type: 'text' },
      { key: 'label', label: 'Label', type: 'text', value: 'Paying Users' },
      { key: 'lane', label: 'Lane', type: 'select', value: 'mid', options: [
        { value: 'mid', label: (STATE.laneNames||{}).mid || 'Product' },
        { value: 'top', label: (STATE.laneNames||{}).top || 'Ops' },
        { value: 'bot', label: (STATE.laneNames||{}).bot || 'Solver' },
      ]},
    ],
    onSave: (v) => {
      if (!STATE.minions) STATE.minions = [];
      const base = { mid:{x:16,y:74}, top:{x:10,y:60}, bot:{x:14,y:82} };
      const p = base[v.lane] || base.mid;
      STATE.minions.push({
        id: 'mn' + Date.now(), type: v.type, count: v.count, lane: v.lane,
        x: p.x + (Math.random()*4-2), y: p.y + (Math.random()*4-2),
        label: v.label || (v.type === 'basic' ? 'Users' : v.type === 'wizard' ? 'Leaders' : 'Partner'),
        name: v.type === 'super' ? v.name : undefined,
      });
      saveLocal(); drawDynamic();
    },
  });
});
document.getElementById('savesBtn').addEventListener('click', () => showSaveLoadModal(() => { fullRefresh(); renderIntelPanel(); drawAll(); }));
document.getElementById('screenshotBtn').addEventListener('click', () => exportMapImage(terrainCanvas, fogCanvas, svgRoot));
document.getElementById('exportBtn').addEventListener('click', exportState);
document.getElementById('importBtn').addEventListener('click', importState);
document.querySelectorAll('.phase-tab').forEach(tab => { tab.addEventListener('click', () => setPhase(tab.dataset.phase)); });

// ── Keyboard ──
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'f') toggleFog();
  if (e.key === 'w') toggleWardMode();
  if (e.key === 'r') resetFog();
  if (e.key === 'g') toggleBriefing(onEnterWarRoom, fullRefresh);
  if (e.key === 'b') toggleShop();
  if (e.key === 't') toggleTasks();
  if (e.key === 'e') toggleFogEdit();
  if (e.key === 'm') document.getElementById('spawnBtn').click();
  if (e.key === 'Tab') { e.preventDefault(); STATE.panelCollapsed = !STATE.panelCollapsed; renderDraftPanel(drawDynamic); saveLocal(); }
  if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); if (undo()) { fullRefresh(); renderIntelPanel(); drawAll(); } }
  if ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) || (e.key === 'y' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); if (redo()) { fullRefresh(); renderIntelPanel(); drawAll(); } }
  if (e.key === 'Escape') { if (wardMode) toggleWardMode(); closeHeroDetail(); hideTooltip(); }
  if (e.key === '+' || e.key === '=') { camera.zoom = Math.min(camera.maxZoom, camera.zoom + 0.25); drawPan(); }
  if (e.key === '-') { camera.zoom = Math.max(camera.minZoom, camera.zoom - 0.25); drawPan(); }
  if (e.key === '0') { camera.toggleBirdseye(); drawPan(); }
});

// ── Init ──
preloadPortraits();
loadLocal();
setTaskUpdateCallback(drawDynamic);
renderDraftPanel(drawDynamic);
renderIntelPanel();
renderEconomy();
document.getElementById('fogBtn').classList.toggle('active', STATE.fogEnabled);
// ── Label system ──
function updateLabels() {
  // Phase tabs
  document.querySelectorAll('.phase-tab').forEach(t => { t.textContent = label('phase_' + t.dataset.phase); });
  // Phase status
  document.getElementById('phaseStatus').textContent = label('status_' + STATE.phase);
  // Bottom bar buttons
  const btnLabels = { briefingBtn:'briefingBtn', shopBtn:'shopBtn', taskBtn:'taskBtn', spawnBtn:'spawnBtn', fogBtn:'fogBtn', fogEditBtn:'fogEditBtn', wardBtn:'wardBtn', resetFogBtn:'resetFogBtn' };
  for (const [id, key] of Object.entries(btnLabels)) {
    const el = document.getElementById(id);
    if (el) { const keySpan = el.querySelector('.key'); el.textContent = label(key) + ' '; if (keySpan) el.appendChild(keySpan); }
  }
  // Mode toggle
  const toggle = document.getElementById('modeToggle');
  const mode = getMode();
  toggle.innerHTML = `<span class="mode-opt ${mode === 'biz' ? 'active-biz' : ''}" data-mode="biz">Biz</span><span class="mode-opt ${mode === 'dota' ? 'active-dota' : ''}" data-mode="dota">Dota</span>`;
  toggle.querySelectorAll('.mode-opt').forEach(opt => {
    opt.addEventListener('click', () => { setMode(opt.dataset.mode); saveLocal(); });
  });
}

onModeChange(() => { updateLabels(); fullRefresh(); renderIntelPanel(); drawAll(); });

// Flush state to localStorage on unload (cloud sync via saveLocal's debounce is best-effort)
window.addEventListener('beforeunload', () => {
  try { localStorage.setItem('ps-strategy-v2', JSON.stringify(STATE)); } catch(e) {}
});
window.addEventListener('resize', resize);
resize();
updateLabels();
showBriefing(onEnterWarRoom, fullRefresh);

// ── Auth Gate ──
import { signIn } from './auth.js';

const authGate = document.getElementById('authGate');
const appShell = document.getElementById('appShell');

function showApp() {
  authGate.classList.add('hidden');
  appShell.style.display = '';
  resize();
}

function showGate() {
  authGate.classList.remove('hidden');
  appShell.style.display = 'none';
}

// Gate form wiring
document.getElementById('gateSignIn').addEventListener('click', async () => {
  const email = document.getElementById('gateEmail').value.trim();
  const password = document.getElementById('gatePassword').value;
  const errEl = document.getElementById('gateError');
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Email and password required'; return; }

  const result = await signIn(email, password);
  if (result.error) errEl.textContent = result.error;
});

// Enter key on password field
document.getElementById('gatePassword').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('gateSignIn').click();
});

// Auth state drives visibility
initAuth().then(() => {
  initAuthUI();
  if (getUser()) showApp(); else showGate();
});

onAuthChange(async (user) => {
  initAuthUI();
  if (user) {
    showApp();
    suppressSync(true);
    try {
      const cloud = await loadFromCloud();
      if (cloud && cloud.state && cloud.state._version >= STATE_VERSION) {
        Object.assign(STATE, cloud.state);
        try { localStorage.setItem('ps-strategy-v2', JSON.stringify(STATE)); } catch(e) {}
        fullRefresh(); renderIntelPanel(); drawAll();
      } else {
        // Cloud data is stale or missing — push fresh defaults
        forceSyncToCloud(STATE);
      }
    } finally {
      suppressSync(false);
    }
  } else {
    showGate();
  }
});
