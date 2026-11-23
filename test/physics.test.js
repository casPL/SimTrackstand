// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// What the physics promises the player.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('../build.js');
const { ride, balancedHips } = require('./bot.js');

// prettier-ignore
const core = loadCore(['BIKE', 'PRESSURES', 'step', 'newState', 'standUp', 'prep', 'support', 'DT', 'RAD', 'G', 'FORE']);
const { BIKE, PRESSURES, step, newState, standUp, prep, support, RAD, G, FORE } = core;
const LOCK = BIKE.lock * RAD;
const ROLL = BIKE.mr / (BIKE.m + BIKE.mr);

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
    for (let i = 0; i < 240; i++) step(s, p, { left: 1, br: 1, fw: 1 });
    assert.equal(s.phi, phi);
    assert.equal(s.x, 0, 'the body keys do not roll the bike');
    assert.equal(s.t, 0, 'the clock starts only on the pegs');
    assert.ok(setUp(p).footLoad / G > 3, 'resting on the foot, the bike leans on it');
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

test('turning the bars into the lean rights the bike at once, but held there with the wheels still it falls sooner', () => {
  for (const p of PRESSURES) {
    const still = hold(balanced(p, 0, 0.5 * RAD), p, {}, 0.2);
    const into = hold(balanced(p, 0, 0.5 * RAD), p, { right: 1 }, 0.2);
    assert.ok(into.phi < still.phi, `${p}: the bars do not right the bike`);
    hold(still, p, {}, 10);
    hold(into, p, {}, 10);
    assert.ok(into.t < still.t, `${p}: ${into.t} vs ${still.t}`);
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

test('on the pegs the body rolls the bike the other way, about half as far, and back again', () => {
  for (const p of PRESSURES) {
    const s = balanced(p, 0);
    hold(s, p, { fw: 1 }, 1);
    assert.ok(s.w < -0.9 * FORE, `${p}: the body goes back`);
    assert.ok(s.x > 0.03 && s.x < ROLL * FORE, `${p}: ${s.x}`);
    hold(s, p, {}, 1.5);
    assert.ok(Math.abs(s.x) < 0.01, `${p}: ${s.x}`);
    assert.equal(s.done, null);
  }
});

test('with the bars turned, rolling forward rights a lean towards them and rolling back a lean away', () => {
  for (const p of PRESSURES) {
    const lean = (dphi, keys) => hold(balanced(p, LOCK, dphi * RAD), p, keys, 0.4).phi;
    assert.ok(lean(0.5, { fw: 1 }) < lean(0.5, {}) - 0.5 * RAD, `${p}: forward`);
    assert.ok(lean(-0.5, { bw: 1 }) > lean(-0.5, {}) + 0.5 * RAD, `${p}: back`);
    assert.ok(lean(-0.5, { fw: 1 }) < lean(-0.5, {}), `${p}: forward with the lean away`);
  }
});

test('a bike that keeps rolling ends the attempt at the chalk line', () => {
  for (const p of PRESSURES) {
    const s = balanced(p, 0);
    s.vG = 0.8;
    hold(s, p, {}, 5);
    assert.equal(s.done, 'roll', String(p));
  }
});

test('lower pressure and turned bars widen the support band; soft tyres reach their edge later', () => {
  const half = (p, d) => support(prep(p), d).half;
  for (let i = 1; i < PRESSURES.length; i++) {
    assert.ok(half(PRESSURES[i - 1], 0) > half(PRESSURES[i], 0));
    assert.ok(prep(PRESSURES[i - 1]).edge > prep(PRESSURES[i]).edge);
  }
  for (const p of PRESSURES) assert.ok(half(p, LOCK) > 1.3 * half(p, 0), String(p));
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
      t += ride(core, p, { delay: 0.12, seed, hipErr: (seed % 2 ? 1 : -1) * 0.006 }).t;
    return t / 8;
  };
  assert.ok(mean(0.8) > 2 * mean(2.0));
});

test('with the bars at lock, rolling the bike keeps a quick rider up for half a minute; without it, seconds', () => {
  const mean = (p, use) => {
    let t = 0;
    for (let seed = 1; seed <= 4; seed++)
      t += ride(core, p, { d0: -LOCK, delay: 0.06, seed, hipErr: (seed % 2 ? 1 : -1) * 0.006, use }).t;
    return t / 4;
  };
  for (const p of PRESSURES) assert.ok(mean(p) > 30, `${p}: ${mean(p).toFixed(1)} s`);
  assert.ok(mean(1.6) > 4 * mean(1.6, ['hips', 'bars']));
});
