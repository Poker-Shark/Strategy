import { STATE, saveLocal } from '../state.js';
import { HERO_PORTRAITS, HERO_ABILITIES, heroStatusColor } from '../data/heroes.js';
import { esc, levelToVision } from '../utils.js';
import { label } from '../labels.js';

let _onUpdate = null;

export function openHeroDetail(heroId, onUpdate) {
  _onUpdate = onUpdate;
  const hero = STATE.heroes.find(h => h.id === heroId);
  if (!hero) return;

  closeHeroDetail();

  const portrait = HERO_PORTRAITS[heroId];
  const abilities = HERO_ABILITIES[heroId] || [];
  const statusColor = heroStatusColor(hero.status);
  const tasks = STATE.towers[hero.lane] || [];

  const overlay = document.createElement('div');
  overlay.id = 'heroDetailOverlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card hero-detail-modal">
      <div class="hd-header">
        <div class="hd-portrait" style="border-color:${statusColor}">
          ${portrait ? `<img src="${portrait}" alt="${esc(hero.name)}">` : `<span>${hero.name.charAt(0)}</span>`}
        </div>
        <div class="hd-meta">
          <div class="hd-name">${esc(hero.name)}</div>
          <div class="hd-role">${esc(hero.role)}</div>
          <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
            <span class="hero-lane-tag ${hero.lane}">${hero.lane}</span>
            <span style="font-size:12px;color:var(--gold)">Lvl <input type="number" class="hd-input-sm" id="hdLevel" value="${hero.level}" min="0" max="${hero.maxLevel}"> / ${hero.maxLevel}</span>
            <span style="font-size:11px;color:var(--text3)">Vision: <input type="number" class="hd-input-sm" id="hdVision" value="${hero.vision}" min="0" max="20" style="width:36px"></span>
          </div>
        </div>
        <button class="btn hd-close" id="hdClose">&times;</button>
      </div>

      <div class="hd-stats">
        <div class="hd-stat-row">
          <span class="hd-stat-label">HP</span>
          <div class="hd-bar"><div class="hd-bar-fill hp" style="width:${hero.hp}%"></div></div>
          <input type="number" class="hd-input-sm" id="hdHp" value="${hero.hp}" min="0" max="100">
        </div>
        <div class="hd-stat-row">
          <span class="hd-stat-label">MP</span>
          <div class="hd-bar"><div class="hd-bar-fill mp" style="width:${hero.mp}%"></div></div>
          <input type="number" class="hd-input-sm" id="hdMp" value="${hero.mp}" min="0" max="100">
        </div>
      </div>

      ${abilities.length > 0 ? `
        <div class="hd-section-title">${label('abilities')}</div>
        <div class="hd-abilities">
          ${abilities.map(a => `
            <div class="hd-ability">
              <div class="hd-ability-key">${esc(a.key)}</div>
              <div>
                <div class="hd-ability-name">${esc(a.name)}</div>
                <div class="hd-ability-desc">${esc(a.desc)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${tasks.length > 0 ? `
        <div class="hd-section-title">${label('laneTasks')}</div>
        <div class="hd-tasks">
          ${tasks.map(t => `<div class="hd-task"><span class="hd-task-status" style="color:${t.status === 'achieved' ? 'var(--radiant)' : t.status === 'next' ? 'var(--orange)' : 'var(--text3)'}">${t.status === 'achieved' ? '✓' : t.status === 'next' ? '!' : '•'}</span> ${esc(t.name)}</div>`).join('')}
        </div>
      ` : ''}

      <div class="hd-section-title">${label('dotaAnalogy')}</div>
      <div class="hd-dota">${esc(hero.dota || '')}</div>

      <div class="hd-section-title">Notes</div>
      <textarea class="hd-notes" id="hdNotes">${esc(hero.note || '')}</textarea>

      <div class="modal-actions">
        <button class="btn modal-save" id="hdSave">Save</button>
        <button class="btn" id="hdCancel">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeHeroDetail(); });
  document.getElementById('hdClose').addEventListener('click', closeHeroDetail);
  document.getElementById('hdCancel').addEventListener('click', closeHeroDetail);
  document.getElementById('hdSave').addEventListener('click', () => {
    hero.level = Math.max(0, Math.min(hero.maxLevel, parseInt(document.getElementById('hdLevel').value) || 0));
    hero.vision = Math.max(0, Math.min(20, parseInt(document.getElementById('hdVision').value) || 0));
    hero.hp = Math.max(0, Math.min(100, parseInt(document.getElementById('hdHp').value) || 0));
    hero.mp = Math.max(0, Math.min(100, parseInt(document.getElementById('hdMp').value) || 0));
    hero.note = document.getElementById('hdNotes').value;
    saveLocal();
    closeHeroDetail();
    if (_onUpdate) _onUpdate();
  });
}

export function closeHeroDetail() {
  const el = document.getElementById('heroDetailOverlay');
  if (el) el.remove();
}
