// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// The bike, the rider standing on the pegs, and what the tyres give at a chosen pressure.

// m bike [kg], mr rider [kg], L wheelbase [m], b CoG ahead of the rear axle [m], hb bike CoG height,
// hr rider CoG height standing on the pegs [m], Ib, Ir roll inertia about their own CoG [kg·m²],
// rr wheel radius [m], rake [°], trail [m], lock steering lock [°], du rider shift over the pegs [m],
// tf, tr tyre width, front and rear [m]; pwf, pwr contact patch width of the front and the rear tyre
// when it covers 40 cm² [m]; crown tyre crown radius, front and rear together [m].
// Mass, wheelbase, steering and wheels are those of the Supermoto 450 in SimGP8: a 450 cc supermoto
// on 17" wheels, 120/70 at the front and 160/60 at the rear.
// prettier-ignore
const BIKE = {
  name: 'Supermoto 450', color: '#e33b34',
  m: 118, mr: 80, L: 1.49, b: 0.685, hb: 0.6, hr: 1.19, Ib: 13, Ir: 10,
  rr: 0.3, rake: 26, trail: 0.11, lock: 38, du: 0.16, tf: 0.12, tr: 0.16, pwf: 0.049, pwr: 0.059,
  crown: 0.07,
};

const PREP = new Map();

/**
 * Constants used by every physics step, computed once per pressure p [bar].
 * M, h: total mass and CoG height; J0: roll inertia about the ground line with the rider centred;
 * f: share of the weight on the front; wr, lr, wf, lf: contact patch width and length, rear and
 * front [m]; follow: share of the CoG's sideways movement that the support follows inside the
 * balance zone as the bike leans;
 * cr: tyre roll damping [N·m·s/rad].
 */
function prep(p) {
  let c = PREP.get(p);
  if (c) return c;
  const bk = BIKE;
  const M = bk.m + bk.mr;
  const h = (bk.m * bk.hb + bk.mr * bk.hr) / M;
  const f = bk.b / bk.L;
  // A contact patch is an oval: the load over the pressure gives its area, and a softer tyre
  // spreads it more along the tyre than across it.
  const patch = (load, w40) => {
    const A = load / ((p * 100 + P0) * 1000);
    const w = w40 * Math.pow(A / 0.004, 0.35);
    return [w, (4 * A) / (Math.PI * w)];
  };
  const [wr, lr] = patch((1 - f) * M * G, bk.pwr);
  const [wf, lf] = patch(f * M * G, bk.pwf);
  c = {
    M,
    h,
    f,
    J0: bk.Ib + bk.m * bk.hb * bk.hb + bk.Ir + bk.mr * bk.hr * bk.hr,
    wr,
    lr,
    wf,
    lf,
    follow: FOLLOW + (FOLLOW_SOFT * (2.2 - p)) / 1.4,
    cr: 30,
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

/** How far an oval patch w wide and l long reaches across the bike line when turned by a [m]. */
function patchHalf(w, l, a) {
  return Math.hypot((w / 2) * Math.cos(a), (l / 2) * Math.sin(a));
}

/**
 * Support under the CoG at steering d [m]: mid and half, the centre and half width of the band
 * between the contact patches; zone, the half width of the balance zone of the game around mid. The
 * zone is wider than the band, because a rider reacts to a picture on a screen much later than to the
 * bike moving under the body.
 */
function support(c, d) {
  const half = (1 - c.f) * (c.wr / 2) + c.f * patchHalf(c.wf, c.lf, groundSteer(d));
  return { mid: c.f * frontShift(d), half, zone: ZONE * half };
}

/** Lean at which the support reaches the edge of the balance zone with the bars at d [rad]. */
function edgeLean(c, d) {
  return support(c, d).zone / (c.follow * c.h);
}

/**
 * Where the tyres push from across the bike line at lean phi and steering d [m]. As the tyres roll,
 * the support moves across the balance zone up to its edge, then the tyres roll onto their round
 * crown. With the front wheel turned, leaning also moves its lowest point along the rim towards the
 * low side.
 */
function pushPoint(c, phi, d) {
  const sup = support(c, d);
  const edge = edgeLean(c, d);
  const across =
    Math.abs(phi) > edge ? Math.sign(phi) * (sup.zone + BIKE.crown * (Math.abs(phi) - edge)) : (sup.zone * phi) / edge;
  const sd = Math.sin(groundSteer(d));
  return sup.mid + across + c.f * BIKE.rr * sd * sd * Math.sin(phi);
}

/** Time for a small lean to double with the tyres past their edge and nothing done [s]. */
function doubling(p) {
  const c = prep(p);
  return Math.LN2 / Math.sqrt((c.M * G * (c.h - BIKE.crown)) / c.J0);
}
