import { positionTasksOnLane, getTowerPosition } from '../utils.js';

export function drawFog(ctx, w, h, state, camera) {
  ctx.clearRect(0, 0, w, h);

  // Fog edit mode — show zone outlines, no actual fog
  if (state.fogEditMode) {
    camera.applyToCtx(ctx, w, h);
    (state.fogZones || []).forEach(z => {
      const cx = w * z.x / 100, cy = h * z.y / 100, r = z.r * Math.min(w, h) / 100;
      ctx.strokeStyle = 'rgba(200,60,60,0.4)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(200,60,60,0.06)'; ctx.fill(); ctx.setLineDash([]);
    });
    camera.restoreCtx(ctx);
    return;
  }

  if (!state.fogEnabled) return;

  // Full fog layer
  ctx.fillStyle = 'rgba(8,12,18,0.82)';
  ctx.fillRect(0, 0, w, h);

  camera.applyToCtx(ctx, w, h);
  const dim = Math.min(w, h);

  // Cut holes (subtractive — reveals map)
  ctx.globalCompositeOperation = 'destination-out';

  function cutHole(xPct, yPct, rPct, edge) {
    const cx = w * xPct / 100, cy = h * yPct / 100, r = rPct * dim / 100;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(edge, 'rgba(0,0,0,0.7)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }

  state.fogHoles.forEach(fh => cutHole(fh.x, fh.y, fh.r, 0.6));
  state.wards.forEach(wd => cutHole(wd.x, wd.y, wd.r, 0.7));
  state.heroes.forEach(hero => {
    const pos = state.heroPositions[hero.id];
    if (pos && hero.vision > 0) cutHole(pos.x, pos.y, hero.vision, 0.65);
  });

  // Achieved towers provide vision (like standing towers in Dota)
  for (const lane in state.towers) {
    const tasks = state.towers[lane];
    const positions = positionTasksOnLane(lane, tasks.length);
    tasks.forEach((t, i) => {
      if (t.status !== 'achieved') return;
      const pos = getTowerPosition(t, positions, i);
      cutHole(pos.x, pos.y, 5, 0.6);
    });
  }

  // Additive fog — user-placed zones
  ctx.globalCompositeOperation = 'source-over';
  (state.fogZones || []).forEach(z => {
    const cx = w * z.x / 100, cy = h * z.y / 100, r = z.r * dim / 100;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(8,12,18,0.7)');
    grad.addColorStop(0.7, 'rgba(8,12,18,0.4)');
    grad.addColorStop(1, 'rgba(8,12,18,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  });

  // Dire nebulous cloud — one large procedural fog over top-right quadrant
  const direCx = w * 0.82, direCy = h * 0.18;
  const direR = dim * 0.38;
  const direGrad = ctx.createRadialGradient(direCx, direCy, 0, direCx, direCy, direR);
  direGrad.addColorStop(0, 'rgba(8,12,18,0.7)');
  direGrad.addColorStop(0.35, 'rgba(8,12,18,0.5)');
  direGrad.addColorStop(0.65, 'rgba(8,12,18,0.25)');
  direGrad.addColorStop(1, 'rgba(8,12,18,0)');
  ctx.fillStyle = direGrad;
  ctx.beginPath(); ctx.arc(direCx, direCy, direR, 0, Math.PI * 2); ctx.fill();

  // Subtle red tint on Dire
  const direTint = ctx.createRadialGradient(direCx, direCy, 0, direCx, direCy, direR * 0.5);
  direTint.addColorStop(0, 'rgba(80,20,20,0.06)');
  direTint.addColorStop(1, 'rgba(80,20,20,0)');
  ctx.fillStyle = direTint;
  ctx.beginPath(); ctx.arc(direCx, direCy, direR * 0.5, 0, Math.PI * 2); ctx.fill();

  camera.restoreCtx(ctx);
}
