// Shared map geometry (percentage coords used by terrain + minimap)
export const MAP_GEO = {
  // River runs top-left → bottom-right, PERPENDICULAR to mid lane (which runs bottom-left → top-right)
  river: [
    [0.10, 0.08], // start — top-left area
    [0.18, 0.20], [0.28, 0.32], [0.38, 0.40], // bezier 1 — flows down-right
    [0.43, 0.44], [0.50, 0.50], [0.55, 0.52], // bezier 2 — crosses mid lane at center
    [0.62, 0.56], [0.75, 0.68], [0.92, 0.85], // bezier 3 — continues to bottom-right
  ],
  top: [[0.10, 0.75], [0.10, 0.15], [0.10, 0.06], [0.18, 0.06], [0.82, 0.06]],
  mid: [[0.18, 0.76], [0.35, 0.55], [0.50, 0.45], [0.62, 0.37], [0.78, 0.24]],
  bot: [[0.18, 0.92], [0.82, 0.92], [0.90, 0.92], [0.90, 0.84], [0.90, 0.22]],
};

export function drawRiverPath(ctx, w, h) {
  const r = MAP_GEO.river;
  ctx.beginPath();
  ctx.moveTo(w * r[0][0], h * r[0][1]);
  ctx.bezierCurveTo(w*r[1][0], h*r[1][1], w*r[2][0], h*r[2][1], w*r[3][0], h*r[3][1]);
  ctx.bezierCurveTo(w*r[4][0], h*r[4][1], w*r[5][0], h*r[5][1], w*r[6][0], h*r[6][1]);
  ctx.bezierCurveTo(w*r[7][0], h*r[7][1], w*r[8][0], h*r[8][1], w*r[9][0], h*r[9][1]);
}

export function drawLanePath(ctx, w, h, lane) {
  const pts = MAP_GEO[lane];
  ctx.beginPath();
  if (lane === 'top') {
    ctx.moveTo(w*pts[0][0], h*pts[0][1]);
    ctx.lineTo(w*pts[1][0], h*pts[1][1]);
    ctx.quadraticCurveTo(w*pts[2][0], h*pts[2][1], w*pts[3][0], h*pts[3][1]);
    ctx.lineTo(w*pts[4][0], h*pts[4][1]);
  } else if (lane === 'mid') {
    ctx.moveTo(w*pts[0][0], h*pts[0][1]);
    ctx.quadraticCurveTo(w*pts[1][0], h*pts[1][1], w*pts[2][0], h*pts[2][1]);
    ctx.quadraticCurveTo(w*pts[3][0], h*pts[3][1], w*pts[4][0], h*pts[4][1]);
  } else {
    ctx.moveTo(w*pts[0][0], h*pts[0][1]);
    ctx.lineTo(w*pts[1][0], h*pts[1][1]);
    ctx.quadraticCurveTo(w*pts[2][0], h*pts[2][1], w*pts[3][0], h*pts[3][1]);
    ctx.lineTo(w*pts[4][0], h*pts[4][1]);
  }
}

// Lane interpolation — sample lane paths into points, then interpolate by t (0-1)
const _laneCache = {};

function sampleLane(lane, steps = 60) {
  if (_laneCache[lane]) return _laneCache[lane];
  const pts = MAP_GEO[lane];
  const samples = [];

  function lerp(a, b, t) { return a + (b - a) * t; }
  function quadBez(p0, p1, p2, t) {
    const u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
  }

  // Build segments from MAP_GEO points
  // top: line(0→1), quad(1,2,3), line(3→4)
  // mid: quad(0,1,2), quad(2,3,4)
  // bot: line(0→1), quad(1,2,3), line(3→4)
  const segs = [];
  if (lane === 'mid') {
    segs.push({ type: 'quad', p0: pts[0], p1: pts[1], p2: pts[2] });
    segs.push({ type: 'quad', p0: pts[2], p1: pts[3], p2: pts[4] });
  } else {
    segs.push({ type: 'line', p0: pts[0], p1: pts[1] });
    segs.push({ type: 'quad', p0: pts[1], p1: pts[2], p2: pts[3] });
    segs.push({ type: 'line', p0: pts[3], p1: pts[4] });
  }

  // Sample each segment evenly
  const perSeg = Math.ceil(steps / segs.length);
  segs.forEach(seg => {
    for (let i = 0; i <= perSeg; i++) {
      const t = i / perSeg;
      if (seg.type === 'line') {
        samples.push([lerp(seg.p0[0], seg.p1[0], t), lerp(seg.p0[1], seg.p1[1], t)]);
      } else {
        samples.push(quadBez(seg.p0, seg.p1, seg.p2, t));
      }
    }
  });

  // Compute cumulative distances
  let totalDist = 0;
  const dists = [0];
  for (let i = 1; i < samples.length; i++) {
    const dx = samples[i][0] - samples[i - 1][0];
    const dy = samples[i][1] - samples[i - 1][1];
    totalDist += Math.sqrt(dx * dx + dy * dy);
    dists.push(totalDist);
  }
  // Normalize distances to 0-1
  for (let i = 0; i < dists.length; i++) dists[i] /= totalDist;

  _laneCache[lane] = { samples, dists };
  return _laneCache[lane];
}

// Returns {x, y} in percentage coords (0-100) at position t (0=base end, 1=enemy end)
export function interpolateLane(lane, t) {
  t = Math.max(0, Math.min(1, t));
  const { samples, dists } = sampleLane(lane);
  // Find the two sample points bracketing t
  let i = 0;
  while (i < dists.length - 1 && dists[i + 1] < t) i++;
  if (i >= samples.length - 1) return { x: samples[samples.length - 1][0] * 100, y: samples[samples.length - 1][1] * 100 };
  const segT = dists[i + 1] === dists[i] ? 0 : (t - dists[i]) / (dists[i + 1] - dists[i]);
  return {
    x: (samples[i][0] + (samples[i + 1][0] - samples[i][0]) * segT) * 100,
    y: (samples[i][1] + (samples[i + 1][1] - samples[i][1]) * segT) * 100,
  };
}

// Returns array of {x, y} for count tasks evenly spaced along a lane
// Cached per lane+count since lane geometry is static
const _posCache = {};
export function positionTasksOnLane(lane, count) {
  if (count === 0) return [];
  const key = lane + ':' + count;
  if (_posCache[key]) return _posCache[key];
  const positions = [];
  for (let i = 0; i < count; i++) {
    const t = 0.08 + (i / Math.max(1, count - 1)) * 0.72;
    positions.push(interpolateLane(lane, count === 1 ? 0.15 : t));
  }
  _posCache[key] = positions;
  return positions;
}

// Clear position cache when tasks are added/removed
export function invalidatePositionCache() {
  for (const k in _posCache) delete _posCache[k];
}

export function detectLane(x, y) {
  const d = Math.abs(y - (100 - x));
  if (d < 15 && x > 20 && x < 80) return 'mid';
  if (y < 22 || (x < 20 && y < 55)) return 'top';
  if (y > 78 || (x > 78 && y > 45)) return 'bot';
  if (d < 25) return 'river';
  return 'mid';
}

// Vision formula: level → vision radius (map %)
export function levelToVision(level) {
  return Math.min(12, Math.round(2 + level * 0.5));
}

// Resolve tower position — manual override or auto-computed
export function getTowerPosition(tower, autoPositions, index) {
  if (tower.manualX !== undefined && tower.manualY !== undefined) {
    return { x: tower.manualX, y: tower.manualY };
  }
  return autoPositions[index];
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatNum(n) { return n.toLocaleString(); }
export function formatShort(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toString();
}

export function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

export function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }

export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
