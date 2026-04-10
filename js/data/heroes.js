export const PORTRAIT_CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/';
export function portraitUrl(slug) { return PORTRAIT_CDN + slug + '.png'; }

export const HERO_PORTRAITS = {
  jack:     portraitUrl('queenofpain'),
  hu:       portraitUrl('spectre'),
  anthony:  portraitUrl('spirit_breaker'),
  clarence: portraitUrl('crystal_maiden'),
  minh:     portraitUrl('techies'),
  steve:    portraitUrl('techies'),
};

export const POS3_CANDIDATES = [
  { name:'Mars',              slug:'mars',            reason:'Arena definer — claims territory, dictates where fights happen' },
  { name:'Axe',               slug:'axe',             reason:'The bully — forces fights on his terms, self-sufficient' },
  { name:'Centaur Warrunner', slug:'centaur',          reason:'Stampede leader — tanks damage, rallies the team forward' },
  { name:'Tidehunter',        slug:'tidehunter',       reason:'Patient devastator — one perfect Ravage changes everything' },
  { name:'Legion Commander',  slug:'legion_commander', reason:'Duelist — takes direct ownership, compounds wins' },
  { name:'Beastmaster',       slug:'beastmaster',      reason:'Map controller — vision, tempo, push. Sees everything' },
];

export const LANE_COLORS = { mid: '#e0a030', top: '#4dcc70', bot: '#4488dd' };

export const HERO_ABILITIES = {
  jack: [
    { name:'Blink', key:'Q', desc:'Quickly shift focus between lanes — redirect attention to where it matters most' },
    { name:'Sonic Wave', key:'W', desc:'Big product push — ship a major feature that moves the needle' },
    { name:'Shadow Strike', key:'E', desc:'Targeted feature release — precise, high-impact delivery' },
    { name:'Scream of Pain', key:'R', desc:'Crunch time sprint — burst of output at the cost of HP' },
  ],
  hu: [
    { name:'Spectral Dagger', key:'Q', desc:'Research path — cut through unknown territory to find the route' },
    { name:'Desolate', key:'W', desc:'Focused analysis — deep work that weakens the problem' },
    { name:'Dispersion', key:'E', desc:'Knowledge sharing — damage taken becomes knowledge for the team' },
    { name:'Haunt', key:'R', desc:'Late-game scaling — presence grows across all lanes simultaneously' },
  ],
  anthony: [
    { name:'Charge', key:'Q', desc:'SEO sprint — lock onto a keyword target and bulldoze toward it' },
    { name:'Greater Bash', key:'W', desc:'Viral content hit — chance to stun the market with a breakout piece' },
    { name:'Bulldoze', key:'E', desc:'Push through blockers — ignore resistance and keep moving' },
    { name:'Nether Strike', key:'R', desc:'Targeted outreach — teleport to a high-value contact and strike' },
  ],
  clarence: [
    { name:'Crystal Nova', key:'Q', desc:'Ward placement burst — deploy multiple intelligence sources at once' },
    { name:'Frostbite', key:'W', desc:'Lock down a task — freeze a workstream so it gets done' },
    { name:'Arcane Aura', key:'E', desc:'Team mana regen — presence helps everyone sustain longer' },
    { name:'Freezing Field', key:'R', desc:'Full team support ult — massive enabling play for all lanes' },
  ],
  minh: [
    { name:'Proximity Mines', key:'Q', desc:'Set up foundational code — delayed value, triggers when someone steps on it' },
    { name:'Stasis Trap', key:'W', desc:'Create drag — traps that slow the team instead of helping' },
    { name:'Blast Off', key:'E', desc:'Risky move — damages self to maybe damage the problem' },
    { name:'Remote Mines', key:'R', desc:'Delayed value — might pay off, might not. Hard to tell.' },
  ],
  steve: [
    { name:'Proximity Mines', key:'Q', desc:'Foundational setup — some early infrastructure laid' },
    { name:'Stasis Trap', key:'W', desc:'Communication gaps — creates blockers for the team' },
    { name:'Blast Off', key:'E', desc:'Sporadic availability — shows up, does damage, disappears' },
    { name:'Remote Mines', key:'R', desc:'AFK farming — mines stop getting placed when not present' },
  ],
};

const STATUS_COLORS = { active: '#4dcc70', warning: '#e0a030', danger: '#cc4444', empty: '#4a6070' };
export function heroStatusColor(status) { return STATUS_COLORS[status] || STATUS_COLORS.danger; }

export const TASK_STATUS_COLORS = { achieved: '#4dcc70', next: '#e08030', locked: '#4a6070' };
export function taskStatusColor(status) { return TASK_STATUS_COLORS[status] || TASK_STATUS_COLORS.locked; }

// Preload all portraits
export function preloadPortraits() {
  const urls = new Set([...Object.values(HERO_PORTRAITS), ...POS3_CANDIDATES.map(c => portraitUrl(c.slug))]);
  urls.forEach(url => { new Image().src = url; });
}
