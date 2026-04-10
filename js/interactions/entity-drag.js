// Drag entities (heroes, towers, camps) directly on the map
import { STATE, saveLocal } from '../state.js';
import { detectLane } from '../utils.js';
import { forceSyncToCloud } from '../cloud-sync.js';

let entityDrag = null;

export function initEntityDrag(svgRoot, mapWrap, camera, getSize, drawDynamic) {
  const CLICK_THRESHOLD = 5;

  svgRoot.addEventListener('pointerdown', (e) => {
    const hero = e.target.closest('[data-hero-map]');
    const tower = e.target.closest('[data-tower-id]');
    const camp = e.target.closest('[data-camp-id]');
    const ward = e.target.closest('[data-ward-id]');
    const target = hero || tower || camp || ward;
    if (!target || e.button !== 0) return;

    e.stopPropagation();
    e.preventDefault();

    entityDrag = {
      type: hero ? 'hero' : tower ? 'tower' : camp ? 'camp' : 'ward',
      id: hero ? hero.dataset.heroMap : tower ? tower.dataset.towerId : camp ? camp.dataset.campId : ward.dataset.wardId,
      lane: tower ? tower.dataset.towerLane : null,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };

    svgRoot.setPointerCapture(e.pointerId);
  });

  svgRoot.addEventListener('pointermove', (e) => {
    if (!entityDrag) return;
    const dx = e.clientX - entityDrag.startX;
    const dy = e.clientY - entityDrag.startY;
    if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) {
      entityDrag.moved = true;
    }
  });

  // Suppress click after drag to prevent hero detail modal from opening
  let suppressNextClick = false;
  svgRoot.addEventListener('click', (e) => {
    if (suppressNextClick) { suppressNextClick = false; e.stopImmediatePropagation(); }
  }, true); // capture phase — fires before app.js click handler

  svgRoot.addEventListener('pointerup', (e) => {
    if (!entityDrag) return;
    const drag = entityDrag;
    entityDrag = null;

    if (!drag.moved) return; // was a click, not a drag

    suppressNextClick = true;

    const { W, H } = getSize();
    const rect = mapWrap.getBoundingClientRect();
    const pos = camera.screenToMap(e.clientX, e.clientY, rect, W, H);

    if (drag.type === 'hero') {
      STATE.heroPositions[drag.id] = { x: pos.x, y: pos.y };
      const hero = STATE.heroes.find(h => h.id === drag.id);
      if (hero) hero.lane = detectLane(pos.x, pos.y);
    } else if (drag.type === 'tower') {
      const tower = STATE.towers[drag.lane]?.find(t => t.id === drag.id);
      if (tower) { tower.manualX = pos.x; tower.manualY = pos.y; }
    } else if (drag.type === 'camp') {
      const camp = (STATE.neutralCamps || []).find(c => c.id === drag.id);
      if (camp) { camp.x = pos.x; camp.y = pos.y; }
    } else if (drag.type === 'ward') {
      const ward = STATE.wards.find(w => w.id === drag.id);
      if (ward) {
        ward.x = pos.x; ward.y = pos.y;
        // Update linked fog hole by wardId
        const fh = STATE.fogHoles.find(f => f.wardId === ward.id);
        if (fh) { fh.x = pos.x; fh.y = pos.y; }
      }
    }

    saveLocal();
    forceSyncToCloud(STATE);
    drawDynamic();
  });

  return { isActive: () => !!entityDrag };
}
