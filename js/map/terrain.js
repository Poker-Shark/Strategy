import { LANE_COLORS } from '../data/heroes.js';
import { mulberry32, drawRiverPath, drawLanePath } from '../utils.js';
import { label } from '../labels.js';

export function drawTerrain(ctx, w, h, camera, state) {
  ctx.clearRect(0, 0, w, h);
  camera.applyToCtx(ctx, w, h);

  // ── Background ──
  ctx.fillStyle = '#0e1c14';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1c1410';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.fill();

  // ── River (thin, perpendicular to mid lane) ──
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(25,80,130,0.12)'; ctx.lineWidth = 16;
  drawRiverPath(ctx, w, h); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,120,180,0.25)'; ctx.lineWidth = 8;
  drawRiverPath(ctx, w, h); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,150,210,0.15)'; ctx.lineWidth = 3;
  drawRiverPath(ctx, w, h); ctx.stroke();
  ctx.restore();

  // ── Grid ──
  ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  // ── Lane roads (subtle paths) ──
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const lane of ['top', 'mid', 'bot']) {
    const color = LANE_COLORS[lane];
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 8;
    drawLanePath(ctx, w, h, lane); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 5;
    drawLanePath(ctx, w, h, lane); ctx.stroke();
    const m = color.match(/^#(..)(..)(..)$/);
    if (m) {
      ctx.strokeStyle = `rgba(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)},0.08)`;
      ctx.lineWidth = 5;
      drawLanePath(ctx, w, h, lane); ctx.stroke();
    }
  }

  // ── Trees ──
  const rng = mulberry32(42);
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 400; i++) {
    const tx = rng() * w, ty = rng() * h;
    if (isOnLane(tx / w * 100, ty / h * 100)) { rng(); continue; }
    ctx.fillStyle = (tx / w + (1 - ty / h)) < 1.05 ? '#2a6630' : '#5a3a20';
    ctx.beginPath(); ctx.arc(tx, ty, 2 + rng() * 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ── Neutral camp clearings (sourced from state) ──
  if (state && state.neutralCamps) {
    state.neutralCamps.forEach(camp => {
      const cx = w * camp.x / 100, cy = h * camp.y / 100;
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 0.5; ctx.stroke();
    });
  }

  // ── Roshan pit ──
  drawRoshanPit(ctx, w, h, state);

  // ── Bases ──
  drawBase(ctx, w * 0.08, h * 0.85, 'rgba(77,204,112,');
  drawBase(ctx, w * 0.92, h * 0.12, 'rgba(204,68,68,');

  // ── Labels ──
  ctx.font = '700 13px system-ui'; ctx.fillStyle = 'rgba(77,204,112,0.2)';
  ctx.save(); ctx.translate(w * 0.08, h * 0.9); ctx.rotate(-0.1); ctx.fillText(label('radiantLabel'), 0, 0); ctx.restore();
  ctx.font = '700 13px system-ui'; ctx.fillStyle = 'rgba(204,68,68,0.2)';
  ctx.save(); ctx.translate(w * 0.82, h * 0.1); ctx.rotate(-0.1); ctx.fillText(label('direLabel'), 0, 0); ctx.restore();
  ctx.save(); ctx.font = '700 10px system-ui'; ctx.fillStyle = 'rgba(50,140,200,0.2)';
  ctx.translate(w * 0.46, h * 0.44); ctx.rotate(-0.55); ctx.fillText(label('riverLabel'), 0, 0); ctx.restore();

  camera.restoreCtx(ctx);
}

function isOnLane(xPct, yPct) {
  if (xPct < 14 && yPct < 80 && yPct > 6) return true;
  if (yPct < 10 && xPct > 8 && xPct < 85) return true;
  const diagDist = Math.abs(yPct - (100 - xPct));
  if (diagDist < 8 && xPct > 15 && xPct < 82) return true;
  if (yPct > 88 && xPct > 15 && xPct < 85) return true;
  if (xPct > 87 && yPct > 20 && yPct < 95) return true;
  return false;
}

function drawRoshanPit(ctx, w, h, state) {
  const rx = state && state.roshan ? state.roshan.x : 38;
  const ry = state && state.roshan ? state.roshan.y : 32;
  const cx = w * rx / 100, cy = h * ry / 100;

  ctx.fillStyle = 'rgba(180,80,20,0.06)';
  ctx.beginPath();
  ctx.moveTo(cx - 28, cy - 10);
  ctx.quadraticCurveTo(cx - 30, cy - 22, cx - 12, cy - 26);
  ctx.quadraticCurveTo(cx + 5, cy - 30, cx + 22, cy - 22);
  ctx.quadraticCurveTo(cx + 32, cy - 12, cx + 30, cy + 5);
  ctx.quadraticCurveTo(cx + 26, cy + 18, cx + 10, cy + 22);
  ctx.quadraticCurveTo(cx - 8, cy + 24, cx - 24, cy + 14);
  ctx.quadraticCurveTo(cx - 32, cy + 2, cx - 28, cy - 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,100,30,0.12)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,30,0.04)';
  ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
}

function drawBase(ctx, bx, by, colorBase) {
  ctx.fillStyle = colorBase + '0.04)'; ctx.strokeStyle = colorBase + '0.1)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(bx, by, 42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Ancient (hexagon)
  ctx.fillStyle = colorBase + '0.12)'; ctx.strokeStyle = colorBase + '0.2)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i - Math.PI / 6;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](bx + 14 * Math.cos(a), by + 14 * Math.sin(a));
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Barracks (3 small squares)
  const offsets = [[-22, -18], [8, -24], [24, -4]];
  offsets.forEach(([ox, oy]) => {
    ctx.fillStyle = colorBase + '0.06)'; ctx.strokeStyle = colorBase + '0.12)'; ctx.lineWidth = 1;
    ctx.fillRect(bx + ox - 5, by + oy - 5, 10, 10);
    ctx.strokeRect(bx + ox - 5, by + oy - 5, 10, 10);
  });
}
