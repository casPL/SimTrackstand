// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Maciej Kasprzyk
//
// Constants of the model. SI units throughout; the bike is seen from behind, y to the rider's
// right, z up. The roll angle phi and the steering angle grow to the right.

const G = 9.81;
const DT = 1 / 240; // physics time step [s]
const HIP_W = 9; // hips following their target over the pegs: natural frequency [rad/s], critically damped
const HIP_RATE = 0.4; // with the foot down: how fast a held key moves the hips [m/s]
const HIP_SWING = 0.08; // on the pegs: how far a held key takes the hips from where they were set [m]
const BAR_W = 16; // handlebar following its target: natural frequency [rad/s], critically damped
const STEER_RATE = 60; // handlebar target speed while a key is held [°/s]
const P0 = 40; // pressure the tyre carcass carries on its own [kPa]
const ZONE = 2; // the balance zone of the game is this many times wider than the band between the patches
const FOLLOW = 0.8; // inside the zone, the share of the CoG's sideways movement the support follows at 2.2 bar
const FOLLOW_SOFT = 0.11; // and how much more at 0.8 bar; below 1 the bike never stands up on its own
const DAB_DEG = 10; // the rider puts a foot down when the CoG leans this far from the support [°]
const LEAN_MAX = 28; // or when the bike itself leans this far [°]
const FOOT_LEAN = -2; // lean of the bike resting on the rider's left foot before standing up [°]
const FOOT_ARM = 0.45; // the foot stands this far from the line of the tyres [m]
const PRESSURES = [0.8, 1.2, 1.6, 2.0]; // tyre pressures to choose from [bar]

const RAD = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
