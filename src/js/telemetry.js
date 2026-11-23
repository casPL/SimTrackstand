// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// The last 12 seconds: lean of the bike and of the CoG, the handlebar, the hips and the rolling.

const teleCanvas = $('tele');
const tctx = teleCanvas.getContext('2d');
const TELE_SPAN = 12;
const TELE_DEG = 15;

function recordTrace() {
  trace.push({
    t: S.t,
    phi: deg(S.phi),
    cog: deg(S.cogLean),
    d: S.d / (BIKE.lock * RAD),
    body: S.u / BIKE.du,
    roll: S.x / ROLL_SCALE,
  });
  while (trace.length && trace[0].t < S.t - TELE_SPAN - 0.5) trace.shift();
  teleDirty = true;
}

function drawTele() {
  const { w, h } = fit(teleCanvas, tctx);
  tctx.clearRect(0, 0, w, h);
  const tEnd = Math.max(TELE_SPAN, S.t);
  const tx = (t) => ((t - (tEnd - TELE_SPAN)) / TELE_SPAN) * w;
  const top = 8,
    bot = h - 6;
  const mid = (top + bot) / 2;
  const ty = (d) => mid - (clamp(d, -TELE_DEG, TELE_DEG) / TELE_DEG) * ((bot - top) / 2);
  tctx.lineWidth = 1;
  tctx.font = `10px ${FONT_MONO}`;
  tctx.textAlign = 'left';
  tctx.strokeStyle = alpha(COL.rule, 0.7);
  tctx.fillStyle = COL.dim;
  tctx.beginPath();
  for (let d = -10; d <= 10; d += 5) {
    tctx.moveTo(0, ty(d));
    tctx.lineTo(w, ty(d));
    if (d) tctx.fillText((d > 0 ? i18n`P ` : i18n`L `) + Math.abs(d) + '°', 3, ty(d) - 3);
  }
  tctx.stroke();
  tctx.fillStyle = 'rgba(239,83,80,0.08)';
  tctx.fillRect(0, top, w, ty(DAB_DEG) - top);
  tctx.fillRect(0, ty(-DAB_DEG), w, bot - ty(-DAB_DEG));
  if (trace.length < 2) return;
  const plot = (f, col, lw, dash) => {
    tctx.strokeStyle = col;
    tctx.lineWidth = lw;
    tctx.setLineDash(dash || []);
    tctx.beginPath();
    trace.forEach((p, i) => (i ? tctx.lineTo(tx(p.t), f(p)) : tctx.moveTo(tx(p.t), f(p))));
    tctx.stroke();
    tctx.setLineDash([]);
  };
  plot((p) => mid - p.body * (bot - top) * 0.22, alpha(COL.spd, 0.85), 1.2);
  plot((p) => mid - clamp(p.roll, -1.5, 1.5) * (bot - top) * 0.3, alpha(COL.warn, 0.9), 1.2, [2, 3]);
  plot((p) => mid - p.d * (bot - top) * 0.4, alpha(COL.cone, 0.9), 1.4, [5, 3]);
  plot((p) => ty(p.cog), COL.ok, 1.6);
  plot((p) => ty(p.phi), COL.chalk, 2);
}
