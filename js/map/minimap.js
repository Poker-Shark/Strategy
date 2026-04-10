import { LANE_COLORS, heroStatusColor } from '../data/heroes.js';
import { drawRiverPath, drawLanePath, positionTasksOnLane, getTowerPosition } from '../utils.js';

export function drawMinimap(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = '#0e1c14';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1c1410';
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(w,0); ctx.lineTo(w,h); ctx.fill();

  // River
  ctx.strokeStyle = 'rgba(35,110,170,0.35)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  drawRiverPath(ctx, w, h); ctx.stroke();

  // Lanes
  ctx.lineWidth = 2.5; ctx.globalAlpha = 0.35; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const lane of ['top', 'mid', 'bot']) {
    ctx.strokeStyle = LANE_COLORS[lane];
    drawLanePath(ctx, w, h, lane); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Bases
  ctx.fillStyle = 'rgba(77,204,112,0.3)';
  ctx.beginPath(); ctx.arc(w*0.08, h*0.85, 6, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(204,68,68,0.3)';
  ctx.beginPath(); ctx.arc(w*0.92, h*0.12, 6, 0, Math.PI*2); ctx.fill();

  // Towers (auto-positioned along lanes, matching svg-layer)
  for (const lane in state.towers) {
    const color = LANE_COLORS[lane];
    const tasks = state.towers[lane];
    const positions = positionTasksOnLane(lane, tasks.length);
    tasks.forEach((t, i) => {
      const pos = getTowerPosition(t, positions, i);
      ctx.fillStyle = t.status === 'achieved' ? color : 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.arc(w*pos.x/100, h*pos.y/100, 2.5, 0, Math.PI*2); ctx.fill();
    });
  }

  // Neutral camps
  (state.neutralCamps || []).forEach(camp => {
    ctx.fillStyle = camp.status === 'cleared' ? 'rgba(255,255,255,0.1)' : 'rgba(200,180,80,0.3)';
    ctx.fillRect(w*camp.x/100-1.5, h*camp.y/100-1.5, 3, 3);
  });

  // Roshan
  if (state.roshan) {
    ctx.fillStyle = state.roshan.status === 'alive' ? 'rgba(224,112,32,0.6)' : 'rgba(100,100,100,0.3)';
    ctx.beginPath(); ctx.arc(w*state.roshan.x/100, h*state.roshan.y/100, 4, 0, Math.PI*2); ctx.fill();
  }

  // Heroes
  state.heroes.forEach(hero => {
    const pos = state.heroPositions[hero.id];
    if (!pos) return;
    ctx.fillStyle = heroStatusColor(hero.status);
    ctx.beginPath(); ctx.arc(w*pos.x/100, h*pos.y/100, 3.5, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5; ctx.stroke();
  });

  // Dire
  state.dire.forEach(d => {
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(w*d.x/100, h*d.y/100, 3, 0, Math.PI*2); ctx.fill();
  });

  // Wards
  state.wards.forEach(wd => {
    ctx.fillStyle = '#f0c040';
    ctx.beginPath(); ctx.arc(w*wd.x/100, h*wd.y/100, 2, 0, Math.PI*2); ctx.fill();
  });

  // Minions
  (state.minions || []).forEach(m => {
    if (m.count <= 0 && m.type !== 'super') return;
    const mx = w*m.x/100, my = h*m.y/100;
    ctx.fillStyle = m.type === 'super' ? '#f0c040' : m.type === 'wizard' ? 'rgba(120,230,140,0.6)' : 'rgba(77,204,112,0.5)';
    ctx.beginPath(); ctx.arc(mx, my, m.type === 'super' ? 3.5 : m.type === 'wizard' ? 3 : 2, 0, Math.PI*2); ctx.fill();
  });
}

export function updateMinimapViewport(camera, minimapEl, containerW, containerH) {
  const v = camera.getView(containerW, containerH);
  const el = document.getElementById('minimapViewport');
  if (!el) return;
  const mw = minimapEl.clientWidth, mh = minimapEl.clientHeight;
  el.style.left = Math.max(0, v.x / 100 * mw) + 'px';
  el.style.top = Math.max(0, v.y / 100 * mh) + 'px';
  el.style.width = Math.min(mw, v.w / 100 * mw) + 'px';
  el.style.height = Math.min(mh, v.h / 100 * mh) + 'px';
}
