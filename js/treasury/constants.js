export const POKER_SHARK_CARD = '8789';

export const CATEGORIES = {
  cloud_hosting:       { name: 'Cloud & Hosting',         section: 'cogs', color: '#4a9d7a' },
  ai_tools:            { name: 'AI & Dev Tools',          section: 'cogs', color: '#5fbf95' },
  software_subs:       { name: 'Software Subscriptions',  section: 'opex', color: '#5588cc' },
  domains_dns:         { name: 'Domains & DNS',           section: 'opex', color: '#7ab5e0' },
  internet_telecom:    { name: 'Internet & Telecom',      section: 'opex', color: '#8866bb' },
  office_supplies:     { name: 'Office Supplies',         section: 'opex', color: '#b088dd' },
  professional_svc:    { name: 'Professional Services',   section: 'opex', color: '#d4c455' },
  insurance:           { name: 'Insurance',               section: 'opex', color: '#e09040' },
  marketing:           { name: 'Marketing & Advertising', section: 'opex', color: '#e05555' },
  meals_entertainment: { name: 'Meals & Entertainment',   section: 'opex', color: '#cc6688' },
  automotive:          { name: 'Automotive & Fuel',       section: 'opex', color: '#55aa88' },
  travel_transport:    { name: 'Travel & Transport',      section: 'opex', color: '#66bbaa' },
  education:           { name: 'Education & Training',    section: 'opex', color: '#9988dd' },
  other_expense:       { name: 'Other / Uncategorized',   section: 'opex', color: '#7a9e8c' },
};

export const REVENUE_CATEGORIES = {
  app_revenue:   { name: 'App Revenue' },
  iap:           { name: 'In-App Purchases' },
  subscriptions: { name: 'Subscriptions' },
  other_revenue: { name: 'Other Revenue' },
};

export const CARD_DEFAULTS = {
  [POKER_SHARK_CARD]: { label: 'Chase Ink Business',     primary: true,  holder: 'Jack J Lian' },
  '4005':             { label: 'Amex Platinum',          primary: true,  holder: 'Jack J Lian' },
  '2757':             { label: 'Chase Sapphire',         primary: false, holder: 'Jie Lian — reimbursable' },
  '7326':             { label: 'Amazon Prime Visa',      primary: false, holder: 'Jie Lian — reimbursable' },
};

// Cards counted as primary Poker Shark spend (no reimbursement needed).
// Used by isReimbursable() and the seed/import filter.
export const PRIMARY_CARDS = new Set(
  Object.entries(CARD_DEFAULTS).filter(([, c]) => c.primary).map(([id]) => id),
);

export const TX_TYPES = ['purchase', 'payment', 'credit', 'fee', 'interest'];

export const DEFAULT_RULES = {
  'RENDER':              { vendor: 'Render',           category: 'cloud_hosting' },
  'SUPABASE':            { vendor: 'Supabase',         category: 'cloud_hosting' },
  'NETLIFY':             { vendor: 'Netlify',          category: 'cloud_hosting' },
  'HEROKU':              { vendor: 'Heroku',           category: 'cloud_hosting' },
  'AWS':                 { vendor: 'AWS',              category: 'cloud_hosting' },
  'AMAZON WEB SERV':     { vendor: 'AWS',              category: 'cloud_hosting' },
  'DIGITALOCEAN':        { vendor: 'DigitalOcean',     category: 'cloud_hosting' },
  'VERCEL':              { vendor: 'Vercel',           category: 'cloud_hosting' },
  'FLY.IO':              { vendor: 'Fly.io',           category: 'cloud_hosting' },
  'GOOGLE *CLOUD':       { vendor: 'Google Cloud',     category: 'cloud_hosting' },
  'CLAUDE.AI':           { vendor: 'Claude AI',        category: 'ai_tools' },
  'ANTHROPIC':           { vendor: 'Anthropic',        category: 'ai_tools' },
  'OPENAI':              { vendor: 'OpenAI',           category: 'ai_tools' },
  'CHATGPT':             { vendor: 'ChatGPT',          category: 'ai_tools' },
  'REPLIT':              { vendor: 'Replit',           category: 'ai_tools' },
  'CURSOR':              { vendor: 'Cursor',           category: 'ai_tools' },
  'GITHUB':              { vendor: 'GitHub',           category: 'software_subs' },
  'NOTION':              { vendor: 'Notion',           category: 'software_subs' },
  'SLACK':               { vendor: 'Slack',            category: 'software_subs' },
  'FIGMA':               { vendor: 'Figma',            category: 'software_subs' },
  'ZOOM':                { vendor: 'Zoom',             category: 'software_subs' },
  '1PASSWORD':           { vendor: '1Password',        category: 'software_subs' },
  'JIRA':                { vendor: 'Jira',             category: 'software_subs' },
  'BOX, INC':            { vendor: 'Box.com',          category: 'software_subs' },
  'BOX INC':             { vendor: 'Box.com',          category: 'software_subs' },
  'GOOGLE*GSUITE':       { vendor: 'Google Workspace', category: 'software_subs' },
  'GOOGLE *WORKSPACE':   { vendor: 'Google Workspace', category: 'software_subs' },
  'APPLE.COM/BILL':      { vendor: 'Apple',            category: 'software_subs' },
  'GODADDY':             { vendor: 'GoDaddy',          category: 'domains_dns' },
  'DNH*GODADDY':         { vendor: 'GoDaddy',          category: 'domains_dns' },
  'NAMECHEAP':           { vendor: 'Namecheap',        category: 'domains_dns' },
  'CLOUDFLARE':          { vendor: 'Cloudflare',       category: 'domains_dns' },
  'GOOGLE*DOMAIN':       { vendor: 'Google Domains',   category: 'domains_dns' },
  'TEXAS SECRETARY':     { vendor: 'TX Secretary of State', category: 'professional_svc' },
  'TEXAS S.O.S':         { vendor: 'TX SOS',           category: 'professional_svc' },
  'LEGALZOOM':           { vendor: 'LegalZoom',        category: 'professional_svc' },
  'QUICKBOOKS':          { vendor: 'QuickBooks',       category: 'professional_svc' },
  'INTUIT':              { vendor: 'Intuit',           category: 'professional_svc' },
  'GOOGLE*ADS':          { vendor: 'Google Ads',       category: 'marketing' },
  'META*ADS':            { vendor: 'Meta Ads',         category: 'marketing' },
  'FACEBOOK':            { vendor: 'Facebook Ads',     category: 'marketing' },
  'PATREON':             { vendor: 'Patreon',          category: 'marketing' },
};

// Charges to a non-primary card matching one of these patterns count as business spend
// (owner reimbursable) rather than personal spend.
export const BUSINESS_VENDOR_PATTERNS = [
  'RENDER', 'SUPABASE', 'NETLIFY', 'HEROKU', 'AWS', 'VERCEL', 'FLY.IO',
  'CLAUDE.AI', 'ANTHROPIC', 'OPENAI', 'CHATGPT', 'REPLIT', 'CURSOR',
  'GITHUB', 'GODADDY', 'CLOUDFLARE', 'NAMECHEAP', 'GOOGLE*DOMAIN',
  'GOOGLE *CLOUD', 'DIGITALOCEAN', 'BOX, INC', 'BOX INC',
  'GOOGLE*GSUITE', 'GOOGLE *WORKSPACE',
];

// Hashed onto the UNIQUE dedup_hash column so re-importing a statement is a no-op.
export function txHash(date, amount, rawDescription, card) {
  const amt = Number(amount).toFixed(2);
  return `${date}|${amt}|${(rawDescription || '').slice(0, 30)}|${card}`;
}

export function isReimbursable(card) {
  return !PRIMARY_CARDS.has(card);
}

export function isBusinessVendor(rawDescription) {
  const upper = (rawDescription || '').toUpperCase();
  return BUSINESS_VENDOR_PATTERNS.some(p => upper.includes(p));
}

export function fmtMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export function cardOptions() {
  return Object.entries(CARD_DEFAULTS).map(([id, c]) => ({
    value: id,
    label: `x${id} ${c.label}${c.primary ? '' : ' — reimbursable'}`,
  }));
}

export function categoryOptions() {
  return Object.entries(CATEGORIES).map(([k, v]) => ({ value: k, label: v.name }));
}
