import { STATE, saveLocal } from '../state.js';
import { LANE_COLORS, HERO_PORTRAITS, heroStatusColor } from '../data/heroes.js';
import { esc, formatNum, formatShort } from '../utils.js';
import { openHeroDetail } from './hero-detail.js';
import { label } from '../labels.js';
import { showModal } from '../ui/modal.js';

let briefingVisible = true;
let _onEnter = null;
let _fullRefresh = null;

export function showBriefing(onEnterWarRoom, fullRefresh) {
  _onEnter = onEnterWarRoom;
  _fullRefresh = fullRefresh;
  briefingVisible = true;
  const el = document.getElementById('briefingOverlay');
  el.classList.remove('hidden', 'fade-out');
  renderBriefing();
}

export function hideBriefing() {
  briefingVisible = false;
  const el = document.getElementById('briefingOverlay');
  // Skip animation if user prefers reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.classList.add('hidden');
    return;
  }
  el.classList.add('fade-out');
  el.addEventListener('transitionend', () => {
    el.classList.remove('fade-out');
    el.classList.add('hidden');
  }, { once: true });
}

export function toggleBriefing(onEnter, fullRefresh) {
  if (briefingVisible) hideBriefing();
  else showBriefing(onEnter, fullRefresh);
}

export function isBriefingVisible() { return briefingVisible; }

// ── Data derivation ──

function laneHealth(lane) {
  const towers = STATE.towers[lane] || [];
  if (towers.length === 0) return { pct: 0, achieved: 0, total: 0 };
  const achieved = towers.filter(t => t.status === 'achieved').length;
  return { pct: Math.round(achieved / towers.length * 100), achieved, total: towers.length };
}

function heroesInLane(lane) {
  return STATE.heroes.filter(h => h.lane === lane && STATE.heroPositions[h.id]);
}

function nextObjective(lane) {
  return (STATE.towers[lane] || []).find(t => t.status === 'next');
}

function laneKeyRisk(lane) {
  const items = (STATE.intel[lane] || {}).items || [];
  return items.find(i => i.type === 'red') || items.find(i => i.type === 'orange') || null;
}

function getAlerts() {
  const alerts = [];
  STATE.heroes.forEach(h => {
    if (h.status === 'empty') alerts.push({ type: 'empty', heroId: h.id, name: h.name, role: h.role, msg: 'Position unfilled — lane has no owner' });
    else if (h.status === 'danger') alerts.push({ type: 'danger', heroId: h.id, name: h.name, role: h.role, msg: h.note });
    else if (h.status === 'warning') alerts.push({ type: 'warning', heroId: h.id, name: h.name, role: h.role, msg: h.note });
  });
  (STATE.shop || []).forEach(item => {
    if (item.status === 'building') {
      const comp = item.components.find(c => c.status === 'building');
      const displayName = item.id === 'divine_rapier' ? label('divineRapier') : item.id === 'mask_of_madness' ? label('maskOfMadness') : item.name;
      alerts.push({ type: 'info', name: displayName, msg: `${item.progress}% complete${comp ? ' — ' + comp.name + ': ' + comp.progress + '%' : ''}` });
    }
  });
  return alerts;
}

function getTopActions() {
  const actions = [];
  const names = STATE.laneNames || { mid: 'Product', top: 'Ops', bot: 'Solver' };

  ['mid', 'top', 'bot'].forEach(lane => {
    const next = nextObjective(lane);
    if (next) actions.push({ priority: 1, text: `${names[lane]}: ${next.name}`, desc: next.desc, lane });
  });

  // Critical red intel
  ['mid', 'top', 'bot'].forEach(lane => {
    const risk = laneKeyRisk(lane);
    if (risk && risk.type === 'red') actions.push({ priority: 2, text: risk.text, lane });
  });

  // Low-hanging camps
  (STATE.neutralCamps || []).filter(c => c.status === 'stacked' && ['mid', 'top', 'bot'].includes(c.lane))
    .slice(0, 2)
    .forEach(c => actions.push({ priority: 3, text: `Clear camp: ${c.name}`, desc: c.desc, lane: c.lane }));

  return actions.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

// ── Render ──

function renderBriefing() {
  const el = document.getElementById('briefingOverlay');
  const names = STATE.laneNames || { mid: 'Product', top: 'Ops', bot: 'Solver' };
  const phases = { draft: label('phase_draft'), laning: label('phase_laning'), mid: label('phase_mid'), late: label('phase_late') };
  const e = STATE.economy || {};
  const alerts = getAlerts();
  const actions = getTopActions();

  el.innerHTML = `
    <div class="briefing-content">
      <div class="briefing-header">
        <div class="briefing-logo">POKER SHARK</div>
        <div class="briefing-subtitle">${label('situationReport')}</div>
        <div class="briefing-phase">${phases[STATE.phase] || 'Draft Phase'} &bull; Runway: ${esc(e.runway || '—')}</div>
      </div>

      <div class="briefing-lanes">
        ${['mid', 'top', 'bot'].map(lane => {
          const h = laneHealth(lane);
          const heroes = heroesInLane(lane);
          const next = nextObjective(lane);
          const risk = laneKeyRisk(lane);
          const color = LANE_COLORS[lane];
          const healthColor = h.pct >= 50 ? 'var(--radiant)' : h.pct > 0 ? 'var(--orange)' : 'var(--dire)';

          return `
            <div class="briefing-lane-card" data-briefing-lane="${lane}" style="border-left-color:${color}">
              <div class="bl-header">
                <span class="bl-name" style="color:${color}">${names[lane]}</span>
                <span class="bl-pct" style="color:${healthColor}">${h.pct}%</span>
              </div>
              <div class="bl-health-bar">
                <div class="bl-health-fill" style="width:${h.pct}%;background:${color}"></div>
              </div>
              <div class="bl-meta">
                <span>${h.achieved}/${h.total} ${label('milestones')}</span>
                <span>${heroes.length} ${heroes.length !== 1 ? label('heroes') : label('hero')}</span>
              </div>
              ${heroes.length > 0 ? `
                <div class="bl-heroes">
                  ${heroes.map(hr => {
                    const portrait = HERO_PORTRAITS[hr.id];
                    return `<div class="bl-hero-pip" data-briefing-hero="${hr.id}" title="${esc(hr.name)}" style="border-color:${heroStatusColor(hr.status)}">
                      ${portrait ? `<img src="${portrait}">` : hr.name.charAt(0)}
                    </div>`;
                  }).join('')}
                </div>
              ` : `<div class="bl-empty-lane">${label('noHeroes')}</div>`}
              <div class="bl-next">
                ${next ? `<span class="bl-next-label">NEXT:</span> ${esc(next.name)}` : '<span style="color:var(--text3)">All locked</span>'}
              </div>
              ${risk ? `<div class="bl-risk ${risk.type} bl-risk-edit" data-risk-lane="${lane}" data-risk-id="${risk.id}" title="Click to edit"><span class="bl-risk-dot"></span>${esc(risk.text)}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>

      ${alerts.length > 0 ? `
        <div class="briefing-section">
          <div class="briefing-section-title">ALERTS</div>
          <div class="briefing-alerts">
            ${alerts.map(a => `
              <div class="briefing-alert ${a.type}" ${a.heroId ? `data-briefing-hero="${a.heroId}"` : ''}>
                <div class="ba-indicator ${a.type}"></div>
                <div class="ba-content">
                  <div class="ba-name">${esc(a.name)}</div>
                  <div class="ba-msg">${esc(a.msg)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="briefing-section">
        <div class="briefing-section-title">${label('topActions')}</div>
        <div class="briefing-actions">
          ${actions.length > 0 ? actions.map((a, i) => `
            <div class="briefing-action" data-briefing-lane="${a.lane || ''}">
              <span class="ba-num">${i + 1}</span>
              <div>
                <div class="ba-action-text">${esc(a.text)}</div>
                ${a.desc ? `<div class="ba-action-desc">${esc(a.desc)}</div>` : ''}
              </div>
            </div>
          `).join('') : '<div style="color:var(--text3);font-size:13px">No active objectives</div>'}
        </div>
      </div>

      <div class="briefing-economy">
        <div class="be-item"><span class="be-label">MRR</span><span class="be-val" style="color:var(--gold)">$${formatNum(e.gold || 0)}</span></div>
        <div class="be-item"><span class="be-label">Runway</span><span class="be-val" style="color:var(--radiant)">${esc(e.runway || '—')}</span></div>
        <div class="be-item"><span class="be-label">Shares Left</span><span class="be-val" style="color:var(--blue)">${formatShort(e.sharesRemaining || 0)}</span></div>
      </div>

      <button class="briefing-cta" id="briefingEnter">${label('enterWarRoom')}</button>
    </div>
  `;

  // Wire events
  document.getElementById('briefingEnter').addEventListener('click', () => {
    hideBriefing();
    if (_onEnter) _onEnter();
  });

  el.querySelectorAll('[data-briefing-lane]').forEach(card => {
    card.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-briefing-hero]')) return;
      if (ev.target.closest('.bl-risk-edit')) return;
      hideBriefing();
      if (_onEnter) _onEnter(card.dataset.briefingLane);
    });
  });

  el.querySelectorAll('[data-briefing-hero]').forEach(pip => {
    pip.addEventListener('click', (ev) => {
      ev.stopPropagation();
      hideBriefing();
      openHeroDetail(pip.dataset.briefingHero, _fullRefresh);
    });
  });

  // Risk item editing
  el.querySelectorAll('.bl-risk-edit').forEach(riskEl => {
    riskEl.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const lane = riskEl.dataset.riskLane;
      const id = riskEl.dataset.riskId;
      const item = (STATE.intel[lane]?.items || []).find(i => i.id === id);
      if (!item) return;
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
          { key: '_delete', label: '', type: 'action', text: 'Delete this item', action: () => {
            import('../ui/modal.js').then(m => m.closeModal());
            STATE.intel[lane].items = STATE.intel[lane].items.filter(i => i.id !== id);
            saveLocal(); renderBriefing();
          }},
        ],
        onSave: (v) => { item.text = v.text; item.type = v.type; saveLocal(); renderBriefing(); },
      });
    });
  });
}
