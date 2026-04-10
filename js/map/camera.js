// Virtual camera for zoom + pan
// All map coordinates are in percentage space (0-100)

export class Camera {
  constructor() {
    this.x = 35;       // Center of viewport in map-percent (start near Radiant mid)
    this.y = 60;
    this.zoom = 2.0;
    this.minZoom = 1;
    this.maxZoom = 4;
    this._prevZoom = 2.0;
  }

  // Visible rectangle in map-percent coords
  getView(containerW, containerH) {
    const aspect = containerW / containerH;
    const viewH = 100 / this.zoom;
    const viewW = viewH * aspect;
    return {
      x: this.x - viewW / 2,
      y: this.y - viewH / 2,
      w: viewW,
      h: viewH
    };
  }

  // SVG viewBox string (in pixel coords matching container)
  svgViewBox(W, H) {
    const v = this.getView(W, H);
    return `${v.x * W / 100} ${v.y * H / 100} ${v.w * W / 100} ${v.h * H / 100}`;
  }

  // Apply camera transform to canvas context
  // Must exactly match SVG viewBox: map view rect (in pixels) → fill container (0,0,W,H)
  applyToCtx(ctx, W, H) {
    const v = this.getView(W, H);
    // View rect in pixel coords (same space SVG elements are positioned in)
    const vxPx = v.x * W / 100, vyPx = v.y * H / 100;
    const vwPx = v.w * W / 100, vhPx = v.h * H / 100;
    // Scale so that vwPx pixels fill W container pixels (same for height)
    ctx.save();
    ctx.setTransform(W / vwPx, 0, 0, H / vhPx, -(vxPx * W / vwPx), -(vyPx * H / vhPx));
  }

  restoreCtx(ctx) {
    ctx.restore();
  }

  // Convert screen pixel position (relative to container) to map percentage coords
  screenToMap(clientX, clientY, containerRect, containerW, containerH) {
    const sx = (clientX - containerRect.left) / containerRect.width;
    const sy = (clientY - containerRect.top) / containerRect.height;
    const v = this.getView(containerW, containerH);
    return {
      x: v.x + sx * v.w,
      y: v.y + sy * v.h
    };
  }

  panTo(x, y) {
    this.x = clamp(x, 0, 100);
    this.y = clamp(y, 0, 100);
  }

  panBy(dxScreen, dyScreen, containerW, containerH) {
    const v = this.getView(containerW, containerH);
    this.x = clamp(this.x - (dxScreen / containerW) * v.w, 0, 100);
    this.y = clamp(this.y - (dyScreen / containerH) * v.h, 0, 100);
  }

  zoomBy(delta, pivotScreenX, pivotScreenY, containerRect, containerW, containerH) {
    const oldZoom = this.zoom;
    this.zoom = clamp(this.zoom * (1 + delta), this.minZoom, this.maxZoom);
    if (this.zoom === oldZoom) return;

    // Convert pivot screen position to map coords before zoom, then adjust
    // camera so that map point stays under the cursor after zoom
    const sx = (pivotScreenX - containerRect.left) / containerRect.width;
    const sy = (pivotScreenY - containerRect.top) / containerRect.height;
    const aspect = containerW / containerH;
    const oldViewH = 100 / oldZoom, oldViewW = oldViewH * aspect;
    const newViewH = 100 / this.zoom, newViewW = newViewH * aspect;
    // Pivot in map coords (before zoom): camX + (sx-0.5) * oldViewW
    const pivotMapX = this.x + (sx - 0.5) * oldViewW;
    const pivotMapY = this.y + (sy - 0.5) * oldViewH;
    // After zoom, pivot should still be at (sx, sy) on screen
    this.x = clamp(pivotMapX - (sx - 0.5) * newViewW, 0, 100);
    this.y = clamp(pivotMapY - (sy - 0.5) * newViewH, 0, 100);
  }

  toggleBirdseye() {
    if (this.zoom <= 1.05) {
      this.zoom = this._prevZoom || 2.0;
    } else {
      this._prevZoom = this.zoom;
      this.zoom = 1.0;
      this.x = 50;
      this.y = 50;
    }
  }

  get isBirdseye() { return this.zoom <= 1.05; }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
