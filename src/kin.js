// Mud motor kinematics and dimensions. One input: the rotor angle th (radians, the rotor's spin about its own axis,
// which is also the bit box's rotation). Everything that moves, every flow particle and every readout is a function
// of th plus the settings (bend angle, on/off bottom, explode).
//
// Units: millimetres. Tool axis +x, from the top face of the top sub (x = 0) toward the bit. Cross-section plane is
// (y, z). "True" x is the real position along the tool; the power section is drawn with a break (DH-5 does the same),
// so true x maps to display x through disp().
//
// SOURCES: every dimension is INFERRED (scaled to a 6¾-in OD from DH-5's proportions) unless marked otherwise.
// The excerpt gives no dimensions beyond the tube range (1 11/16 to 11 1/4 in) and the "6¾" in DH-9's caption.

export const N_R = 5; // rotor lobes   (DH-8 as drawn)
export const N_S = 6; // stator lobes  (DH-8 as drawn; text: stator has one more lobe than the rotor)

export const D = {
  od: 171.5, // 6¾ in tool OD, from DH-9's caption
  e: 7, // rotor eccentricity, inferred
  Ls: 1000, // one stage = stator lead (DH-9 definition), length inferred
  stages: 7, // representative count, inferred
  tubeIR: 70, // stator tube inner radius, inferred
  lobeX0: 700, // lobed section start (true x)
  topSubEnd: 610,
  statorTop: 600,
  bendDefault: 1.5, // degrees, inferred setting
  bendMax: 3, // inferred range 0-3°
};
D.lobeX1 = D.lobeX0 + D.stages * D.Ls; // 7700
D.statorBot = D.lobeX1 + 100; // 7800
export const Lr = (D.Ls * N_R) / N_S; // rotor lead, derived: n/(n+1) of the stator lead
// a cavity advances one stage per orbit of the rotor axis, n stages per rotor turn (derived from the geometry)
export const CAV_PER_RAD = (N_R * D.Ls) / (2 * Math.PI);

// ------------------------------------------------------------ the break in the power section
export const XB1 = 2200; // last true x drawn above the break
export const XB2 = 6200; // first true x drawn below it
export const GAP = 170; // drawn gap
export const SHIFT = XB2 - XB1 - GAP;
export const disp = (x) => (x <= XB1 ? x : x >= XB2 ? x - SHIFT : NaN);
export const visibleTrue = (x) => x <= XB1 || x >= XB2;
export const HIDDEN_STAGES = (XB2 - XB1) / D.Ls;

// ------------------------------------------------------------ below the power section (true x)
export const X = {
  j1: 7950, // upper universal joint centre (on the rotor axis)
  adapterEnd: 8560,
  ringEnd: 8700,
  bend: 8700, // bend point on the axis, inferred at the adjusting ring
  j2: 9200, // lower universal joint centre (on the bent axis)
  brgTop: 9340,
  brgBot: 10900,
  mandrelTop: 9290,
  boxTop: 10920,
  boxBot: 11240,
};
export const XB = disp(X.bend);

// ------------------------------------------------------------ profiles
const TAU = Math.PI * 2;
const NT = 2048;
// stator: outer equidistant (offset r0) of a 6-cusp hypocycloid with rolling circle radius e.
// valleys (stator major) at N·e + r0, peaks (stator minor) at (N-2)·e + r0
export const R0 = 16;
export const STATOR_MAJOR = N_S * D.e + R0; // 58
export const STATOR_MINOR = (N_S - 2) * D.e + R0; // 44
const RS = new Float32Array(NT);
{
  const e = D.e;
  const Q = [];
  for (let i = 0; i < 4000; i++) {
    const t = (i / 4000) * TAU;
    Q.push([(N_S - 1) * e * Math.cos(t) + e * Math.cos((N_S - 1) * t), (N_S - 1) * e * Math.sin(t) - e * Math.sin((N_S - 1) * t)]);
  }
  for (let k = 0; k < NT; k++) {
    const a = (k / NT) * TAU;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    let best = 0;
    for (const [qx, qy] of Q) {
      const p = ux * qx + uy * qy;
      const d2 = qx * qx + qy * qy - p * p;
      if (d2 <= R0 * R0) best = Math.max(best, p + Math.sqrt(R0 * R0 - d2));
    }
    RS[k] = best;
  }
}
const lookup = (T, a) => {
  const f = ((((a / TAU) % 1) + 1) % 1) * NT;
  const i = Math.floor(f);
  const k = f - i;
  return T[i % NT] * (1 - k) + T[(i + 1) % NT] * k;
};
/** stator inner radius at profile angle a (stator frame) */
export const rs = (a) => lookup(RS, a);

// rotor: the largest shape that stays inside the stator through the whole motion (the envelope). Pose law, in the
// stator's frame: rotor turned by a, its centre at e·(cos ψ, sin ψ) with ψ = -n·a (the axis orbits n times per rotor
// turn, the other way: the rolling of an n·e pitch circle inside an (n+1)·e one).
export const orbit = (a) => -N_R * a;
const RR = new Float32Array(NT);
{
  const NA = 720;
  const NP = 720;
  const tmp = new Float32Array(NP).fill(1e9);
  for (let j = 0; j < NA; j++) {
    const a = (j / NA) * TAU;
    const ps = orbit(a);
    const cx = D.e * Math.cos(ps);
    const cy = D.e * Math.sin(ps);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (let i = 0; i < NP; i++) {
      const ph = (i / NP) * TAU;
      const ux = Math.cos(ph);
      const uy = Math.sin(ph);
      const wx = ca * ux - sa * uy;
      const wy = sa * ux + ca * uy;
      let lo = 0;
      let hi = Math.min(tmp[i], 80);
      const inside = (r) => {
        const px = cx + wx * r;
        const py = cy + wy * r;
        return Math.hypot(px, py) <= rs(Math.atan2(py, px));
      };
      if (inside(hi)) continue;
      for (let it = 0; it < 22; it++) {
        const m = (lo + hi) / 2;
        if (inside(m)) lo = m;
        else hi = m;
      }
      tmp[i] = Math.min(tmp[i], lo);
    }
  }
  for (let k = 0; k < NT; k++) {
    const f = (k / NT) * NP;
    const i = Math.floor(f);
    const w = f - i;
    RR[k] = tmp[i % NP] * (1 - w) + tmp[(i + 1) % NP] * w;
  }
}
/** rotor radius at profile angle a (rotor frame) */
export const rr = (a) => lookup(RR, a);
export const ROTOR_MAJOR = Math.max(...RR);
export const ROTOR_MINOR = Math.min(...RR);

// ------------------------------------------------------------ helices (left hand: a right-hand turning rotor pushes
// the cavities toward the bit). Profile rotation at true x:
export const betaS = (x) => (-TAU * (x - D.lobeX0)) / D.Ls;
export const betaR = (x) => (-TAU * (x - D.lobeX0)) / Lr;

// ------------------------------------------------------------ the pose for rotor angle th
export function pose(th, bendDeg = D.bendDefault) {
  const ps = orbit(th);
  const C = [D.e * Math.cos(ps), D.e * Math.sin(ps)]; // rotor axis offset (y, z)
  const d = (bendDeg * Math.PI) / 180;
  // the bent axis below the bend, in display coordinates, bending toward -y
  const ax = [Math.cos(d), -Math.sin(d), 0];
  const J1 = [disp(X.j1), C[0], C[1]];
  const L2 = X.j2 - X.bend;
  const J2 = [XB + ax[0] * L2, ax[1] * L2, 0];
  const v = [J2[0] - J1[0], J2[1] - J1[1], J2[2] - J1[2]];
  const len = Math.hypot(...v);
  const u = v.map((c) => c / len);
  const ang = (a, b) => (Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI;
  return {
    th,
    psi: ps,
    C,
    bend: d,
    ax,
    J1,
    J2,
    shaftDir: u,
    shaftLen: len,
    upperJointDeg: ang([1, 0, 0], u),
    lowerJointDeg: ang(ax, u),
    // balls of a thrust row ride round at the cage speed, about 0.42 of the mandrel's (inferred ball/race sizes)
    cage: th * 0.42,
  };
}
/** a point given in the bent frame (true x along the bent axis, y, z) to display coordinates */
export const bent = (xTrue, y, z, bendDeg) => {
  const d = (bendDeg * Math.PI) / 180;
  const lx = xTrue - X.bend;
  return [XB + lx * Math.cos(d) + y * Math.sin(d), -lx * Math.sin(d) + y * Math.cos(d), z];
};

// ------------------------------------------------------------ cavity flow: points that ride the sealed cavities
// A cavity pattern at true x depends on the local rotor angle a_l = th + betaS(x)/n; it holds still when
// x advances CAV_PER_RAD per radian of th. A particle keeps its local cross-section coordinates and moves with it.
export function cavityParticles(count, rand) {
  const out = [];
  const span = D.stages * D.Ls;
  let guard = 0;
  while (out.length < count && guard++ < count * 200) {
    const x0 = D.lobeX0 + rand() * span;
    const al = betaS(x0) / N_R;
    const ps = orbit(al);
    const cx = D.e * Math.cos(ps);
    const cy = D.e * Math.sin(ps);
    const a = rand() * TAU;
    const r = rand() * STATOR_MAJOR;
    const px = r * Math.cos(a);
    const py = r * Math.sin(a);
    if (Math.hypot(px, py) > rs(a) - 2.2) continue;
    const qx = px - cx;
    const qy = py - cy;
    const ca = Math.cos(-al);
    const sa = Math.sin(-al);
    const lx = ca * qx - sa * qy;
    const ly = sa * qx + ca * qy;
    if (Math.hypot(lx, ly) < rr(Math.atan2(ly, lx)) + 2.2) continue;
    out.push({x0, p: [px, py]});
  }
  return out;
}
export const cavityAt = (pt, th) => {
  const span = D.stages * D.Ls;
  let x = pt.x0 + CAV_PER_RAD * th - D.lobeX0;
  x = D.lobeX0 + (((x % span) + span) % span);
  const b = betaS(x);
  const c = Math.cos(b);
  const s = Math.sin(b);
  return {x, y: c * pt.p[0] - s * pt.p[1], z: s * pt.p[0] + c * pt.p[1]};
};

// a 2D slice of the power section at true x for rotor angle th: stator profile (stator frame turned by betaS) and the
// rotor's centre and turn, for the console's DH-8 panel
export function slice(x, th) {
  const bS = betaS(x);
  const ps = orbit(th);
  return {bS, rot: th + betaR(x), C: [D.e * Math.cos(ps), D.e * Math.sin(ps)]};
}

// where the console's cross-section is taken (true x, in the upper drawn stages)
export const SLICE_X = 1450;
