import { syncToCloud } from './cloud-sync.js';

const STORAGE_KEY = 'ps-strategy-v2';

export const STATE = {
  phase: 'draft',
  labelMode: 'biz',
  fogEnabled: true,
  panelCollapsed: false,
  intelCollapsed: false,

  // Hero positions on map (percentage coords 0-100)
  // Only heroes actively on the map get entries — bench heroes excluded
  heroPositions: {
    jack:     { x: 40, y: 55 },   // Mid lane, pushing forward
    hu:       { x: 30, y: 85 },   // Bot lane, farming safely
    clarence: { x: 34, y: 62 },   // Mid lane, supporting Jack from behind
    anthony:  { x: 48, y: 50 },   // River, ganking between lanes
    minh:     { x: 22, y: 70 },   // Mid lane, lingering near base
    steve:    { x: 10, y: 55 },   // Top lane, near base — Techies holding ops
  },

  heroes: [
    {
      id:'jack', name:'Jack Lian', pos:2, role:'Mid — Product Visionary',
      lane:'mid', level:11, maxLevel:30, vision:8,
      hp:200, mp:90, status:'active',
      note:'Carrying the team. 80hrs/wk. Signal system shipped, UI polished, strategy tool built. Product map position is strong. Needs solver depth and team support to scale.',
      dota:'QoP at 11 running at 200% HP — dominating mid through sheer will. The hero is overclocked but this pace isn\'t sustainable without the team stepping up.'
    },
    {
      id:'hu', name:'Prof. Hu', pos:1, role:'Carry — Solver / Academic',
      lane:'bot', level:4, maxLevel:30, vision:6,
      hp:75, mp:90, status:'active',
      note:'Methodology is defined. Sacred Relic (core solver engine) in progress. Needs money and time to complete the Divine Rapier. Don\'t rush — late game win condition.',
      dota:'Spectre at 4 with Sacred Relic building. The methodology is the blueprint — now it\'s about farming gold to finish the Rapier. Protect and fund.'
    },
    {
      id:'pos3', name:'??? (Co-Founder)', pos:3, role:'Offlane — Ops / Biz Dev',
      lane:'top', level:0, maxLevel:30, vision:0,
      hp:0, mp:0, status:'empty',
      note:'EMPTY SLOT. Need the tank/bully who removes threats, creates space, handles ops/marketing/biz dev. Top lane is completely dark without this hero.',
      dota:'Need a Mars or Tidehunter — someone who can initiate, soak pressure, and create space for cores to farm.'
    },
    {
      id:'clarence', name:'Clarence', pos:4, role:'Support — Rotating',
      lane:'mid', level:3, maxLevel:30, vision:4,
      hp:25, mp:90, status:'warning',
      note:'10hrs/wk supporting mid lane with Jack. Build not yet defined — needs to figure out his skill tree. High morale, low hours. Will rotate to top lane once build is set.',
      dota:'Crystal Maiden at 10hrs/wk — high morale but limited mana pool. Needs to commit more time or find her niche fast.'
    },
    {
      id:'anthony', name:'Anthony', pos:4, role:'River Ganker — Web / SEO',
      lane:'river', level:5, maxLevel:30, vision:4,
      hp:25, mp:80, status:'active',
      note:'10hrs/wk on web + SEO + organic growth. Excellent output given his hours. A precision ganker — small time investment, high-value pick-offs across the map.',
      dota:'Spirit Breaker at 10hrs/wk — every Charge counts. Efficient ganker who makes the most of limited availability.'
    },
    {
      id:'minh', name:'Minh', pos:5, role:'Dev',
      lane:'mid', level:4, maxLevel:30, vision:4,
      hp:150, mp:30, status:'danger',
      note:'60hrs/wk but morale is critically low at 30. High hours, low output — the time isn\'t converting to value. Needs direction or a role change.',
      dota:'Techies putting in overtime but the mines aren\'t landing. 60hrs of presence but the map impact doesn\'t match the investment.'
    },
    {
      id:'steve', name:'Steve', pos:5, role:'Dev',
      lane:'top', level:3, maxLevel:30, vision:3,
      hp:10, mp:50, status:'danger',
      note:'4hrs/wk. Not enough presence to make meaningful contributions. Morale at 50 — not checked out but not committed either.',
      dota:'Techies who logs in for 4hrs and places one mine. The lane doesn\'t feel his presence.'
    },
  ],

  // Lane labels
  laneNames: { mid: 'Product', top: 'Ops', bot: 'Solver' },

  // Towers/tasks — positioned by lane + order (auto-computed along lane path)
  towers: {
    mid: [
      { id:'tm1', name:'MVP Launch', desc:'Core game loop, villain AI, signal system', status:'achieved', order:0 },
      { id:'tm2', name:'Signal v2', desc:'152 ML signals, tendency lifecycle, 4-channel animations', status:'achieved', order:1 },
      { id:'tm3', name:'Public Beta', desc:'Open access, onboarding flow, retention loops', status:'next', order:2 },
      { id:'tm4', name:'Revenue Engine', desc:'Monetization proven, positive unit economics', status:'locked', order:3 },
    ],
    top: [
      { id:'tt1', name:'Landing Page', desc:'First public-facing page. Explains the product, captures emails, drives sign-ups.', status:'locked', order:0 },
      { id:'tt2', name:'Social Presence', desc:'Discord server, Twitter/X, Reddit. Start conversations, build community.', status:'locked', order:1 },
      { id:'tt3', name:'Content Strategy', desc:'Blog posts, poker content, videos. Organic traffic engine.', status:'locked', order:2 },
      { id:'tt4', name:'Growth Engine', desc:'Repeatable acquisition: SEO, referrals, partnerships. Predictable funnel.', status:'locked', order:3 },
    ],
    bot: [
      { id:'tb1', name:'Solver Baseline', desc:'GTO solutions, K-means clustering, 2.94M hands', status:'achieved', order:0 },
      { id:'tb2', name:'Validated Results', desc:'External verification of solver accuracy', status:'achieved', order:1 },
      { id:'tb3', name:'Solver v2 + Solution Depth', desc:'Next-gen solver with deeper solution trees. The race is on.', status:'next', order:2 },
      { id:'tb4', name:'Published Paper', desc:'Peer-reviewable methodology, academic credibility', status:'locked', order:3 },
      { id:'tb5', name:'Industry Standard', desc:'Reference implementation, conference talks, citations', status:'locked', order:4 },
    ],
  },

  wards: [
    { id:'w1', x:45, y:48, name:'App Analytics', desc:'PostHog + GA4 — session data, funnels', r:6 },
    { id:'w2', x:30, y:55, name:'User Feedback', desc:'Direct player feedback from alpha testers', r:5 },
  ],

  fogEditMode: false,
  phases: { draft: null, laning: null, mid: null, late: null },

  // Static fog holes (explored areas not tied to heroes)
  fogHoles: [
    { x:8, y:85, r:18 },  // Radiant base — always visible
    { x:15, y:78, r:10 }, // Base approach
  ],

  // Fog zones — manually painted areas (user can add/remove via fog edit mode)
  // Dire fog is now rendered procedurally in fog.js, not as individual zones
  fogZones: [],

  // Minions — tiered traction units pushing lanes
  minions: [
    { id:'mn1', type:'basic', count:0, lane:'mid', x:16, y:74, label:'Paying Users' },
    { id:'mn2', type:'wizard', count:0, lane:'mid', x:20, y:72, label:'Community Leaders' },
    { id:'mn3', type:'super', count:0, lane:'bot', x:14, y:82, label:'Sponsors', name:'' },
  ],

  // Economy
  economy: {
    gold: 0,
    runway: '18 mo',
    sharesTotal: 20000000,
    sharesAllocated: 8000000,
    sharesReserved: 10000000,
    sharesRemaining: 2000000,
  },

  // Neutral camps — opportunities to clear for gold/XP
  // Positioned logically near their relevant lane
  neutralCamps: [
    // Product lane jungle (mid) — user acquisition plays
    { id:'nc1', name:'Twitch Collab', desc:'Partner with a poker streamer for a live demo. Product exposure to engaged audience.', x:35, y:55, status:'stacked', type:'medium', lane:'mid', gold:500, xp:2 },
    { id:'nc2', name:'Mobile-Only Players', desc:'Phone players who can\'t use desktop solvers. Build mobile-first features to capture.', x:42, y:65, status:'stacked', type:'medium', lane:'mid', gold:800, xp:3 },
    // Ops lane jungle (top) — growth & marketing plays
    { id:'nc3', name:'Influencer Partnership', desc:'Secure a poker content creator to promote the product. Organic growth accelerator.', x:14, y:45, status:'stacked', type:'medium', lane:'top', gold:1000, xp:2 },
    { id:'nc4', name:'Home Game Casuals', desc:'Recreational players in weekly home games. Easy community to build around.', x:12, y:60, status:'stacked', type:'small', lane:'top', gold:300, xp:1 },
    { id:'nc5', name:'Podcast Guest Spot', desc:'Appear on a poker podcast. Low cost, high credibility, drives sign-ups.', x:20, y:40, status:'stacked', type:'small', lane:'top', gold:400, xp:1 },
    // Solver lane jungle (bot) — credibility & academic plays
    { id:'nc6', name:'Conference Talk', desc:'Present solver methodology at a poker/AI conference. Major credibility boost.', x:40, y:82, status:'stacked', type:'medium', lane:'bot', gold:200, xp:4 },
    { id:'nc7', name:'Chart Memorizers', desc:'Players who memorize charts but don\'t understand why. Convert with signal-based intuition.', x:50, y:78, status:'stacked', type:'small', lane:'bot', gold:600, xp:2 },
    { id:'nc8', name:'Academic Paper Review', desc:'Get methodology peer-reviewed. Unlocks citations, trust, and industry respect.', x:28, y:88, status:'stacked', type:'medium', lane:'bot', gold:100, xp:5 },
    // Dire jungle (enemy side, in fog, harder segments)
    { id:'nc9', name:'High-Stakes Grinders', desc:'Deep GTO Wizard users. Hard to convert without superior solver.', x:72, y:28, status:'stacked', type:'medium', lane:'dire', gold:2000, xp:3 },
    { id:'nc10', name:'Solver Power Users', desc:'Run their own PioSolver sims. Need proof our approach is better.', x:65, y:18, status:'stacked', type:'small', lane:'dire', gold:1500, xp:2 },
    { id:'nc11', name:'Pro Coaching Clients', desc:'$200+/hr 1-on-1 coaching clients. Different value prop entirely.', x:80, y:35, status:'stacked', type:'small', lane:'dire', gold:3000, xp:1 },
  ],

  // Roshan = GTO Wizard (the raid boss)
  roshan: {
    name: 'GTO Wizard',
    desc: 'The raid boss. $39-229/mo. Solver + trainer + mobile app. Dominates the solver market.',
    status: 'alive',
    aegis: 'Whoever kills Rosh owns the solver narrative and the "learn poker" search intent.',
    x: 38, y: 32,
  },

  // Item shop
  shop: [
    {
      id: 'divine_rapier', name: 'Divine Rapier', subtitle: 'The Solver',
      desc: 'The most powerful weapon in the game. Can be dropped if holder dies — if methodology leaks, competitors gain it.',
      cost: '6+ months dev', status: 'building', progress: 45,
      components: [
        { name: 'Sacred Relic', desc: 'Core solver engine — Spectre is carrying this', status: 'building', progress: 60 },
        { name: 'Demon Edge', desc: 'Solver v2 + solution depth', status: 'locked', progress: 0 },
        { name: 'Recipe', desc: 'Product integration', status: 'locked', progress: 0 },
      ],
      effect: 'Massive credibility. Bot lane becomes unstoppable. But if methodology leaks, competitors gain it.',
      holder: 'hu',
    },
    {
      id: 'mask_of_madness', name: 'Mask of Madness', subtitle: 'Ken Workstream',
      desc: 'Grants attack speed but reduces armor. Active collaboration — fast output with trade-offs.',
      cost: 'Active partnership', status: 'purchased', progress: 100,
      components: [],
      effect: 'Increased velocity on specific deliverables. Reduced flexibility during active sprint.',
      holder: 'jack',
    },
  ],

  // Dire = whoever holds control over poker education today
  // These are forces/positions, not specific companies — the fog obscures who truly holds them
  dire: [
    { id:'d_solver', name:'Solver Dominance', x:75, y:15, threat:95, desc:'Whoever owns the solver narrative controls credibility. Currently unchallenged.', color:'#cc4444' },
    { id:'d_training', name:'Training Market', x:82, y:25, threat:70, desc:'The "learn poker" search intent. Fragmented but massive. Nobody owns "chess.com for poker" yet.', color:'#aa5544' },
    { id:'d_brand', name:'Brand Authority', x:70, y:30, threat:60, desc:'The trusted voice in poker education. Currently split among personalities, not products.', color:'#996644' },
    { id:'d_mobile', name:'Mobile-First', x:85, y:18, threat:55, desc:'Whoever captures mobile poker training first wins the casual segment. The race is on.', color:'#886644' },
    { id:'d_community', name:'Community Lock-in', x:78, y:38, threat:45, desc:'Discord servers, Reddit communities, Twitch audiences. Whoever builds the social layer wins retention.', color:'#776644' },
  ],

  intel: {
    mid: {
      title:'Mid Lane — Product', status:'pushing',
      items: [
        { id:'im1', text:'Signal System v2 live — 152 signals, 85 strong', type:'green' },
        { id:'im2', text:'Villain reveal lifecycle working', type:'green' },
        { id:'im3', text:'UI framework stable', type:'green' },
        { id:'im4', text:'Beta is 1 month out — onboarding + retention loops in progress', type:'orange' },
      ]
    },
    top: {
      title:'Top Lane — Ops / Marketing', status:'dark',
      items: [
        { id:'it1', text:'CI/CD operational (Render 7-repo deploy chain)', type:'green' },
        { id:'it2', text:'NO marketing presence — lane completely dark', type:'red' },
        { id:'it3', text:'No social, no landing page, no content', type:'red' },
        { id:'it4', text:'Pos 3 slot empty — no one to push this lane', type:'red' },
      ]
    },
    bot: {
      title:'Bot Lane — Solver / Academic', status:'farming',
      items: [
        { id:'ib1', text:'2.94M hands processed through ML pipeline', type:'green' },
        { id:'ib2', text:'K-means clustering identifying player types', type:'green' },
        { id:'ib3', text:'Solver methodology defined — needs funding to build', type:'green' },
        { id:'ib4', text:'No external validation yet', type:'orange' },
        { id:'ib5', text:'No published paper — credibility not yet earned', type:'gray' },
      ]
    },
  }
};

// ── Phase Snapshots ──

export function capturePhaseSnapshot() {
  return {
    heroPositions: JSON.parse(JSON.stringify(STATE.heroPositions)),
    towerStatuses: Object.fromEntries(Object.entries(STATE.towers).map(([lane, tasks]) =>
      [lane, tasks.map(t => ({ id: t.id, status: t.status, manualX: t.manualX, manualY: t.manualY }))]
    )),
    fogHoles: JSON.parse(JSON.stringify(STATE.fogHoles)),
    fogZones: JSON.parse(JSON.stringify(STATE.fogZones)),
    wards: JSON.parse(JSON.stringify(STATE.wards)),
    campStatuses: Object.fromEntries((STATE.neutralCamps || []).map(c => [c.id, c.status])),
    heroOverrides: Object.fromEntries(STATE.heroes.map(h => [h.id, { level: h.level, vision: h.vision, hp: h.hp, mp: h.mp }])),
    minions: JSON.parse(JSON.stringify(STATE.minions || [])),
  };
}

export function applyPhaseSnapshot(snapshot) {
  if (!snapshot) return;
  STATE.heroPositions = JSON.parse(JSON.stringify(snapshot.heroPositions || STATE.heroPositions));
  STATE.fogHoles = JSON.parse(JSON.stringify(snapshot.fogHoles || STATE.fogHoles));
  STATE.fogZones = JSON.parse(JSON.stringify(snapshot.fogZones || STATE.fogZones));
  STATE.wards = JSON.parse(JSON.stringify(snapshot.wards || STATE.wards));
  if (snapshot.minions) STATE.minions = JSON.parse(JSON.stringify(snapshot.minions));

  if (snapshot.towerStatuses) {
    for (const lane in snapshot.towerStatuses) {
      (snapshot.towerStatuses[lane] || []).forEach(ts => {
        const tower = (STATE.towers[lane] || []).find(t => t.id === ts.id);
        if (tower) { tower.status = ts.status; tower.manualX = ts.manualX; tower.manualY = ts.manualY; }
      });
    }
  }
  if (snapshot.campStatuses) {
    (STATE.neutralCamps || []).forEach(c => { if (snapshot.campStatuses[c.id] !== undefined) c.status = snapshot.campStatuses[c.id]; });
  }
  if (snapshot.heroOverrides) {
    STATE.heroes.forEach(h => {
      const o = snapshot.heroOverrides[h.id];
      if (o) { h.level = o.level; h.vision = o.vision; h.hp = o.hp; h.mp = o.mp; }
    });
  }
}

// ── Undo/Redo ──
const _undoStack = [];
const _redoStack = [];
const MAX_HISTORY = 50;

function pushHistory() {
  _undoStack.push(JSON.stringify(STATE));
  if (_undoStack.length > MAX_HISTORY) _undoStack.shift();
  _redoStack.length = 0;
}

export function undo() {
  if (_undoStack.length === 0) return false;
  _redoStack.push(JSON.stringify(STATE));
  Object.assign(STATE, JSON.parse(_undoStack.pop()));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE)); } catch(e) {}
  return true;
}

export function redo() {
  if (_redoStack.length === 0) return false;
  _undoStack.push(JSON.stringify(STATE));
  Object.assign(STATE, JSON.parse(_redoStack.pop()));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE)); } catch(e) {}
  return true;
}

// ── Save/Load ──
export function saveLocal() {
  pushHistory();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE)); } catch(e) {}
  syncToCloud(STATE);
}

export function loadLocal() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      Object.assign(STATE, JSON.parse(s));
      // Migrations
      STATE.heroes.forEach(h => {
        if (h.lane === 'bench' && h.id === 'minh') h.lane = 'mid';
        if ((h.lane === 'bench' || h.lane === 'mid') && h.id === 'steve') h.lane = 'top';
        if (h.vision === undefined) h.vision = 5;
      });
      // Migrate towers with x,y but no order
      for (const lane in STATE.towers) {
        STATE.towers[lane].forEach((t, i) => {
          if (t.order === undefined) { t.order = i; delete t.x; delete t.y; }
        });
      }
      // Ensure new fields exist
      if (!STATE.fogZones) STATE.fogZones = [];
      if (STATE.fogEditMode === undefined) STATE.fogEditMode = false;
      if (!STATE.laneNames) STATE.laneNames = { mid: 'Product', top: 'Ops', bot: 'Solver' };
      if (!STATE.phases) STATE.phases = { draft: null, laning: null, mid: null, late: null };
      if (STATE.minionWaves) { delete STATE.minionWaves; }
      if (!STATE.minions) STATE.minions = [];
    }
  } catch(e) {}
}
