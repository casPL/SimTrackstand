// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// The run loop and start-up. Physics advances in fixed steps of DT, scaled by the tempo; the scene
// is drawn only while something moves or after invalidate().

const FALL_DEG = 16; // after a dab the bike settles on the foot at this lean [°]
let last = performance.now();
let acc = 0;

function settle(dt) {
  const target = fall.side * FALL_DEG * RAD;
  fall.phi += clamp(target - fall.phi, -1.2 * dt, 1.2 * dt);
  fall.k = Math.min(1, fall.k + dt / 0.35);
  return fall.k < 1 || fall.phi !== target;
}

const live = () => phase === 'setup' || phase === 'ride';

function frame(now) {
  const dtReal = Math.min(0.05, (now - last) / 1000);
  last = now;
  const dtGame = dtReal * cfg.tempo;
  const running = live() && !paused;
  let moving = running;
  if (running) {
    acc += dtGame;
    const inp = controls();
    while (acc >= DT && live()) {
      acc -= DT;
      step(S, cfg.p, inp);
      if (phase !== 'ride') continue;
      traceT += DT;
      if (traceT >= 1 / 30) {
        traceT = 0;
        recordTrace();
      }
      if (S.done) finish();
    }
    // The foot comes up onto the peg after standing up.
    if (phase === 'ride' && footK > 0) footK = Math.max(0, footK - dtGame / 0.3);
    // With the foot down the picture changes only while a key is held or the bars and hips settle.
    if (phase === 'setup') moving = Object.values(inp).some(Boolean) || Math.abs(S.dd) > 1e-4 || Math.abs(S.ud) > 1e-4;
  } else {
    acc = 0;
    if (fall) moving = settle(dtGame) || moving;
  }
  if (moving || sceneDirty) {
    sceneDirty = false;
    drawScene();
  }
  if (teleDirty) {
    teleDirty = false;
    drawTele();
  }
  requestAnimationFrame(frame);
}

if (document.fonts) {
  const redraw = () => {
    invalidate();
    drawSupportDemo();
  };
  document.fonts.ready.then(redraw);
  document.fonts.addEventListener('loadingdone', redraw);
}
bikeInfo();
syncAct();
showReady();
requestAnimationFrame(frame);
