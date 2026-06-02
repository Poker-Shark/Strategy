// Business domain model — the canonical, business-first view the map renders.
//
// Today the app stores game-shaped data (heroes with hp/mp, gold economy, item
// shop) and paints a business label over it at render time. This module flips
// that: it projects the legacy STATE into a clean business model with real
// vocabulary (members, workstreams, milestones, deployments, competitors, bets)
// and VALIDATES it, so "describe the current business state" is reliable rather
// than free-form. Pure — no DOM, no network.

import { STATE } from '../state.js';

// ── Enums: the only legal values for each status field ──
export const WORKSTREAM_STATUS = ['active', 'planned', 'done', 'dark'];
export const MILESTONE_STATUS  = ['done', 'in_progress', 'planned'];
export const MEMBER_STATUS      = ['active', 'at_risk', 'vacant'];
export const COMPETITOR_LEVEL   = ['watch', 'contender', 'dominant'];
export const BET_STATUS         = ['planned', 'active', 'done'];

// Legacy game value → business value mappings.
const MEMBER_STATUS_MAP    = { active: 'active', warning: 'at_risk', danger: 'at_risk', empty: 'vacant' };
const MILESTONE_STATUS_MAP = { achieved: 'done', next: 'in_progress', locked: 'planned' };
const BET_STATUS_MAP       = { building: 'active', purchased: 'done', planned: 'planned' };

// Lanes get a business name from STATE.laneNames; these are the fallbacks for
// lanes that exist on the map but aren't in laneNames (river, enemy side).
const DEFAULT_WORKSTREAM_NAMES = {
  mid: 'Product', top: 'Ops', bot: 'Solver',
  river: 'Cross-functional', dire: 'Competitor',
};

function competitorLevel(threat) {
  const t = Number(threat) || 0;
  if (t >= 80) return 'dominant';
  if (t >= 50) return 'contender';
  return 'watch';
}

// Status of a workstream, inferred from its milestones (towers).
function workstreamStatus(milestones, hasMembers) {
  if (milestones.length === 0) return hasMembers ? 'active' : 'dark';
  if (milestones.some(m => m.status === 'in_progress')) return 'active';
  if (milestones.every(m => m.status === 'done')) return 'done';
  if (milestones.every(m => m.status === 'planned')) return 'planned';
  return 'active';
}

export function normalizeBusinessState(state = STATE) {
  const laneNames = state.laneNames || {};
  const heroes = state.heroes || [];
  const towers = state.towers || {};
  const positions = state.heroPositions || {};

  // Members (team org). Game hp/mp become hours/week and morale.
  const team = heroes.map(h => ({
    id: h.id,
    name: h.name,
    role: h.role || '',
    workstream: h.lane || '',
    hoursPerWeek: Number(h.hp) || 0,
    morale: Number(h.mp) || 0,
    status: MEMBER_STATUS_MAP[h.status] || 'active',
    note: h.note || '',
  }));

  // Milestones (towers) flattened, tagged with their workstream.
  const milestones = [];
  for (const lane of Object.keys(towers)) {
    for (const t of towers[lane] || []) {
      milestones.push({
        id: t.id,
        workstream: lane,
        name: t.name,
        description: t.desc || '',
        status: MILESTONE_STATUS_MAP[t.status] || 'planned',
        order: t.order ?? 0,
      });
    }
  }

  // Workstreams (lanes): every lane referenced anywhere on the map.
  const laneIds = new Set([
    ...Object.keys(laneNames),
    ...Object.keys(towers),
    ...team.map(m => m.workstream).filter(Boolean),
  ]);
  const workstreams = [...laneIds].map(lane => {
    const ms = milestones.filter(m => m.workstream === lane);
    const hasMembers = team.some(m => m.workstream === lane && m.status !== 'vacant');
    return {
      id: lane,
      name: laneNames[lane] || DEFAULT_WORKSTREAM_NAMES[lane] || lane,
      status: workstreamStatus(ms, hasMembers),
    };
  });

  // Deployments: where each member sits on the map (x/y in 0-100).
  const deployments = Object.entries(positions).map(([memberId, p]) => ({
    memberId, x: Number(p.x), y: Number(p.y),
  }));

  // Competitors: the Dire market forces plus Roshan (the raid boss).
  const competitors = (state.dire || []).map(d => ({
    id: d.id,
    name: d.name,
    level: competitorLevel(d.threat),
    threat: Number(d.threat) || 0,
    note: d.desc || '',
  }));
  if (state.roshan && state.roshan.name) {
    competitors.push({
      id: 'roshan',
      name: state.roshan.name,
      level: 'dominant',
      threat: 100,
      note: state.roshan.desc || '',
    });
  }

  // Bets: strategic investments (the item shop).
  const bets = (state.shop || []).map(s => ({
    id: s.id,
    name: s.name,
    description: s.desc || '',
    status: BET_STATUS_MAP[s.status] || 'planned',
    progress: Number(s.progress) || 0,
    owner: s.holder || '',
  }));

  return { workstreams, milestones, team, deployments, competitors, bets };
}

// ── Validation ──
// Returns { ok, issues: [{ entity, id, field, message }] }.
export function validateBusinessState(model) {
  const issues = [];
  const add = (entity, id, field, message) => issues.push({ entity, id, field, message });

  const requireUnique = (rows, entity) => {
    const seen = new Set();
    for (const r of rows) {
      if (!r.id) { add(entity, r.id, 'id', 'missing id'); continue; }
      if (seen.has(r.id)) add(entity, r.id, 'id', 'duplicate id');
      seen.add(r.id);
    }
  };
  const inEnum = (val, enumVals) => enumVals.includes(val);
  const inBounds = (n) => Number.isFinite(n) && n >= 0 && n <= 100;

  const workstreams = model.workstreams || [];
  const milestones = model.milestones || [];
  const team = model.team || [];
  const workstreamIds = new Set(workstreams.map(w => w.id));
  const memberIds = new Set(team.map(m => m.id));

  requireUnique(workstreams, 'workstream');
  for (const w of workstreams) {
    if (!w.name) add('workstream', w.id, 'name', 'empty name');
    if (!inEnum(w.status, WORKSTREAM_STATUS)) add('workstream', w.id, 'status', `invalid status "${w.status}"`);
  }

  requireUnique(milestones, 'milestone');
  for (const m of milestones) {
    if (!m.name) add('milestone', m.id, 'name', 'empty name');
    if (!inEnum(m.status, MILESTONE_STATUS)) add('milestone', m.id, 'status', `invalid status "${m.status}"`);
    if (!workstreamIds.has(m.workstream)) add('milestone', m.id, 'workstream', `unknown workstream "${m.workstream}"`);
  }

  requireUnique(team, 'member');
  for (const m of team) {
    if (!m.name) add('member', m.id, 'name', 'empty name');
    if (!inEnum(m.status, MEMBER_STATUS)) add('member', m.id, 'status', `invalid status "${m.status}"`);
    if (m.status !== 'vacant') {
      if (!m.role) add('member', m.id, 'role', 'active member has no role');
      if (!workstreamIds.has(m.workstream)) add('member', m.id, 'workstream', `unknown workstream "${m.workstream}"`);
    }
    if (Number(m.morale) < 0 || Number(m.morale) > 100) add('member', m.id, 'morale', 'morale out of 0-100');
    if (Number(m.hoursPerWeek) < 0) add('member', m.id, 'hoursPerWeek', 'negative hours');
  }

  requireUnique(model.competitors || [], 'competitor');
  for (const c of model.competitors || []) {
    if (!c.name) add('competitor', c.id, 'name', 'empty name');
    if (!inEnum(c.level, COMPETITOR_LEVEL)) add('competitor', c.id, 'level', `invalid level "${c.level}"`);
  }

  requireUnique(model.bets || [], 'bet');
  for (const b of model.bets || []) {
    if (!b.name) add('bet', b.id, 'name', 'empty name');
    if (!inEnum(b.status, BET_STATUS)) add('bet', b.id, 'status', `invalid status "${b.status}"`);
    if (!inBounds(Number(b.progress))) add('bet', b.id, 'progress', 'progress out of 0-100');
  }

  for (const d of model.deployments || []) {
    if (!memberIds.has(d.memberId)) add('deployment', d.memberId, 'memberId', 'deployment references unknown member');
    if (!inBounds(d.x) || !inBounds(d.y)) add('deployment', d.memberId, 'position', 'coordinates out of 0-100');
  }

  return { ok: issues.length === 0, issues };
}

// ── Selectors (read-side helpers for the UI / briefing) ──
export const membersOf = (model, workstreamId) =>
  (model.team || []).filter(m => m.workstream === workstreamId && m.status !== 'vacant');

export const vacancies = (model) =>
  (model.team || []).filter(m => m.status === 'vacant');

export const atRisk = (model) =>
  (model.team || []).filter(m => m.status === 'at_risk');

export const milestonesOf = (model, workstreamId) =>
  (model.milestones || []).filter(m => m.workstream === workstreamId).sort((a, b) => a.order - b.order);

// One-glance "where is the business right now" rollup for the executive summary.
export function businessSummary(model) {
  const team = model.team || [];
  const ms = model.milestones || [];
  const ws = model.workstreams || [];
  const comps = model.competitors || [];

  const count = (arr, pred) => arr.filter(pred).length;
  const done = count(ms, m => m.status === 'done');
  const topCompetitor = comps.reduce((top, c) => ((c.threat || 0) > (top?.threat || 0) ? c : top), null);

  return {
    workstreams: {
      total: ws.length,
      active: count(ws, w => w.status === 'active'),
      dark: count(ws, w => w.status === 'dark'),
      done: count(ws, w => w.status === 'done'),
    },
    team: {
      active: count(team, m => m.status === 'active'),
      atRisk: count(team, m => m.status === 'at_risk'),
      vacant: count(team, m => m.status === 'vacant'),
      totalHours: team.reduce((s, m) => s + (Number(m.hoursPerWeek) || 0), 0),
    },
    milestones: {
      done,
      inProgress: count(ms, m => m.status === 'in_progress'),
      planned: count(ms, m => m.status === 'planned'),
      total: ms.length,
      pct: ms.length ? Math.round((done / ms.length) * 100) : 0,
    },
    competitors: {
      total: comps.length,
      dominant: count(comps, c => c.level === 'dominant'),
      top: topCompetitor ? { name: topCompetitor.name, level: topCompetitor.level } : null,
    },
    bets: {
      active: count(model.bets || [], b => b.status === 'active'),
      done: count(model.bets || [], b => b.status === 'done'),
    },
  };
}
