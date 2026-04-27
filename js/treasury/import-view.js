import { esc } from '../utils.js';
import { showConfirm } from '../ui/modal.js';
import {
  POKER_SHARK_CARD, CARD_DEFAULTS, CATEGORIES, fmtMoney,
  txHash, isReimbursable,
} from './constants.js';
import { parseChasePDF, parseChaseCSV, filterToPokerShark, classifyRow } from './parsers.js';
import { bulkInsertTransactions, getTransactions } from './state.js';

let pending = [];
let droppedCount = 0;
let fileLog = [];
let csvCard = POKER_SHARK_CARD;
let csvText = '';
let pdfCardOverride = '';   // '' = detect from filename

export function renderImport(container) {
  container.innerHTML = `
    <div class="treasury-import-grid">
      <div class="treasury-card">
        <h3>Drop Statements</h3>
        <p class="treasury-card-hint">
          <strong>CSV is recommended.</strong> Download from Chase or Amex web portals
          (Account → Activity → Download → CSV). PDF parsing handles single-line
          transaction layouts but misses multi-line ones — use <strong>+ Add Transaction</strong>
          on the Transactions tab for any rows the parser skips.
        </p>
        <div class="treasury-pdf-card-row">
          <label class="treasury-pnl-field">Card
            <select id="treasuryPdfCard" class="treasury-input">
              <option value="" ${pdfCardOverride === '' ? 'selected' : ''}>(detect from filename)</option>
              ${Object.entries(CARD_DEFAULTS).map(([id, c]) => `<option value="${id}" ${id === pdfCardOverride ? 'selected' : ''}>x${id} ${c.label}</option>`).join('')}
            </select>
          </label>
          <span class="treasury-card-hint" style="margin:0">Required for PDFs without the <code>YYYYMMDD-statements-NNNN-.pdf</code> filename pattern, and for all Amex / non-Chase PDFs.</span>
        </div>
        <div class="treasury-dropzone" id="treasuryDropZone">
          <div class="treasury-dropzone-icon">▼</div>
          <div>Drop CSV or PDF files here</div>
          <div class="treasury-dropzone-hint">or click to browse</div>
          <input type="file" id="treasuryFileInput" multiple accept=".pdf,.csv" hidden>
        </div>
        <div class="treasury-file-log" id="treasuryFileLog">${fileLog.map(fileLogHTML).join('')}</div>
      </div>

      <div class="treasury-card">
        <h3>CSV Paste</h3>
        <select id="treasuryCsvCard" class="treasury-input">
          ${Object.entries(CARD_DEFAULTS).map(([id, c]) => `<option value="${id}" ${id === csvCard ? 'selected' : ''}>x${id} ${c.label}</option>`).join('')}
        </select>
        <textarea id="treasuryCsvText" class="treasury-csv-paste" rows="8" placeholder="Transaction Date,Post Date,Description,Category,Type,Amount,Memo&#10;01/15/2026,01/16/2026,RENDER.COM,Services,Sale,-29.00,">${esc(csvText)}</textarea>
        <button class="btn treasury-add-btn" id="treasuryCsvParseBtn">Parse & Preview</button>
      </div>
    </div>

    ${pending.length > 0 ? previewHTML() : ''}

    <div class="treasury-card treasury-seed-card">
      <h3>Seed from receipts.html export</h3>
      <p class="treasury-card-hint">One-time migration: open the old receipts tool → Import tab → "Export All (JSON)". Then drop that JSON here. Only Poker Shark + business-vendor reimbursable rows will be imported.</p>
      <input type="file" id="treasurySeedInput" accept=".json" hidden>
      <button class="btn treasury-add-btn" id="treasurySeedBtn">Import seed JSON…</button>
    </div>
  `;

  // Drop zone
  const dz = container.querySelector('#treasuryDropZone');
  const fi = container.querySelector('#treasuryFileInput');
  dz.addEventListener('click', () => fi.click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('dragover');
    handleFiles(e.dataTransfer.files, container);
  });
  fi.addEventListener('change', () => handleFiles(fi.files, container));
  container.querySelector('#treasuryPdfCard').addEventListener('change', e => { pdfCardOverride = e.target.value; });

  // CSV paste
  container.querySelector('#treasuryCsvCard').addEventListener('change', e => { csvCard = e.target.value; });
  container.querySelector('#treasuryCsvText').addEventListener('input', e => { csvText = e.target.value; });
  container.querySelector('#treasuryCsvParseBtn').addEventListener('click', () => {
    if (!csvText.trim()) { alert('Paste some CSV first.'); return; }
    const rows = parseChaseCSV(csvText, csvCard);
    if (rows.length === 0) { alert('No transactions found in the pasted CSV.'); return; }
    addToPending(rows, 'csv-paste', container);
  });

  // Preview commit / cancel
  if (pending.length > 0) {
    container.querySelector('#treasuryCommitBtn').addEventListener('click', () => commit(container));
    container.querySelector('#treasuryCancelBtn').addEventListener('click', () => {
      pending = [];
      droppedCount = 0;
      renderImport(container);
    });
    const dropBtn = container.querySelector('#treasuryDropPersonalBtn');
    if (dropBtn) dropBtn.addEventListener('click', () => {
      pending = pending.filter(r => classifyRow(r) !== 'personal');
      renderImport(container);
    });
    container.querySelectorAll('[data-pending-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        pending.splice(parseInt(btn.dataset.pendingRemove), 1);
        renderImport(container);
      });
    });
  }

  // Seed import
  const seedBtn = container.querySelector('#treasurySeedBtn');
  const seedInput = container.querySelector('#treasurySeedInput');
  seedBtn.addEventListener('click', () => seedInput.click());
  seedInput.addEventListener('change', () => handleSeedFile(seedInput.files[0], container));
}

async function handleFiles(fileList, container) {
  const files = Array.from(fileList || []);
  if (files.length === 0) return;
  for (const file of files) {
    const entry = { name: file.name, status: 'parsing', message: 'Parsing…', rowCount: 0 };
    fileLog.push(entry);
    renderFileLog(container);

    try {
      let rows = [];
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.pdf')) {
        const result = await parseChasePDF(file, { cardOverride: pdfCardOverride });
        if (result.error) {
          entry.status = 'error';
          entry.message = result.error;
        } else {
          rows = result.rows;
          entry.status = result.stats.errors > 0 ? 'partial' : (rows.length === 0 ? 'partial' : 'ok');
          entry.message = rows.length === 0
            ? `0 rows · ${result.stats.parsed}/${result.stats.pages} pages — open DevTools console for raw text`
            : `${rows.length} rows · ${result.stats.parsed}/${result.stats.pages} pages`;
          entry.rowCount = rows.length;
        }
      } else if (lower.endsWith('.csv')) {
        const text = await file.text();
        const filenameMeta = file.name.match(/(\d{4})\D/);
        const card = pdfCardOverride
          || (filenameMeta && CARD_DEFAULTS[filenameMeta[1]] ? filenameMeta[1] : POKER_SHARK_CARD);
        rows = parseChaseCSV(text, card);
        entry.status = rows.length === 0 ? 'partial' : 'ok';
        entry.message = rows.length === 0
          ? '0 rows — check that the CSV has Date / Description / Amount columns'
          : `${rows.length} rows`;
        entry.rowCount = rows.length;
      } else {
        entry.status = 'error';
        entry.message = 'Unsupported file type';
      }
      addToPending(rows, file.name, container);
    } catch (e) {
      entry.status = 'error';
      entry.message = e.message || String(e);
      renderFileLog(container);
    }
  }
}

function addToPending(rows, sourceLabel, container) {
  if (rows.length === 0) { renderImport(container); return; }
  pending = pending.concat(rows);
  renderImport(container);
}

function previewHTML() {
  const total = pending.reduce((s, r) => s + (r.type === 'purchase' ? r.amount : 0), 0);
  const counts = { primary: 0, reimbursable: 0, personal: 0 };
  for (const r of pending) counts[classifyRow(r)]++;
  return `
    <div class="treasury-card treasury-preview-card">
      <div class="treasury-preview-head">
        <h3>Preview — ${pending.length} rows ready, ${fmtMoney(total)} in purchases</h3>
        <div class="treasury-preview-summary">
          <span class="treasury-pill treasury-pill-primary">${counts.primary} Poker Shark</span>
          <span class="treasury-pill treasury-pill-reimburse">${counts.reimbursable} Reimbursable</span>
          <span class="treasury-pill treasury-pill-personal">${counts.personal} Personal?</span>
        </div>
      </div>
      <div class="treasury-table-wrap" style="max-height:380px">
        <table class="treasury-table">
          <thead><tr>
            <th>Class</th><th>Date</th><th>Vendor</th><th>Description</th><th class="num">Amount</th>
            <th>Card</th><th>Category</th><th>Type</th><th></th>
          </tr></thead>
          <tbody>
            ${pending.map((r, i) => previewRowHTML(r, i)).join('')}
          </tbody>
        </table>
      </div>
      <div class="treasury-preview-actions">
        <button class="btn" id="treasuryCancelBtn">Discard all</button>
        ${counts.personal > 0 ? `<button class="btn" id="treasuryDropPersonalBtn">Drop ${counts.personal} personal rows</button>` : ''}
        <span style="flex:1"></span>
        <button class="btn treasury-add-btn" id="treasuryCommitBtn">Commit ${pending.length} rows</button>
      </div>
    </div>
  `;
}

function previewRowHTML(r, i) {
  const cat = CATEGORIES[r.category] || CATEGORIES.other_expense;
  const cls = classifyRow(r);
  return `
    <tr class="treasury-class-${cls}">
      <td><span class="treasury-pill treasury-pill-${cls === 'primary' ? 'primary' : cls === 'reimbursable' ? 'reimburse' : 'personal'}">${cls}</span></td>
      <td>${esc(r.date)}</td>
      <td>${esc(r.vendor)}</td>
      <td class="treasury-desc">${esc(r.raw_description)}</td>
      <td class="num">${fmtMoney(r.amount)}</td>
      <td>x${esc(r.card)}</td>
      <td><span class="treasury-cat-pill" style="color:${cat.color};border-color:${cat.color}">${cat.name}</span></td>
      <td>${esc(r.type)}</td>
      <td><button class="btn-mini" data-pending-remove="${i}">Drop</button></td>
    </tr>
  `;
}

function renderFileLog(container) {
  const el = container.querySelector('#treasuryFileLog');
  if (el) el.innerHTML = fileLog.map(fileLogHTML).join('');
}

function fileLogHTML(f) {
  const colorByStatus = { ok: 'var(--radiant)', partial: 'var(--orange)', error: 'var(--dire)', parsing: 'var(--text3)' };
  return `
    <div class="treasury-file-row">
      <span class="treasury-file-dot" style="background:${colorByStatus[f.status] || 'var(--text3)'}"></span>
      <span class="treasury-file-name">${esc(f.name)}</span>
      <span class="treasury-file-msg">${esc(f.message)}</span>
    </div>
  `;
}

async function commit(container) {
  if (pending.length === 0) return;
  const btn = container.querySelector('#treasuryCommitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Committing…'; }
  try {
    const before = getTransactions().length;
    await bulkInsertTransactions(pending);
    const after = getTransactions().length;
    const inserted = after - before;
    const skipped = pending.length - inserted;
    pending = [];
    droppedCount = 0;
    fileLog = [];
    renderImport(container);
    alert(`Committed ${inserted} new rows.${skipped > 0 ? ` ${skipped} duplicates skipped (already in Treasury).` : ''}`);
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = `Commit ${pending.length} rows`; }
    alert('Commit failed: ' + (e.message || e));
  }
}

async function handleSeedFile(file, container) {
  if (!file) return;
  let json;
  try {
    const text = await file.text();
    json = JSON.parse(text);
  } catch (e) {
    alert('Could not parse JSON file.'); return;
  }
  // receipts.html export shape: { transactions: [...], revenue: [...], vendorRules: {...} }
  const txs = Array.isArray(json) ? json : (json.transactions || []);
  if (txs.length === 0) { alert('No transactions found in JSON.'); return; }

  const rows = txs
    .filter(t => t && t.date && t.amount !== undefined && t.card)
    .map(convertReceiptsRow);
  // Seed-time filter uses the original entity field so manually-categorized rows are kept.
  const kept = rows.filter(r => r._entity === 'pokershark' || r.flagged || r.card === POKER_SHARK_CARD);
  const dropped = rows.length - kept.length;
  // Strip the transient _entity before insert.
  for (const r of kept) delete r._entity;

  showConfirm({
    title: 'Import seed JSON?',
    message: `${kept.length} Poker Shark rows ready (${dropped} non-Poker-Shark rows skipped). Existing duplicates skip automatically. Review the preview before committing.`,
    onConfirm: async () => {
      pending = kept;
      fileLog.push({ name: file.name, status: 'ok', message: `${kept.length} rows ready, ${dropped} non-Poker-Shark skipped`, rowCount: kept.length });
      renderImport(container);
    },
  });
}

function convertReceiptsRow(t) {
  const rawDesc = t.rawDescription || t.raw_description || t.vendor || '';
  const amount = Math.abs(Number(t.amount) || 0);
  const card = String(t.card || POKER_SHARK_CARD);
  // receipts.html let the user manually move rows to entity=pokershark even when
  // the auto-flagger missed them. Treat those as flagged for Treasury purposes.
  const flagged = !!t.flagged || (t.entity === 'pokershark' && card !== POKER_SHARK_CARD);
  return {
    date: t.date,
    vendor: t.vendor || rawDesc,
    raw_description: rawDesc,
    amount,
    card,
    category: t.category || 'other_expense',
    type: t.type || 'purchase',
    business_pct: t.businessPct ?? t.business_pct ?? 100,
    notes: t.notes || '',
    reviewed: !!t.reviewed,
    flagged,
    source: 'seed',
    reimbursable: isReimbursable(card),
    dedup_hash: txHash(t.date, amount, rawDesc, card),
    _entity: t.entity,                                  // transient — used by the seed filter
  };
}
