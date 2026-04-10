import { STATE, saveLocal } from '../state.js';
import { HERO_PORTRAITS, POS3_CANDIDATES, portraitUrl, LANE_COLORS } from '../data/heroes.js';
import { truncate, esc, levelToVision, invalidatePositionCache } from '../utils.js';
import { renderEconomy } from './economy.js';
import { label } from '../labels.js';
import { showModal, showConfirm } from '../ui/modal.js';

let _onRedraw = null;

// Section collapse state (session only, not persisted)
const sections = { team: true, towers: true, camps: true };

export function renderDraftPanel(onRedraw) {
  _onRedraw = onRedraw;
  const panel = document.getElementById('draftPanel');
  const collapsed = STATE.panelCollapsed;
  panel.classList.toggle('collapsed', collapsed);

  const cores = STATE.heroes.filter(h => h.pos <= 3);
  const supports = STATE.heroes.filter(h => h.pos >= 4);
  const laneNames = STATE.laneNames || { mid: 'Product', top: 'Ops', bot: 'Solver' };

  let html = `<button class="panel-toggle" id="panelToggle">${collapsed ? '▶' : '◀ ' + label('draftHeader')}</button>`;

  // ── Team section (collapsible) ──
  html += renderSectionHeader('team', label('draftHeader'));
  if (sections.team) {
    html += `<div class="section-label" style="margin-top:4px">${label('coresSection')}</div>`;
    html += cores.map(renderHeroCard).join('');
    html += `<div class="section-label">${label('supportsSection')}</div>`;
    html += supports.map(renderHeroCard).join('');
  }

  // ── Towers section (collapsible) ──
  html += renderSectionHeader('towers', label('towersSection'));
  if (sections.towers) {
    ['mid', 'top', 'bot'].forEach(lane => {
      const tasks = STATE.towers[lane] || [];
      html += `<div class="tower-lane-group" style="border-left:2px solid ${LANE_COLORS[lane]};padding-left:6px;margin:4px 0">`;
      html += `<div style="font-size:9px;color:${LANE_COLORS[lane]};font-weight:700;margin-bottom:3px">${laneNames[lane]} Lane</div>`;
      tasks.sort((a, b) => a.order - b.order).forEach(t => {
        html += renderTowerCard(t, lane);
      });
      html += `<button class="btn tower-add-btn" data-lane="${lane}" style="width:100%;justify-content:center;font-size:9px;margin-top:2px">${label('addTower')}</button>`;
      html += '</div>';
    });
  }

  // ── Camps section (collapsible) ──
  html += renderSectionHeader('camps', label('campsSection'));
  if (sections.camps) {
    html += renderCampSection();
  }

  panel.innerHTML = html;

  // ── Wire panel toggle ──
  document.getElementById('panelToggle').addEventListener('click', () => {
    STATE.panelCollapsed = !STATE.panelCollapsed;
    renderDraftPanel(onRedraw);
    panel.addEventListener('transitionend', function h() { panel.removeEventListener('transitionend', h); if (onRedraw) onRedraw(); });
    saveLocal();
  });

  // ── Wire section toggles ──
  panel.querySelectorAll('.section-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      sections[btn.dataset.section] = !sections[btn.dataset.section];
      renderDraftPanel(onRedraw);
    });
  });

  // ── Wire pos3 picker ──
  const picker = document.getElementById('pos3Picker');
  const pos3Card = panel.querySelector('[data-hero-id="pos3"]');
  if (pos3Card && picker) {
    pos3Card.addEventListener('click', (e) => {
      if (e.target.closest('.pos3-option')) return;
      picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
    });
    picker.querySelectorAll('.pos3-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        selectPos3(opt.dataset.slug, opt.dataset.name);
      });
    });
  }

  // ── Wire level editing ──
  panel.querySelectorAll('.lvl-edit').forEach(el => {
    el.addEventListener('click', () => {
      const hero = STATE.heroes.find(h => h.id === el.dataset.heroId);
      if (!hero) return;
      showModal({
        title: `${hero.name} — Level`,
        fields: [
          { key: 'level', label: `Level (0-${hero.maxLevel})`, type: 'number', value: hero.level, min: 0, max: hero.maxLevel },
        ],
        onSave: (v) => {
          hero.level = Math.max(0, Math.min(hero.maxLevel, v.level));
          hero.vision = levelToVision(hero.level);
          saveLocal(); renderDraftPanel(onRedraw); if (onRedraw) onRedraw();
        },
      });
    });
  });

  // ── Delegated click handler for camps + towers ──
  panel.addEventListener('click', (e) => {
    // Camp actions
    const clear = e.target.closest('.camp-clear-btn');
    if (clear) { clearCamp(clear.dataset.campId); return; }
    const edit = e.target.closest('.camp-edit-btn');
    if (edit) { editCamp(edit.dataset.campId); return; }
    const del = e.target.closest('.camp-delete-btn');
    if (del) { deleteCamp(del.dataset.campId); return; }
    if (e.target.closest('#addCampBtn')) { addCamp(); return; }
    const preset = e.target.closest('.camp-preset');
    if (preset) { addPreset(preset.dataset.preset); return; }

    // Tower actions
    const tAdd = e.target.closest('.tower-add-btn');
    if (tAdd) { addTower(tAdd.dataset.lane); return; }
    const tEdit = e.target.closest('.tower-edit-btn');
    if (tEdit) { editTower(tEdit.dataset.lane, tEdit.dataset.id); return; }
    const tDel = e.target.closest('.tower-delete-btn');
    if (tDel) { deleteTower(tDel.dataset.lane, tDel.dataset.id); return; }
    const tCycle = e.target.closest('.tower-status-btn');
    if (tCycle) { cycleTowerStatus(tCycle.dataset.lane, tCycle.dataset.id); return; }
  });
}

// ── Section header with toggle ──

function renderSectionHeader(key, label) {
  const open = sections[key];
  return `<div class="section-toggle" data-section="${key}" style="display:flex;align-items:center;gap:4px;cursor:pointer;margin:8px 0 4px;user-select:none">
    <span style="font-size:8px;color:var(--text3)">${open ? '▼' : '▶'}</span>
    <span class="section-label" style="margin:0;flex:1">${label}</span>
  </div>`;
}

// ── Hero cards ──

function renderHeroCard(h) {
  const avatarClass = h.status === 'empty' ? 'empty' : 'pos' + h.pos;
  const portrait = HERO_PORTRAITS[h.id];
  const avatarInner = portrait
    ? `<img src="${portrait}" alt="${esc(h.name)}">`
    : (h.status === 'empty' ? '?' : h.name.charAt(0));

  const isDraggable = h.status !== 'empty';
  const pos3Extra = h.id === 'pos3' ? renderPos3Picker() : '';

  return `
    <div class="hero-card ${h.status === 'empty' ? 'empty' : ''}"
         data-hero-id="${h.id}" ${isDraggable ? 'data-draggable="true"' : ''}>
      <div class="hero-status"><span class="status-dot ${h.status}"></span></div>
      <div class="hero-top">
        <div class="hero-avatar ${avatarClass}">${avatarInner}</div>
        <div class="hero-info">
          <div class="hero-name">${esc(h.name)}</div>
          <div class="hero-role">${esc(h.role)}</div>
        </div>
        <div class="hero-lane-tag ${h.lane}">${h.lane}</div>
      </div>
      ${h.level > 0 ? `
        <div class="hero-level">Lvl <span class="lvl lvl-edit" data-hero-id="${h.id}" title="Click to edit level">${h.level}</span> / ${h.maxLevel} — vision: ${h.vision}</div>
        <div class="hero-bars">
          <div class="mini-bar" title="Energy"><div class="mini-bar-fill hp" style="width:${h.hp}%"></div></div>
          <div class="mini-bar" title="Resources"><div class="mini-bar-fill mp" style="width:${h.mp}%"></div></div>
        </div>
      ` : ''}
      <div class="hero-note">${esc(h.note)}</div>
      ${pos3Extra}
    </div>
  `;
}

function renderPos3Picker() {
  return `
    <div class="pos3-picker" id="pos3Picker" style="display:none">
      ${POS3_CANDIDATES.map(c => `
        <div class="pos3-option" data-slug="${c.slug}" data-name="${c.name}">
          <img src="${portraitUrl(c.slug)}" alt="${c.name}">
          <div class="opt-info">
            <div class="opt-name">${c.name}</div>
            <div class="opt-reason">${c.reason}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function selectPos3(slug, name) {
  const hero = STATE.heroes.find(h => h.id === 'pos3');
  hero.name = name + ' (Candidate)';
  hero.status = 'warning';
  hero.level = 1;
  hero.vision = levelToVision(1);
  hero.hp = 50; hero.mp = 50;
  hero.note = `Candidate for Pos 3 offlaner. If confirmed, will take ownership of top lane.`;
  hero.dota = `${name} — the offlaner who dictates the pace and creates space for cores.`;
  HERO_PORTRAITS['pos3'] = portraitUrl(slug);
  STATE.heroPositions['pos3'] = { x: 15, y: 28 };
  saveLocal(); renderDraftPanel(_onRedraw); if (_onRedraw) _onRedraw();
}

// ── Tower cards ──

function renderTowerCard(t, lane) {
  const statusColors = { achieved: 'var(--radiant)', next: 'var(--orange)', locked: 'var(--text3)' };
  const sc = statusColors[t.status] || 'var(--text3)';
  return `
    <div class="tower-card">
      <div style="display:flex;align-items:center;gap:5px">
        <img src="/tower.webp" class="tower-thumb" alt="tower">
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.name)}</div>
          <div style="font-size:9px;color:var(--text3)">${esc(t.desc || '').slice(0, 50)}</div>
        </div>
        <span class="tower-status-btn" data-lane="${lane}" data-id="${t.id}" style="font-size:7px;text-transform:uppercase;letter-spacing:1px;padding:1px 4px;border:1px solid ${sc};color:${sc};border-radius:3px;cursor:pointer">${t.status}</span>
      </div>
      <div style="display:flex;gap:3px;margin-top:3px">
        <button class="btn tower-edit-btn" data-lane="${lane}" data-id="${t.id}" style="font-size:8px;padding:1px 4px;flex:1">Edit</button>
        <button class="btn tower-delete-btn" data-lane="${lane}" data-id="${t.id}" style="font-size:8px;padding:1px 4px;color:var(--dire)">✕</button>
      </div>
    </div>
  `;
}

function addTower(lane) {
  showModal({
    title: label('addTower'),
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'desc', label: 'Description', type: 'textarea' },
    ],
    onSave: (v) => {
      STATE.towers[lane].push({ id: 't' + Date.now(), name: v.name, desc: v.desc || '', status: 'locked', order: STATE.towers[lane].length });
      invalidatePositionCache();
      saveLocal(); renderDraftPanel(_onRedraw); if (_onRedraw) _onRedraw();
    },
  });
}

function editTower(lane, id) {
  const t = (STATE.towers[lane] || []).find(t => t.id === id);
  if (!t) return;
  showModal({
    title: 'Edit ' + label('towersSection'),
    fields: [
      { key: 'name', label: 'Name', type: 'text', value: t.name, required: true },
      { key: 'desc', label: 'Description', type: 'textarea', value: t.desc },
    ],
    onSave: (v) => {
      t.name = v.name; t.desc = v.desc || '';
      saveLocal(); renderDraftPanel(_onRedraw); if (_onRedraw) _onRedraw();
    },
  });
}

function deleteTower(lane, id) {
  showConfirm({
    title: label('deleteTower'),
    message: 'This cannot be undone.',
    onConfirm: () => {
      STATE.towers[lane] = (STATE.towers[lane] || []).filter(t => t.id !== id);
      STATE.towers[lane].forEach((t, i) => t.order = i);
      invalidatePositionCache();
      saveLocal(); renderDraftPanel(_onRedraw); if (_onRedraw) _onRedraw();
    },
  });
}

function cycleTowerStatus(lane, id) {
  const t = (STATE.towers[lane] || []).find(t => t.id === id);
  if (!t) return;
  const cycle = ['locked', 'next', 'achieved'];
  t.status = cycle[(cycle.indexOf(t.status) + 1) % cycle.length];
  saveLocal(); renderDraftPanel(_onRedraw); if (_onRedraw) _onRedraw();
}

// ── Camp management ──

const CAMP_PRESETS = [
  { name:'Influencer Deal', desc:'Partner with poker content creator for promotion.', lane:'top', type:'medium', gold:1000, xp:2 },
  { name:'Conference Talk', desc:'Present at poker/AI conference. Credibility boost.', lane:'bot', type:'medium', gold:200, xp:4 },
  { name:'Podcast Guest', desc:'Appear on a poker podcast. Low cost, high reach.', lane:'top', type:'small', gold:400, xp:1 },
  { name:'Discord Community', desc:'Build an engaged community server. Retention play.', lane:'mid', type:'medium', gold:300, xp:2 },
  { name:'Blog Post Series', desc:'SEO-driven content about poker strategy. Organic traffic.', lane:'top', type:'small', gold:500, xp:1 },
  { name:'Academic Review', desc:'Get solver methodology peer-reviewed. Major credibility.', lane:'bot', type:'medium', gold:100, xp:5 },
];

const CAMP_LANE_POSITIONS = {
  mid: [{ x:35, y:55 }, { x:42, y:65 }, { x:30, y:68 }],
  top: [{ x:14, y:45 }, { x:12, y:60 }, { x:20, y:40 }],
  bot: [{ x:40, y:82 }, { x:50, y:78 }, { x:28, y:88 }],
  dire: [{ x:72, y:28 }, { x:65, y:18 }, { x:80, y:35 }],
};

function renderCampSection() {
  const camps = STATE.neutralCamps || [];
  const laneNames = STATE.laneNames || { mid: 'Product', top: 'Ops', bot: 'Solver' };
  let html = '';

  ['mid', 'top', 'bot'].forEach(lane => {
    const laneCamps = camps.filter(c => c.lane === lane);
    if (laneCamps.length === 0) return;
    html += `<div class="camp-lane-group" style="border-left:2px solid ${LANE_COLORS[lane]};padding-left:6px;margin-bottom:4px">`;
    html += `<div style="font-size:9px;color:${LANE_COLORS[lane]};font-weight:700;margin-bottom:3px">${laneNames[lane]} ${label('jungle')}</div>`;
    laneCamps.forEach(c => { html += renderCampCard(c); });
    html += '</div>';
  });

  const direCamps = camps.filter(c => c.lane === 'dire');
  if (direCamps.length > 0) {
    html += `<div class="camp-lane-group" style="border-left:2px solid var(--dire);padding-left:6px;margin-bottom:4px;opacity:0.6">`;
    html += `<div style="font-size:9px;color:var(--dire);font-weight:700;margin-bottom:3px">${label('direJungle')}</div>`;
    direCamps.forEach(c => { html += renderCampCard(c); });
    html += '</div>';
  }

  html += `<div style="margin-top:4px">
    <button class="btn" id="addCampBtn" style="width:100%;justify-content:center;font-size:10px;margin-bottom:3px">${label('customCamp')}</button>
    <div style="display:flex;flex-wrap:wrap;gap:2px">
      ${CAMP_PRESETS.map((p, i) => `<button class="btn camp-preset" data-preset="${i}" style="font-size:8px;padding:1px 5px">${p.name}</button>`).join('')}
    </div>
  </div>`;
  return html;
}

function renderCampCard(c) {
  const isCleared = c.status === 'cleared';
  return `<div class="camp-card ${isCleared ? 'cleared' : ''}" style="margin-bottom:2px">
    <div style="display:flex;align-items:center;gap:4px;font-size:11px">
      <span style="color:${isCleared ? 'var(--radiant)' : 'var(--gold)'};font-size:8px">${isCleared ? '✓' : '◆'}</span>
      <span style="font-weight:600;flex:1;${isCleared ? 'text-decoration:line-through;opacity:0.5' : ''}">${esc(c.name)}</span>
      <span style="font-size:9px;color:var(--gold)">${c.gold ? '$'+c.gold : ''}</span>
      <span style="font-size:9px;color:var(--purple)">${c.xp ? '+'+c.xp+'xp' : ''}</span>
    </div>
    <div style="display:flex;gap:2px;margin-top:2px">
      <button class="btn camp-clear-btn" data-camp-id="${c.id}" style="font-size:8px;padding:1px 4px">${isCleared ? 'Undo' : 'Clear'}</button>
      <button class="btn camp-edit-btn" data-camp-id="${c.id}" style="font-size:8px;padding:1px 4px">Edit</button>
      <button class="btn camp-delete-btn" data-camp-id="${c.id}" style="font-size:8px;padding:1px 4px">✕</button>
    </div>
  </div>`;
}

function clearCamp(id) {
  const camp = (STATE.neutralCamps || []).find(c => c.id === id);
  if (!camp) return;
  camp.status = camp.status === 'cleared' ? 'stacked' : 'cleared';
  if (camp.status === 'cleared' && camp.gold) STATE.economy.gold += camp.gold;
  saveLocal(); renderDraftPanel(_onRedraw); renderEconomy(); if (_onRedraw) _onRedraw();
}

function editCamp(id) {
  const camp = (STATE.neutralCamps || []).find(c => c.id === id);
  if (!camp) return;
  showModal({
    title: 'Edit ' + label('campsSection'),
    fields: [
      { key: 'name', label: 'Name', type: 'text', value: camp.name, required: true },
      { key: 'desc', label: 'Description', type: 'textarea', value: camp.desc },
      { key: 'gold', label: 'Gold Reward', type: 'number', value: camp.gold || 0, min: 0 },
      { key: 'xp', label: 'XP Reward', type: 'number', value: camp.xp || 0, min: 0 },
    ],
    onSave: (v) => {
      camp.name = v.name; camp.desc = v.desc || ''; camp.gold = v.gold; camp.xp = v.xp;
      saveLocal(); renderDraftPanel(_onRedraw); if (_onRedraw) _onRedraw();
    },
  });
}

function deleteCamp(id) {
  showConfirm({
    title: label('deleteCamp'),
    message: 'This cannot be undone.',
    onConfirm: () => {
      STATE.neutralCamps = (STATE.neutralCamps || []).filter(c => c.id !== id);
      saveLocal(); renderDraftPanel(_onRedraw); if (_onRedraw) _onRedraw();
    },
  });
}

function addCamp() {
  showModal({
    title: label('customCamp'),
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'desc', label: 'Description', type: 'textarea' },
      { key: 'lane', label: 'Lane', type: 'select', value: 'mid', options: [
        { value: 'mid', label: (STATE.laneNames || {}).mid || 'Product' },
        { value: 'top', label: (STATE.laneNames || {}).top || 'Ops' },
        { value: 'bot', label: (STATE.laneNames || {}).bot || 'Solver' },
        { value: 'dire', label: label('direLabel') },
      ]},
      { key: 'gold', label: 'Gold Reward', type: 'number', value: 500, min: 0 },
      { key: 'xp', label: 'XP Reward', type: 'number', value: 2, min: 0 },
    ],
    onSave: (v) => {
      const positions = CAMP_LANE_POSITIONS[v.lane] || CAMP_LANE_POSITIONS.mid;
      const pos = positions[Math.floor(Math.random() * positions.length)];
      STATE.neutralCamps.push({ id: 'nc' + Date.now(), name: v.name, desc: v.desc || '', lane: v.lane, type: 'medium', x: pos.x + (Math.random()*6-3), y: pos.y + (Math.random()*6-3), status: 'stacked', gold: v.gold, xp: v.xp });
      saveLocal(); renderDraftPanel(_onRedraw); if (_onRedraw) _onRedraw();
    },
  });
}

function addPreset(idx) {
  const preset = CAMP_PRESETS[parseInt(idx)];
  if (!preset) return;
  const positions = CAMP_LANE_POSITIONS[preset.lane] || CAMP_LANE_POSITIONS.mid;
  const pos = positions[Math.floor(Math.random() * positions.length)];
  STATE.neutralCamps.push({ id: 'nc' + Date.now(), name: preset.name, desc: preset.desc, lane: preset.lane, type: preset.type, x: pos.x + (Math.random()*6-3), y: pos.y + (Math.random()*6-3), status: 'stacked', gold: preset.gold, xp: preset.xp });
  saveLocal(); renderDraftPanel(_onRedraw); if (_onRedraw) _onRedraw();
}
