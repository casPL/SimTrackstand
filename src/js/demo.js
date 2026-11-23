// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// The support diagram under the game: contact patches from above for a chosen steering angle.

const demoCanvas = $('sup');
const demoCtx = demoCanvas.getContext('2d');

function drawSupportDemo() {
  const g = demoCtx;
  const { w, h } = fit(demoCanvas, g);
  g.clearRect(0, 0, w, h);
  const c = prep(cfg.p);
  const d = Number($('supr').value) * RAD;
  const sup = support(c, d);
  const side = sup.mid < -0.001 ? i18n`w lewo` : sup.mid > 0.001 ? i18n`w prawo` : '';
  $('supv').textContent =
    i18n`pas ±${fmt(sup.half * 100, 1)} cm` +
    (side ? ' · ' + i18n`środek ${fmt(Math.abs(sup.mid) * 100, 1)} cm ${side}` : '');
  // Lengthwise the bike is drawn across the canvas; sideways five times larger.
  const LAT = 5;
  const sx = (w - 70) / (BIKE.L + 0.5);
  const ox = 26,
    oy = h / 2;
  const at = (bx, by) => [ox + (bx + 0.25) * sx, oy + by * sx * LAT];
  // Patches magnified LAT times about their centres, so their true shape and angle show.
  const patch = (x0, y0, wd, ln, a) => {
    const [px, py] = at(x0, y0);
    const k = sx * LAT;
    return [
      [-ln / 2, -wd / 2],
      [ln / 2, -wd / 2],
      [ln / 2, wd / 2],
      [-ln / 2, wd / 2],
    ].map(([p, q]) => [px + (p * Math.cos(a) - q * Math.sin(a)) * k, py + (p * Math.sin(a) + q * Math.cos(a)) * k]);
  };
  const rp = patch(0, 0, c.wr, c.lr, 0);
  const fp = patch(BIKE.L, frontShift(d), c.wf, c.lf, groundSteer(d));
  poly(g, hull([...rp, ...fp]), alpha(COL.ok, 0.14), alpha(COL.ok, 0.5), 1);
  line(g, at(-0.1, 0), at(BIKE.L + 0.1, 0), alpha(COL.chalk, 0.3), 1);
  poly(g, rp, '#c9cdd1');
  poly(g, fp, '#c9cdd1');
  line(g, at(BIKE.b, sup.mid - sup.half), at(BIKE.b, sup.mid + sup.half), COL.ok, 3);
  disc(g, at(BIKE.b, 0), 5, COL.chalk);
  g.font = `500 11px ${FONT_MONO}`;
  g.fillStyle = COL.muted;
  g.textAlign = 'left';
  g.fillText(i18n`tył`, 4, oy + 4);
  g.textAlign = 'right';
  g.fillText(i18n`przód`, w - 2, oy + 4);
  g.textAlign = 'center';
  g.fillText(i18n`środek ciężkości`, at(BIKE.b, 0)[0], 14);
  g.fillText(i18n`w bok ×${LAT}`, at(BIKE.b, 0)[0], h - 4);
  g.textAlign = 'right';
  g.fillStyle = COL.dim;
  g.fillText(i18n`lewa strona`, w - 2, 14);
  g.fillText(i18n`prawa strona`, w - 2, h - 4);
}
$('supr').addEventListener('input', drawSupportDemo);
