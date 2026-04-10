import { esc } from '../utils.js';

export function initTooltip(svgRoot) {
  const tooltip = document.getElementById('tooltip');

  function show(e, title, desc, status) {
    tooltip.innerHTML = `<div class="tt-title">${esc(title)}</div><div class="tt-sub">${esc(desc)}</div>${status ? `<div class="tt-status">${esc(status)}</div>` : ''}`;
    tooltip.style.display = 'block';
    position(e);
  }

  function position(e) {
    let x = e.clientX + 12, y = e.clientY + 12;
    if (x + 220 > window.innerWidth) x = e.clientX - 232;
    if (y + 100 > window.innerHeight) y = e.clientY - 112;
    tooltip.style.left = x + 'px'; tooltip.style.top = y + 'px';
  }

  function hide() { tooltip.style.display = 'none'; }

  document.addEventListener('mousemove', e => { if (tooltip.style.display === 'block') position(e); });
  svgRoot.addEventListener('mouseover', e => {
    const g = e.target.closest('[data-tt-title]');
    if (g) show(e, g.dataset.ttTitle, g.dataset.ttDesc, g.dataset.ttStatus);
  });
  svgRoot.addEventListener('mouseout', e => { if (e.target.closest('[data-tt-title]')) hide(); });

  return { show, hide };
}
