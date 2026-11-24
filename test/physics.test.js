// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// What the physics promises the player.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('../build.js');
const { ride, balancedHips } = require('./bot.js');

// prettier-ignore
const core = loadCore(['BIKE', 'PRESSURES', 'step', 'newState', 'standUp', 'prep', 'support', 'edgeLean', 'doubling', 'DT', 'RAD', 'G', 'HIP_SWING', 'P0', 'ZONE']);
const { BIKE, PRESSURES, step, newState, standUp, prep, support, edgeLean, doubling, RAD, G, P0, ZONE } = core;
const LOCK = BIKE.lock * RAD;

/** Steps s at pressure p with the controls given by ctl(s) for up to seconds, or until the run ends. */
function hold(s, p, ctl, seconds) {
  const end = s.t + seconds;
  while (s.t < end && !s.done) step(s, p, typeof ctl === 'function' ? ctl(s) : ctl);
  return s;
}

/** The bike resting on the foot with the bars at d and the hips at u; footLoad is filled in. */
function setUp(p, d = 0, u = 0) {
  const s = Object.assign(newState(), { d, dT: d, u, uT: u, uS: u });
  step(s, p, {});
  return s;
}

/** Standing up from a posture that leaves nothing on the foot, nudged by dphi. */
function balanced(p, d, dphi = 0) {
  const s = setUp(p, d, balancedHips(core, p, d));
  standUp(s);
  s.phi += dphi;
  return s;
}

test('with the foot down nothing moves, and the foot carries what gravity leaves', () => {
  for (const p of PRESSURES) {
    const s = setUp(p);
    const phi = s.phi;
    for (let i = 0; i < 240; i++) step(s, p, { left: 1, br: 1 });
    assert.equal(s.phi, phi);
    assert.equal(s.t, 0, 'the clock starts only on the pegs');
    assert.ok(setUp(p).footLoad / G > 1, 'resting on the foot, the bike leans on it');
  }
});

test('bars towards the foot load it more; bars away and hips to the other side load it less', () => {
  for (const p of PRESSURES) {
    const rest = setUp(p).footLoad;
    assert.ok(setUp(p, -LOCK).footLoad > rest + 3 * G, String(p));
    assert.ok(setUp(p, LOCK).footLoad < rest - 3 * G, String(p));
    assert.ok(setUp(p, 0, 0.05).footLoad < rest - 3 * G, String(p));
  }
});

test('standing up with weight on the foot, the bike falls towards it', () => {
  for (const p of PRESSURES) {
    const s = setUp(p);
    standUp(s);
    hold(s, p, {}, 5);
    assert.equal(s.done, 'dab', String(p));
    assert.ok(s.phi < 0 && s.t < 3, `${p}: ${s.t}`);
  }
});

test('set so that the foot carries nothing, the bike stands up in balance', () => {
  for (const p of PRESSURES)
    for (const d of [-LOCK, 0, LOCK]) {
      const s = balanced(p, d);
      const phi = s.phi;
      hold(s, p, {}, 2);
      assert.equal(s.done, null, `${p} ${d}`);
      assert.ok(Math.abs(s.phi - phi) < 0.01 * RAD, `${p} ${d}`);
    }
});

test('turning the bars a little further into the lean straightens the bike slightly at once; held there, it falls sooner', () => {
  for (const p of PRESSURES)
    for (const d of [0, 20 * RAD]) {
      const still = hold(balanced(p, d, 0.5 * RAD), p, {}, 1 / 6);
      const into = hold(balanced(p, d, 0.5 * RAD), p, { right: 1 }, 1 / 6);
      const gain = still.phi - into.phi;
      assert.ok(gain > 0.1 * RAD && gain < 1 * RAD, `${p} ${d}: ${(gain / RAD).toFixed(2)}°`);
      hold(still, p, {}, 10);
      hold(into, p, {}, 10);
      assert.ok(into.t < still.t, `${p} ${d}: ${into.t} vs ${still.t}`);
    }
});

test('at full lock the bars have nowhere to go, so turning them does nothing', () => {
  for (const p of PRESSURES) {
    const still = hold(balanced(p, LOCK, 0.5 * RAD), p, {}, 0.3);
    const into = hold(balanced(p, LOCK, 0.5 * RAD), p, { right: 1 }, 0.3);
    assert.equal(into.phi, still.phi, String(p));
  }
});

test('bars turned away from the lean dip the bike a little further, then bring the CoG back over the tyres', () => {
  for (const p of PRESSURES) {
    const still = hold(balanced(p, 0, 0.5 * RAD), p, {}, 0.1);
    const away = hold(balanced(p, 0, 0.5 * RAD), p, { left: 1 }, 0.1);
    assert.ok(away.phi > still.phi, `${p}: the bike dips`);
    assert.ok(away.yG - away.yP < still.yG - still.yP, `${p}: the CoG comes back`);
  }
});

test('hips to the high side bring the support under the CoG; to the low side they do not', () => {
  for (const p of PRESSURES) {
    const high = hold(balanced(p, 0, 0.6 * RAD), p, { bl: 1 }, 0.35);
    hold(high, p, {}, 0.4);
    assert.equal(high.done, null, String(p));
    assert.ok(high.om < 0, `${p}: the bike comes back`);
    const low = hold(balanced(p, 0, 0.6 * RAD), p, { br: 1 }, 3);
    assert.equal(low.done, 'dab', String(p));
  }
});

test('lower pressure and turned bars widen the support band; soft tyres reach their edge later', () => {
  const half = (p, d) => support(prep(p), d).half;
  for (let i = 1; i < PRESSURES.length; i++) {
    assert.ok(half(PRESSURES[i - 1], 0) > half(PRESSURES[i], 0));
    assert.ok(edgeLean(prep(PRESSURES[i - 1]), 0) > edgeLean(prep(PRESSURES[i]), 0));
  }
  for (const p of PRESSURES) assert.ok(half(p, LOCK) > 1.15 * half(p, 0), String(p));
});

test('the balance zone is twice the band between the patches; inside it the bike falls far more slowly than past its edge, yet never stands up on its own', () => {
  for (const p of PRESSURES)
    for (const d of [0, LOCK]) {
      const sup = support(prep(p), d);
      assert.ok(ZONE === 2 && Math.abs(sup.zone - 2 * sup.half) < 1e-12);
      const eq = balanced(p, d).phi;
      const s = balanced(p, d, 0.1 * RAD);
      while (!s.done && Math.abs(s.phi - eq) < 0.2 * RAD) step(s, p, {});
      assert.ok(s.t > 2 * doubling(p), `${p} ${d}: ${s.t.toFixed(2)} s to double`);
      assert.ok(s.t < 5, `${p} ${d}: the lean keeps growing`);
    }
});

test('the contact patches are ovals the size of a palm: longer than wide, the rear one wider', () => {
  for (const p of PRESSURES) {
    const c = prep(p);
    const load = c.f * c.M * G;
    const area = (Math.PI / 4) * c.wf * c.lf;
    assert.ok(Math.abs(area - load / ((p * 100 + P0) * 1000)) < 1e-9, `${p}: area = load / pressure`);
    assert.ok(c.lf > c.wf && c.lr > c.wr && c.wr > c.wf, String(p));
    assert.ok(c.wf > 0.04 && c.wr < 0.09 && c.lf < 0.17, String(p));
  }
  const hard = prep(2.0);
  assert.ok(hard.wf * hard.lf * 1e4 > 30 && hard.wf * hard.lf * 1e4 < 60, 'about a credit card at the front');
});

test('a quick rider on soft tyres holds most of a minute', () => {
  let t = 0;
  for (let seed = 1; seed <= 8; seed++)
    t += ride(core, 0.8, { delay: 0.06, seed, hipErr: (seed % 2 ? 1 : -1) * 0.006 }).t;
  assert.ok(t / 8 > 40, `${(t / 8).toFixed(1)} s on average`);
});

test('with a slower reaction, soft tyres forgive more than hard ones', () => {
  const mean = (p) => {
    let t = 0;
    for (let seed = 1; seed <= 8; seed++)
      t += ride(core, p, { delay: 0.25, seed, hipErr: (seed % 2 ? 1 : -1) * 0.006 }).t;
    return t / 8;
  };
  assert.ok(mean(0.8) > 2 * mean(2.0));
});

test('a quick rider stays up for the whole minute with the hips alone, with the bars too, and at full lock', () => {
  const mean = (p, d0, use) => {
    let t = 0;
    for (let seed = 1; seed <= 4; seed++)
      t += ride(core, p, { d0, delay: 0.06, seed, hipErr: (seed % 2 ? 1 : -1) * 0.006, use }).t;
    return t / 4;
  };
  for (const p of [0.8, 2.0])
    for (const [d0, use] of [
      [0, ['hips']],
      [0, undefined],
      [-LOCK, undefined],
    ]) {
      const t = mean(p, d0, use);
      assert.ok(t > 50, `${p} ${d0} ${use || 'hips and bars'}: ${t.toFixed(1)} s`);
    }
});

test('reacting as late as to a picture on a screen, a rider still holds for tens of seconds at the default pressure', () => {
  for (const d0 of [0, -LOCK]) {
    let t = 0;
    for (let seed = 1; seed <= 8; seed++)
      t += ride(core, 1.6, { d0, delay: 0.2, seed, hipErr: (seed % 2 ? 1 : -1) * 0.006 }).t;
    assert.ok(t / 8 > 20, `${d0}: ${(t / 8).toFixed(1)} s on average`);
  }
});
