// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// A rider that presses keys as a player would: it sets the bars and the hips with the foot down,
// stands up, then sees the bike late and roughly, decides every 60 ms, and holds a key or lets go.
// Its gains come from an LQR design on the physics linearised about the posture it stood up in.

const STATE = ['phi', 'om', 'u', 'ud', 'd', 'dd', 'dT', 'w', 'wd', 'vG'];
const INPUTS = ['hips', 'bars', 'fore'];

const mul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, a, k) => s + a * B[k][j], 0)));
const tr = (A) => A[0].map((_, j) => A.map((r) => r[j]));
const sum = (A, B, k = 1) => A.map((r, i) => r.map((a, j) => a + k * B[i][j]));
const diag = (v) => v.map((x, i) => v.map((_, j) => (i === j ? x : 0)));
/** Inverse of a small square matrix by Gauss–Jordan elimination. */
function inv(A) {
  const n = A.length;
  const M = A.map((r, i) => [...r, ...diag(Array(n).fill(1))[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const k = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= k;
    for (let r = 0; r < n; r++)
      if (r !== c) {
        const f = M[r][c];
        for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
      }
  }
  return M.map((r) => r.slice(n));
}

/** The keys for the inputs b (each −1…1) in the order of use. */
function keysOf(use, b) {
  const v = (name) => {
    const i = use.indexOf(name);
    return i < 0 ? 0 : b[i];
  };
  const pair = (x, plus, minus) => ({ [plus]: Math.max(0, x), [minus]: Math.max(0, -x) });
  return { ...pair(v('hips'), 'br', 'bl'), ...pair(v('bars'), 'right', 'left'), ...pair(v('fore'), 'fw', 'bw') };
}

/** Hip position that leaves nothing on the foot with the bars at d. */
function balancedHips(core, p, d) {
  const { step, newState, BIKE, G } = core;
  const load = (u) => {
    const s = Object.assign(newState(), { d, dT: d, u, uT: u, uS: u });
    step(s, p, {});
    return s.footLoad / G;
  };
  let lo = -BIKE.du,
    hi = BIKE.du;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (load(m) > 0) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** The posture standing up with the bars at d0: what the bot steers the deviations from. */
function posture(core, p, d0) {
  const { step, newState } = core;
  const u0 = balancedHips(core, p, d0);
  const s = Object.assign(newState(), { d: d0, dT: d0, u: u0, uT: u0, uS: u0 });
  step(s, p, {});
  return { phi: s.phi, u: u0, uS: u0, uT: u0, d: d0, dT: d0 };
}

/** LQR gains about the posture ref for the inputs in use; one row per input. */
function gains(core, p, ref, use) {
  const { step, newState, standUp, BIKE } = core;
  const next = (x, b) => {
    const s = Object.assign(newState(), ref);
    standUp(s);
    STATE.forEach((k, i) => (s[k] = (ref[k] || 0) + x[i]));
    // The hips as a linear input: the place they head for moves with the key.
    const i = use.indexOf('hips');
    if (i >= 0) s.uS = ref.uS + b[i] * BIKE.du;
    const keys = keysOf(use, b);
    keys.br = keys.bl = 0;
    step(s, p, keys);
    return STATE.map((k) => s[k] - (ref[k] || 0));
  };
  const n = STATE.length;
  const e = 1e-6;
  const x0 = STATE.map(() => 0);
  const b0 = use.map(() => 0);
  const f0 = next(x0, b0);
  const A = STATE.map(() => Array(n).fill(0));
  const B = STATE.map(() => Array(use.length).fill(0));
  for (let j = 0; j < n; j++) {
    const x = [...x0];
    x[j] = e;
    next(x, b0).forEach((v, i) => (A[i][j] = (v - f0[i]) / e));
  }
  for (let j = 0; j < use.length; j++) {
    const b = [...b0];
    b[j] = e;
    next(x0, b).forEach((v, i) => (B[i][j] = (v - f0[i]) / e));
  }
  const Q = diag([100, 1, 10, 0.1, 1, 0.01, 1, 5, 0.1, 10]);
  const R = diag(use.map(() => 0.05));
  let P = Q;
  let K;
  for (let it = 0; it < 6000; it++) {
    const BtP = mul(tr(B), P);
    K = mul(inv(sum(R, mul(BtP, B))), mul(BtP, A));
    P = sum(Q, mul(mul(tr(A), P), sum(A, mul(B, K), -1)));
  }
  return K;
}

/**
 * Stands up with the bars at d0 and the hips set to leave nothing on the foot (plus an error of
 * hipErr [m]), then rides at pressure p with reaction delay [s] and seeded noise; returns the state.
 */
function ride(core, p, { d0 = 0, hipErr = 0, delay, seed, seconds = 60, noise = 1, use = INPUTS }) {
  const { step, newState, standUp, DT, RAD } = core;
  const ref = posture(core, p, d0);
  const K = gains(core, p, ref, use);
  let r = seed;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647 - 0.5;
  const u0 = ref.u + hipErr;
  const s = Object.assign(newState(), { d: d0, dT: d0, u: u0, uT: u0, uS: u0 });
  step(s, p, {});
  standUp(s);
  const seen = [];
  let b = use.map(() => 0);
  let next = 0;
  const lag = Math.round(delay / DT);
  while (!s.done && s.t < seconds) {
    seen.push(STATE.map((k) => s[k] - (ref[k] || 0)));
    if (s.t >= next) {
      next += 0.06;
      const x = seen[Math.max(0, seen.length - 1 - lag)].slice();
      x[0] += rnd() * 0.6 * RAD * noise;
      x[1] += rnd() * 4 * RAD * noise;
      b = K.map((row) => {
        const want = -row.reduce((a, k, i) => a + k * x[i], 0);
        return want > 0.5 ? 1 : want < -0.5 ? -1 : 0;
      });
    }
    step(s, p, keysOf(use, b));
  }
  return s;
}

module.exports = { ride, gains, posture, balancedHips, STATE, INPUTS };
