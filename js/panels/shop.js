import { STATE, saveLocal } from '../state.js';
import { HERO_PORTRAITS } from '../data/heroes.js';
import { esc } from '../utils.js';
import { label } from '../labels.js';
import { showModal } from '../ui/modal.js';

let shopOpen = false;

export function toggleShop() {
  shopOpen = !shopOpen;
  const drawer = document.getElementById('shopDrawer');
  drawer.classList.toggle('open', shopOpen);
  document.getElementById('shopBtn').classList.toggle('active', shopOpen);
  if (shopOpen) renderShop();
}

export function renderShop() {
  const drawer = document.getElementById('shopDrawer');
  if (!shopOpen) return;

  drawer.innerHTML = `
    <div class="shop-header">
      <span class="shop-title">${label('shopTitle')}</span>
      <button class="btn shop-close" id="shopClose">&times;</button>
    </div>
    <div class="shop-grid">
      ${(STATE.shop || []).map(renderItem).join('')}
    </div>
  `;

  document.getElementById('shopClose').addEventListener('click', toggleShop);

  // Progress editing
  drawer.querySelectorAll('.item-progress-edit').forEach(el => {
    el.addEventListener('click', () => {
      const itemId = el.dataset.itemId;
      const compIdx = el.dataset.compIdx;
      const item = STATE.shop.find(i => i.id === itemId);
      if (!item) return;
      const isComp = compIdx !== undefined && compIdx !== '';
      const current = isComp ? item.components[parseInt(compIdx)].progress : item.progress;
      const compName = isComp ? item.components[parseInt(compIdx)].name : item.name;
      showModal({
        title: `${compName} — Progress`,
        fields: [{ key: 'progress', label: 'Progress (0-100)', type: 'number', value: current, min: 0, max: 100 }],
        onSave: (v) => {
          const num = Math.max(0, Math.min(100, v.progress));
          if (isComp) {
            item.components[parseInt(compIdx)].progress = num;
            item.components[parseInt(compIdx)].status = num >= 100 ? 'done' : num > 0 ? 'building' : 'locked';
          } else {
            item.progress = num;
            item.status = num >= 100 ? 'purchased' : num > 0 ? 'building' : 'available';
          }
          if (item.components.length > 0) {
            item.progress = Math.round(item.components.reduce((s, c) => s + c.progress, 0) / item.components.length);
          }
          saveLocal(); renderShop();
        },
      });
    });
  });

  // Status cycling
  drawer.querySelectorAll('.item-status-cycle').forEach(el => {
    el.addEventListener('click', () => {
      const item = STATE.shop.find(i => i.id === el.dataset.itemId);
      if (!item) return;
      const cycle = ['available', 'building', 'purchased', 'stolen'];
      item.status = cycle[(cycle.indexOf(item.status) + 1) % cycle.length];
      saveLocal();
      renderShop();
    });
  });
}

function renderItem(item) {
  const statusColors = {
    available: 'var(--text3)', building: 'var(--orange)', purchased: 'var(--radiant)', stolen: 'var(--dire)',
  };
  const statusColor = statusColors[item.status] || 'var(--text3)';
  const holder = STATE.heroes.find(h => h.id === item.holder);
  const holderPortrait = HERO_PORTRAITS[item.holder];

  return `
    <div class="shop-item ${item.status}">
      <div class="item-header">
        <div class="item-icon ${item.id === 'divine_rapier' ? 'rapier' : 'mom'}">
          ${item.id === 'divine_rapier' ? '⚔' : '🎭'}
        </div>
        <div class="item-info">
          <div class="item-name">${esc(item.id === 'divine_rapier' ? label('divineRapier') : item.id === 'mask_of_madness' ? label('maskOfMadness') : item.name)}</div>
          <div class="item-subtitle">${esc(item.subtitle)}</div>
        </div>
        <div class="item-status-badge item-status-cycle" data-item-id="${item.id}" style="color:${statusColor};border-color:${statusColor}" title="Click to cycle status">
          ${item.status.toUpperCase()}
        </div>
      </div>

      <div class="item-desc">${esc(item.desc)}</div>

      ${item.components.length > 0 ? `
        <div class="item-components">
          ${item.components.map((c, i) => `
            <div class="item-component ${c.status}">
              <span class="comp-status-dot" style="background:${c.status === 'done' ? 'var(--radiant)' : c.status === 'building' ? 'var(--orange)' : 'var(--text3)'}"></span>
              <span class="comp-name">${c.name}</span>
              <span class="comp-desc">${c.desc}</span>
              <div class="comp-progress">
                <div class="comp-progress-fill" style="width:${c.progress}%;background:${c.status === 'done' ? 'var(--radiant)' : 'var(--orange)'}"></div>
              </div>
              <span class="comp-pct item-progress-edit" data-item-id="${item.id}" data-comp-idx="${i}" data-current="${c.progress}">${c.progress}%</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="item-footer">
        <div class="item-progress-wrap">
          <div class="item-progress-bar">
            <div class="item-progress-fill" style="width:${item.progress}%;background:${statusColor}"></div>
          </div>
          <span class="item-pct item-progress-edit" data-item-id="${item.id}" data-comp-idx="" data-current="${item.progress}">${item.progress}%</span>
        </div>
        ${holder ? `
          <div class="item-holder" title="Held by ${holder.name}">
            ${holderPortrait ? `<img src="${holderPortrait}" class="holder-avatar">` : holder.name.charAt(0)}
            <span>${holder.name.split(' ')[0]}</span>
          </div>
        ` : ''}
      </div>

      <div class="item-effect">${esc(item.effect)}</div>
    </div>
  `;
}
