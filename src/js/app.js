// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// Interface state, settings, colours and fonts taken from the stylesheet, and the links to the
// other games.

const $ = (id) => document.getElementById(id);
const deg = (r) => (r * 180) / Math.PI;
const fmt = (n, d = 1) => n.toFixed(d).replace('.', DECIMAL).replace('-', '−');
const pct = (t) => Math.round(t * 100) + '%';
const bar = (p) => fmt(p) + ' bar';
const store = {
  get(k, def) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? def : JSON.parse(v);
    } catch (e) {
      return def;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  },
};

const rootStyle = getComputedStyle(document.documentElement);
const cssVar = (n) => rootStyle.getPropertyValue('--' + n).trim();
const COL = {};
['chalk', 'muted', 'dim', 'rule', 'panel', 'asphalt', 'ok', 'warn', 'spd', 'cone', 'coneN', 'coneF'].forEach(
  (k) => (COL[k] = cssVar(k)),
);
const FONT_MONO = cssVar('f-mono') || 'monospace';
const FONT_DISPLAY = cssVar('f-display') || 'sans-serif';
/** A stylesheet colour (#rrggbb) with transparency. */
function alpha(hex, a) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

const COARSE = matchMedia('(pointer: coarse)');
const LANDPADS = matchMedia('(pointer: coarse) and (orientation: landscape) and (max-height: 540px)');
const TEMPOS = [1, 0.75, 0.5, 0.35];
const cfg = Object.assign({ p: 1.6, tempo: 0.5, sup: true, trend: true }, store.get('simtrackstand-cfg', {}));
if (!PRESSURES.includes(cfg.p)) cfg.p = 1.6;
if (!TEMPOS.includes(cfg.tempo)) cfg.tempo = 0.5;
const best = store.get('simtrackstand-best', {});
const bestKey = () => cfg.p + '@' + cfg.tempo;
const saveCfg = () => store.set('simtrackstand-cfg', { p: cfg.p, tempo: cfg.tempo, sup: cfg.sup, trend: cfg.trend });

let S = newState();
let phase = 'ready';
let paused = false;
let trace = [];
let traceT = 0;
let fall = null;
let footK = 1; // the left foot on the asphalt: 1 while the bike rests on it, down to 0 after standing up
let standLoad = 0; // what the foot carried when the rider stood up [kg]
const keys = { left: 0, right: 0, bl: 0, br: 0, fw: 0, bw: 0 };
const pads = { left: 0, right: 0, bl: 0, br: 0, fw: 0, bw: 0 };

// The scene is redrawn only while something moves; anything else that changes it calls invalidate().
let sceneDirty = true;
let teleDirty = true;
function invalidate() {
  sceneDirty = true;
  teleDirty = true;
}

// On secpro.pl the games live under the same key, /simtrackstand/<key>/, /simwheelie/<key>/ and
// /simgp8/<key>/, with the English editions in en/ below them. Elsewhere the other language is the
// file next to this one, as in dist/; where there is none, the language link is hidden.
const secpro = /^(.*)\/simtrackstand\/([0-9a-f]{32})\//i.exec(location.pathname);
if (secpro) {
  const [, root, key] = secpro;
  const en = (yes) => (yes ? 'en/' : '');
  document.querySelectorAll('a[data-sibling]').forEach((a) => {
    a.href = `${root}/${a.dataset.sibling}/${key}/${en(LANG === 'en')}`;
    a.removeAttribute('target');
    a.removeAttribute('rel');
  });
  document
    .querySelectorAll('a[data-lang]')
    .forEach((a) => (a.href = `${root}/simtrackstand/${key}/${en(LANG !== 'en')}`));
} else if (!/\/simtrackstand-(pl|en)\.html$/.test(location.pathname)) {
  document.querySelectorAll('a[data-lang]').forEach((a) => (a.hidden = true));
}

function segmented(el, val, onPick) {
  el.querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.v === String(val)));
    b.addEventListener('click', () => {
      onPick(b.dataset.v);
      el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      b.blur();
    });
  });
}

$('press').innerHTML = PRESSURES.map((p) => `<button data-v="${p}">${fmt(p)}</button>`).join('');
segmented($('press'), cfg.p, (v) => {
  cfg.p = Number(v);
  saveCfg();
  reset();
  bikeInfo();
});
segmented($('tempo'), cfg.tempo, (v) => {
  cfg.tempo = Number(v);
  saveCfg();
  reset();
});
$('view')
  .querySelectorAll('button')
  .forEach((b) => {
    const k = b.dataset.v;
    b.setAttribute('aria-pressed', String(!!cfg[k]));
    b.addEventListener('click', () => {
      cfg[k] = !cfg[k];
      b.setAttribute('aria-pressed', String(cfg[k]));
      saveCfg();
      invalidate();
      b.blur();
    });
  });
