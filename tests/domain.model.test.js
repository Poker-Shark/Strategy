import { describe, it, expect } from 'vitest';
import {
  normalizeBusinessState, validateBusinessState, businessSummary,
  membersOf, vacancies, atRisk, milestonesOf,
  WORKSTREAM_STATUS, MEMBER_STATUS,
} from '../js/domain/model.js';
import { STATE } from '../js/state.js';

// A minimal, deliberately-clean fixture.
function fixture() {
  return {
    laneNames: { mid: 'Product', top: 'Ops' },
    heroes: [
      { id: 'a', name: 'Ann',  role: 'Lead',  lane: 'mid', hp: 40, mp: 80, status: 'active' },
      { id: 'b', name: 'Bo',   role: 'Dev',   lane: 'mid', hp: 50, mp: 30, status: 'danger' },
      { id: 'c', name: '???',  role: '',      lane: 'top', hp: 0,  mp: 0,  status: 'empty' },
    ],
    heroPositions: { a: { x: 40, y: 55 }, b: { x: 30, y: 60 } },
    towers: {
      mid: [
        { id: 't1', name: 'MVP',  desc: '', status: 'achieved', order: 0 },
        { id: 't2', name: 'Beta', desc: '', status: 'next',     order: 1 },
      ],
      top: [{ id: 't3', name: 'Landing', desc: '', status: 'locked', order: 0 }],
    },
    dire: [{ id: 'd1', name: 'BigCo', threat: 90, desc: 'incumbent' }],
    roshan: { name: 'GTO Wizard', desc: 'boss' },
    shop: [
      { id: 's1', name: 'Solver', subtitle: 'core IP', desc: 'the engine', effect: 'credibility', status: 'building', progress: 45, holder: 'a',
        components: [
          { name: 'Sacred Relic', desc: 'engine', status: 'building', progress: 60 },
          { name: 'Demon Edge', desc: 'v2', status: 'locked', progress: 0 },
        ] },
      { id: 's2', name: 'Partnership', desc: 'ken', status: 'stolen', progress: 100, holder: 'a', components: [] },
    ],
    neutralCamps: [
      // Legacy game loot fields (gold/xp) are present but must be ignored.
      { id: 'nc1', name: 'Podcast', desc: 'reach', lane: 'top', status: 'stacked', gold: 400, xp: 1 },
      { id: 'nc2', name: 'Conference', desc: 'cred', lane: 'bot', status: 'cleared', gold: 200, xp: 4 },
      { id: 'nc9', name: 'Power Users', desc: 'hard', lane: 'dire', status: 'stacked' },
    ],
  };
}

describe('normalizeBusinessState', () => {
  const m = normalizeBusinessState(fixture());

  it('maps heroes to business members (hp→hours, mp→morale, status normalized)', () => {
    const ann = m.team.find(x => x.id === 'a');
    expect(ann).toMatchObject({ name: 'Ann', role: 'Lead', workstream: 'mid', hoursPerWeek: 40, morale: 80, status: 'active' });
    expect(m.team.find(x => x.id === 'b').status).toBe('at_risk');   // danger → at_risk
    expect(m.team.find(x => x.id === 'c').status).toBe('vacant');    // empty → vacant
  });

  it('flattens towers into milestones with business statuses', () => {
    expect(m.milestones).toHaveLength(3);
    expect(m.milestones.find(x => x.id === 't1').status).toBe('done');
    expect(m.milestones.find(x => x.id === 't2').status).toBe('in_progress');
    expect(m.milestones.find(x => x.id === 't3').status).toBe('planned');
  });

  it('derives workstreams from lane names and infers status', () => {
    expect(m.workstreams.find(w => w.id === 'mid')).toMatchObject({ name: 'Product', status: 'active' });
    expect(m.workstreams.find(w => w.id === 'top').status).toBe('planned'); // all milestones planned
  });

  it('includes Roshan among competitors and grades by threat', () => {
    expect(m.competitors.find(c => c.id === 'd1').level).toBe('dominant'); // threat 90
    expect(m.competitors.find(c => c.id === 'roshan')).toMatchObject({ level: 'dominant', name: 'GTO Wizard' });
  });

  it('maps shop items to bets with business statuses and stages', () => {
    expect(m.bets[0]).toMatchObject({
      id: 's1', name: 'Solver', subtitle: 'core IP', rationale: 'credibility',
      status: 'active', progress: 45, owner: 'a',
    });
    // components → stages, with mapped statuses (building→active, locked→planned)
    expect(m.bets[0].stages).toEqual([
      { name: 'Sacred Relic', description: 'engine', status: 'active', progress: 60 },
      { name: 'Demon Edge', description: 'v2', status: 'planned', progress: 0 },
    ]);
    // "stolen" (the Dota drop mechanic) becomes the business "at_risk"
    expect(m.bets[1]).toMatchObject({ id: 's2', status: 'at_risk', stages: [] });
  });

  it('maps camps to opportunities with NO game loot (gold/xp dropped)', () => {
    expect(m.opportunities).toHaveLength(3);
    const podcast = m.opportunities.find(o => o.id === 'nc1');
    expect(podcast).toEqual({ id: 'nc1', name: 'Podcast', description: 'reach', workstream: 'top', side: 'ours', status: 'available' });
    expect('gold' in podcast).toBe(false);
    expect('xp' in podcast).toBe(false);
    expect(m.opportunities.find(o => o.id === 'nc2').status).toBe('captured'); // cleared → captured
    expect(m.opportunities.find(o => o.id === 'nc9').side).toBe('competitor');  // dire lane
  });

  it('records deployments from hero positions', () => {
    expect(m.deployments).toEqual([{ memberId: 'a', x: 40, y: 55 }, { memberId: 'b', x: 30, y: 60 }]);
  });
});

describe('validateBusinessState — clean fixture', () => {
  it('passes with no issues', () => {
    const res = validateBusinessState(normalizeBusinessState(fixture()));
    expect(res.issues).toEqual([]);
    expect(res.ok).toBe(true);
  });
});

describe('validateBusinessState — each rule fails when violated', () => {
  const base = () => normalizeBusinessState(fixture());

  it('flags an invalid member status', () => {
    const m = base();
    m.team[0].status = 'super-saiyan';
    const res = validateBusinessState(m);
    expect(res.ok).toBe(false);
    expect(res.issues).toContainEqual(expect.objectContaining({ entity: 'member', field: 'status' }));
  });

  it('flags an active member with no role', () => {
    const m = base();
    m.team[0].role = '';
    expect(validateBusinessState(m).issues).toContainEqual(expect.objectContaining({ entity: 'member', field: 'role' }));
  });

  it('flags a member on a non-existent workstream', () => {
    const m = base();
    m.team[0].workstream = 'ghost-lane';
    expect(validateBusinessState(m).issues).toContainEqual(expect.objectContaining({ entity: 'member', field: 'workstream' }));
  });

  it('flags a milestone on a non-existent workstream', () => {
    const m = base();
    m.milestones[0].workstream = 'ghost-lane';
    expect(validateBusinessState(m).issues).toContainEqual(expect.objectContaining({ entity: 'milestone', field: 'workstream' }));
  });

  it('flags duplicate ids', () => {
    const m = base();
    m.team[1].id = m.team[0].id;
    expect(validateBusinessState(m).issues).toContainEqual(expect.objectContaining({ entity: 'member', message: 'duplicate id' }));
  });

  it('flags out-of-bounds deployment coordinates', () => {
    const m = base();
    m.deployments[0].x = 140;
    expect(validateBusinessState(m).issues).toContainEqual(expect.objectContaining({ entity: 'deployment', field: 'position' }));
  });

  it('flags a deployment pointing at an unknown member', () => {
    const m = base();
    m.deployments[0].memberId = 'nobody';
    expect(validateBusinessState(m).issues).toContainEqual(expect.objectContaining({ entity: 'deployment', field: 'memberId' }));
  });

  it('flags out-of-bounds morale', () => {
    const m = base();
    m.team[0].morale = 250;
    expect(validateBusinessState(m).issues).toContainEqual(expect.objectContaining({ entity: 'member', field: 'morale' }));
  });

  it('flags bet progress outside 0-100', () => {
    const m = base();
    m.bets[0].progress = 300;
    expect(validateBusinessState(m).issues).toContainEqual(expect.objectContaining({ entity: 'bet', field: 'progress' }));
  });

  it('flags a bet stage with out-of-bounds progress', () => {
    const m = base();
    m.bets[0].stages[0].progress = 250;
    expect(validateBusinessState(m).issues).toContainEqual(expect.objectContaining({ entity: 'bet', field: 'stage.progress' }));
  });

  it('flags an invalid opportunity status', () => {
    const m = base();
    m.opportunities[0].status = 'farming';
    expect(validateBusinessState(m).issues).toContainEqual(expect.objectContaining({ entity: 'opportunity', field: 'status' }));
  });
});

describe('selectors', () => {
  const m = normalizeBusinessState(fixture());
  it('membersOf excludes vacant slots', () => {
    expect(membersOf(m, 'mid').map(x => x.id)).toEqual(['a', 'b']);
    expect(membersOf(m, 'top')).toEqual([]); // only a vacant slot lives on top
  });
  it('vacancies and atRisk pick out the right members', () => {
    expect(vacancies(m).map(x => x.id)).toEqual(['c']);
    expect(atRisk(m).map(x => x.id)).toEqual(['b']);
  });
  it('milestonesOf returns ordered milestones for a workstream', () => {
    expect(milestonesOf(m, 'mid').map(x => x.id)).toEqual(['t1', 't2']);
  });
});

describe('businessSummary', () => {
  const s = businessSummary(normalizeBusinessState(fixture()));
  it('rolls up team headcount and hours', () => {
    expect(s.team).toMatchObject({ active: 1, atRisk: 1, vacant: 1, totalHours: 90 });
  });
  it('rolls up milestone progress', () => {
    expect(s.milestones).toMatchObject({ done: 1, inProgress: 1, planned: 1, pct: 33 });
  });
  it('names the top competitor by threat', () => {
    expect(s.competitors.top).toMatchObject({ name: 'GTO Wizard', level: 'dominant' });
    expect(s.competitors.dominant).toBe(2);
  });
  it('counts workstreams and bets', () => {
    expect(s.workstreams.total).toBe(2);
    expect(s.bets).toMatchObject({ active: 1, done: 0 });
  });
  it('rolls up opportunities', () => {
    expect(s.opportunities).toMatchObject({ total: 3, available: 2, captured: 1 });
  });
});

describe('the real seeded STATE', () => {
  it('normalizes and validates clean — the shipped board is a valid business description', () => {
    const res = validateBusinessState(normalizeBusinessState(STATE));
    if (!res.ok) console.error('Seed validation issues:', res.issues);
    expect(res.ok).toBe(true);
  });
  it('exposes the expected enums', () => {
    expect(WORKSTREAM_STATUS).toContain('active');
    expect(MEMBER_STATUS).toEqual(['active', 'at_risk', 'vacant']);
  });
});
