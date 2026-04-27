// Returns rows shaped for treasury_transactions; filterToPokerShark trims them at commit time.

import {
  POKER_SHARK_CARD,
  txHash, isReimbursable, isBusinessVendor,
} from './constants.js';
import { normalizeVendor } from './vendor-rules.js';

const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
let _pdfjsLib = null;

async function getPdfjs() {
  if (_pdfjsLib) return _pdfjsLib;
  const mod = await import(/* @vite-ignore */ PDFJS_URL);
  _pdfjsLib = mod.default || mod;
  if (_pdfjsLib.GlobalWorkerOptions && !_pdfjsLib.GlobalWorkerOptions.workerSrc) {
    _pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  }
  return _pdfjsLib;
}

export function parseFilenameMetadata(filename) {
  const m = filename.match(/(\d{4})(\d{2})(\d{2})-statements-(\d{4})/);
  if (!m) return null;
  return {
    statementDate: `${m[1]}-${m[2]}-${m[3]}`,
    card: m[4],
    year: parseInt(m[1]),
    month: parseInt(m[2]),
  };
}

export function detectTransactionType(desc) {
  const d = (desc || '').toUpperCase();
  if (d.includes('PAYMENT THANK YOU') || d.includes('AUTOMATIC PAYMENT')) return 'payment';
  if (d.includes('TRAVEL CREDIT') || d.includes('STATEMENT CREDIT')) return 'credit';
  if (d.includes('PURCHASE INTEREST') || d.includes('INTEREST CHARGE')) return 'interest';
  if (d.includes('FOREIGN TRANSACTION FEE') || d.includes('LATE FEE') || d.includes('ANNUAL FEE') || d.includes('CASH ADVANCE FEE')) return 'fee';
  return 'purchase';
}

function buildRow({ date, rawDesc, amount, card, source, sourceFile }) {
  const type = detectTransactionType(rawDesc);
  const norm = normalizeVendor(rawDesc);
  const flagged = isReimbursable(card) && type === 'purchase' && isBusinessVendor(rawDesc);
  const amt = Math.abs(Number(amount) || 0);
  return {
    date,
    vendor: norm.vendor,
    raw_description: rawDesc.trim(),
    amount: amt,
    card,
    category: type === 'purchase' ? norm.category : 'other_expense',
    type,
    business_pct: 100,
    notes: sourceFile ? `Imported from ${sourceFile}` : '',
    reviewed: false,
    flagged,
    source,
    reimbursable: isReimbursable(card),
    dedup_hash: txHash(date, amt, rawDesc, card),
  };
}

const SKIP_LINE = /^(MEXICAN PESO|CANADIAN DOLLAR|EURO|BRITISH POUND|TRANSACTIONS THIS CYCLE|TOTAL FEES|TOTAL INTEREST|Page \d|Date of|Transaction|Opening|Closing)/i;
// Amex Platinum: "MM/DD/YY[*] DESCRIPTION [STATE] [-]$AMOUNT"
const TX_LINE_AMEX = /^(\d{2}\/\d{2}\/\d{2})\*?\s+(.+?)\s+(-)?\$([\d,]+\.\d{2})\s*$/;
// Two-date Chase layout (Sapphire / Freedom / Amazon Visa): "MM/DD MM/DD DESCRIPTION AMOUNT"
const TX_LINE_TWO_DATES = /^(\d{2}\/\d{2})\s+\d{2}\/\d{2}\s+(.+?)\s+([-]?\$?[\d,]+\.\d{2})\s*$/;
// Single-date Chase layout (Ink Business): "MM/DD DESCRIPTION AMOUNT"
const TX_LINE = /^(\d{2}\/\d{2})\s+(?:&\s+)?(.+?)\s+([-]?\$?[\d,]+\.\d{2})\s*$/;
// Anything starting with MM/DD or MM/DD/YY — used for diagnostic logging when strict patterns miss
const CANDIDATE_LINE = /^\d{2}\/\d{2}(?:\/\d{2})?\b/;

// Items at slightly different Y values often belong to the same visual row
// (font baseline differences). Bucket size in PDF units.
const Y_BUCKET = 4;

async function extractPageRows(pdf, pageNum, ctx, diag) {
  const { card, closingYear, closingMonth, sourceFile } = ctx;
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();

  const itemsByY = {};
  for (const item of content.items) {
    if (!item.str || !item.str.trim()) continue;
    const y = Math.round(item.transform[5] / Y_BUCKET) * Y_BUCKET;
    (itemsByY[y] ||= []).push({ x: item.transform[4], str: item.str });
  }
  const lines = Object.keys(itemsByY)
    .map(Number)
    .sort((a, b) => b - a)
    .map(y => itemsByY[y].sort((a, b) => a.x - b.x).map(it => it.str).join(' '));

  if (diag.sample.length < 60) {
    for (const l of lines.slice(0, 25)) {
      const trimmed = l.trim();
      if (trimmed && diag.sample.length < 60) diag.sample.push(`p${pageNum}: ${trimmed}`);
    }
  }

  const rows = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || SKIP_LINE.test(line) || /EXCHG RATE/i.test(line)) continue;

    let date, rawDesc, amount;
    const amex = line.match(TX_LINE_AMEX);
    if (amex) {
      const [, dateStr, desc, sign, amtStr] = amex;
      const [mm, dd, yy] = dateStr.split('/').map(Number);
      date = `20${String(yy).padStart(2, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      rawDesc = desc;
      amount = parseFloat(amtStr.replace(/,/g, '')) * (sign === '-' ? -1 : 1);
    } else {
      const chase = line.match(TX_LINE_TWO_DATES) || line.match(TX_LINE);
      if (!chase) {
        if (CANDIDATE_LINE.test(line)) diag.unmatched.push(`p${pageNum}: ${line}`);
        continue;
      }
      const [, dateStr, desc, amtStr] = chase;
      const [mm, dd] = dateStr.split('/').map(Number);
      // Chase MM/DD has no year — infer from the statement closing date.
      const year = mm > closingMonth ? closingYear - 1 : closingYear;
      date = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      rawDesc = desc;
      amount = parseFloat(amtStr.replace(/[$,]/g, ''));
    }
    rows.push(buildRow({ date, rawDesc, amount, card, source: 'pdf', sourceFile }));
  }
  return rows;
}

export async function parseChasePDF(file, { cardOverride } = {}) {
  const pdfjsLib = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const meta = parseFilenameMetadata(file.name);
  const today = new Date();
  const dateMatch = file.name.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
  const ctx = {
    card: cardOverride || meta?.card || '',
    closingYear:  meta?.year  || (dateMatch ? parseInt(dateMatch[1]) : today.getFullYear()),
    closingMonth: meta?.month || (dateMatch ? parseInt(dateMatch[2]) : today.getMonth() + 1),
    sourceFile: file.name,
  };

  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (e) {
    return { rows: [], stats: { pages: 0, parsed: 0, errors: 0 }, error: e.message, sampleLines: [] };
  }

  const stats = { pages: pdf.numPages, parsed: 0, errors: 0 };
  const diag = { sample: [], unmatched: [] };
  const rows = [];

  for (let n = 1; n <= pdf.numPages; n++) {
    try {
      const pageRows = await extractPageRows(pdf, n, ctx, diag);
      stats.parsed++;
      rows.push(...pageRows);
    } catch (err) {
      stats.errors++;
      console.warn(`PDF page ${n} failed:`, err.message);
    }
  }
  if (rows.length === 0) {
    console.warn(`[Treasury] 0 transactions extracted from ${file.name}. First lines from each page:`);
    diag.sample.slice(0, 60).forEach(l => console.warn('  ', l));
  }
  if (diag.unmatched.length > 0) {
    console.warn(`[Treasury] ${file.name} — ${diag.unmatched.length} line(s) start with MM/DD but didn't match the transaction pattern:`);
    diag.unmatched.forEach(l => console.warn('  ', l));
  }
  return { rows, stats, error: null, sampleLines: diag.sample };
}

export function parseCSVRow(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

export function parseDate(str) {
  if (!str) return '';
  const s = String(str).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) return `20${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return '';
}

// Auto-detects date / description / amount columns by header name.
// Works on Chase ("Transaction Date,Post Date,Description,...,Amount,..."),
// Amex ("Date,Description,Card Member,Account #,Amount"),
// and most other bank CSV exports.
export function parseChaseCSV(csvText, defaultCard = POKER_SHARK_CARD) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = parseCSVRow(lines[0]).map(h => h.trim().toLowerCase());
  const dateCol   = pickColumn(header, /^(transaction\s*date|date|trans\.?\s*date)$/);
  const postCol   = pickColumn(header, /^post\s*date$/);
  const descCol   = pickColumn(header, /^(description|details|merchant|particulars)$/);
  const amountCol = pickColumn(header, /^(amount|debit|charge|amt)$/);

  // Resolve columns: header lookup first, else positional fallback.
  const dCol = dateCol   >= 0 ? dateCol
             : header.length >= 1 ? 0 : -1;
  const sCol = descCol   >= 0 ? descCol
             : header.length >= 3 ? 2                    // Chase-shaped (no header match)
             : header.length >= 2 ? 1 : -1;
  const aCol = amountCol >= 0 ? amountCol
             : header.length >= 6 ? 5                    // Chase-shaped
             : header.length >= 3 ? header.length - 1 : -1;
  if (dCol < 0 || sCol < 0 || aCol < 0) return [];

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    if (row.length <= Math.max(dCol, sCol, aCol)) continue;

    const date = parseDate(row[dCol]);
    const rawDesc = row[sCol] || '';
    const amount = parseFloat((row[aCol] || '0').replace(/[$,]/g, ''));
    if (!date || !rawDesc) continue;

    out.push(buildRow({
      date, rawDesc, amount, card: defaultCard, source: 'csv', sourceFile: 'csv-import',
    }));
  }
  return out;
}

function pickColumn(header, regex) {
  for (let i = 0; i < header.length; i++) if (regex.test(header[i])) return i;
  return -1;
}

// 'primary'      — Poker Shark Ink Business card (always business)
// 'reimbursable' — non-primary card + matches a known business vendor (owner reimbursement)
// 'personal'     — non-primary card + unrecognized vendor (probably personal spend)
export function classifyRow(row) {
  if (row.card === POKER_SHARK_CARD) return 'primary';
  if (row.flagged) return 'reimbursable';
  return 'personal';
}

// Used by the seed-JSON path where bulk pre-filtering is appropriate.
// PDF/CSV imports show all rows for review and skip this filter.
export function filterToPokerShark(rows) {
  const kept = [];
  const dropped = [];
  for (const r of rows) {
    if (classifyRow(r) === 'personal') dropped.push(r);
    else kept.push(r);
  }
  return { kept, dropped };
}
