// The mud motor built from code, in millimetres (root scaled to metres). Lathed housings with exact section caps,
// a helical 5-lobe rotor inside a 6-lobe elastomer, a rotor catch, a driveshaft with two ball-type universal joints,
// an adjustable housing with the bend, and a mud-lubricated bearing assembly (radial sleeves, a multi-row ball thrust
// stack) down to the bit box. update(state) poses everything from the rotor angle and the settings.
import * as THREE from 'three';
import {betaR, betaS, bent, cavityAt, cavityParticles, D, disp, GAP, Lr, N_R, pose, rr, rs, SHIFT, SLICE_X, X, XB, XB1, XB2} from './kin.js';

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const rand = (() => {
  let s = 20141;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
})();

// lathe of a closed (x, r) profile around the x axis
function latheGeo(prof, seg = 96) {
  const g = new THREE.LatheGeometry(prof.map(([x, r]) => new THREE.Vector2(r, x)), seg);
  g.rotateZ(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}
// the flat face a lathed part shows on the section plane z = 0: the profile above the axis and its mirror below
function capGeo(prof) {
  const up = new THREE.Shape(prof.map(([x, r]) => new THREE.Vector2(x, r)));
  const dn = new THREE.Shape(prof.map(([x, r]) => new THREE.Vector2(x, -r)));
  return new THREE.ShapeGeometry([up, dn]);
}
const ring = (x0, x1, ri, ro) => [
  [x0, ro],
  [x1, ro],
  [x1, ri],
  [x0, ri],
];

export function buildMotor() {
  const root = new THREE.Group();
  root.scale.setScalar(0.001);
  const CLIP = new THREE.Plane(new V3(0, 0, -1), 0);
  const mk = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: o.r ?? 0.42, metalness: o.m ?? 0.55, side: o.side ?? THREE.FrontSide, envMapIntensity: o.env ?? 0.6});
  const M = {
    teal: mk('#4b8e9b'),
    oxide: mk('#a1453b', {m: 0.35, r: 0.5}),
    rubber: mk('#5a5e66', {m: 0, r: 0.7, side: THREE.DoubleSide}),
    rotor: mk('#c3c8cf', {m: 1, r: 0.3, env: 0.8}),
    bronze: mk('#c0814a', {m: 0.9, r: 0.35}),
    steel: mk('#b4b9c1', {m: 1, r: 0.35}),
    violet: mk('#7461ad', {m: 0.5, r: 0.45}),
    cup: mk('#7461ad', {m: 0.5, r: 0.45}),
    olive: mk('#87a043', {m: 0.45, r: 0.45}),
    blue: mk('#3f6ea6', {m: 0.5, r: 0.45}),
    mandrel: mk('#8fa6c4', {m: 0.8, r: 0.35}),
    yellow: mk('#cfd25d', {m: 0.4, r: 0.45}),
    pink: mk('#c49ab4', {m: 0.35, r: 0.5}),
    orange: mk('#e08a2c', {m: 0.3, r: 0.5}),
    dark: mk('#202226', {m: 0.2, r: 0.6}),
    ball: mk('#dfe3e8', {m: 1, r: 0.22, env: 0.9}),
    lock: mk('#55682a', {m: 0.4, r: 0.5}),
  };
  // flat matte section colour per material
  const CAP = new Map();
  const capMat = (m) => {
    if (!CAP.has(m)) {
      const c = m === M.rubber ? new THREE.Color('#25272b') : m === M.rotor ? new THREE.Color('#9097a0') : m.color.clone().lerp(new THREE.Color('#ffffff'), 0.18);
      // the rotor's cut meets the elastomer's at the seal lines: it gets the stronger offset, so the two never fight
      const po = m === M.rotor ? [-8, -24] : [-4, -12];
      CAP.set(m, new THREE.MeshStandardMaterial({color: c, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: po[0], polygonOffsetUnits: po[1]}));
    }
    return CAP.get(m);
  };
  // shells: housings that go see-through in GLASS and are cut in SECTION; cuts: other parts cut in SECTION
  const shells = new Set([M.lock, M.cup, M.teal, M.oxide, M.rubber, M.olive, M.blue, M.yellow, M.pink, M.steel]);
  const cuts = new Set([M.mandrel, M.rotor, M.dark]);
  const caps = [];
  const anchors = {};
  const anchor = (id, parent, x, y = 0, z = 0) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    anchors[id] = o;
  };
  const addMesh = (parent, geo, mat, {cast = true} = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  // a lathed part with its section cap
  const part = (parent, prof, mat, {seg = 96, cap = true, capParent = null} = {}) => {
    const m = addMesh(parent, latheGeo(prof, seg), mat);
    if (cap) {
      const c = new THREE.Mesh(capGeo(prof), capMat(mat));
      c.visible = false;
      (capParent || parent).add(c);
      caps.push(c);
    }
    return m;
  };
  // explodable group: base position, offset at explode = 1
  const groups = [];
  const grp = (parent, ex = [0, 0, 0]) => {
    const g = new THREE.Group();
    parent.add(g);
    g.userData.ex = ex;
    groups.push(g);
    return g;
  };

  // ------------------------------------------------------------ frames
  const upper = new THREE.Group(); // display coordinates above the bend
  root.add(upper);
  const lowerF = new THREE.Group(); // the bent frame: origin at the bend point, x along the bent axis
  lowerF.position.x = XB;
  root.add(lowerF);
  const below = (x) => x - SHIFT; // true x below the break to display x
  const bx = (x) => x - X.bend; // true x below the bend to bent-frame x

  // ------------------------------------------------------------ top sub (DH-6): API box up top, pin into the stator
  const topSub = grp(upper, [-480, 0, 0]);
  part(topSub, [
    [0, 85.75], [290, 85.75], [290, 83], [302, 83], [302, 85.75], [560, 85.75], [560, 75], [610, 75],
    [610, 62], [330, 62], [300, 40], [150, 40], [60, 56], [0, 60],
  ], M.teal);
  anchor('topsub', topSub, 200, 86);
  anchor('apibox', topSub, 20, 62);
  anchor('propconn', topSub, 590, 75);

  // ------------------------------------------------------------ stator: tube + elastomer, two drawn segments
  const stator = grp(upper, [0, 330, 0]);
  part(stator, [[560, 85.75], [XB1, 85.75], [XB1, 70], [700, 70], [650, 70], [610, 70], [610, 75], [560, 75]], M.oxide);
  const statorLo = new THREE.Group();
  statorLo.position.x = -SHIFT;
  stator.add(statorLo);
  part(statorLo, [[XB2, 85.75], [D.statorBot, 85.75], [D.statorBot, 70], [XB2, 70]], M.oxide);
  anchor('stator', stator, 1500, 86);
  anchor('statorLo', statorLo, 7000, 86);
  anchor('break', upper, XB1 + GAP / 2, 86);
  // a thin red ring where the console's slice is taken
  const sliceRing = new THREE.Mesh(new THREE.TorusGeometry(88, 2.2, 8, 96).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({color: '#e3172c'}));
  sliceRing.position.x = SLICE_X;
  sliceRing.visible = false;
  stator.add(sliceRing);
  // the elastomer: inner surface swept along the helix, end faces, and its exact section on z = 0
  const NP = 180;
  const elastomer = (x0, x1, parent) => {
    const nx = Math.ceil((x1 - x0) / (D.Ls / 56));
    const pos = [];
    const idx = [];
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx;
      const b = betaS(x);
      for (let j = 0; j < NP; j++) {
        const a = (j / NP) * TAU;
        const r = rs(a);
        pos.push(x, r * Math.cos(a + b), r * Math.sin(a + b));
      }
    }
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < NP; j++) {
        const a = i * NP + j;
        const b = i * NP + ((j + 1) % NP);
        idx.push(a, a + NP, b, b, a + NP, b + NP);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    addMesh(parent, g, M.rubber);
    // the annular end faces
    for (const x of [x0, x1]) {
      const sh = new THREE.Shape();
      sh.absarc(0, 0, D.tubeIR, 0, TAU, false);
      const hole = new THREE.Path();
      const b = betaS(x);
      for (let j = 0; j <= NP; j++) {
        const a = (j / NP) * TAU;
        const r = rs(a);
        const p = [r * Math.cos(a + b), r * Math.sin(a + b)];
        j ? hole.lineTo(p[0], p[1]) : hole.moveTo(p[0], p[1]);
      }
      sh.holes.push(hole);
      const fg = new THREE.ShapeGeometry(sh, 48);
      fg.rotateY(Math.PI / 2);
      // after rotateY(+90°) the shape's (x, y) lie in (−z, y); swap to put shape x on y and shape y on z
      const p = fg.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const sx = -p.getZ(k);
        const sy = p.getY(k);
        p.setXYZ(k, x, sx, sy);
      }
      fg.computeVertexNormals();
      addMesh(parent, fg, M.rubber);
    }
    // section cap: where z = 0 cuts the elastomer, from the lobe surface out to the tube, above and below the axis
    for (const side of [1, -1]) {
      const pts = [];
      const n = Math.ceil((x1 - x0) / 3);
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const a = (side > 0 ? Math.PI / 2 : -Math.PI / 2) - betaS(x);
        pts.push([x, side * rs(a)]);
      }
      const sh = new THREE.Shape();
      sh.moveTo(x0, side * D.tubeIR);
      sh.lineTo(x1, side * D.tubeIR);
      for (let i = pts.length - 1; i >= 0; i--) sh.lineTo(pts[i][0], pts[i][1]);
      const c = new THREE.Mesh(new THREE.ShapeGeometry(sh), capMat(M.rubber));
      c.visible = false;
      parent.add(c);
      caps.push(c);
    }
  };
  elastomer(D.lobeX0, XB1, stator);
  elastomer(XB2, D.lobeX1, statorLo);
  // the rubber is solid out to the tube: a backing face so nothing red shows behind the lobes at a cut
  part(stator, ring(D.lobeX0, XB1, 69, 70), M.rubber, {cap: false});
  part(statorLo, ring(XB2, D.lobeX1, 69, 70), M.rubber, {cap: false});
  // rubber collars at the plain ends
  part(stator, ring(642, D.lobeX0, 62, 70), M.rubber);
  part(statorLo, ring(D.lobeX1, D.statorBot, 62, 70), M.rubber);

  // ------------------------------------------------------------ rotor catch ring (static): hub, spokes, rim; it sits
  // in the stator's top box, under the top sub's pin; the stem's flange can't pass the hub
  const catchRing = grp(upper, [-230, 0, 0]);
  part(catchRing, ring(612, 640, 28, 36), M.steel);
  part(catchRing, ring(612, 640, 62, 70), M.steel);
  for (let k = 0; k < 4; k++) {
    const s = addMesh(catchRing, new THREE.BoxGeometry(28, 27, 10), M.steel);
    const a = (k / 4) * TAU;
    s.position.set(626, 49 * Math.cos(a), 49 * Math.sin(a));
    s.rotation.x = a;
  }
  anchor('catchring', catchRing, 626, 66);

  // ------------------------------------------------------------ the rotor: one rigid body that spins and orbits
  const rotorG = new THREE.Group();
  upper.add(rotorG);
  // caps of the rotor's round parts (necks, joint cup) stay on the cut plane: they follow the orbit but don't spin
  const rotorCaps = new THREE.Group();
  upper.add(rotorCaps);
  const rotorEx = grp(rotorG, [0, 0, 0]);
  const RP = 160;
  const rotorSeg = (x0, x1, parent, dx) => {
    const nx = Math.ceil((x1 - x0) / (Lr / 56));
    const pos = [];
    const idx = [];
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx;
      const b = betaR(x);
      for (let j = 0; j < RP; j++) {
        const a = (j / RP) * TAU;
        const r = rr(a);
        pos.push(x + dx, r * Math.cos(a + b), r * Math.sin(a + b));
      }
    }
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < RP; j++) {
        const a = i * RP + j;
        const b = i * RP + ((j + 1) % RP);
        idx.push(a, b, a + RP, b, b + RP, a + RP);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    addMesh(parent, g, M.rotor);
    for (const x of [x0, x1]) {
      const sh = new THREE.Shape();
      const b = betaR(x);
      for (let j = 0; j <= RP; j++) {
        const a = (j / RP) * TAU;
        const r = rr(a);
        j ? sh.lineTo(r * Math.cos(a + b), r * Math.sin(a + b)) : sh.moveTo(r * Math.cos(a + b), r * Math.sin(a + b));
      }
      const fg = new THREE.ShapeGeometry(sh, 32);
      const p = fg.attributes.position;
      for (let k = 0; k < p.count; k++) p.setXYZ(k, x + dx, p.getX(k), p.getY(k));
      fg.computeVertexNormals();
      addMesh(parent, fg, M.rotor);
    }
  };
  rotorSeg(D.lobeX0, XB1, rotorEx, 0);
  rotorSeg(XB2, D.lobeX1, rotorEx, -SHIFT);
  // the rotor's cut face where z = 0 passes through the lobes: for each x, the interval of y inside its section.
  // Rebuilt every frame from the pose, so the cut shows the lobes turning past the plane.
  const rotorCut = [[D.lobeX0, XB1, 0], [XB2, D.lobeX1, -SHIFT]].map(([x0, x1, dx]) => {
    const n = Math.ceil((x1 - x0) / 3.5);
    const pos = new Float32Array((n + 1) * 6);
    const nrm = new Float32Array((n + 1) * 6);
    for (let k = 2; k < nrm.length; k += 3) nrm[k] = 1;
    const idx = [];
    for (let i = 0; i < n; i++) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setIndex(idx);
    const mesh = new THREE.Mesh(g, capMat(M.rotor));
    mesh.visible = false;
    mesh.frustumCulled = false;
    upper.add(mesh);
    return {x0, x1, dx, n, pos, g, mesh};
  });
  const cutRotor = (th, C) => {
    for (const c of rotorCut) {
      for (let i = 0; i <= c.n; i++) {
        const x = c.x0 + ((c.x1 - c.x0) * i) / c.n;
        const a = th + betaR(x);
        const ca = Math.cos(-a);
        const sa = Math.sin(-a);
        const inside = (y) => {
          const gx = y - C[0];
          const gy = -C[1];
          const lx = ca * gx - sa * gy;
          const ly = sa * gx + ca * gy;
          return Math.hypot(lx, ly) <= rr(Math.atan2(ly, lx));
        };
        const edge = (dir) => {
          let lo = 0;
          let hi = 60;
          for (let it = 0; it < 18; it++) {
            const m = (lo + hi) / 2;
            if (inside(C[0] + dir * m)) lo = m;
            else hi = m;
          }
          return C[0] + dir * (lo + 0.5);
        };
        c.pos.set([x + c.dx, edge(-1), 0, x + c.dx, edge(1), 0], i * 6);
      }
      c.g.attributes.position.needsUpdate = true;
    }
  };
  // top neck (the stem threads in) and the bottom neck down to the upper joint housing
  part(rotorEx, [[655, 30], [D.lobeX0 + 2, 30], [D.lobeX0 + 2, 0], [655, 0]], M.rotor, {capParent: rotorCaps});
  part(rotorEx, [[below(D.lobeX1) - 2, 40], [below(7860), 40], [below(7860), 0], [below(D.lobeX1) - 2, 0]], M.rotor, {capParent: rotorCaps});
  // upper universal-joint housing: a cup open toward the bit, on the rotor's end
  const j1x = disp(X.j1);
  part(rotorEx, [[j1x - 90, 55], [j1x + 85, 55], [j1x + 85, 43], [j1x - 70, 43], [j1x - 70, 0], [j1x - 90, 0]], M.cup, {capParent: rotorCaps});
  anchor('rotor', rotorEx, 1200, 0);
  anchor('rotorLo', rotorEx, below(7300), 0);
  anchor('j1', rotorEx, j1x, 0);
  // rotor catch stem: flanged head in the top sub's chamber, shank through the ring's hub, nozzle/plug at the rotor top
  const stem = grp(rotorEx, [-320, 0, 0]);
  part(stem, [[352, 0], [352, 44], [378, 44], [378, 19], [660, 19], [660, 0]], M.bronze, {cap: false});
  for (let k = 0; k < 2; k++) {
    const lug = addMesh(stem, new THREE.BoxGeometry(18, 14, 100), M.bronze);
    lug.position.set(342, 0, 0);
    lug.rotation.x = (k / 2) * Math.PI;
  }
  part(stem, [[640, 0], [640, 24], [658, 24], [658, 0]], M.orange, {cap: false});
  anchor('stem', stem, 365, 0);
  anchor('nozzle', stem, 649, 0);

  // ------------------------------------------------------------ adjustable assembly (DH-12)
  const adapter = grp(upper, [180, 330, 0]);
  part(adapter, [[below(D.statorBot), 85.75], [below(X.adapterEnd), 85.75], [below(X.adapterEnd), 74], [below(D.statorBot), 74]], M.olive);
  anchor('adapter', adapter, below(8200), 86);
  const adjRing = grp(upper, [300, 330, 0]);
  part(adjRing, [[below(X.adapterEnd), 89], [below(X.ringEnd), 89], [below(X.ringEnd), 74], [below(X.adapterEnd), 74]], M.olive);
  // engagement teeth round the ring's lower end
  for (let k = 0; k < 24; k++) {
    const t = addMesh(adjRing, new THREE.BoxGeometry(40, 5, 9), M.steel);
    const a = (k / 24) * TAU;
    t.position.set(below(X.ringEnd) - 24, 90 * Math.cos(a), 90 * Math.sin(a));
    t.rotation.x = a;
  }
  anchor('adjring', adjRing, below(8630), 90);
  const offset = grp(lowerF, [420, 330, 0]);
  part(offset, [[bx(X.bend), 85.75], [bx(X.brgTop), 85.75], [bx(X.brgTop), 74], [bx(X.bend), 74]], M.olive);
  // oval lock features (DH-12 shows a band of them; their function isn't given)
  for (let k = 0; k < 12; k++) {
    const o = addMesh(offset, new THREE.CapsuleGeometry(4, 10, 4, 8), M.lock);
    const a = (k / 12) * TAU;
    o.position.set(bx(8790), 86 * Math.cos(a), 86 * Math.sin(a));
    o.rotation.x = a;
    o.rotation.z = Math.PI / 2;
  }
  anchor('offset', offset, bx(9000), 86);
  anchor('bend', upper, XB, 92);

  // ------------------------------------------------------------ the driveshaft: rod and two ball knuckles with drive balls
  const shaft = new THREE.Group();
  root.add(shaft); // posed in display mm, under the root's scale
  shaft.userData.ex = [260, 0, 0];
  const shaftSpin = new THREE.Group();
  shaft.add(shaftSpin);
  const rod = addMesh(shaftSpin, new THREE.CylinderGeometry(30, 30, 1, 40).rotateZ(-Math.PI / 2).translate(0.5, 0, 0), M.violet);
  const knuckles = [0, 1].map(() => {
    const k = new THREE.Group();
    shaftSpin.add(k);
    addMesh(k, new THREE.SphereGeometry(38, 40, 24), M.violet);
    for (let i = 0; i < 6; i++) {
      const b = addMesh(k, new THREE.SphereGeometry(8, 16, 12), M.ball);
      const a = (i / 6) * TAU;
      b.position.set(0, 34 * Math.cos(a), 34 * Math.sin(a));
    }
    return k;
  });
  const shaftMid = new THREE.Object3D();
  shaftSpin.add(shaftMid);
  anchors.driveshaft = shaftMid;
  anchors.j2 = knuckles[1];

  // ------------------------------------------------------------ the bearing assembly (DH-14), in the bent frame
  const housing = grp(lowerF, [640, 330, 0]);
  const HR = 64; // housing inner radius
  part(housing, [
    [bx(X.brgTop), 85.75], [bx(9950), 85.75], [bx(9950), 90], [bx(10100), 90], [bx(10100), 85.75], [bx(10600), 85.75],
    [bx(10600), 80], [bx(X.brgBot), 80], [bx(X.brgBot), HR], [bx(X.brgTop), HR],
  ], M.blue);
  anchor('housing', housing, bx(10300), 86);
  anchor('band', housing, bx(10025), 90);
  // static halves of the bearings, held in the housing: radial outer sleeves, thrust outer races
  part(housing, ring(bx(9370), bx(9670), 55, HR), M.yellow);
  part(housing, ring(bx(10340), bx(10420), 55, HR), M.yellow);
  part(housing, ring(bx(10420), bx(10860), 55, HR), M.pink);
  const ROWS = 28;
  const PITCH = 22;
  const T0 = 9700;
  const BALL_R = 7.5;
  const BC = 55.5; // ball circle radius
  const grooveProf = (x0, x1, rFace, rBack, inner) => {
    // a race ring with a ball groove in its running face
    const xc = (x0 + x1) / 2;
    const R = BALL_R + 0.25;
    const pts = [[x0, rBack], [x0, rFace]];
    const dr = rFace - BC;
    const t = Math.asin(Math.min(1, Math.abs(dr) / R));
    const nA = 12;
    for (let i = 0; i <= nA; i++) {
      const u = i / nA;
      const ang = inner ? Math.PI + t + u * (Math.PI - 2 * t) : Math.PI - t - u * (Math.PI - 2 * t);
      pts.push([xc + R * Math.cos(ang), BC + R * Math.sin(ang)]);
    }
    pts.push([x1, rFace], [x1, rBack]);
    return inner ? pts : pts;
  };
  for (let k = 0; k < ROWS; k++) {
    const x0 = bx(T0 + k * PITCH);
    part(housing, grooveProf(x0 + 1, x0 + PITCH - 1, 57, HR, false), M.steel, {seg: 72});
  }
  anchor('thrustOuter', housing, bx(T0 + 4 * PITCH), 60);
  // the rotating side: mandrel, inner sleeves, inner races, balls, lower joint cup, bit box
  const mandrel = grp(lowerF, [640, 0, 0]);
  part(mandrel, [[bx(X.mandrelTop), 47.5], [bx(X.boxTop), 47.5], [bx(X.boxTop), 25], [bx(X.mandrelTop), 25]], M.mandrel);
  part(mandrel, ring(bx(9370), bx(9670), 47.5, 54), M.yellow);
  part(mandrel, ring(bx(10340), bx(10860), 47.5, 54), M.yellow);
  for (let k = 0; k < ROWS; k++) {
    const x0 = bx(T0 + k * PITCH);
    part(mandrel, grooveProf(x0 + 1, x0 + PITCH - 1, 54, 47.5, true), M.steel, {seg: 72});
  }
  // lower joint cup (open toward the rotor) on the mandrel's top
  const j2b = bx(X.j2);
  part(mandrel, [[j2b - 85, 55], [j2b + 90, 55], [j2b + 90, 0], [j2b + 70, 0], [j2b + 70, 43], [j2b - 85, 43]], M.cup);
  // output shaft and bit box: the box's tapered thread bore at the bottom
  part(mandrel, [
    [bx(X.boxTop), 85.5], [bx(X.boxBot), 85.5], [bx(X.boxBot), 62], [bx(11100), 46], [bx(11080), 25], [bx(X.boxTop), 25],
  ], M.blue);
  part(mandrel, ring(bx(10928), bx(10940), 85.5, 87), M.orange, {seg: 72});
  anchor('mandrel', mandrel, bx(9330), 47.5);
  anchor('bitbox', mandrel, bx(11160), 86);
  anchor('boxthread', mandrel, bx(11200), 55);
  anchor('upperRadial', mandrel, bx(9520), 54);
  anchor('lowerRadial', mandrel, bx(10600), 54);
  anchor('thrust', mandrel, bx(T0 + 14 * PITCH), 55);
  // spinning parts that show the rotation: ports into the bore, stripes on the bit box
  const spin = new THREE.Group();
  mandrel.add(spin);
  for (let k = 0; k < 4; k++) {
    const p = addMesh(spin, new THREE.CylinderGeometry(10, 10, 6, 24), M.dark);
    const a = (k / 4) * TAU;
    p.position.set(bx(9312), 47 * Math.cos(a), 47 * Math.sin(a));
    p.rotation.x = a;
  }
  for (let k = 0; k < 2; k++) {
    const s = addMesh(spin, new THREE.BoxGeometry(200, 3, 22), M.dark);
    const a = (k / 2) * TAU;
    s.position.set(bx(11080), 85.5 * Math.cos(a), 85.5 * Math.sin(a));
    s.rotation.x = a;
  }
  anchor('ports', spin, bx(9312), 47);
  // the balls: one instanced mesh, each row riding round at the cage speed
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(BALL_R, 18, 12), M.ball.clone(), ROWS * 20);
  balls.castShadow = true;
  mandrel.add(balls);
  const BPR = 20;
  const OFF_ROWS = 8; // upper rows carry off-bottom load, the rest on-bottom (split inferred)

  // ------------------------------------------------------------ load-path arrows (red)
  const red = new THREE.MeshBasicMaterial({color: '#e3172c', transparent: true, opacity: 0.92, depthWrite: false});
  const arrow = (len) => {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, len, 16).rotateZ(Math.PI / 2), red);
    s.position.x = -len / 2;
    const t = new THREE.Mesh(new THREE.ConeGeometry(24, 60, 24).rotateZ(-Math.PI / 2), red);
    t.position.x = 30;
    g.add(s, t);
    g.renderOrder = 6;
    return g;
  };
  const loads = new THREE.Group();
  mandrel.add(loads);
  const onArrows = new THREE.Group();
  const offArrows = new THREE.Group();
  loads.add(onArrows, offArrows);
  {
    // on bottom: the bit pushes up on the box (toward -x)
    const a = arrow(260);
    a.rotation.z = Math.PI;
    a.position.set(bx(X.boxBot) + 100, 0, 0);
    onArrows.add(a);
    for (const s of [1, -1]) {
      const b = arrow(120);
      b.rotation.z = Math.PI;
      b.position.set(bx(T0 + 14 * PITCH), s * 112, 0);
      onArrows.add(b);
    }
    // off bottom: hydraulic thrust pushes the mandrel down (toward +x)
    const c = arrow(240);
    c.position.set(bx(X.mandrelTop) + 60, 0, 0);
    offArrows.add(c);
    for (const s of [1, -1]) {
      const d = arrow(120);
      d.position.set(bx(T0 + 3 * PITCH), s * 112, 0);
      offArrows.add(d);
    }
  }
  anchor('loadOn', onArrows, bx(X.boxBot) + 240, 0);
  anchor('loadOff', offArrows, bx(X.mandrelTop) - 20, 0);

  // ------------------------------------------------------------ the bend made visible: the straight axis carried on
  // (dashed) and the bent axis (red), meeting at the bend point
  const axes = new THREE.Group();
  root.add(axes);
  const straight = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new V3(XB - 1300, 0, 0), new V3(XB + 1500, 0, 0)]),
    new THREE.LineDashedMaterial({color: '#5d6269', dashSize: 30, gapSize: 22, depthTest: false, transparent: true}),
  );
  straight.computeLineDistances();
  const bentLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(XB, 0, 0), new V3(XB + 1500, 0, 0)]), new THREE.LineBasicMaterial({color: '#e3172c', depthTest: false, transparent: true}));
  axes.add(straight, bentLine);
  axes.renderOrder = 8;
  anchor('bentAxis', axes, XB + 600, 0);

  // ------------------------------------------------------------ flow particles (conceptual)
  const flow = new THREE.Group();
  root.add(flow);
  const fluid = new THREE.MeshBasicMaterial({color: '#2a7de1'});
  const bleedM = new THREE.MeshBasicMaterial({color: '#f29a1d'});
  const cav = cavityParticles(900, rand);
  const cavMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(3.6, 8, 6), fluid, cav.length);
  flow.add(cavMesh);
  // pipe paths: [trueX, r, frame] knots; frame 'u' upper display, 'b' bent; particles keep a stream angle
  const PATH_TOP = [[-260, 22], [120, 30], [290, 34], [340, 56], [600, 56], [660, 56], [700, 50]];
  const PATH_LOW = [[7710, 50], [7790, 56], [7822, 66], [8000, 66], [X.bend, 66], [9200, 66], [9296, 64], [9312, 47], [9330, 0.6], [11240, 0.6], [11600, 1]];
  const PATH_BLEED = [[9296, 64], [9340, 54.5], [10890, 54.5], [10912, 72], [10920, 100], [11050, 130]];
  const mkPath = (knots) => {
    const L = [0];
    for (let i = 1; i < knots.length; i++) L.push(L[i - 1] + Math.hypot(knots[i][0] - knots[i - 1][0], knots[i][1] - knots[i - 1][1]));
    return {knots, L, len: L[L.length - 1]};
  };
  const at = (P, s) => {
    const d = s * P.len;
    let i = 1;
    while (i < P.L.length - 1 && P.L[i] < d) i++;
    const k = (d - P.L[i - 1]) / (P.L[i] - P.L[i - 1] || 1);
    return [P.knots[i - 1][0] + (P.knots[i][0] - P.knots[i - 1][0]) * k, P.knots[i - 1][1] + (P.knots[i][1] - P.knots[i - 1][1]) * k];
  };
  const P = {top: mkPath(PATH_TOP), low: mkPath(PATH_LOW), bleed: mkPath(PATH_BLEED)};
  const stream = (n, path, ang) => Array.from({length: n}, (_, i) => ({path, s0: i / n + rand() * 0.6 / n, a: ang(i), j: rand(), r2: Math.sqrt(rand())}));
  const topP = stream(160, P.top, (i) => Math.PI / 4 + (i % 4) * (Math.PI / 2) + (rand() - 0.5) * 0.35);
  const lowP = stream(320, P.low, () => rand() * TAU);
  const bleedP = stream(70, P.bleed, () => rand() * TAU);
  const pipeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(3.6, 8, 6), fluid, topP.length + lowP.length);
  const bleedMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(3.4, 8, 6), bleedM, bleedP.length);
  flow.add(pipeMesh, bleedMesh);
  for (const m of [cavMesh, pipeMesh, bleedMesh]) {
    m.frustumCulled = false;
    m.renderOrder = 4;
  }

  // ------------------------------------------------------------ cutaway modes
  let cutNow = '';
  // rotorCut: the section also cuts the rotor (the power-section stop); elsewhere the rotor stays whole, as DH-7 draws it
  let rotorCutNow = false;
  const setCut = (mode, withRotor = false) => {
    const rc = mode === "section" && withRotor;
    if (mode === cutNow && rc === rotorCutNow) return;
    cutNow = mode;
    rotorCutNow = rc;
    for (const m of Object.values(M)) {
      const isShell = shells.has(m);
      const clip = mode === 'section' && (isShell || (cuts.has(m) && (m !== M.rotor || rc)));
      m.clippingPlanes = clip ? [CLIP] : null;
      const glass = mode === 'glass' && isShell;
      m.transparent = glass;
      m.opacity = glass ? (m === M.rubber ? 0.32 : 0.16) : 1;
      m.depthWrite = !glass;
      m.side = clip || glass || m === M.rubber ? THREE.DoubleSide : THREE.FrontSide;
      m.needsUpdate = true;
    }
    for (const c of caps) c.visible = mode === "section";
    for (const c of rotorCut) c.mesh.visible = rc;
    // the joint cup is a housing: its cut face shows in any section; the rotor necks only when the rotor is cut
    for (const c of rotorCaps.children) c.visible = c.material === capMat(M.cup) ? mode === "section" : rc;
    sliceRing.material.clippingPlanes = mode === 'section' ? [CLIP] : null;
    sliceRing.material.needsUpdate = true;
    for (const m of [fluid, bleedM]) {
      m.clippingPlanes = mode === "section" ? [CLIP] : null;
      m.needsUpdate = true;
    }
  };

  // ------------------------------------------------------------ pose
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const m4 = new THREE.Matrix4();
  const v = new V3();
  const sc = new V3();
  const XA = new V3(1, 0, 0);
  const cOn = new THREE.Color('#e3172c');
  const cOff = new THREE.Color('#dfe3e8');
  const cDim = new THREE.Color('#c6cad0');
  /** s: {th, bend (deg), explode 0..1, flow 0..1, loads 0..1, onBottom bool} */
  const update = (s) => {
    const p = pose(s.th, s.bend);
    const ex = smoother(s.explode ?? 0);
    lowerF.rotation.z = -p.bend;
    for (const g of groups) {
      const [dx, dy] = g.userData.ex;
      if (!g.userData.base) g.userData.base = g.position.clone();
      g.position.set(g.userData.base.x + dx * ex, g.userData.base.y + dy * ex, g.userData.base.z);
    }
    sliceRing.visible = !!s.slice;
    axes.visible = !!s.axes && ex < 0.02;
    if (axes.visible) {
      const pa = bentLine.geometry.attributes.position;
      pa.setXYZ(1, XB + 1500 * Math.cos(p.bend), -1500 * Math.sin(p.bend), 0);
      pa.needsUpdate = true;
      anchors.bentAxis.position.set(XB + 600 * Math.cos(p.bend), -600 * Math.sin(p.bend), 0);
    }
    rotorG.position.set(0, p.C[0], p.C[1]);
    rotorG.rotation.x = s.th;
    rotorCaps.position.set(0, p.C[0], 0);
    if (rotorCutNow) cutRotor(s.th, p.C);
    // driveshaft from J1 to J2, spun with the rotor; exploded it slides toward the bit as one piece
    const sh = 260 * ex;
    shaft.position.set(p.J1[0] + sh, p.J1[1], p.J1[2]);
    v.set(...p.shaftDir);
    q.setFromUnitVectors(XA, v);
    q2.setFromAxisAngle(XA, s.th);
    shaftSpin.quaternion.copy(q).multiply(q2);
    rod.scale.set(p.shaftLen, 1, 1);
    knuckles[1].position.x = p.shaftLen;
    shaftMid.position.x = p.shaftLen * 0.5;
    shaftMid.position.y = 30;
    spin.rotation.x = s.th;
    // balls: each row round at the cage speed; loaded rows lit
    const loadOn = (s.loads ?? 0) > 0.5;
    let n = 0;
    for (let k = 0; k < ROWS; k++) {
      const x = bx(T0 + k * PITCH + PITCH / 2);
      const lit = loadOn && (s.onBottom ? k >= OFF_ROWS : k < OFF_ROWS);
      for (let i = 0; i < BPR; i++) {
        const a = p.cage + (i / BPR) * TAU + (k % 2) * (Math.PI / BPR);
        m4.makeTranslation(x, BC * Math.cos(a), BC * Math.sin(a));
        balls.setMatrixAt(n, m4);
        balls.setColorAt(n, lit ? cOn : loadOn ? cDim : cOff);
        n++;
      }
    }
    balls.instanceMatrix.needsUpdate = true;
    balls.instanceColor.needsUpdate = true;
    loads.visible = loadOn;
    onArrows.visible = !!s.onBottom;
    offArrows.visible = !s.onBottom;

    // flow
    const fOn = (s.flow ?? 0) > 0.01 && ex < 0.02;
    flow.visible = fOn;
    if (fOn) {
      const hide = () => m4.makeScale(0, 0, 0);
      cav.forEach((pt, i) => {
        const c = cavityAt(pt, s.th);
        const dx = disp(c.x);
        if (Number.isNaN(dx)) hide();
        else m4.makeTranslation(dx, c.y, c.z);
        cavMesh.setMatrixAt(i, m4);
      });
      cavMesh.instanceMatrix.needsUpdate = true;
      const adv = (pp, speed) => (((pp.s0 + (s.th * speed) / pp.path.len) % 1) + 1) % 1;
      const SP = 0.55 * (N_R * D.Ls) / TAU; // pipe flow speed, mm per radian (conceptual)
      let k = 0;
      for (const pp of topP) {
        const u = adv(pp, SP);
        const [x, r] = at(pp.path, u);
        m4.makeTranslation(x, r * Math.cos(pp.a), r * Math.sin(pp.a));
        pipeMesh.setMatrixAt(k++, m4);
      }
      for (const pp of lowP) {
        const u = adv(pp, SP);
        let [x, r] = at(pp.path, u);
        let a = pp.a;
        // into the ports: steer to the nearest port as it turns with the mandrel; in the bore, spread across it
        if (x >= 9296) {
          const portA = s.th + Math.round((pp.a - s.th) / (Math.PI / 2)) * (Math.PI / 2);
          const k2 = Math.min(1, (x - 9296) / 16);
          a = pp.a + (portA - pp.a) * k2;
          if (x > 9330) r = 22 * pp.r2;
          if (x > 11240) r = 22 * pp.r2 + (x - 11240) * 0.18 * pp.r2;
        }
        let w;
        if (x <= X.bend) w = [disp(x), r * Math.cos(a), r * Math.sin(a)];
        else w = bent(x, r * Math.cos(a), r * Math.sin(a), s.bend);
        const fade = x > 11240 ? Math.max(0, 1 - (x - 11240) / 360) : 1;
        sc.setScalar(fade);
        m4.compose(v.set(...w), q.identity(), sc);
        pipeMesh.setMatrixAt(k++, m4);
      }
      pipeMesh.instanceMatrix.needsUpdate = true;
      bleedP.forEach((pp, i) => {
        const u = adv(pp, SP * 0.16);
        const [x, r] = at(pp.path, u);
        const w = bent(x, r * Math.cos(pp.a), r * Math.sin(pp.a), s.bend);
        const fade = x > 10920 ? Math.max(0, 1 - (x - 10920) / 130) : 1;
        sc.setScalar(fade);
        m4.compose(v.set(...w), q.identity(), sc);
        bleedMesh.setMatrixAt(i, m4);
      });
      bleedMesh.instanceMatrix.needsUpdate = true;
    }
    return p;
  };
  return {root, update, setCut, anchors, M, CLIP, pose};
}
