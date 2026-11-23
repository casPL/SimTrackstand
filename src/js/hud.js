// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// Heads-up display over the scene: time or the load on the foot, lean gauge with the CoG, the hips
// and the handlebar.

function panel(x, y, w, h) {
  ctx.fillStyle = alpha(COL.asphalt, 0.74);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 6);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

/** Kilograms without a minus sign in front of a zero. */
const kg = (n) => fmt(Math.abs(n) < 0.5 ? 0 : n, 0);

function drawHud(w, h, supW, narrow) {
  const u = clamp(w / 900, 0.72, 1.2);
  const mono = (s, wgt = 500) => `${wgt} ${s * u}px ${FONT_MONO}`;
  const disp = (s) => `700 ${s * u}px ${FONT_DISPLAY}`;

  // Time, or while the foot is down, the load on it.
  panel(10, 10, 186 * u, 96 * u);
  ctx.textAlign = 'left';
  ctx.font = mono(10.5);
  if (phase === 'setup') {
    const load = S.footLoad / G;
    const near = Math.abs(load) < 2 ? COL.ok : Math.abs(load) < 6 ? COL.warn : COL.chalk;
    ctx.fillStyle = COL.warn;
    ctx.fillText(i18n`STOPA NA ZIEMI`, 20 * u, 27 * u);
    ctx.fillStyle = near;
    ctx.font = disp(32);
    ctx.fillText(kg(load) + ' kg', 20 * u, 59 * u);
    ctx.font = mono(11.5);
    ctx.fillStyle = COL.muted;
    ctx.fillText(load < -0.5 ? i18n`motocykl ciągnie w prawo` : i18n`nacisk na lewą stopę`, 20 * u, 78 * u);
    ctx.fillStyle = COL.chalk;
    ctx.fillText(COARSE.matches ? i18n`przycisk „Wstań”` : i18n`Spacja: wstań na podnóżki`, 20 * u, 95 * u);
  } else {
    const riding = phase === 'ride';
    ctx.fillStyle = riding ? COL.ok : COL.muted;
    ctx.fillText(riding ? i18n`NA PODNÓŻKACH` : i18n`TRACKSTAND`, 20 * u, 27 * u);
    ctx.fillStyle = phase === 'ready' ? COL.dim : COL.chalk;
    ctx.font = disp(32);
    ctx.fillText(fmt(S.t) + ' s', 20 * u, 59 * u);
    ctx.font = mono(11.5);
    ctx.fillStyle = COL.muted;
    const rec = best[bestKey()];
    ctx.fillText(rec ? i18n`rekord ${fmt(rec)} s` : i18n`bez rekordu`, 20 * u, 78 * u);
    ctx.fillText(`${bar(cfg.p)} · ${i18n`tempo ${pct(cfg.tempo)}`}`, 20 * u, 95 * u);
  }

  // Lean gauge: the needle is the bike, the dot on the arc the CoG over the support. The needle
  // starts away from the middle, so that the angle written there stays readable.
  const R = (narrow ? 46 : 62) * u;
  const pad = 12 * u;
  const room = w - supW - 20;
  const gx = narrow ? 10 : Math.max(206 * u, room / 2 - R - pad);
  const gyTop = narrow ? 114 * u : 10;
  panel(gx, gyTop, 2 * R + 2 * pad, R + 2 * pad + 22 * u);
  const cx = gx + pad + R,
    cy = gyTop + pad + R;
  const SPAN = 30 * RAD;
  const ang = (a) => -Math.PI / 2 + (clamp(a, -SPAN, SPAN) / SPAN) * (Math.PI / 2.4);
  const arc = (a0, a1, col, lw) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(cx, cy, R, ang(a0), ang(a1));
    ctx.stroke();
  };
  ctx.lineCap = 'butt';
  arc(-SPAN, SPAN, COL.rule, 8 * u);
  arc(-DAB_DEG * RAD * 0.5, DAB_DEG * RAD * 0.5, alpha(COL.ok, 0.5), 8 * u);
  arc(DAB_DEG * RAD, SPAN, 'rgba(239,83,80,0.8)', 8 * u);
  arc(-SPAN, -DAB_DEG * RAD, 'rgba(239,83,80,0.8)', 8 * u);
  ctx.strokeStyle = COL.dim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let d = -30; d <= 30; d += 10) {
    const a = ang(d * RAD);
    ctx.moveTo(cx + Math.cos(a) * (R - 7 * u), cy + Math.sin(a) * (R - 7 * u));
    ctx.lineTo(cx + Math.cos(a) * (R - 12 * u), cy + Math.sin(a) * (R - 12 * u));
  }
  ctx.stroke();
  const pose = currentPose();
  const an = ang(pose.phi);
  ctx.strokeStyle = COL.chalk;
  ctx.lineWidth = 3 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(an) * R * 0.55, cy + Math.sin(an) * R * 0.55);
  ctx.lineTo(cx + Math.cos(an) * (R + 4 * u), cy + Math.sin(an) * (R + 4 * u));
  ctx.stroke();
  const cogCol =
    Math.abs(S.cogLean) < DAB_DEG * RAD * 0.5 ? COL.ok : Math.abs(S.cogLean) < DAB_DEG * RAD ? COL.warn : '#ef5350';
  const ac = ang(S.cogLean);
  disc(ctx, [cx + Math.cos(ac) * R, cy + Math.sin(ac) * R], 6 * u, cogCol);
  ctx.textAlign = 'center';
  ctx.font = disp(18);
  ctx.fillStyle = COL.chalk;
  const side = Math.abs(pose.phi) < 0.05 * RAD ? '' : pose.phi < 0 ? i18n`L` : i18n`P`;
  ctx.fillText(`${fmt(deg(Math.abs(pose.phi)), 1)}° ${side}`.trim(), cx, cy + 4 * u);
  ctx.font = mono(10, 600);
  ctx.fillStyle = cogCol;
  ctx.fillText(i18n`CoG ${fmt(deg(Math.abs(S.cogLean)), 1)}°`, cx, cy + 18 * u);

  // The hips, the handlebar and how far the bike rolled: a marker in the middle is straight, or where it started.
  const bw = 84 * u,
    lab = 78 * u,
    val = 52 * u,
    rowH = 17 * u;
  const pw = lab + bw + val + 18 * u,
    ph = rowH * 3 + 12 * u;
  // With the pads over the picture the bottom is theirs, so the bars go under the time.
  const overPads = LANDPADS.matches && padsEl.classList.contains('on');
  const lx = 10;
  const py = overPads ? 18 + 96 * u : h - ph - 10;
  panel(lx, py, pw, ph);
  const midBar = (i, v, col, text, value) => {
    const y = py + 8 * u + i * rowH;
    ctx.fillStyle = COL.muted;
    ctx.font = mono(10);
    ctx.textAlign = 'left';
    ctx.fillText(text, lx + 10 * u, y + 9 * u);
    const x0 = lx + lab + 10 * u;
    ctx.fillStyle = COL.rule;
    ctx.fillRect(x0, y + 2 * u, bw, 8 * u);
    ctx.fillStyle = COL.dim;
    ctx.fillRect(x0 + bw / 2 - 1, y, 2, 12 * u);
    ctx.fillStyle = col;
    ctx.fillRect(x0 + bw / 2 + (clamp(v, -1, 1) * bw) / 2 - 4 * u, y - 1 * u, 8 * u, 14 * u);
    ctx.fillStyle = COL.chalk;
    ctx.textAlign = 'right';
    ctx.fillText(value, lx + pw - 8 * u, y + 9 * u);
  };
  const lr = (v, eps) => (Math.abs(v) < eps ? '' : v < 0 ? ' ' + i18n`L` : ' ' + i18n`P`);
  midBar(0, S.u / BIKE.du, COL.spd, i18n`BIODRA`, `${Math.round(Math.abs(S.u) * 100)} cm${lr(S.u, 0.005)}`);
  midBar(
    1,
    S.d / (BIKE.lock * RAD),
    COL.cone,
    i18n`KIEROWNICA`,
    `${Math.round(deg(Math.abs(S.d)))}°${lr(S.d, 0.5 * RAD)}`,
  );
  const fb = Math.abs(S.x) < 0.005 ? '' : S.x > 0 ? ' ↑' : ' ↓';
  midBar(2, S.x / ROLL_SCALE, COL.ok, i18n`TOCZENIE`, `${Math.round(Math.abs(S.x) * 100)} cm${fb}`);

  if (paused && (phase === 'ride' || phase === 'setup')) {
    ctx.fillStyle = 'rgba(12,14,16,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = COL.chalk;
    ctx.textAlign = 'center';
    ctx.font = disp(30);
    ctx.fillText(i18n`Pauza`, w / 2, h / 2);
    ctx.font = mono(13);
    ctx.fillText(COARSE.matches ? i18n`dotknij przycisku, aby grać dalej` : i18n`P: dalej`, w / 2, h / 2 + 26 * u);
  }
}
