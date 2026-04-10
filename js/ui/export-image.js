import { downloadBlob } from '../utils.js';

export function exportMapImage(terrainCanvas, fogCanvas, svgRoot) {
  const W = terrainCanvas.width, H = terrainCanvas.height;

  // Create composite canvas
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Layer 1: Terrain
  ctx.drawImage(terrainCanvas, 0, 0);

  // Layer 2: SVG — serialize and draw as image
  // Clone SVG and replace cross-origin <image> elements with circles
  const svgClone = svgRoot.cloneNode(true);
  svgClone.querySelectorAll('image').forEach(img => {
    const cx = parseFloat(img.getAttribute('x')) + parseFloat(img.getAttribute('width')) / 2;
    const cy = parseFloat(img.getAttribute('y')) + parseFloat(img.getAttribute('height')) / 2;
    const r = parseFloat(img.getAttribute('width')) / 2;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', r);
    circle.setAttribute('fill', 'rgba(77,204,112,0.3)'); circle.setAttribute('stroke', '#4dcc70'); circle.setAttribute('stroke-width', '1');
    img.parentNode.replaceChild(circle, img);
  });

  // Set explicit dimensions on SVG for serialization
  svgClone.setAttribute('width', W);
  svgClone.setAttribute('height', H);
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const svgString = new XMLSerializer().serializeToString(svgClone);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(svgUrl);

    // Layer 3: Fog
    ctx.drawImage(fogCanvas, 0, 0);

    // Download
    canvas.toBlob(blob => {
      if (blob) downloadBlob(blob, 'strategy-' + new Date().toISOString().slice(0, 10) + '.png');
    }, 'image/png');
  };
  img.onerror = () => {
    URL.revokeObjectURL(svgUrl);
    ctx.drawImage(fogCanvas, 0, 0);
    canvas.toBlob(blob => {
      if (blob) downloadBlob(blob, 'strategy-' + new Date().toISOString().slice(0, 10) + '.png');
    }, 'image/png');
  };
  img.src = svgUrl;
}
