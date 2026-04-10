import { STATE } from '../state.js';
import { LANE_COLORS } from '../data/heroes.js';
import { positionTasksOnLane, getTowerPosition, svgEl } from '../utils.js';

export function initConnections(svgRoot, getSize) {
  let linesGroup = null;
  let activeHeroId = null;

  // Clear stale state when SVG rebuilds (innerHTML='')
  const observer = new MutationObserver(() => { linesGroup = null; activeHeroId = null; });
  observer.observe(svgRoot, { childList: true });

  svgRoot.addEventListener('mouseover', (e) => {
    const heroG = e.target.closest('[data-hero-map]');
    if (!heroG) return;

    const heroId = heroG.dataset.heroMap;
    if (heroId === activeHeroId && linesGroup?.parentNode) return;

    removeLines();
    activeHeroId = heroId;

    const hero = STATE.heroes.find(h => h.id === heroId);
    if (!hero) return;
    const pos = STATE.heroPositions[heroId];
    if (!pos) return;

    const { W, H } = getSize();
    const hx = W * pos.x / 100, hy = H * pos.y / 100;
    const color = LANE_COLORS[hero.lane] || '#fff';

    linesGroup = svgEl('g', { class: 'connection-lines', opacity: 0.35 });

    // Lines to lane towers
    const towers = STATE.towers[hero.lane] || [];
    const towerPositions = positionTasksOnLane(hero.lane, towers.length);
    towers.forEach((t, i) => {
      const tp = getTowerPosition(t, towerPositions, i);
      linesGroup.appendChild(svgEl('line', {
        x1: hx, y1: hy, x2: W * tp.x / 100, y2: H * tp.y / 100,
        stroke: color, 'stroke-width': 0.8, 'stroke-dasharray': '4,4',
      }));
    });

    // Lines to lane camps
    (STATE.neutralCamps || []).forEach(c => {
      if (c.lane !== hero.lane) return;
      linesGroup.appendChild(svgEl('line', {
        x1: hx, y1: hy, x2: W * c.x / 100, y2: H * c.y / 100,
        stroke: color, 'stroke-width': 0.6, 'stroke-dasharray': '3,5', opacity: 0.6,
      }));
    });

    svgRoot.appendChild(linesGroup);
  });

  // Only remove when mouse leaves ALL hero groups (not just transitioning between them)
  svgRoot.addEventListener('mouseout', (e) => {
    const leftHero = e.target.closest('[data-hero-map]');
    if (!leftHero) return;
    // Check if the related target (where mouse went) is another hero
    const enteredHero = e.relatedTarget?.closest?.('[data-hero-map]');
    if (enteredHero) return; // transitioning between heroes — mouseover will handle it
    removeLines();
    activeHeroId = null;
  });

  function removeLines() {
    if (linesGroup) { linesGroup.remove(); linesGroup = null; }
  }
}
