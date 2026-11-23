// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// One time step of the standing bike. The bike with the rider rolls about the line where the tyres
// touch the asphalt, as an inverted pendulum. Gravity acts between the CoG and the point the tyres
// push from, which moves across the contact patches as the tyres roll onto their side. Moving the
// hips over the pegs rolls the bike the other way. Turning the bars turns the frame about the rear
// tyre, because the front patch cannot slide: the CoG moves across the tyre line towards the side
// the bars turn, and while it moves, the bike rolls the other way. The wheels roll freely: moving the
// body forward over the pegs pushes the bike back a few centimetres, and with the bars turned the
// wheels then run sideways under the CoG.

/**
 * t: time on the pegs; phi, om: roll angle and rate; u, ud, uT, uS: hips over the pegs, their rate,
 * target and where they were set with the foot down [m]; d, dd, dT: steering angle, rate and
 * target; sx, sv: CoG shift across the tyre line made by the steering, and its rate [m]; yG, yGv,
 * yP: CoG, its rate and the point the tyres push from, across the bike line [m]; mid, half: the
 * support band; edge: tyres past the edge of their patches; cogLean: CoG angle from the middle of
 * the band; foot: the bike rests on the left foot; footLoad: what the foot carries [N]; done: 'dab'
 * when a foot goes down, 'roll' when a tyre rolls onto the chalk line; w, wd, wT: body forward of
 * the middle of the pegs, its rate and target [m]; x, v, va: the bike rolled forward, its speed and
 * acceleration; vG: speed of the CoG of the bike with the rider; yaw, X, Y: heading and where the
 * rear tyre stands on the asphalt, for the picture; sumCog, maxLean, into, maxRoll:
 * statistics (into: time with the bars turned towards the lean; maxRoll: furthest the bike rolled
 * from where it stood).
 */
function newState() {
  // prettier-ignore
  return {
    t: 0, phi: FOOT_LEAN * RAD, om: 0, u: 0, ud: 0, uT: 0, uS: 0, d: 0, dd: 0, dT: 0, sx: 0, sv: 0,
    yG: 0, yGv: 0, yP: 0, mid: 0, half: 0.03, edge: false, cogLean: 0, foot: true, footLoad: 0,
    done: null, w: 0, wd: 0, wT: 0, x: 0, v: 0, va: 0, vG: 0, yaw: 0, X: 0, Y: 0,
    sumCog: 0, maxLean: 0, into: 0, maxRoll: 0,
  };
}

/**
 * Advances s by DT at pressure p [bar] with the controls inp = { left, right, bl, br, fw, bw }, each
 * 0…1; fw and bw roll the bike forward and back, the body going the other way.
 */
function step(s, p, inp) {
  const bk = BIKE;
  const c = prep(p);
  const dt = DT;

  // Handlebar: its target moves while a key is held and stays where it is left; the bars follow.
  const lock = bk.lock * RAD;
  s.dT = clamp(s.dT + ((inp.right || 0) - (inp.left || 0)) * STEER_RATE * RAD * dt, -lock, lock);
  const da = BAR_W * BAR_W * (s.dT - s.d) - 2 * BAR_W * s.dd;
  s.dd += da * dt;
  s.d += s.dd * dt;
  // With the foot down the hips move while a key is held and stay. On the pegs a key takes them all
  // the way to its side, and let go, they come back to where they were set.
  const key = (inp.br || 0) - (inp.bl || 0);
  if (s.foot) {
    s.uS = clamp(s.uS + key * HIP_RATE * dt, -bk.du, bk.du);
    s.uT = s.uS;
  } else s.uT = key ? clamp(key, -1, 1) * bk.du : s.uS;
  const ua = HIP_W * HIP_W * (s.uT - s.u) - 2 * HIP_W * s.ud;
  s.ud += ua * dt;
  s.u += s.ud * dt;

  // The body forward and back over the pegs. With the foot down it stays in the middle. On the pegs
  // the bike moves the other way, because the CoG of the bike with the rider changes speed only
  // through the rolling resistance of the tyres.
  const fk = s.foot ? 0 : (inp.bw || 0) - (inp.fw || 0);
  s.wT = clamp(fk, -1, 1) * FORE;
  const wa = FORE_W * FORE_W * (s.wT - s.w) - 2 * FORE_W * s.wd;
  s.wd += wa * dt;
  s.w += s.wd * dt;
  if (s.foot) {
    s.vG = s.v = s.va = 0;
  } else {
    const drag = c.crr * G * Math.tanh(s.v / 0.02);
    s.vG -= drag * dt;
    s.v = s.vG - (bk.mr / c.M) * s.wd;
    s.va = -drag - (bk.mr / c.M) * wa;
    s.x += s.v * dt;
  }

  // The CoG moves across the tyre line as the bars turn; its acceleration rolls the bike.
  const e = 1e-4;
  const s0 = cogShift(c, s.d),
    sP = cogShift(c, s.d + e),
    sM = cogShift(c, s.d - e);
  const s1 = (sP - sM) / (2 * e),
    s2 = (sP - 2 * s0 + sM) / (e * e);
  s.sx = s0;
  s.sv = s1 * s.dd;
  const sa = s1 * da + s2 * s.dd * s.dd;

  const sup = support(c, s.d);
  s.mid = sup.mid;
  s.half = sup.half;
  const cs = Math.cos(s.phi),
    sn = Math.sin(s.phi);
  s.edge = Math.abs(s.phi) > c.edge;
  s.yP = pushPoint(c, s.phi, s.d);
  s.yG = c.h * sn + (bk.mr * s.u * cs) / c.M;
  s.yGv = c.h * cs * s.om + (bk.mr * (s.ud * cs - s.u * sn * s.om)) / c.M;
  s.cogLean = Math.atan2(s.yG - s.mid, c.h);
  const gravity = c.M * G * (s.yG - s.yP);
  if (s.foot) {
    // Resting on the left foot: the lean stays and the foot carries what gravity leaves.
    s.footLoad = -gravity / FOOT_ARM;
    s.om = 0;
    return s;
  }

  // Rolling with the bars turned, the wheels follow a curve: the bike line swings sideways under the
  // CoG, and the faster it rolls, the harder.
  const k0 = Math.tan(groundSteer(s.d)) / bk.L;
  const k1 = (Math.tan(groundSteer(s.d + e)) - Math.tan(groundSteer(s.d - e))) / (2 * e * bk.L);
  const side = bk.b * (s.va * k0 + s.v * k1 * s.dd) + s.v * s.v * k0 + (s.v * s.sv) / (c.f * bk.L);
  s.yaw += s.v * k0 * dt;
  s.X += s.v * Math.cos(s.yaw) * dt;
  s.Y += s.v * Math.sin(s.yaw) * dt;
  const J = c.J0 + bk.mr * s.u * s.u;
  const torque =
    gravity -
    c.M * c.h * (sa + side) * cs -
    bk.mr * bk.hr * ua -
    2 * bk.mr * s.u * s.ud * s.om -
    (s.edge ? 0 : c.cr * s.om);
  s.om += (torque / J) * dt;
  s.phi += s.om * dt;
  s.t += dt;

  s.sumCog += Math.abs(s.cogLean) * dt;
  s.maxLean = Math.max(s.maxLean, Math.abs(s.phi));
  s.maxRoll = Math.max(s.maxRoll, Math.abs(s.x));
  if (Math.abs(s.d) > 5 * RAD && Math.sign(s.d) === Math.sign(s.phi)) s.into += dt;
  if (Math.abs(s.cogLean) > DAB_DEG * RAD || Math.abs(s.phi) > LEAN_MAX * RAD) s.done = 'dab';
  else if (Math.abs(s.x) > ROLL_MAX) s.done = 'roll';
  return s;
}

/** CoG shift across the tyre line made by the steering d [m]: the frame turns about the rear tyre. */
function cogShift(c, d) {
  return -c.f * frontShift(d);
}

/** Lifts the left foot onto the peg: from now on the rider balances. */
function standUp(s) {
  s.foot = false;
  s.footLoad = 0;
}
