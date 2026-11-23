// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// Keyboard and the touch pads. Both feed the same controls; the stronger of the two wins.

// prettier-ignore
const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', KeyA: 'bl', KeyD: 'br', ArrowUp: 'fw', KeyW: 'fw', ArrowDown: 'bw', KeyS: 'bw' };

function setPaused(on) {
  if (paused === on) return;
  paused = on;
  syncAct();
  invalidate();
}

/** Space, Enter and the middle pad: start, stand up on the pegs, or pause and go on. */
function act() {
  if (phase === 'ready' || phase === 'over') start();
  else if (phase === 'setup') standUpNow();
  else setPaused(!paused);
}

/** The middle pad says what it does now. */
function syncAct() {
  const b = $('actPad');
  if (!b) return;
  b.textContent =
    phase === 'setup' ? i18n`Wstań` : phase === 'ride' ? (paused ? i18n`Dalej` : i18n`Pauza`) : i18n`Start`;
  b.classList.toggle('up', phase === 'setup');
}

addEventListener('keydown', (e) => {
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const k = KEYMAP[e.code];
  if (k) {
    keys[k] = 1;
    e.preventDefault();
    return;
  }
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (e.repeat) return;
    if (phase === 'ready' || phase === 'over') start();
    else if (phase === 'setup') standUpNow();
  } else if (e.code === 'KeyP' && (phase === 'ride' || phase === 'setup')) {
    setPaused(!paused);
  }
});
addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) keys[k] = 0;
});
addEventListener('blur', () => {
  Object.keys(keys).forEach((k) => (keys[k] = 0));
  Object.keys(pads).forEach((k) => (pads[k] = 0));
  document.querySelectorAll('.pad.on').forEach((p) => p.classList.remove('on'));
  if (phase === 'ride') setPaused(true);
});

const padsEl = $('pads');
if (COARSE.matches) padsEl.classList.add('on');
// On a phone a long press selects text or opens a menu, and the browser then cancels the touch, so
// a pad held for a while would let go. Nothing in the game area has a long-press action of its own.
padsEl.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
$('play').addEventListener('contextmenu', (e) => e.preventDefault());
padsEl.querySelectorAll('.pad').forEach((p) => {
  const k = p.dataset.k;
  const down = (e) => {
    e.preventDefault();
    getSelection()?.removeAllRanges();
    try {
      p.setPointerCapture(e.pointerId);
    } catch (err) {}
    p.classList.add('on');
    if (k === 'act') return act();
    pads[k] = 1;
    if (phase === 'ready' || phase === 'over') start();
    setPaused(false);
  };
  const up = () => {
    if (k !== 'act') pads[k] = 0;
    p.classList.remove('on');
  };
  p.addEventListener('pointerdown', down);
  p.addEventListener('pointerup', up);
  p.addEventListener('pointercancel', up);
  p.addEventListener('lostpointercapture', up);
});

/** The controls as the physics sees them. */
function controls() {
  const inp = {};
  for (const k in keys) inp[k] = Math.max(keys[k], pads[k]);
  return inp;
}
