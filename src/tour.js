// Component catalogue (name, figure references, what is inferred) and the guided tour, top sub to bit box.
// Camera targets are display coordinates in metres (tool axis +x, the power section drawn with a break).
//
// Every dimension in the model is inferred (scaled to a 6¾-in OD from DH-5's proportions); the page says so once.
// inf marks the parts whose FORM is inferred too: the excerpt doesn't show it, or doesn't show it clearly.
export const PARTS = {
  topsub: {name: 'Top sub', refs: 'DH-5 · DH-6'},
  apibox: {name: 'API tool-joint box', refs: 'DH-6'},
  propconn: {name: 'Proprietary connection into the stator', refs: 'DH-6'},
  stem: {name: 'Rotor catch stem', refs: 'DH-7'},
  catchring: {name: 'Rotor catch ring', refs: 'DH-7', inf: 'slotted form'},
  nozzle: {name: 'Nozzle or plug', refs: 'DH-7', inf: 'position'},
  stator: {name: 'Stator · 6-lobe elastomer in tube', refs: 'DH-8 · DH-9'},
  statorLo: {name: 'Stator (lower stages)', refs: 'DH-5'},
  rotor: {name: 'Rotor · 5 lobes, helical', refs: 'DH-8 · DH-9'},
  rotorLo: {name: 'Rotor (lower end)', refs: 'DH-5'},
  break: {name: '// 4 of 7 stages hidden by the break', refs: 'DH-5', inf: 'stage count'},
  j1: {name: 'Upper universal joint', refs: 'DH-5 · DH-12', inf: 'ball type'},
  driveshaft: {name: 'Driveshaft', refs: 'DH-5 · DH-12'},
  j2: {name: 'Lower universal joint', refs: 'DH-5 · DH-12', inf: 'ball type'},
  adapter: {name: 'Upper housing', refs: 'DH-12', inf: 'housing split'},
  adjring: {name: 'Adjusting ring', refs: 'DH-12', inf: 'teeth'},
  offset: {name: 'Offset housing (carries the bend)', refs: 'DH-12', inf: 'bend location'},
  bend: {name: 'Bend', refs: 'DH-5 · DH-12', inf: 'angle range'},
  bentAxis: {name: 'Bent axis (red) against the straight axis (dashed)', refs: 'DH-5', inf: 'angle range'},
  housing: {name: 'Bearing housing', refs: 'DH-14'},
  band: {name: 'Housing band', refs: 'DH-14', inf: 'function'},
  upperRadial: {name: 'Upper radial bearing', refs: 'DH-14', inf: 'sleeve type'},
  thrust: {name: 'Thrust bearing · 28 ball rows', refs: 'DH-14', inf: 'row count, split'},
  thrustOuter: {name: 'Outer races (in housing)', refs: 'DH-14', inf: 'race form'},
  lowerRadial: {name: 'Lower radial bearing', refs: 'DH-14', inf: 'sleeve type'},
  mandrel: {name: 'Mandrel (hollow)', refs: 'DH-14'},
  ports: {name: 'Flow ports into the mandrel bore', refs: '', inf: 'not in excerpt'},
  bitbox: {name: 'Bit box (output shaft)', refs: 'DH-5 · DH-14'},
  boxthread: {name: 'Box connection to the bit', refs: 'DH-14'},
  loadOn: {name: 'Weight-on-bit reaction', refs: 'text p.4'},
  loadOff: {name: 'Hydraulic thrust (off bottom)', refs: 'text p.4'},
};

const C = (tx, ty, az, el, d, o = {}) => ({tx, ty, tz: 0, az, el, d, sx: o.sx ?? 0, sy: o.sy ?? -24, drift: o.drift ?? 4});

// each stop: what the camera frames, how the model is shown, which parts get labels ([id, dx, dy] screen offsets)
export const STOPS = [
  {
    id: 'overview', btn: 'OVERVIEW', name: 'Complete motor', refs: 'DH-5', dur: 9,
    cam: C(3.66, -0.05, 0, 8, 18.6, {drift: 1.5}), cut: 'section', flow: 0, explode: 0, bend: 1.5, loads: 0,
    text: 'Five assemblies, top to bottom, as in DH-5: top sub, power section, driveshaft assembly, adjustable assembly and the mud-lubricated bearing assembly, ending at the bit box. The power section is drawn with a break, as DH-5 draws it.',
    // DH-5's own five labels, plus the break
    labels: [['topsub', 50, -70, 'Top sub'], ['stator', 0, 64, 'Power section · rotor and stator'], ['break', 95, -70, '// 4 of 7 stages hidden'], ['driveshaft', -40, 64, 'Driveshaft assembly'], ['offset', 70, -70, 'Adjustable assembly'], ['housing', 40, 64, 'Bearing assembly · mud-lubricated']],
  },
  {
    id: 'topsub', btn: 'TOP SUB', name: 'Top sub', refs: 'DH-6', dur: 8,
    cam: C(0.36, 0, 22, 14, 2.15), cut: 'section', flow: 1, explode: 0, bend: 1.5, loads: 0,
    text: 'A cross-over housing at the top end of the motor. Its top connection is an API tool-joint box; its lower end screws into the upper box of the stator with a proprietary thread (DH-6). Drilling fluid enters here.',
    labels: [['apibox', -40, -100], ['topsub', 60, -110], ['propconn', 90, 105]],
  },
  {
    id: 'catch', btn: 'ROTOR CATCH', name: 'Rotor catch', refs: 'DH-7', dur: 8,
    cam: C(0.55, 0, 28, 16, 1.25), cut: 'section', flow: 1, explode: 0, bend: 1.5, loads: 0,
    text: 'A back-up if the connection between the power section and top sub breaks. The stem is screwed into the rotor top; its flange cannot pass the catch ring, so the rotor and the BHA below stay attached (DH-7).',
    labels: [['stem', -60, -110], ['catchring', 50, -120], ['nozzle', 60, 110], ['rotor', 40, 120]],
  },
  {
    id: 'power', btn: 'POWER', name: 'Power section', refs: 'DH-8 · DH-9', dur: 11,
    cam: C(1.45, 0, 16, 14, 2.7), cut: [[0, 'section'], [5.5, 'glass']], flow: 1, explode: 0, bend: 1.5, loads: 0,
    text: 'Pumped mud fills sealed cavities between the 5-lobe rotor and the 6-lobe stator elastomer. As each cavity moves down it pushes on the rotor and turns it. Speed follows flow rate; torque follows the pressure drop (text p.4). One stage is one stator lead (DH-9).',
    labels: [['rotor', -80, 110], ['stator', 60, -110]],
  },
  {
    id: 'driveshaft', btn: 'DRIVESHAFT', name: 'Driveshaft assembly', refs: 'DH-5 · DH-12', dur: 9,
    cam: C(4.6, -0.01, 12, 12, 3.05), cut: 'glass', flow: 0, explode: 0, bend: 1.5, loads: 0, axes: 1,
    text: 'Two universal joints turn the rotor’s eccentric, orbiting motion into concentric rotation for the bearing mandrel, and take up the bend. The driveshaft also carries the rotor’s thrust from the pressure drop (text p.4).',
    labels: [['j1', -30, -100], ['driveshaft', 0, 100], ['j2', 30, -100]],
  },
  {
    id: 'adjust', btn: 'ADJUSTABLE', name: 'Adjustable assembly', refs: 'DH-12', dur: 10,
    cam: C(4.88, -0.02, 0, 5, 3.7, {drift: 2}), cut: 'section', flow: 0, explode: 0, bend: [[0, 1.5], [2.5, 0], [5.5, 2.6], [8.5, 1.5]], loads: 0, axes: 1,
    text: 'Connects the stator to the bearing assembly and encloses the driveshaft. The bend angle is field-adjustable to give a range of build rates (DH-12). The joint-angle panel follows the bend as it changes.',
    labels: [['adapter', -60, -100], ['adjring', 40, -120], ['offset', 30, 100], ['bentAxis', -20, 150]],
  },
  {
    id: 'bearings', btn: 'BEARINGS', name: 'Mud-lubricated bearing assembly', refs: 'DH-14', dur: 12,
    cam: C(6.3, -0.08, 10, 11, 4.15), cut: 'section', flow: 1, explode: 0, bend: 1.5, loads: 1, onBottom: [[0, 1], [6, 1.01], [6.01, 0]],
    text: 'A small share of the drilling fluid passes through the bearing chamber to lubricate it, so there are no elastomeric seals (DH-14, text p.5). Radial bearings above and below; a multi-row ball thrust stack between them carries on-bottom and off-bottom loads.',
    labels: [['upperRadial', -150, -96], ['thrust', 60, -122], ['lowerRadial', 50, -96], ['mandrel', -40, 100], ['band', 30, 112]],
  },
  {
    id: 'bitbox', btn: 'BIT BOX', name: 'Output shaft and bit box', refs: 'DH-5 · DH-14', dur: 8,
    cam: C(7.05, -0.1, 22, 14, 2.0), cut: 'section', flow: 1, explode: 0, bend: 1.5, loads: 0,
    text: 'The mandrel continues as the output shaft and ends in the bit box, turning 1:1 with the rotor. The main flow leaves through the mandrel bore to the bit; the small bearing bleed exits to the annulus just above the box.',
    labels: [['bitbox', -20, -110], ['boxthread', 60, 100], ['lowerRadial', -90, 100]],
  },
  {
    id: 'exploded', btn: 'EXPLODED', name: 'Exploded view', refs: 'DH-5', dur: 9,
    cam: C(3.88, 0.1, 0, 8, 20.2, {drift: 1.5}), cut: 'solid', flow: 0, explode: 1, bend: 1.5, loads: 0,
    text: 'The assemblies pulled apart along the axis, housings lifted clear: top sub; catch ring and stem; stator; rotor; driveshaft; adjustable housings; bearing housing; and the mandrel with its bearings and bit box.',
    labels: [['topsub', 0, -64], ['statorLo', 0, -66, 'Stator'], ['rotor', 0, 62], ['driveshaft', 0, 62], ['housing', 0, -66], ['mandrel', 30, 62]],
  },
];
export const TOUR_LEN = STOPS.reduce((s, x) => s + x.dur, 0);
export const stopAt = (t) => {
  let a = 0;
  for (let i = 0; i < STOPS.length; i++) {
    if (t < a + STOPS[i].dur) return {i, since: t - a};
    a += STOPS[i].dur;
  }
  return {i: STOPS.length - 1, since: STOPS[STOPS.length - 1].dur};
};
// a stop setting that may be keyed over the stop's time: a number, or [[t, v], ...] eased between keys
export const keyed = (v, t) => {
  if (!Array.isArray(v)) return v;
  // text values (cutaway modes) step at their keys
  if (typeof v[0][1] !== 'number') return v.filter(([k]) => k <= t).pop()?.[1] ?? v[0][1];
  if (t <= v[0][0]) return v[0][1];
  for (let i = 0; i < v.length - 1; i++) {
    const [t0, a] = v[i];
    const [t1, b] = v[i + 1];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      return a + (b - a) * e;
    }
  }
  return v[v.length - 1][1];
};
