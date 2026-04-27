import { STATE } from './state.js';

export const LABELS = {
  // Phase tabs
  phase_draft:    { biz: 'Planning',   dota: 'Draft' },
  phase_laning:   { biz: 'Execution',  dota: 'Laning' },
  phase_mid:      { biz: 'Growth',     dota: 'Mid Game' },
  phase_late:     { biz: 'Scale',      dota: 'Late Game' },

  // Phase status bar
  status_draft:   { biz: 'PLANNING — Team Formation',         dota: 'DRAFT PHASE — Team Incomplete' },
  status_laning:  { biz: 'EXECUTION — Establishing Positions', dota: 'LANING PHASE — Establishing Lanes' },
  status_mid:     { biz: 'GROWTH — Market Timing',             dota: 'MID GAME — Timing Window' },
  status_late:    { biz: 'SCALE — Market Dominance',           dota: 'LATE GAME — High Ground' },

  // Bottom bar buttons
  briefingBtn:    { biz: 'Summary',          dota: 'Briefing' },
  shopBtn:        { biz: 'Investments',      dota: 'Shop' },
  taskBtn:        { biz: 'Tasks',            dota: 'Tasks' },
  treasuryBtn:    { biz: 'Books',            dota: 'Treasury' },
  fogBtn:         { biz: 'Uncertainty',      dota: 'Fog' },
  fogEditBtn:     { biz: 'Edit Uncertainty', dota: 'Fog Edit' },
  wardBtn:        { biz: 'Place Sensor',     dota: 'Place Ward' },
  resetFogBtn:    { biz: 'Reset Uncertainty',dota: 'Reset Fog' },

  // Briefing
  situationReport:{ biz: 'EXECUTIVE SUMMARY',  dota: 'SITUATION REPORT' },
  enterWarRoom:   { biz: 'VIEW STRATEGY MAP',  dota: 'ENTER WAR ROOM' },
  milestones:     { biz: 'milestones',          dota: 'towers' },
  hero:           { biz: 'member',              dota: 'hero' },
  heroes:         { biz: 'members',             dota: 'heroes' },
  noHeroes:       { biz: 'No team members assigned', dota: 'No heroes assigned' },
  topActions:     { biz: 'TOP PRIORITIES',      dota: 'TOP ACTIONS' },

  // Draft panel
  draftHeader:    { biz: 'TEAM',         dota: 'DRAFT' },
  coresSection:   { biz: 'Leadership',   dota: 'Cores' },
  supportsSection:{ biz: 'Support Staff',dota: 'Supports' },
  towersSection:  { biz: 'Milestones',   dota: 'Towers' },
  campsSection:   { biz: 'Opportunities',dota: 'Jungle Camps' },
  addTower:       { biz: '+ Add Milestone', dota: '+ Add Tower' },
  towerName:      { biz: 'Milestone name:', dota: 'Tower name:' },
  deleteTower:    { biz: 'Delete this milestone?', dota: 'Delete this tower?' },
  jungle:         { biz: 'Pipeline',     dota: 'Jungle' },
  direJungle:     { biz: 'Competitor Pipeline', dota: 'Dire Jungle' },
  customCamp:     { biz: '+ Custom Opportunity', dota: '+ Custom Camp' },
  campName:       { biz: 'Opportunity name:', dota: 'Camp name:' },
  deleteCamp:     { biz: 'Delete this opportunity?', dota: 'Delete this camp?' },
  clearAction:    { biz: 'Capture',      dota: 'Clear' },

  // Intel panel
  intelHeader:    { biz: 'INTELLIGENCE', dota: 'INTEL' },
  direSection:    { biz: 'Market Forces — Who Controls Poker Education?', dota: 'Dire — Who Controls Poker Education?' },

  // Shop
  shopTitle:      { biz: 'INVESTMENTS — Strategic Assets', dota: 'SHOP — Strategic Investments' },

  // Treasury
  treasuryTitle:  { biz: 'BOOKS — P&L, Receipts, Burn', dota: 'TREASURY — Gold, Bounties, Burn' },

  // Hero detail
  abilities:      { biz: 'Capabilities', dota: 'Abilities' },
  laneTasks:      { biz: 'Lane Objectives', dota: 'Lane Tasks' },
  dotaAnalogy:    { biz: 'Gaming Analogy', dota: 'Dota Analogy' },
  hp:             { biz: 'Hours/wk',     dota: 'HP' },
  mp:             { biz: 'Morale',       dota: 'MP' },
  lvl:            { biz: 'Level',        dota: 'Lvl' },
  vision:         { biz: 'reach',        dota: 'vision' },

  // Map terrain
  radiantLabel:   { biz: 'HOME BASE',    dota: 'RADIANT' },
  direLabel:      { biz: 'MARKET',       dota: 'DIRE' },
  riverLabel:     { biz: 'M A R K E T   D I V I D E', dota: 'R I V E R' },

  // Map SVG
  minionWave:     { biz: 'Sprint Wave',  dota: 'Minion Wave' },
  creeps:         { biz: 'tasks',         dota: 'creeps' },

  // Ward prompts
  wardName:       { biz: 'Sensor name:', dota: 'Ward name:' },
  wardDesc:       { biz: 'What does this sensor reveal?', dota: 'What does this ward reveal?' },
  wardLabel:      { biz: 'Sensor',       dota: 'Ward' },

  // Statuses
  achieved:       { biz: 'complete',     dota: 'achieved' },
  next:           { biz: 'in progress',  dota: 'next' },
  locked:         { biz: 'planned',      dota: 'locked' },
  stacked:        { biz: 'available',    dota: 'stacked' },
  cleared:        { biz: 'captured',     dota: 'cleared' },

  // Shop items
  divineRapier:   { biz: 'The Solver',    dota: 'Divine Rapier' },
  maskOfMadness:  { biz: 'Ken Partnership', dota: 'Mask of Madness' },

  // Minions
  spawnBtn:       { biz: 'Add Traction',  dota: 'Spawn' },

  // Economy
  gold:           { biz: 'MRR',          dota: 'Gold' },
  runway:         { biz: 'Runway',       dota: 'Buyback Timer' },
  shares:         { biz: 'Shares Left',  dota: 'Net Worth' },
};

const _callbacks = [];

export function label(key) {
  const entry = LABELS[key];
  if (!entry) return key;
  return entry[getMode()] || entry.biz || key;
}

export function labelAlt(key) {
  const entry = LABELS[key];
  if (!entry) return '';
  const alt = getMode() === 'biz' ? 'dota' : 'biz';
  return entry[alt] || '';
}

export function getMode() { return STATE.labelMode || 'biz'; }

export function setMode(mode) {
  STATE.labelMode = mode;
  fireModeChange();
}

export function onModeChange(cb) { _callbacks.push(cb); }

export function fireModeChange() {
  _callbacks.forEach(cb => cb());
}
