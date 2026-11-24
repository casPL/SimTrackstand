// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// The support diagram under the game: the tyres and their contact patches from above, to scale, for
// a chosen steering angle, with both patches enlarged below.

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
  g.font = `500 11px ${FONT_MONO}`;

  // The whole bike from above, front to the right, the right side down, laid out for the bars at
  // full lock either way, so that nothing but the front tyre moves with the slider.
  const span = BIKE.L + 2 * BIKE.rr + 0.06;
  const k1 = Math.min((w - 16) / span, 150);
  const x0 = (w - span * k1) / 2;
  const al = groundSteer(BIKE.lock * RAD);
  const reach = ((BIKE.trail + BIKE.rr - BIKE.tf / 2) * Math.sin(al) + BIKE.tf / 2) * k1;
  const rearH = (BIKE.tr / 2) * k1;
  const oy = 24 + reach;
  const at = (bx, by) => [x0 + (bx + BIKE.rr + 0.03) * k1, oy + by * k1];
  line(g, at(-BIKE.rr, 0), at(BIKE.L + BIKE.rr, 0), alpha(COL.chalk, 0.16), 1);
  const { rear, front } = drawTyresTop(g, at, c, d, 1);
  poly(g, hull([...rear, ...front]), alpha(COL.ok, 0.16), alpha(COL.ok, 0.55), 1);
  poly(g, rear, '#c9cdd1');
  poly(g, front, '#c9cdd1');
  line(g, at(BIKE.b, sup.mid - sup.half), at(BIKE.b, sup.mid + sup.half), COL.ok, 3);
  const [gx, gy] = at(BIKE.b, 0);
  line(g, [gx, 19], [gx, gy - 0.08 * k1 - 2], alpha(COL.chalk, 0.2), 1);
  disc(g, [gx, gy], 3.5, COL.chalk);
  g.fillStyle = COL.muted;
  g.textAlign = 'center';
  g.fillText(i18n`środek ciężkości`, gx, 14);
  const left = Math.max(4, x0),
    right = Math.min(w - 4, w - x0);
  g.fillStyle = COL.dim;
  g.textAlign = 'left';
  g.fillText(i18n`tył`, left, 14);
  g.fillText(i18n`lewa strona`, left, oy - rearH - 6);
  g.fillText(i18n`prawa strona`, left, oy + rearH + 13);
  g.textAlign = 'right';
  g.fillText(i18n`przód`, right, 14);
  g.fillText(i18n`w skali`, at(BIKE.L - 0.3, 0)[0], oy + rearH + 13);

  // Both patches enlarged to the same scale: the rear one, and the front one with the point where its
  // steering axis meets the ground. The labels keep a strip at the top of each box to themselves.
  const top = oy + reach + 12;
  const bh = h - top - 2,
    bwR = (w - 10) * 0.4,
    bwF = w - 10 - bwR;
  const k2 = Math.min(bwR / 0.18, bwF / 0.3, (bh - 16) / 0.24);
  const box = (bx0, bw, cx, label, draw) => {
    g.save();
    g.beginPath();
    g.rect(bx0, top, bw, bh);
    g.clip();
    g.fillStyle = alpha(COL.asphalt, 0.5);
    g.fillRect(bx0, top, bw, bh);
    const my = top + 16 + (bh - 16) / 2;
    const atZ = (bx, by) => [bx0 + bw / 2 + (bx - cx) * k2, my + by * k2];
    const hw = bw / 2 / k2;
    // A 5 cm grid, so that the size of the patches reads at a glance.
    g.strokeStyle = alpha(COL.chalk, 0.07);
    g.lineWidth = 1;
    g.beginPath();
    for (let i = Math.ceil((cx - hw) / 0.05); i * 0.05 < cx + hw; i++) {
      const [px] = atZ(i * 0.05, 0);
      g.moveTo(px, top);
      g.lineTo(px, top + bh);
    }
    for (let i = Math.ceil((top - my) / k2 / 0.05); i * 0.05 < (top + bh - my) / k2; i++) {
      const [, py] = atZ(0, i * 0.05);
      g.moveTo(bx0, py);
      g.lineTo(bx0 + bw, py);
    }
    g.stroke();
    line(g, atZ(cx - hw, 0), atZ(cx + hw, 0), alpha(COL.chalk, 0.25), 1);
    draw(atZ);
    g.restore();
    g.strokeStyle = COL.rule;
    g.strokeRect(bx0 + 0.5, top + 0.5, bw - 1, bh - 1);
    g.fillStyle = COL.muted;
    g.textAlign = 'left';
    g.fillText(label, bx0 + 5, top + 13);
  };
  box(4, bwR, 0, i18n`tył`, (atZ) => drawTyresTop(g, atZ, c, d, 1.5));
  box(6 + bwR, bwF, BIKE.L + 0.04, i18n`przód`, (atZ) => {
    drawTyresTop(g, atZ, c, d, 1.5);
    const ax = atZ(BIKE.L + BIKE.trail, 0);
    ring(g, ax, 4, COL.cone, 1.5);
    // The label goes to the side the patch has not swung to.
    const text = i18n`oś skrętu`;
    const half = g.measureText(text).width / 2;
    g.fillStyle = COL.cone;
    g.textAlign = 'center';
    g.fillText(text, Math.min(ax[0], w - 8 - half), ax[1] + (d >= 0 ? 24 : -12));
  });
  g.fillStyle = COL.dim;
  g.textAlign = 'right';
  g.fillText(i18n`kratka 5 cm`, bwR - 1, top + bh - 6);
}
$('supr').addEventListener('input', drawSupportDemo);
