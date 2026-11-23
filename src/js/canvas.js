// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// Canvas sizing and drawing primitives, in CSS pixels. Lines are never thinner than one pixel, so
// that they do not vanish when the view is small.

// Canvas sizes come from a ResizeObserver, so the animation loop never has to read the layout.
const canvasSize = new Map();
const resizeObserver =
  typeof ResizeObserver === 'function'
    ? new ResizeObserver((entries) => {
        for (const e of entries) {
          canvasSize.set(e.target, { width: e.contentRect.width, height: e.contentRect.height });
          if (e.target.id === 'sup') drawSupportDemo();
        }
        invalidate();
      })
    : null;
addEventListener('resize', () => {
  invalidate();
  drawSupportDemo();
});

/** Matches the canvas backing store to its size on screen; returns the size in CSS pixels. */
function fit(c, g) {
  let r = canvasSize.get(c);
  if (!r) {
    r = c.getBoundingClientRect();
    if (resizeObserver) {
      canvasSize.set(c, { width: r.width, height: r.height });
      resizeObserver.observe(c);
    }
  }
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: r.width, h: r.height };
}

function poly(g, pts, fill, stroke, lw) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.lineJoin = 'round';
    g.stroke();
  }
}

function line(g, a, b, col, lw) {
  g.strokeStyle = col;
  g.lineWidth = Math.max(lw, 1);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.stroke();
}

function disc(g, c, r, fill) {
  g.fillStyle = fill;
  g.beginPath();
  g.arc(c[0], c[1], r, 0, Math.PI * 2);
  g.fill();
}

function ring(g, c, r, col, lw, a0 = 0, a1 = Math.PI * 2) {
  g.strokeStyle = col;
  g.lineWidth = Math.max(lw, 1);
  g.beginPath();
  g.arc(c[0], c[1], r, a0, a1);
  g.stroke();
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
