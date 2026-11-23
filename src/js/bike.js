// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// The bike, the rider standing on the pegs, and what the tyres give at a chosen pressure.

// m bike [kg], mr rider [kg], L wheelbase [m], b CoG ahead of the rear axle [m], hb bike CoG height,
// hr rider CoG height standing on the pegs [m], Ib, Ir roll inertia about their own CoG [kg·m²],
// rr wheel radius [m], rake [°], trail [m], lock steering lock [°], du rider shift over the pegs [m],
// crown tyre crown radius [m]
// prettier-ignore
const BIKE = {
  name: 'Sur-Ron SM 17"', color: '#e33b34',
  m: 85, mr: 80, L: 1.38, b: 0.64, hb: 0.48, hr: 1.12, Ib: 8, Ir: 10,
  rr: 0.3, rake: 26, trail: 0.09, lock: 38, du: 0.16, crown: 0.05,
};

const PREP = new Map();

/**
 * Constants used by every physics step, computed once per pressure p [bar].
 * M, h: total mass and CoG height; J0: roll inertia about the ground line with the rider centred;
 * f: share of the weight on the front; wr, lr, wf, lf: contact patch width and length, rear and
 * front [m]; edge: tyre roll at which the pressure reaches the edge of the patch [rad];
 * cr: tyre roll damping [N·m·s/rad]; crr: rolling resistance coefficient.
 */
function prep(p) {
  let c = PREP.get(p);
  if (c) return c;
  const bk = BIKE;
  const M = bk.m + bk.mr;
  const h = (bk.m * bk.hb + bk.mr * bk.hr) / M;
  const f = bk.b / bk.L;
  const patch = (load) => {
    const A = load / ((p * 100 + P0) * 1000);
    const w = 0.05 * Math.pow(A / 0.004, 0.35);
    return [w, A / (0.8 * w)];
  };
  const [wr, lr] = patch((1 - f) * M * G);
  const [wf, lf] = patch(f * M * G);
  c = {
    M,
    h,
    f,
    J0: bk.Ib + bk.m * bk.hb * bk.hb + bk.Ir + bk.mr * bk.hr * bk.hr,
    wr,
    lr,
    wf,
    lf,
    edge: (EDGE_DEG + (EDGE_SOFT * (2.2 - p)) / 1.4) * RAD,
    cr: 30,
    crr: 0.012 + (0.012 * (2.2 - p)) / 1.4,
  };
  PREP.set(p, c);
  return c;
}

/** Steering angle seen on the ground for the handlebar turned by d about the raked steering axis. */
function groundSteer(d) {
  return Math.atan(Math.tan(d) * Math.cos(BIKE.rake * RAD));
}

/**
 * Sideways shift of the front contact patch, relative to the frame, with the bars turned by d [m].
 * The patch trails behind the steering axis, so it swings the other way: bars to the right, patch
 * to the left. Standing still, the patch cannot slide, so the frame turns about the rear tyre instead
 * and carries the CoG towards the side the bars turn.
 */
function frontShift(d) {
  return -BIKE.trail * Math.sin(groundSteer(d));
}

/** Support under the CoG at steering d: centre and half width of the band the tyres can push from [m]. */
function support(c, d) {
  const dg = groundSteer(d);
  const sd = Math.abs(Math.sin(dg)),
    cd = Math.cos(dg);
  return {
    mid: c.f * frontShift(d),
    half: (1 - c.f) * (c.wr / 2) + c.f * ((c.wf / 2) * cd + (c.lf / 2) * sd),
  };
}

/**
 * Where the tyres push from across the bike line at lean phi and steering d [m]. Each tyre rolls
 * across its patch up to the edge, then onto its round crown. With the front wheel turned, leaning
 * also moves its lowest point along the rim towards the low side.
 */
function pushPoint(c, phi, d) {
  const sup = support(c, d);
  const across =
    Math.abs(phi) > c.edge
      ? Math.sign(phi) * (sup.half + BIKE.crown * (Math.abs(phi) - c.edge))
      : (sup.half * phi) / c.edge;
  const sd = Math.sin(groundSteer(d));
  return sup.mid + across + c.f * BIKE.rr * sd * sd * Math.sin(phi);
}

/** Time for a small lean to double with the tyres past their edge and nothing done [s]. */
function doubling(p) {
  const c = prep(p);
  return Math.LN2 / Math.sqrt((c.M * G * (c.h - BIKE.crown)) / c.J0);
}
