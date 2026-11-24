// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// A square in the city at night, seen from behind and to the left of the bike: the street with its
// lamps and houses, the asphalt with the chalk box and the cones, the shadow, the bike and rider,
// the CoG over its support, and the support panel with the contact patches seen from above.

const cv = $('cv');
const ctx = cv.getContext('2d');
const CAM_T = [0.62, 0.05, 0.84]; // the camera looks at this point [m]
const CAM_AZ = 30 * RAD; // and stands this far to the left of straight behind
const CAM_DIST = 4.1; // [m]
const CAM_Z = 1.85; // eye height [m]
const backdrop = { key: '', canvas: null };
const shadowLayer = document.createElement('canvas');
const SHADOW_RES = 0.4; // pixels of the shadow layer per CSS pixel

/** A seeded random number generator, so that the city looks the same every time. */
function seeded(seed) {
  let r = seed;
  return () => (r = (r * 16807) % 2147483647) / 2147483647;
}

function sceneLayout(w, h) {
  const narrow = w < 560;
  const supW = cfg.sup ? clamp(w * (narrow ? 0.32 : 0.25), 112, 250) : 0;
  const room = w - supW;
  const F = Math.min(h * 1.32, room * 1.55);
  const cam = makeCamera(CAM_T, CAM_AZ, CAM_DIST, CAM_Z, F, room * 0.5, h * (narrow ? 0.6 : 0.56));
  return { narrow, supW, cam };
}

/** The part of a ground polygon in front of the camera, projected; null when nothing is left. */
function projPoly(cam, pts, near = 0.6) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    const da = cam.proj(a)[2],
      db = cam.proj(b)[2];
    if (da >= near) out.push(cam.proj(a));
    if (da >= near !== db >= near) out.push(cam.proj(v3.mix(a, b, (near - da) / (db - da))));
  }
  return out.length >= 3 ? out : null;
}

/** A soft round glow lying on the ground around c with radius r [m]. */
function groundGlow(g, cam, c, r, col, a) {
  const P = cam.proj(c);
  const ex = cam.proj(v3.add(c, [0, r, 0])),
    ez = cam.proj(v3.add(c, [r, 0, 0])),
    en = cam.proj(v3.add(c, [-Math.min(r, 2), 0, 0]));
  const rx = Math.max(4, Math.hypot(ex[0] - P[0], ex[1] - P[1]));
  const ry = Math.max(2, (Math.abs(en[1] - P[1]) + Math.abs(ez[1] - P[1])) / 2);
  g.save();
  g.translate(P[0], P[1]);
  g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, alpha(col, a));
  gr.addColorStop(0.55, alpha(col, a * 0.45));
  gr.addColorStop(1, alpha(col, 0));
  g.fillStyle = gr;
  g.fillRect(-rx, -rx, 2 * rx, 2 * rx);
  g.restore();
}

/** Everything that never moves: sky, houses, street, asphalt, chalk and cones. */
function paintBackdrop(g, cam, w, h) {
  const rnd = seeded(8);
  const horizon = cam.proj([CAM_T[0] + 1e5 * Math.cos(CAM_AZ), CAM_T[1] + 1e5 * Math.sin(CAM_AZ), 0])[1];
  const hy = clamp(horizon, 0, h);
  const sky = g.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, '#080b10');
  sky.addColorStop(0.7, '#141a22');
  sky.addColorStop(1, '#2a2a2c');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, hy + 1);
  g.fillStyle = 'rgba(236,232,221,0.5)';
  for (let i = 0; i < 26; i++) g.fillRect(rnd() * w, rnd() * hy * 0.55, 1, 1);
  const ground = g.createLinearGradient(0, hy, 0, h);
  ground.addColorStop(0, '#16181b');
  ground.addColorStop(1, '#2a2e33');
  g.fillStyle = ground;
  g.fillRect(0, hy, w, h - hy);

  // Houses beyond the street on the right and across the far end of the square.
  const house = (pts, col) => {
    const q = projPoly(cam, pts);
    if (q) poly(g, q, col);
  };
  const windows = (o, along, wd, ht, floors, cols) => {
    for (let f = 0; f < floors; f++)
      for (let k = 0; k < cols; k++) {
        const r = rnd();
        const col =
          r < 0.17
            ? `rgba(255,${190 + Math.round(rnd() * 40)},${110 + Math.round(rnd() * 50)},${0.42 + rnd() * 0.3})`
            : r < 0.21
              ? 'rgba(150,190,255,0.32)'
              : 'rgba(120,140,170,0.05)';
        const x0 = 0.8 + k * (wd / cols),
          z0 = 4.2 + f * 3.1;
        const a = v3.add(o, v3.add(v3.mul(along, x0), [0, 0, z0]));
        const b = v3.add(a, v3.mul(along, 1.0));
        house([a, b, v3.add(b, [0, 0, 1.4]), v3.add(a, [0, 0, 1.4])], col);
      }
  };
  const shop = (o, along, wd) => {
    for (let x = 1; x < wd - 2; x += 4.2) {
      const a = v3.add(o, v3.mul(along, x));
      const b = v3.add(a, v3.mul(along, 3));
      const lit = rnd() < 0.55;
      house(
        [a, b, v3.add(b, [0, 0, 2.6]), v3.add(a, [0, 0, 2.6])],
        lit ? 'rgba(255,214,150,0.32)' : 'rgba(120,140,170,0.08)',
      );
    }
  };
  // Far end, facing the camera, from the left to the street.
  for (let y = -6; y < 31; ) {
    const wd = 9 + rnd() * 9;
    const ht = 10 + rnd() * 18;
    const x = 78;
    const o = [x, y, 0];
    const along = [0, 1, 0];
    house([o, [x, y + wd, 0], [x, y + wd, ht], [x, y, ht]], rnd() < 0.5 ? '#12161c' : '#151a21');
    windows(o, along, wd, ht, Math.floor((ht - 4.5) / 3.1), Math.max(1, Math.floor(wd / 2.6)));
    shop(o, along, wd);
    y += wd + 0.4;
  }
  // The right side of the street, from the far end towards the camera, so the near ones cover the far.
  const right = [];
  for (let x = 6; x < 78; ) {
    const wd = 10 + rnd() * 10;
    right.push({ x, wd, ht: 9 + rnd() * 16, tone: rnd() });
    x += wd + 0.5;
  }
  for (let i = right.length - 1; i >= 0; i--) {
    const { x, wd, ht, tone } = right[i];
    const y = 31;
    house(
      [
        [x, y, 0],
        [x, y + 12, 0],
        [x, y + 12, ht],
        [x, y, ht],
      ],
      '#0b0e12',
    );
    const o = [x, y, 0];
    house([o, [x + wd, y, 0], [x + wd, y, ht], [x, y, ht]], tone < 0.5 ? '#141920' : '#181d25');
    windows(o, [1, 0, 0], wd, ht, Math.floor((ht - 4.5) / 3.1), Math.max(1, Math.floor(wd / 2.6)));
    shop(o, [1, 0, 0], wd);
  }

  // Haze over the city: the glow of the street lights near the horizon.
  const haze = g.createLinearGradient(0, hy * 0.35, 0, hy);
  haze.addColorStop(0, 'rgba(40,40,44,0)');
  haze.addColorStop(1, 'rgba(58,50,44,0.55)');
  g.fillStyle = haze;
  g.fillRect(0, hy * 0.35, w, hy * 0.65 + 1);

  // The street: pavement, kerb, the carriageway with its centre line, the pavement by the houses.
  const strip = (y0, y1, col) =>
    house(
      [
        [-6, y0, 0],
        [200, y0, 0],
        [200, y1, 0],
        [-6, y1, 0],
      ],
      col,
    );
  strip(10, 12, '#24272b');
  strip(12, 28, '#141618');
  strip(28, 31, '#1e2124');
  const gl = (a, b, col, wM) => {
    const q = projPoly(cam, [a, b, v3.add(b, [0, 0.001, 0])]);
    if (q) line(g, q[0], q[1], col, Math.max(0.6, cam.px(wM, (q[0][2] + q[1][2]) / 2)));
  };
  gl([-6, 10, 0], [200, 10, 0], 'rgba(200,204,208,0.35)', 0.12);
  gl([-6, 12, 0], [200, 12, 0], 'rgba(200,204,208,0.18)', 0.1);
  for (let x = -4; x < 120; x += 6) gl([x, 20, 0], [x + 3, 20, 0], 'rgba(236,232,221,0.22)', 0.12);

  // Asphalt grain on the square.
  for (let i = 0; i < 2600; i++) {
    const x = -3 + rnd() * 40,
      y = -5 + rnd() * 15;
    const P = cam.proj([x, y, 0]);
    if (P[2] < 0.8 || P[0] < 0 || P[0] > w || P[1] < hy || P[1] > h) continue;
    const s = Math.max(0.6, cam.px(0.03, P[2]));
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.16)';
    g.fillRect(P[0], P[1], s, s * 0.6);
  }
  // Patches of newer asphalt and a crack, so the square is not a flat colour.
  for (let i = 0; i < 6; i++) {
    const cx = 2 + rnd() * 18,
      cy = -3 + rnd() * 12,
      r = 0.8 + rnd() * 1.6;
    const pts = [];
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const rr = r * (0.75 + rnd() * 0.4);
      pts.push([cx + Math.cos(a) * rr * 1.4, cy + Math.sin(a) * rr, 0]);
    }
    const q = projPoly(cam, pts);
    if (q) poly(g, q, 'rgba(0,0,0,0.12)');
  }

  // Lamplight: pools under the street lamps and the lamp that lights the bike, behind the camera.
  for (let x = 10; x < 90; x += 14) groundGlow(g, cam, [x, 11.5, 0], 4.5, '#ffd9a0', 0.16);
  groundGlow(g, cam, [0.8, 0.2, 0], 5.5, '#ffe2b8', 0.2);

  // The trackstand box in chalk, and the start mark.
  const chalk = alpha(COL.chalk, 0.6);
  const box = [
    [-0.9, -1.05],
    [2.3, -1.05],
    [2.3, 1.05],
    [-0.9, 1.05],
  ];
  for (let i = 0; i < 4; i++) {
    const [x0, y0] = box[i],
      [x1, y1] = box[(i + 1) % 4];
    gl([x0, y0, 0], [x1, y1, 0], chalk, 0.06);
  }
  gl([-0.9, 0, 0], [-0.55, 0, 0], chalk, 0.05);
  gl([2.3, 0, 0], [1.95, 0, 0], chalk, 0.05);

  // Cones of a GP8 layout further on: the near one blue on the left, the far one red on the right.
  const cone = (x, y, col) => {
    const base = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      base.push(cam.proj([x + Math.cos(a) * 0.19, y + Math.sin(a) * 0.19, 0]));
    }
    poly(g, hull(base), 'rgba(0,0,0,0.4)');
    const top = cam.proj([x, y, 0.45]);
    const l = cam.proj([x - 0.02, y - 0.13, 0.02]),
      r = cam.proj([x + 0.02, y + 0.13, 0.02]);
    poly(g, [l, r, top], col);
    const band = (z0, z1) => {
      const k0 = 0.13 * (1 - z0 / 0.45),
        k1 = 0.13 * (1 - z1 / 0.45);
      poly(
        g,
        [cam.proj([x, y - k0, z0]), cam.proj([x, y + k0, z0]), cam.proj([x, y + k1, z1]), cam.proj([x, y - k1, z1])],
        'rgba(255,255,255,0.85)',
      );
    };
    band(0.18, 0.25);
  };
  cone(6.5, -1.4, COL.coneN);
  cone(18.5, 2.8, COL.coneF);
  cone(2.9, -1.05, COL.cone);
  cone(2.9, 1.05, COL.cone);

  // Street lamps: pole, arm, lamp and its glow, from the far end towards the camera.
  for (let x = 80; x >= 10; x -= 14) {
    const base = cam.proj([x, 10.6, 0]),
      top = cam.proj([x, 10.6, 5.6]),
      head = cam.proj([x, 11.6, 5.5]);
    if (top[2] < 0.8) continue;
    line(g, base, top, '#2c3239', Math.max(1, cam.px(0.12, top[2])));
    line(g, top, head, '#2c3239', Math.max(1, cam.px(0.08, top[2])));
    const r = cam.px(1.6, head[2]);
    const glow = g.createRadialGradient(head[0], head[1], 0, head[0], head[1], r);
    glow.addColorStop(0, 'rgba(255,232,190,0.55)');
    glow.addColorStop(0.25, 'rgba(255,214,150,0.16)');
    glow.addColorStop(1, 'rgba(255,214,150,0)');
    g.fillStyle = glow;
    g.fillRect(head[0] - r, head[1] - r, 2 * r, 2 * r);
    disc(g, head, Math.max(1.5, cam.px(0.16, head[2])), '#fff1d6');
    // The cone of light down to the pavement.
    const ring = [head];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ring.push(cam.proj([x + Math.cos(a) * 2.6, 11.6 + Math.sin(a) * 2.6, 0]));
    }
    poly(g, hull(ring), 'rgba(255,226,170,0.025)');
  }
}

/** The cached backdrop, painted again only when the canvas or the layout changes. */
function drawBackdrop(cam, w, h, supW) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const key = [w, h, dpr, supW].join(' ');
  if (backdrop.key !== key) {
    const c = backdrop.canvas || document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBackdrop(g, cam, w, h);
    backdrop.canvas = c;
    backdrop.key = key;
  }
  ctx.drawImage(backdrop.canvas, 0, 0, w, h);
}

/** The pose to draw: the bike as it is, standing up from the foot, or going down onto a foot after a dab. */
function currentPose() {
  const pose = { phi: S.phi, d: S.d, u: S.u, foot: footK, dab: 0, side: 0 };
  if (fall) {
    pose.phi = fall.phi;
    pose.dab = fall.k;
    pose.side = fall.side;
    pose.foot = 0;
  }
  return pose;
}

/** Colour of the CoG off the middle of the zone by off: green inside, yellow just beside it, red far outside. */
function zoneCol(off, zone) {
  return Math.abs(off) <= zone ? COL.ok : Math.abs(off) <= 2 * zone ? COL.warn : '#ef5350';
}

/** The CoG, the point straight below it, the balance zone and the point the tyres push from. */
function drawCogMarker(cam, pose) {
  const g = ctx;
  const c = prep(cfg.p);
  // Across the bike line in the frame of the bike, then put where the bike stands.
  const Gb = roll([BIKE.b, (BIKE.mr * pose.u) / c.M, c.h], pose.phi);
  const Gw = Gb;
  const at = (x, y) => [x, y, 0];
  const bx = BIKE.b;
  const off = Gb[1] - S.mid;
  const zone = S.zone;
  const col = zoneCol(off, zone);
  const band = projPoly(cam, [
    at(bx - 0.16, S.mid - zone),
    at(bx + 0.16, S.mid - zone),
    at(bx + 0.16, S.mid + zone),
    at(bx - 0.16, S.mid + zone),
  ]);
  if (band) poly(g, band, alpha(COL.ok, 0.45), alpha(COL.ok, 0.9), 1);
  const yP = fall ? Gb[1] : S.yP;
  const p0 = cam.proj(at(bx - 0.2, yP)),
    p1 = cam.proj(at(bx + 0.2, yP));
  line(g, p0, p1, alpha(COL.chalk, 0.9), Math.max(1.2, cam.px(0.012, p0[2])));
  const top = cam.proj(Gw),
    foot = cam.proj(at(bx, Gb[1]));
  g.setLineDash([4, 4]);
  line(g, top, foot, alpha(col, 0.85), 1.5);
  g.setLineDash([]);
  ring(g, top, cam.px(0.05, top[2]), col, 2);
  disc(g, top, cam.px(0.018, top[2]), col);
  disc(g, foot, Math.max(3, cam.px(0.028, foot[2])), col);
}

function drawScene() {
  const { w, h } = fit(cv, ctx);
  const { narrow, supW, cam } = sceneLayout(w, h);
  drawBackdrop(cam, w, h, supW);
  const pose = currentPose();
  drawShadow(cam, pose, w, h);
  drawBike3d(ctx, cam, pose);
  if (cfg.sup) {
    drawCogMarker(cam, pose);
    drawSupport(w - supW - 10, 10, supW, Math.min(h - 20, Math.max(200, h * 0.74)), narrow);
  }
  drawHud(w, h, supW, narrow);
}

/**
 * The shadow of the bike and rider on the asphalt, in one layer, so that overlaps stay even. The
 * layer has fewer pixels than the screen: stretched over it, its edges come out soft, with no blur
 * filter, which is slow and which some browsers ignore.
 */
function drawShadow(cam, pose, w, h) {
  const W0 = Math.max(1, Math.round(w * SHADOW_RES)),
    H0 = Math.max(1, Math.round(h * SHADOW_RES));
  if (shadowLayer.width !== W0 || shadowLayer.height !== H0) {
    shadowLayer.width = W0;
    shadowLayer.height = H0;
  }
  const g = shadowLayer.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W0, H0);
  const kx = W0 / w,
    ky = H0 / h;
  g.setTransform(kx, 0, 0, ky, 0, 0);
  // Only the part of the layer with the shadow on it is laid over the picture; the margin covers
  // the width of the thickest lines.
  const [l, t, r, b] = shadowShapes(g, cam, pose);
  const x0 = Math.max(0, Math.floor(l - 24)),
    y0 = Math.max(0, Math.floor(t - 24));
  const x1 = Math.min(w, Math.ceil(r + 24)),
    y1 = Math.min(h, Math.ceil(b + 24));
  if (x1 <= x0 || y1 <= y0) return;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.drawImage(shadowLayer, x0 * kx, y0 * ky, (x1 - x0) * kx, (y1 - y0) * ky, x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}

/** Points of an oval w wide and l long in the bike's frame, centred at (x, y) and turned by a [m, rad]. */
function oval(x, y, w, l, a, n = 32) {
  const ca = Math.cos(a),
    sa = Math.sin(a);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const p = (l / 2) * Math.cos(t),
      q = (w / 2) * Math.sin(t);
    out.push([x + p * ca - q * sa, y + p * sa + q * ca]);
  }
  return out;
}

/** A tyre w wide seen from above, centred at (x, y) and turned by a: as long as the wheel, with round ends. */
function tyreTop(x, y, w, a) {
  const e = w / 2,
    r = BIKE.rr - e;
  const ca = Math.cos(a),
    sa = Math.sin(a);
  const out = [];
  for (const end of [1, -1])
    for (let i = 0; i <= 8; i++) {
      const t = ((end > 0 ? -1 : 1) * Math.PI) / 2 + (i / 8) * Math.PI;
      const p = end * r + e * Math.cos(t),
        q = e * Math.sin(t);
      out.push([x + p * ca - q * sa, y + p * sa + q * ca]);
    }
  return out;
}

/**
 * Centre of the front patch in the frame of the bike with the bars at d, and its turn a. The patch
 * trails the point where the steering axis meets the ground and swings about it.
 */
function frontPatchAt(d) {
  const a = groundSteer(d);
  return { fx: BIKE.L + BIKE.trail * (1 - Math.cos(a)), fy: frontShift(d), a };
}

/**
 * The balance zone of the game from above, from the rear patch to the front one: ZONE times as wide
 * as the patches reach across, so that at the CoG it is as wide as support() says.
 */
function zoneTop(c, d, at) {
  const { fx, fy, a } = frontPatchAt(d);
  const zr = ZONE * (c.wr / 2),
    zf = ZONE * patchHalf(c.wf, c.lf, a);
  return [at(0, -zr), at(fx, fy - zf), at(fx, fy + zf), at(0, zr)];
}

/**
 * Both tyres and their contact patches from above, to scale, for the bars at d and the tyres of c;
 * at maps a point of the bike's frame to the canvas. Returns the outlines of the patches.
 */
function drawTyresTop(g, at, c, d, lw) {
  const { fx, fy, a } = frontPatchAt(d);
  const map = (pts) => pts.map(([x, y]) => at(x, y));
  const rear = map(oval(0, 0, c.wr, c.lr, 0)),
    front = map(oval(fx, fy, c.wf, c.lf, a));
  poly(g, map(tyreTop(0, 0, BIKE.tr, 0)), '#26292d', alpha(COL.chalk, 0.28), lw);
  poly(g, map(tyreTop(fx, fy, BIKE.tf, a)), '#26292d', alpha(COL.chalk, 0.28), lw);
  poly(g, rear, '#c9cdd1');
  poly(g, front, '#c9cdd1');
  return { rear, front };
}

/** The contact patches from above, to scale, the balance zone around them and the CoG over it. */
function drawSupport(x, y, w, h, narrow) {
  const g = ctx;
  const c = prep(cfg.p);
  panel(x, y, w, h);
  const u = clamp(w / 220, 0.6, 1.1);
  g.fillStyle = COL.muted;
  g.font = `500 ${10 * u}px ${FONT_MONO}`;
  g.textAlign = 'left';
  g.fillText(i18n`PODPARCIE Z GÓRY`, x + 9 * u, y + 16 * u);

  // Top view to scale: front up, from the back of the rear tyre to the front of the front one.
  const gaugeH = 58 * u;
  const top = y + 26 * u,
    bot = y + h - gaugeH - 10 * u;
  const k = Math.min((bot - top) / (BIKE.L + 2 * BIKE.rr + 0.06), (w - 20 * u) / 1.0);
  const ox = x + w / 2,
    oy = bot - (BIKE.rr + 0.03) * k;
  const at = (bx, by) => [ox + by * k, oy - bx * k];
  const zone = S.zone;
  const mid = S.mid;
  line(g, at(-BIKE.rr, 0), at(BIKE.L + BIKE.rr, 0), alpha(COL.chalk, 0.16), 1);
  const { rear, front } = drawTyresTop(g, at, c, S.d, 1);
  poly(g, zoneTop(c, S.d, at), alpha(COL.ok, 0.16), alpha(COL.ok, 0.55), 1);
  poly(g, hull([...rear, ...front]), alpha(COL.chalk, 0.1), alpha(COL.chalk, 0.4), 1);
  poly(g, rear, '#c9cdd1');
  poly(g, front, '#c9cdd1');
  // Handlebar at the steering head, turned with the bars.
  const hx = axisAt(1.0)[0];
  const ga = groundSteer(S.d);
  const grip = (side) => {
    const p = -0.08,
      q = side * 0.39;
    return at(hx + p * Math.cos(ga) - q * Math.sin(ga), p * Math.sin(ga) + q * Math.cos(ga));
  };
  line(g, grip(-1), grip(1), alpha(COL.spd, 0.9), 2.5 * u);
  // The foot on the asphalt while the bike rests on it.
  if (footK > 0.5 && !fall) {
    const fp = at(0.5, -FOOT_ARM);
    g.fillStyle = alpha(COL.warn, 0.85);
    g.font = `600 ${9 * u}px ${FONT_MONO}`;
    g.textAlign = 'center';
    disc(g, fp, 4 * u, alpha(COL.warn, 0.85));
    g.fillText(i18n`stopa`, fp[0], fp[1] - 7 * u);
  }
  // CoG and the point the tyres push from, at the CoG's station along the bike.
  const off = S.yG - mid;
  const state = zoneCol(off, zone);
  line(g, at(BIKE.b, mid - zone), at(BIKE.b, mid + zone), COL.ok, 3 * u);
  const yPt = at(BIKE.b, S.yP);
  line(g, [yPt[0], yPt[1] - 6 * u], [yPt[0], yPt[1] + 6 * u], COL.chalk, 1.5 * u);
  if (cfg.trend && phase === 'ride') {
    const tp = at(BIKE.b, S.yG + S.yGv * 0.25);
    ring(g, tp, 5 * u, alpha(COL.chalk, 0.8), 1.5);
  }
  disc(g, at(BIKE.b, S.yG), 4.5 * u, state);
  // Scale: ten centimetres.
  const sb = [x + w - 10 * u - 0.1 * k, y + 22 * u];
  line(g, sb, [sb[0] + 0.1 * k, sb[1]], COL.dim, 1.5);
  g.fillStyle = COL.dim;
  g.font = `500 ${9 * u}px ${FONT_MONO}`;
  g.textAlign = 'right';
  g.fillText(i18n`10 cm`, x + w - 8 * u, y + 16 * u);

  // Gauge: the balance zone under the CoG, centimetres to scale.
  const gy = y + h - gaugeH;
  const gx0 = x + 12 * u,
    gx1 = x + w - 12 * u;
  const SPAN = 0.12;
  const gxOf = (m) => (gx0 + gx1) / 2 + (clamp(m, -SPAN, SPAN) / SPAN) * ((gx1 - gx0) / 2);
  g.fillStyle = COL.muted;
  g.font = `500 ${9.5 * u}px ${FONT_MONO}`;
  g.textAlign = 'left';
  g.fillText(i18n`POD ŚRODKIEM CIĘŻKOŚCI`, gx0, gy + 4 * u);
  const by = gy + 22 * u;
  g.fillStyle = COL.rule;
  g.fillRect(gx0, by - 4 * u, gx1 - gx0, 8 * u);
  g.fillStyle = alpha(COL.ok, 0.65);
  g.fillRect(gxOf(mid - zone), by - 4 * u, gxOf(mid + zone) - gxOf(mid - zone), 8 * u);
  g.fillStyle = COL.dim;
  for (let cm = -10; cm <= 10; cm += 5) g.fillRect(gxOf(cm / 100) - 0.5, by + 5 * u, 1, cm % 10 ? 3 * u : 5 * u);
  line(g, [gxOf(S.yP), by - 8 * u], [gxOf(S.yP), by + 8 * u], COL.chalk, 1.5 * u);
  disc(g, [gxOf(S.yG), by], 6 * u, state);
  g.fillStyle = COL.muted;
  g.textAlign = 'center';
  g.fillText(i18n`strefa ±${fmt(zone * 100, 1)} cm · CoG ${fmt(off * 100, 1)} cm`, (gx0 + gx1) / 2, by + 22 * u);
}
