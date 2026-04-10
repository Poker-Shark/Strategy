import { svgEl, positionTasksOnLane, getTowerPosition, formatShort } from '../utils.js';
import { LANE_COLORS, HERO_PORTRAITS, CREEP_PORTRAITS, heroStatusColor } from '../data/heroes.js';
import { label } from '../labels.js';

export function drawSvgLayer(svgRoot, w, h, state, camera) {
  svgRoot.innerHTML = '';
  svgRoot.setAttribute('viewBox', camera.svgViewBox(w, h));
  svgRoot.setAttribute('preserveAspectRatio', 'none');

  const defs = svgEl('defs', {});
  svgRoot.appendChild(defs);
  const dim = Math.min(w, h);

  // Lane labels
  const names = state.laneNames || { mid: 'Product', top: 'Ops', bot: 'Solver' };
  [
    { lane:'mid', x:48, y:42, color:'rgba(224,160,48,0.15)', rot:-30 },
    { lane:'top', x:25, y:8, color:'rgba(77,204,112,0.15)', rot:0 },
    { lane:'bot', x:55, y:94, color:'rgba(68,136,221,0.15)', rot:0 },
  ].forEach(l => {
    const px = w * l.x / 100, py = h * l.y / 100;
    const t = svgEl('text', {
      x: px, y: py, fill: l.color, 'font-size': 10, 'font-weight': 700,
      'letter-spacing': 3, 'text-anchor': 'middle',
      transform: `rotate(${l.rot} ${px} ${py})`
    });
    t.textContent = (names[l.lane] || l.lane).toUpperCase() + ' LANE';
    svgRoot.appendChild(t);
  });

  // Towers — auto-positioned along lane paths
  for (const lane in state.towers) {
    const laneColor = LANE_COLORS[lane];
    const tasks = state.towers[lane];
    const positions = positionTasksOnLane(lane, tasks.length);
    tasks.forEach((t, idx) => {
      const tpos = getTowerPosition(t, positions, idx);
      const cx = w * tpos.x / 100, cy = h * tpos.y / 100;
      let fill, stroke, opacity;
      if (t.status === 'achieved') { fill = laneColor; stroke = laneColor; opacity = 0.9; }
      else if (t.status === 'next') { fill = 'rgba(255,255,255,0.08)'; stroke = laneColor; opacity = 0.7; }
      else { fill = 'rgba(255,255,255,0.04)'; stroke = 'rgba(255,255,255,0.15)'; opacity = 0.4; }

      const g = svgEl('g', { opacity });
      const ts = 12;

      // Tower image
      const tClipId = 'tclip_' + t.id;
      const tClip = svgEl('clipPath', { id: tClipId });
      tClip.appendChild(svgEl('circle', { cx, cy: cy - 2, r: ts - 2 }));
      defs.appendChild(tClip);

      // Status ring
      g.appendChild(svgEl('circle', { cx, cy: cy - 2, r: ts, fill: 'none', stroke, 'stroke-width': 1.5 }));
      g.appendChild(svgEl('image', { href: '/tower.webp', x: cx - ts, y: cy - ts - 2, width: ts * 2, height: ts * 2, 'clip-path': `url(#${tClipId})`, preserveAspectRatio: 'xMidYMid slice' }));

      // Status icon overlay
      if (t.status === 'achieved') {
        g.appendChild(svgEl('circle', { cx: cx + ts - 3, cy: cy - ts + 1, r: 4, fill: laneColor }));
        const chk = svgEl('text', { x: cx + ts - 3, y: cy - ts + 3.5, 'text-anchor': 'middle', fill: '#000', 'font-size': 6, 'font-weight': 700 });
        chk.textContent = '✓'; g.appendChild(chk);
      }

      const label = svgEl('text', { x:cx, y:cy+ts+6, 'text-anchor':'middle', fill: t.status==='achieved'?laneColor:'rgba(255,255,255,0.3)', 'font-size':6, 'font-weight':600 });
      label.textContent = t.name;
      g.appendChild(label);
      g.dataset.ttTitle = t.name; g.dataset.ttDesc = t.desc; g.dataset.ttStatus = t.status;
      g.dataset.towerId = t.id; g.dataset.towerLane = lane;
      g.style.cursor = 'grab';
      svgRoot.appendChild(g);
    });
  }

  // Wards
  state.wards.forEach(wd => {
    const cx = w * wd.x / 100, cy = h * wd.y / 100;
    svgRoot.appendChild(svgEl('circle', { cx, cy, r: wd.r * dim / 100, fill:'rgba(255,215,0,0.04)', stroke:'rgba(255,215,0,0.1)', 'stroke-width':0.5, 'stroke-dasharray':'3,3' }));
    const g = svgEl('g', { style: 'cursor:grab' });
    g.appendChild(svgEl('circle', { cx, cy, r:5, fill:'rgba(255,215,0,0.15)', stroke:'#f0c040', 'stroke-width':1 }));
    const icon = svgEl('text', { x:cx, y:cy+3, 'text-anchor':'middle', fill:'#f0c040', 'font-size':6, 'font-weight':700 });
    icon.textContent = '◉'; g.appendChild(icon);
    const label = svgEl('text', { x:cx, y:cy+10, 'text-anchor':'middle', fill:'rgba(255,215,0,0.35)', 'font-size':4, 'font-weight':600 });
    label.textContent = wd.name; g.appendChild(label);
    g.dataset.ttTitle = wd.name; g.dataset.ttDesc = wd.desc; g.dataset.ttStatus = 'ward';
    g.dataset.wardId = wd.id;
    svgRoot.appendChild(g);
  });

  // Neutral camps
  (state.neutralCamps || []).forEach(camp => {
    const cx = w * camp.x / 100, cy = h * camp.y / 100;
    const g = svgEl('g', {});
    const isCleared = camp.status === 'cleared';
    const campColor = isCleared ? 'rgba(255,255,255,0.15)' : 'rgba(200,180,80,0.3)';
    const campFill = isCleared ? 'rgba(255,255,255,0.03)' : 'rgba(200,180,80,0.06)';
    const sz = camp.type === 'medium' ? 5 : 4;

    g.appendChild(svgEl('rect', { x:cx-sz, y:cy-sz, width:sz*2, height:sz*2, rx:2, fill:campFill, stroke:campColor, 'stroke-width':0.8, opacity:isCleared?0.5:0.8 }));
    if (camp.status === 'stacked') {
      g.appendChild(svgEl('rect', { x:cx-sz+1.5, y:cy-sz-2.5, width:sz*2-3, height:sz*2, rx:2, fill:'none', stroke:campColor, 'stroke-width':0.4, opacity:0.4 }));
    }
    const icon = svgEl('text', { x:cx, y:cy+2.5, 'text-anchor':'middle', fill:isCleared?'rgba(255,255,255,0.3)':'rgba(200,180,80,0.6)', 'font-size':5, 'font-weight':700 });
    icon.textContent = isCleared ? '✓' : '◆';
    g.appendChild(icon);
    g.dataset.ttTitle = camp.name; g.dataset.ttDesc = camp.desc;
    g.dataset.ttStatus = camp.status + (camp.gold ? ' — $'+camp.gold : '');
    g.dataset.campId = camp.id;
    g.style.cursor = 'grab';
    svgRoot.appendChild(g);
  });

  // Roshan
  if (state.roshan) {
    const rosh = state.roshan;
    const cx = w * rosh.x / 100, cy = h * rosh.y / 100;
    const g = svgEl('g', { 'data-roshan': 'true' });
    const isAlive = rosh.status === 'alive';
    const rColor = isAlive ? '#e07020' : rosh.status === 'slain' ? '#666' : '#aa6620';

    g.appendChild(svgEl('circle', { cx, cy, r:14, fill:'rgba(200,100,20,0.06)', stroke:rColor, 'stroke-width':1, 'stroke-dasharray':isAlive?'none':'3,3' }));
    g.appendChild(svgEl('circle', { cx, cy, r:9, fill:isAlive?'rgba(224,112,32,0.15)':'rgba(100,100,100,0.1)', stroke:rColor, 'stroke-width':1.5 }));
    const icon = svgEl('text', { x:cx, y:cy+3, 'text-anchor':'middle', fill:rColor, 'font-size':8, 'font-weight':800 });
    icon.textContent = isAlive ? 'GW' : (rosh.status === 'slain' ? '☠' : '⟳');
    g.appendChild(icon);
    const label = svgEl('text', { x:cx, y:cy+20, 'text-anchor':'middle', fill:'rgba(224,112,32,0.5)', 'font-size':5, 'font-weight':700 });
    label.textContent = rosh.name; g.appendChild(label);
    g.dataset.ttTitle = rosh.name; g.dataset.ttDesc = rosh.desc;
    g.dataset.ttStatus = rosh.status + (rosh.status === 'alive' ? ' — Click to slay' : ' — Click to cycle');
    svgRoot.appendChild(g);
  }

  // Dire — abstract market forces
  state.dire.forEach(d => {
    const cx = w * d.x / 100, cy = h * d.y / 100;
    const g = svgEl('g', { opacity: 0.6 });
    g.appendChild(svgEl('circle', { cx, cy, r:10, fill:'rgba(204,68,68,0.06)', stroke:d.color, 'stroke-width':0.8, 'stroke-dasharray':'3,3' }));
    g.appendChild(svgEl('circle', { cx, cy, r:6, fill:'rgba(204,68,68,0.08)', stroke:d.color, 'stroke-width':1 }));
    const icon = svgEl('text', { x:cx, y:cy+3, 'text-anchor':'middle', fill:d.color, 'font-size':8, 'font-weight':700 });
    icon.textContent = '?'; g.appendChild(icon);
    const label = svgEl('text', { x:cx, y:cy+16, 'text-anchor':'middle', fill:'rgba(204,68,68,0.4)', 'font-size':5, 'font-weight':600 });
    label.textContent = d.name; g.appendChild(label);
    g.dataset.ttTitle = d.name; g.dataset.ttDesc = d.desc; g.dataset.ttStatus = 'Unknown — ' + d.threat + '% control';
    svgRoot.appendChild(g);
  });

  // Minions (tiered traction units with Dota creep portraits)
  (state.minions || []).forEach(m => {
    if (m.count <= 0 && !m.name) return;
    const cx = w * m.x / 100, cy = h * m.y / 100;
    const g = svgEl('g', { style: 'cursor:grab' });
    g.dataset.minionId = m.id;

    const portrait = CREEP_PORTRAITS[m.type];
    const r = m.type === 'super' ? 14 : m.type === 'wizard' ? 10 : 7;
    const borderColor = m.type === 'super' ? '#f0c040' : m.type === 'wizard' ? '#78e68c' : '#4dcc70';

    // Portrait circle
    const clipId = 'mclip_' + m.id;
    const clip = svgEl('clipPath', { id: clipId });
    clip.appendChild(svgEl('circle', { cx, cy, r: r - 1.5 }));
    defs.appendChild(clip);

    g.appendChild(svgEl('circle', { cx, cy, r, fill:'rgba(0,0,0,0.4)', stroke: borderColor, 'stroke-width': m.type === 'super' ? 1.5 : 1 }));
    g.appendChild(svgEl('image', { href: portrait, x: cx-(r-1.5), y: cy-(r-1.5), width: (r-1.5)*2, height: (r-1.5)*2, 'clip-path': `url(#${clipId})`, preserveAspectRatio: 'xMidYMid slice' }));

    // Count badge (top-right)
    if (m.count > 0) {
      const badgeR = m.type === 'super' ? 6 : 5;
      const bx = cx + r - 2, by = cy - r + 2;
      g.appendChild(svgEl('circle', { cx: bx, cy: by, r: badgeR, fill: '#19242f', stroke: borderColor, 'stroke-width': 0.8 }));
      const countText = svgEl('text', { x: bx, y: by + 2.5, 'text-anchor': 'middle', fill: borderColor, 'font-size': m.count >= 1000 ? 4 : 5, 'font-weight': 700 });
      countText.textContent = formatShort(m.count);
      g.appendChild(countText);
    }

    // Name label for super minions
    if (m.type === 'super' && m.name) {
      const nm = svgEl('text', { x:cx, y:cy+r+8, 'text-anchor':'middle', fill:'rgba(240,192,64,0.5)', 'font-size':5, 'font-weight':600 });
      nm.textContent = m.name; g.appendChild(nm);
    }

    g.dataset.ttTitle = m.label || m.type;
    g.dataset.ttDesc = m.type === 'super' ? (m.name || 'Unnamed partner') : m.count + ' ' + m.label;
    g.dataset.ttStatus = m.type + ' — ' + m.lane + ' lane';
    svgRoot.appendChild(g);
  });

  // Heroes
  state.heroes.forEach(hero => {
    const pos = state.heroPositions[hero.id];
    if (!pos) return;
    const cx = w * pos.x / 100, cy = h * pos.y / 100;
    const portrait = HERO_PORTRAITS[hero.id];
    const statusColor = heroStatusColor(hero.status);
    const g = svgEl('g', { 'data-hero-map': hero.id, style: 'cursor:grab' });

    // Vision radius (world-space, slightly increased multiplier)
    if (hero.vision > 0) {
      const vr = hero.vision * dim / 75; // increased from /100
      g.appendChild(svgEl('circle', { cx, cy, r:vr, fill:'none', stroke:statusColor, 'stroke-width':0.3, 'stroke-dasharray':'2,4', opacity:0.08 }));
    }

    // Hero portrait (increased from r:9 to r:12)
    const hr = 12;
    g.appendChild(svgEl('circle', { cx, cy, r:hr, fill:'rgba(0,0,0,0.5)', stroke:statusColor, 'stroke-width':1.5 }));

    if (portrait) {
      const pr = hr - 2;
      const clipId = 'hclip_' + hero.id;
      const clip = svgEl('clipPath', { id: clipId });
      clip.appendChild(svgEl('circle', { cx, cy, r:pr }));
      defs.appendChild(clip);
      g.appendChild(svgEl('image', { href:portrait, x:cx-pr, y:cy-pr, width:pr*2, height:pr*2, 'clip-path':`url(#${clipId})`, preserveAspectRatio:'xMidYMid slice' }));
    } else {
      const initial = svgEl('text', { x:cx, y:cy+4, 'text-anchor':'middle', fill:statusColor, 'font-size':10, 'font-weight':700 });
      initial.textContent = hero.name.charAt(0); g.appendChild(initial);
    }

    const nameLbl = svgEl('text', { x:cx, y:cy+18, 'text-anchor':'middle', fill:'rgba(255,255,255,0.5)', 'font-size':5, 'font-weight':600 });
    nameLbl.textContent = hero.name.split(' ')[0]; g.appendChild(nameLbl);
    g.dataset.ttTitle = hero.name; g.dataset.ttDesc = hero.note; g.dataset.ttStatus = 'Lvl ' + hero.level;
    svgRoot.appendChild(g);
  });
}
