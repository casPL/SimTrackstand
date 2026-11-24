// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// The bike and the rider in perspective, seen by a camera behind and to the left of the bike.
// Points are given in the bike's frame (x forward from the rear contact patch, y to the right, z up),
// rolled by the lean about the line of the tyres and projected by the camera. The wheels stand still,
// so the bike's frame is also the world's. Solid parts are extruded profiles lit by one lamp; parts
// are drawn from the furthest to the nearest.

const RIDER_COL = {
  helmet: '#ece8dd',
  accent: '#ff6b1a',
  jersey: '#2f3b48',
  pants: '#707a87',
  guard: '#e4e7ea',
  boot: '#dcd8cc',
  glove: '#1d2024',
  visor: '#14171a',
};
const LAMP = [-0.42, -0.5, 0.76]; // towards the light, from the bike [unit vector, normalised below]

const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  mix: (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k],
};
const LIGHT = v3.norm(LAMP);
// Ground shift of a shadow per metre of height: the street lamp stands high, ahead and to the left.
const SHADOW_DIR = [-0.3, 0.5];

/** Camera looking at target T from distance dist, turned az to the left of straight behind, eye at height zc. */
function makeCamera(T, az, dist, zc, F, cx, cy) {
  const C = [T[0] - dist * Math.cos(az), T[1] - dist * Math.sin(az), zc];
  const f = v3.norm(v3.sub(T, C));
  const r = v3.norm([-f[1], f[0], 0]);
  const u = v3.cross(f, r);
  return {
    C,
    F,
    proj(p) {
      const d = v3.sub(p, C);
      const z = v3.dot(d, f);
      return [cx + (F * v3.dot(d, r)) / z, cy - (F * v3.dot(d, u)) / z, z];
    },
    depth: (p) => v3.len(v3.sub(p, C)),
    /** Size on screen of length l [m] at depth z. */
    px: (l, z) => (F * l) / z,
  };
}

/** A point of the bike frame rolled by phi about the line of the tyres. */
function roll(p, phi) {
  const c = Math.cos(phi),
    s = Math.sin(phi);
  return [p[0], p[1] * c + p[2] * s, -p[1] * s + p[2] * c];
}

/** Rotation of v by angle t about the unit axis k through point o. */
function rotAbout(v, o, k, t) {
  const p = v3.sub(v, o);
  const c = Math.cos(t),
    s = Math.sin(t);
  const kxp = v3.cross(k, p);
  const kp = v3.dot(k, p);
  return v3.add(o, [
    p[0] * c + kxp[0] * s + k[0] * kp * (1 - c),
    p[1] * c + kxp[1] * s + k[1] * kp * (1 - c),
    p[2] * c + kxp[2] * s + k[2] * kp * (1 - c),
  ]);
}

/** Convex hull of 2D points (monotone chain). */
function hull(pts) {
  const p = pts.map((q) => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [],
    hi = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop();
    hi.push(q);
  }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

/** A stylesheet-free colour #rrggbb lit by k (1 = as is). */
function lit(hex, k) {
  return shade(hex, k);
}

// Geometry of the front end: the steering axis meets the ground one trail ahead of the front patch.
const RAKE = BIKE.rake * RAD;
const AXIS = [Math.sin(RAKE), 0, -Math.cos(RAKE)]; // down and forward along the steering axis
const AXIS_Q = [BIKE.L + BIKE.trail, 0, 0];
const axisAt = (z) => [AXIS_Q[0] - z * Math.tan(RAKE), 0, z];
// The frame, the body and the rider are drawn for a steering head 0.98 m ahead of the rear patch;
// everything ahead of the rear axle stretches to where the head of this bike is.
const LONG = axisAt(1.0)[0] / 0.98;
const fwd = (x) => (x > 0 ? x * LONG : x);
const lng = (prof) => prof.map(([x, z]) => [fwd(x), z]);
const at3 = (x, y, z) => [fwd(x), y, z];
const HEAD = axisAt(1.0);
const FORK_FWD = [Math.cos(RAKE), 0, Math.sin(RAKE)];

/**
 * Draws the bike and rider. pose: phi lean, d steering, u hips over the pegs, foot 0…1 (the left
 * foot on the asphalt), dab 0…1 with side (a foot going down after a fall).
 */
function drawBike3d(g, cam, pose) {
  const bk = BIKE;
  const phi = pose.phi;
  const W = (p) => roll(p, phi);
  const S = (p) => cam.proj(W(p));
  const steerT = -pose.d;
  const steer = (p) => rotAbout(p, HEAD, AXIS, steerT);
  // The camera stands behind and to the left, so the parts are drawn in a fixed order from the
  // furthest to the nearest: front end, the right side, the middle, the left side, the rider's back.
  const layers = {};
  const part = (name, draw) => (layers[name] = draw);

  // A solid profile in the x–z plane extruded between y0 and y1; xf maps it into the bike frame.
  const prism = (prof, y0, y1, col, xf = (p) => p) => {
    let area = 0;
    for (let i = 0; i < prof.length; i++) {
      const [x0, z0] = prof[i],
        [x1, z1] = prof[(i + 1) % prof.length];
      area += x0 * z1 - x1 * z0;
    }
    const wind = area > 0 ? 1 : -1;
    const A = prof.map(([x, z]) => W(xf([x, y0, z])));
    const B = prof.map(([x, z]) => W(xf([x, y1, z])));
    const faces = [];
    const face = (pts, n, base) => {
      const c = pts.reduce((s, q) => v3.add(s, q), [0, 0, 0]).map((v) => v / pts.length);
      if (v3.dot(n, v3.sub(cam.C, c)) <= 0) return;
      const k = 0.42 + 0.58 * Math.max(0, v3.dot(n, LIGHT));
      faces.push({ pts: pts.map((q) => cam.proj(q)), col: lit(base || col, k), z: cam.depth(c) });
    };
    for (let i = 0; i < prof.length; i++) {
      const j = (i + 1) % prof.length;
      const e = v3.sub(A[j], A[i]);
      const across = v3.sub(B[i], A[i]);
      let n = v3.norm(v3.cross(across, e));
      n = v3.mul(n, wind * (y1 > y0 ? 1 : -1));
      face([A[i], A[j], B[j], B[i]], n);
    }
    const ny = v3.norm(v3.sub(B[0], A[0]));
    faces.sort((a, b) => b.z - a.z);
    for (const f of faces) poly(g, f.pts, f.col);
    const capB = v3.dot(ny, v3.sub(cam.C, B[0])) > 0;
    const cap = capB ? B : A;
    const n = capB ? ny : v3.mul(ny, -1);
    const k = 0.42 + 0.58 * Math.max(0, v3.dot(n, LIGHT));
    poly(
      g,
      cap.map((q) => cam.proj(q)),
      lit(col, k),
    );
    return capB ? y1 : y0;
  };
  const circle = (cx, cz, r, n = 22, a0 = 0, a1 = Math.PI * 2) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / (a1 - a0 >= Math.PI * 2 ? n : n - 1);
      out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    return out;
  };
  const seg = (a, b, col, wM, xf = (p) => p) => {
    const A = S(xf(a)),
      B = S(xf(b));
    line(g, A, B, col, cam.px(wM, (A[2] + B[2]) / 2));
  };
  // A limb as a lit cylinder: a dark outline and a lighter core towards the lamp.
  const limb = (a, b, col, wM) => {
    const A = cam.proj(a),
      B = cam.proj(b);
    const wpx = cam.px(wM, (A[2] + B[2]) / 2);
    line(g, A, B, lit(col, 0.7), wpx);
    const off = wpx * 0.14;
    line(g, [A[0] - off, A[1] - off], [B[0] - off, B[1] - off], lit(col, 1.12), wpx * 0.55);
  };

  // Wheels: a tyre with a tread and sidewalls, the rim and spokes on the side facing us.
  const wheel = (axle, half, xf, front) => {
    const prof = circle(axle[0], axle[2], bk.rr, 26);
    const side = prism(prof, -half, half, '#16181b', xf);
    const sw = (r, n = 26) => circle(axle[0], axle[2], r, n).map(([x, z]) => S(xf([x, side, z])));
    poly(g, sw(bk.rr * 0.93), '#1d2023');
    const rim = sw(0.215);
    g.strokeStyle = '#b8bdc2';
    g.lineWidth = Math.max(1, cam.px(0.022, rim[0][2]));
    g.beginPath();
    rim.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
    g.closePath();
    g.stroke();
    const hub = S(xf([axle[0], side, axle[2]]));
    g.strokeStyle = '#c4c8cc';
    g.lineWidth = Math.max(0.7, cam.px(0.006, hub[2]));
    g.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const p0 = S(xf([axle[0] + Math.cos(a) * 0.04, side * 0.6, axle[2] + Math.sin(a) * 0.04]));
      const p1 = S(xf([axle[0] + Math.cos(a + 0.42) * 0.21, side, axle[2] + Math.sin(a + 0.42) * 0.21]));
      g.moveTo(p0[0], p0[1]);
      g.lineTo(p1[0], p1[1]);
    }
    g.stroke();
    if (front) {
      const disc0 = sw(0.11, 18);
      g.strokeStyle = '#8a9096';
      g.lineWidth = Math.max(1, cam.px(0.025, hub[2]));
      g.beginPath();
      disc0.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
      g.closePath();
      g.stroke();
    }
    disc(g, hub, cam.px(0.045, hub[2]), '#5c6166');
    disc(g, hub, cam.px(0.018, hub[2]), '#c9cdd1');
  };

  const col = bk.color;
  const frontAxle = [bk.L, 0, bk.rr];

  // Front end, turning with the bars about the steering axis.
  part('frontWheel', () => wheel(frontAxle, bk.tf / 2, steer, true));
  part('fork', () => {
    for (const y of [-0.075, 0.075]) {
      const lo = v3.add(frontAxle, [0, y, 0]);
      const mid = v3.add(lo, v3.mul(AXIS, -0.36));
      const top = v3.add(lo, v3.mul(AXIS, -0.78));
      seg(lo, mid, '#d4a52a', 0.042, steer);
      seg(mid, top, '#2a2d31', 0.052, steer);
    }
    const f = (x, z) => v3.add(axisAt(z), v3.mul(FORK_FWD, x));
    const fender = [
      [-0.3, 0.83],
      [0.05, 0.86],
      [0.36, 0.8],
      [0.38, 0.76],
      [0.05, 0.81],
      [-0.28, 0.79],
    ];
    prism(fender, -0.07, 0.07, '#1f2226', (p) => steer(v3.add(f(p[0], p[2]), [0, p[1], 0])));
    const clamp3 = [
      [-0.06, 0.84],
      [0.12, 0.84],
      [0.12, 0.88],
      [-0.06, 0.88],
    ];
    prism(clamp3, -0.1, 0.1, '#3a3f45', (p) => steer(v3.add(f(p[0], p[2]), [0, p[1], 0])));
    const cowl = [
      [0.05, 0.86],
      [0.18, 0.9],
      [0.2, 1.08],
      [0.08, 1.12],
    ];
    prism(cowl, -0.1, 0.1, '#1b1d20', (p) => steer(v3.add(f(p[0], p[2]), [0, p[1], 0])));
  });

  // Frame, engine and red side panels.
  part('frame', () => {
    seg(at3(0.28, 0, 0.4), at3(0.47, 0, 0.78), '#d8a21f', 0.05);
    prism(lng(circle(0.66, 0.36, 0.085, 18)), -0.085, 0.085, '#3a3f45');
    prism(
      lng([
        [1.0, 0.99],
        [0.93, 1.02],
        [0.44, 0.88],
        [0.34, 0.7],
        [0.44, 0.44],
        [0.78, 0.38],
        [0.99, 0.66],
      ]),
      -0.1,
      0.1,
      '#2b2f34',
    );
  });
  for (const sideY of [-1, 1]) {
    part(sideY < 0 ? 'panelL' : 'panelR', () => {
      prism(
        lng([
          [0.93, 0.95],
          [0.55, 0.86],
          [0.42, 0.74],
          [0.5, 0.55],
          [0.9, 0.6],
        ]),
        sideY * 0.112,
        sideY * 0.125,
        col,
      );
      if (sideY < 0) numberOn(g, cam, W, at3(0.66, -0.126, 0.73), 0.16, '8', '#16181a', [1, 0, 0], [0, 0, 1]);
    });
  }

  // Swingarm, rear shock, rear wheel, seat and tail.
  for (const sideY of [-1, 1]) {
    part(sideY < 0 ? 'armL' : 'armR', () =>
      prism(
        lng([
          [-0.05, 0.27],
          [0.6, 0.38],
          [0.6, 0.46],
          [-0.05, 0.34],
        ]),
        sideY * 0.07,
        sideY * 0.1,
        '#9aa1a8',
      ),
    );
  }
  part('rearWheel', () => wheel([0, 0, bk.rr], bk.tr / 2, (p) => p, false));
  part('seat', () =>
    prism(
      lng([
        [-0.12, 0.86],
        [0.8, 0.86],
        [0.84, 0.9],
        [0.79, 0.94],
        [-0.1, 0.93],
      ]),
      -0.088,
      0.088,
      '#17191c',
    ),
  );
  part('tail', () => {
    prism(
      lng([
        [-0.42, 0.79],
        [-0.4, 0.83],
        [0.05, 0.87],
        [0.26, 0.85],
        [0.26, 0.76],
        [0.0, 0.72],
        [-0.39, 0.745],
      ]),
      -0.072,
      0.072,
      col,
    );
    prism(
      [
        [-0.43, 0.755],
        [-0.405, 0.755],
        [-0.405, 0.79],
        [-0.43, 0.79],
      ],
      -0.04,
      0.04,
      '#ff3b30',
    );
    const tl = S([-0.43, 0, 0.772]);
    const glow = g.createRadialGradient(tl[0], tl[1], 0, tl[0], tl[1], cam.px(0.18, tl[2]));
    glow.addColorStop(0, 'rgba(255,60,48,0.45)');
    glow.addColorStop(1, 'rgba(255,60,48,0)');
    g.fillStyle = glow;
    g.fillRect(tl[0] - 200, tl[1] - 200, 400, 400);
    prism(
      [
        [-0.36, 0.5],
        [-0.345, 0.5],
        [-0.345, 0.66],
        [-0.36, 0.66],
      ],
      -0.095,
      0.095,
      '#ece8dd',
    );
    numberOn(g, cam, W, [-0.362, 0, 0.58], 0.13, '8', '#16181a', [0, 1, 0], [0, 0, 1]);
  });
  for (const sideY of [-1, 1])
    part(sideY < 0 ? 'pegL' : 'pegR', () =>
      prism(
        lng([
          [0.37, 0.355],
          [0.47, 0.355],
          [0.47, 0.385],
          [0.37, 0.385],
        ]),
        sideY * 0.11,
        sideY * 0.25,
        '#4a5056',
      ),
    );

  // Handlebar, turning with the steering.
  const barAt = (y) => steer([HEAD[0] - 0.08, y, HEAD[2] + 0.1]);
  const gripL = barAt(-0.39),
    gripR = barAt(0.39);
  part('bar', () => {
    const c0 = steer([HEAD[0], 0, HEAD[2] + 0.02]);
    seg(c0, barAt(0), '#2a2d31', 0.05);
    seg(barAt(-0.32), barAt(0.32), '#1b1d20', 0.026);
    seg(gripL, barAt(-0.3), '#0c0d0e', 0.045);
    seg(gripR, barAt(0.3), '#0c0d0e', 0.045);
    seg(barAt(-0.27), steer([HEAD[0] + 0.05, -0.35, HEAD[2] + 0.08]), '#8a9096', 0.012);
    seg(barAt(0.27), steer([HEAD[0] + 0.05, 0.35, HEAD[2] + 0.08]), '#8a9096', 0.012);
  });

  // The rider. The hips move over the pegs, the torso leans about a third of the bike's lean.
  const rig = riderRig(pose);
  const { T, tilt } = rig;
  const drawLeg = (side) => {
    const { hj, knee, an } = side < 0 ? rig.legL : rig.legR;
    limb(hj, knee, RIDER_COL.pants, 0.16);
    limb(knee, an, RIDER_COL.pants, 0.12);
    limb(v3.add(knee, [0.02, 0, 0.02]), v3.mix(knee, an, 0.45), RIDER_COL.guard, 0.07);
    const fwd = W([1, 0, 0]);
    const up = [0, 0, 1];
    const lat = v3.cross(up, fwd);
    const boot = (x, y, z) => cam.proj(v3.add(an, v3.add(v3.mul(fwd, x), v3.add(v3.mul(lat, y), [0, 0, z]))));
    const pts = [];
    for (const x of [-0.1, 0.13])
      for (const y of [-0.045, 0.045]) for (const z of [-0.05, 0.13]) pts.push(boot(x, y, z));
    poly(g, hull(pts), lit(RIDER_COL.boot, 0.9));
    const sole = [];
    for (const x of [-0.1, 0.13])
      for (const y of [-0.047, 0.047]) for (const z of [-0.06, -0.035]) sole.push(boot(x, y, z));
    poly(g, hull(sole), '#1b1d20');
  };
  part('legR', () => drawLeg(1));
  part('legL', () => drawLeg(-1));

  const drawArm = (side) => {
    const { sh, el, grip } = side < 0 ? rig.armL : rig.armR;
    limb(sh, el, RIDER_COL.jersey, 0.11);
    limb(el, grip, RIDER_COL.jersey, 0.09);
    const a = cam.proj(v3.mix(sh, el, 0.3)),
      b = cam.proj(v3.mix(el, grip, 0.75));
    line(g, a, b, RIDER_COL.accent, cam.px(0.016, a[2]));
    const G0 = cam.proj(grip);
    disc(g, G0, cam.px(0.048, G0[2]), RIDER_COL.glove);
  };
  part('handR', () => drawArm(1));

  // Torso as a tapered box, the back with the number.
  const torso = () => {
    const c = (x, y, z) => T([x, y, z]);
    const wy = (k) => 0.16 + 0.05 * k;
    const corner = (fx, sy, k) => c(0.22 * k + fx * (0.09 + 0.01 * k), sy * wy(k), 0.46 * k);
    const box = {
      back: [corner(-1, -1, 0), corner(-1, 1, 0), corner(-1, 1, 1), corner(-1, -1, 1)],
      front: [corner(1, 1, 0), corner(1, -1, 0), corner(1, -1, 1), corner(1, 1, 1)],
      left: [corner(1, -1, 0), corner(-1, -1, 0), corner(-1, -1, 1), corner(1, -1, 1)],
      right: [corner(-1, 1, 0), corner(1, 1, 0), corner(1, 1, 1), corner(-1, 1, 1)],
      top: [corner(-1, -1, 1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, -1, 1)],
    };
    const center = c(0.11, 0, 0.23);
    const faces = [];
    for (const [name, pts] of Object.entries(box)) {
      const m = pts.reduce((s, q) => v3.add(s, q), [0, 0, 0]).map((v) => v / 4);
      const n = v3.norm(v3.sub(m, center));
      if (v3.dot(n, v3.sub(cam.C, m)) <= 0) continue;
      faces.push({ name, pts, z: cam.depth(m), k: 0.45 + 0.55 * Math.max(0, v3.dot(n, LIGHT)) });
    }
    faces.sort((a, b) => b.z - a.z);
    for (const f of faces) {
      poly(
        g,
        f.pts.map((q) => cam.proj(q)),
        lit(RIDER_COL.jersey, f.k),
      );
      if (f.name === 'back') {
        const m = v3.mix(f.pts[0], f.pts[2], 0.5);
        const up = v3.norm(v3.sub(v3.mix(f.pts[3], f.pts[2], 0.5), v3.mix(f.pts[0], f.pts[1], 0.5)));
        const right = v3.norm(v3.sub(f.pts[1], f.pts[0]));
        numberOn(g, cam, (p) => p, v3.add(m, v3.mul(up, 0.02)), 0.2, '8', RIDER_COL.accent, right, up);
      }
      if (f.name === 'left' || f.name === 'back') {
        const a = cam.proj(v3.mix(f.pts[0], f.pts[3], 0.15)),
          b = cam.proj(v3.mix(f.pts[0], f.pts[3], 0.85));
        if (f.name === 'left') line(g, a, b, RIDER_COL.accent, cam.px(0.02, a[2]));
      }
    }
    // Waist band of the pants.
    const wb = [c(-0.1, -0.165, 0), c(-0.1, 0.165, 0), c(-0.1, 0.165, 0.07), c(-0.1, -0.165, 0.07)].map((q) =>
      cam.proj(q),
    );
    poly(g, wb, lit(RIDER_COL.pants, 0.9));
  };
  part('torso', torso);
  part('handL', () => drawArm(-1));

  // Helmet with the peak and goggles, looking forward.
  part('helmet', () => {
    const neckA = T([0.22, 0, 0.46]),
      neckB = T([0.26, 0, 0.56]);
    limb(neckA, neckB, '#1b1f24', 0.1);
    const hc = T([0.3, 0, 0.7]);
    const H = cam.proj(hc);
    const r = cam.px(0.14, H[2]);
    const grad = g.createRadialGradient(H[0] - r * 0.35, H[1] - r * 0.4, r * 0.1, H[0], H[1], r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, RIDER_COL.helmet);
    grad.addColorStop(1, '#9d9a92');
    disc(g, H, r, grad);
    const hp = (x, y, z) => cam.proj(v3.add(hc, roll([x, y, z], tilt)));
    // Orange stripe over the top, front to back.
    g.strokeStyle = RIDER_COL.accent;
    g.lineWidth = Math.max(1, r * 0.16);
    g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (0.15 + 0.7 * (i / 10));
      const p = hp(Math.cos(a) * 0.138, 0, Math.sin(a) * 0.138);
      i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]);
    }
    g.stroke();
    // Peak and goggles strap.
    poly(
      g,
      [hp(0.08, -0.09, 0.11), hp(0.25, -0.08, 0.08), hp(0.25, 0.08, 0.08), hp(0.08, 0.09, 0.11)],
      lit('#2a2d31', 1),
    );
    g.strokeStyle = '#1b1f24';
    g.lineWidth = Math.max(1, r * 0.16);
    g.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * (0.5 + i / 12);
      const p = hp(Math.cos(a) * 0.14 + 0.02, Math.sin(a) * 0.14, 0.0);
      i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]);
    }
    g.stroke();
  });

  const footOut = pose.foot > 0.3 || (pose.dab > 0.3 && pose.side < 0);
  // prettier-ignore
  const order = ['frontWheel', 'fork', 'legR', 'panelR', 'armR', 'pegR', 'frame', 'bar', 'handR', 'seat',
    'panelL', 'armL', 'pegL', footOut ? null : 'legL', 'rearWheel', 'tail', footOut ? 'legL' : null, 'torso', 'handL', 'helmet'];
  for (const name of order) if (name) layers[name]();
}

/** Where the rider's joints are in the world: hips over the pegs, legs and arms reaching the pegs and grips. */
function riderRig(pose) {
  const phi = pose.phi;
  const W = (p) => roll(p, phi);
  const steer = (p) => rotAbout(p, HEAD, AXIS, -pose.d);
  const barAt = (y) => steer([HEAD[0] - 0.08, y, HEAD[2] + 0.1]);
  // With a foot reaching down to the asphalt the hips drop and the other knee bends.
  const sit = 0.1 * Math.max(pose.foot, pose.dab);
  const hip = at3(0.3, pose.u, 0.97 - sit);
  const hipW = W(hip);
  const tilt = 0.35 * phi;
  const T = (off) => v3.add(hipW, roll(off, tilt));
  const pegW = (side) => W(at3(0.42, side * 0.19, 0.42));
  const groundFoot = (side) => at3(0.48, side * FOOT_ARM + Math.sin(phi) * 0.1, 0.06);
  const ankle = (side) => {
    if (side < 0 && pose.foot > 0) return v3.mix(pegW(side), groundFoot(side), pose.foot);
    if (pose.dab && side === pose.side) return v3.mix(pegW(side), groundFoot(side), pose.dab);
    return pegW(side);
  };
  const leg = (side) => {
    const hj = W(v3.add(hip, [0, side * 0.12, 0]));
    const an = ankle(side);
    const dd = v3.sub(an, hj);
    const L0 = Math.min(v3.len(dd), 0.92);
    const lt = 0.46,
      ls = 0.47;
    const along = (lt * lt - ls * ls + L0 * L0) / (2 * L0);
    const out = Math.sqrt(Math.max(0, lt * lt - along * along));
    const dn = v3.norm(dd);
    let bend = v3.norm(roll([1, side * 0.3, 0.05], phi));
    bend = v3.norm(v3.sub(bend, v3.mul(dn, v3.dot(bend, dn))));
    const knee = v3.add(v3.add(hj, v3.mul(dn, along)), v3.mul(bend, out));
    return { hj, knee, an };
  };
  const arm = (side) => {
    const sh = T([0.22, side * 0.2, 0.46]);
    const grip = W(barAt(side * 0.39));
    const dd = v3.sub(grip, sh);
    const L0 = Math.min(v3.len(dd), 0.63);
    const la = 0.32;
    const out = Math.sqrt(Math.max(0, la * la - (L0 / 2) * (L0 / 2)));
    const dn = v3.norm(dd);
    let bend = v3.norm([0.1, side, -0.5]);
    bend = v3.norm(v3.sub(bend, v3.mul(dn, v3.dot(bend, dn))));
    const el = v3.add(v3.add(sh, v3.mul(dn, L0 / 2)), v3.mul(bend, out));
    return { sh, el, grip };
  };
  return { W, steer, barAt, hipW, tilt, T, legL: leg(-1), legR: leg(1), armL: arm(-1), armR: arm(1) };
}

/**
 * The shadow the lamp casts on the asphalt, drawn in black on g; the caller makes it transparent.
 * Returns the box on screen that the shadow covers, [left, top, right, bottom].
 */
function shadowShapes(g, cam, pose) {
  const rig = riderRig(pose);
  const { W, steer, T } = rig;
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const sh = (p) => {
    const q = cam.proj([p[0] + p[2] * SHADOW_DIR[0], p[1] + p[2] * SHADOW_DIR[1], 0]);
    box[0] = Math.min(box[0], q[0]);
    box[1] = Math.min(box[1], q[1]);
    box[2] = Math.max(box[2], q[0]);
    box[3] = Math.max(box[3], q[1]);
    return q;
  };
  const blob = (pts) => poly(g, hull(pts.map(sh)), '#000');
  const bar = (a, b, wM) => {
    const A = sh(a),
      B = sh(b);
    line(g, A, B, '#000', Math.max(1, cam.px(wM, (A[2] + B[2]) / 2)));
  };
  const wheel = (x, wd, xf) => {
    const out = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      for (const y of [-wd / 2, wd / 2])
        out.push(W(xf([x + Math.cos(a) * BIKE.rr, y, BIKE.rr + Math.sin(a) * BIKE.rr])));
    }
    return out;
  };
  blob(wheel(0, BIKE.tr, (p) => p));
  blob(wheel(BIKE.L, BIKE.tf, steer));
  const body = [];
  for (const [x, z] of [
    [-0.43, 0.76],
    [-0.4, 0.84],
    [0.8, 0.94],
    [1.0, 1.0],
    [0.99, 0.62],
    [0.75, 0.3],
    [0.4, 0.3],
    [0.0, 0.3],
  ])
    for (const y of [-0.1, 0.1]) body.push(W(at3(x, y, z)));
  blob(body);
  bar(W(steer([BIKE.L, 0, BIKE.rr])), W(steer(HEAD)), 0.12);
  bar(W(rig.barAt(-0.39)), W(rig.barAt(0.39)), 0.05);
  const torso = [];
  for (const x of [-0.1, 0.32]) for (const y of [-0.2, 0.2]) for (const z of [0, 0.5]) torso.push(T([x, y, z]));
  blob(torso);
  const head = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    head.push(
      T([0.3 + Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.7]),
      T([0.3, Math.cos(a) * 0.15, 0.7 + Math.sin(a) * 0.15]),
    );
  }
  blob(head);
  for (const L of [rig.legL, rig.legR]) {
    bar(L.hj, L.knee, 0.16);
    bar(L.knee, L.an, 0.13);
    blob([
      L.an,
      v3.add(L.an, [0.14, 0, 0]),
      v3.add(L.an, [-0.12, 0, 0]),
      v3.add(L.an, [0, 0.05, -0.05]),
      v3.add(L.an, [0, -0.05, -0.05]),
    ]);
  }
  for (const A of [rig.armL, rig.armR]) {
    bar(A.sh, A.el, 0.11);
    bar(A.el, A.grip, 0.09);
  }
  return box;
}

/** A number of height size [m] centred at point c (already in world) on the plane spanned by unit right and up. */
function numberOn(g, cam, W, c, size, text, col, right, up) {
  const o = W(c);
  const r = v3.sub(W(v3.add(c, v3.mul(right, size))), o);
  const u = v3.sub(W(v3.add(c, v3.mul(up, size))), o);
  // Only on a face turned towards the camera.
  const n = v3.cross(r, u);
  if (Math.abs(v3.dot(v3.norm(n), v3.norm(v3.sub(cam.C, o)))) < 0.12) return;
  const O = cam.proj(o),
    R = cam.proj(v3.add(o, r)),
    U = cam.proj(v3.add(o, u));
  const ax = (R[0] - O[0]) / size,
    ay = (R[1] - O[1]) / size,
    bx = -(U[0] - O[0]) / size,
    by = -(U[1] - O[1]) / size;
  const facing = v3.dot(n, v3.sub(cam.C, o)) > 0;
  const k = size / 100;
  g.save();
  g.transform((facing ? ax : -ax) * k, (facing ? ay : -ay) * k, bx * k, by * k, O[0], O[1]);
  g.fillStyle = col;
  g.font = `700 100px ${FONT_DISPLAY}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 0, 0);
  g.restore();
}
