import { STATE, saveLocal } from '../state.js';
import { label } from '../labels.js';

export function renderIntelPanel() {
  const panel = document.getElementById('intelPanel');
  const collapsed = STATE.intelCollapsed;
  panel.classList.toggle('collapsed', collapsed);

  let html = `<button class="panel-toggle" id="intelToggle">${collapsed ? '◀' : label('intelHeader') + ' ▶'}</button>`;

  ['mid', 'top', 'bot'].forEach(lane => {
    const data = STATE.intel[lane];
    html += `<div class="intel-card">
      <div class="intel-title ${lane}">${data.title} <span style="float:right;font-size:9px;color:var(--text3)">${data.status}</span></div>
      ${data.items.map(i => `<div class="intel-row"><div class="dot ${i.type}"></div><span>${i.text}</span></div>`).join('')}
    </div>`;
  });

  const gaps = STATE.intel.gaps;
  html += `<div class="intel-card">
    <div class="intel-title general">${gaps.title}</div>
    ${gaps.items.map(i => `<div class="intel-row"><div class="dot ${i.type}"></div><span>${i.text}</span></div>`).join('')}
  </div>`;

  html += `<div class="intel-card">
    <div class="intel-title" style="color:var(--dire)">${label('direSection')}</div>
    ${STATE.dire.map(d => `<div class="competitor-entry">
      <div class="comp-icon">?</div>
      <div style="flex:1">
        <div class="comp-name">${d.name}</div>
        <div class="comp-detail">${d.desc}</div>
        <div class="threat-bar"><div class="threat-fill" style="width:${d.threat}%;background:${d.color}"></div></div>
      </div>
    </div>`).join('')}
  </div>`;

  panel.innerHTML = html;

  document.getElementById('intelToggle').addEventListener('click', () => {
    STATE.intelCollapsed = !STATE.intelCollapsed;
    renderIntelPanel();
    panel.addEventListener('transitionend', function h() {
      panel.removeEventListener('transitionend', h);
      window.dispatchEvent(new Event('resize'));
    });
    saveLocal();
  });
}
