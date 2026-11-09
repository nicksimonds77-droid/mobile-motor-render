// The motor as a page you drive. Left alone it plays the guided tour, top sub to bit box, then the exploded view, and
// loops; a click, drag, wheel or key hands control to the visitor, and 25 s of quiet hands it back.
// One input, the rotor angle th, advances at a rate set by flow × playback speed.
// window.LIVE.shot({...}) renders one deterministic frame for the review stills.
import {warmComposer} from 'teardown-kit/warm.js';
import {D} from './kin.js';
import {createStage} from './stage.js';
import {keyed, STOPS, stopAt, TOUR_LEN} from './tour.js';
import {createConsole, CSS} from './ui.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const BASE = 0.45 * Math.PI * 2; // rotor rad/s at 100% flow and 1× (display rate, not a rating)
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

export function runLive() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createStage(canvas);
  const ui = createConsole(app);
  const shotMode = new URLSearchParams(location.search).has('shot');

  let scale = 1;
  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, shotMode ? 1 : clamp((devicePixelRatio || 1) * scale, 0.75, 2));
  };
  fit();
  addEventListener('resize', fit);
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };

  // ------------------------------------------------------------ state
  const S = {
    th: 0.3, stopI: 0, since: 0, paused: false, play: 1, flow: 0.7, bend: D.bendDefault, explode: 0,
    cut: 'solid', labels: true, flowOn: false, loads: false, onBottom: true, tourOn: true,
  };
  // settings the visitor chose, eased toward each frame
  const goal = {bend: S.bend, explode: 0};
  const off = {az: 0, el: 0, k: 1};
  const cam = {...STOPS[0].cam};
  let T = 0;
  // the tour's own clock: it only runs while the tour is on and not paused, so PAUSE freezes the tour in place
  let tourC = 0;
  let lastInput = -99;
  const stopStart = (i) => STOPS.slice(0, i).reduce((s, x) => s + x.dur, 0);

  const applyStop = (i, since, hard = false) => {
    const s = STOPS[i];
    S.stopI = i;
    S.since = since;
    S.cut = keyed(s.cut, since);
    S.flowOn = !!s.flow;
    S.loads = !!s.loads;
    if (s.onBottom !== undefined) S.onBottom = keyed(s.onBottom, since) > 0.5;
    goal.bend = keyed(s.bend, since);
    goal.explode = s.explode;
    if (hard) {
      S.bend = goal.bend;
      S.explode = goal.explode;
    }
  };
  // resume the tour from the stop on screen, not from the top
  const startTour = (fromStop = S.stopI) => {
    S.tourOn = true;
    tourC = stopStart(fromStop);
    S.paused = false;
    S.play = 1;
    S.labels = true;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const takeOver = () => {
    lastInput = T;
    S.tourOn = false;
  };
  const setView = (i) => {
    takeOver();
    const s = STOPS[i];
    S.stopI = i;
    S.since = 0;
    S.cut = keyed(s.cut, 0);
    S.flowOn = !!s.flow;
    S.loads = !!s.loads;
    goal.bend = keyed(s.bend, 99);
    goal.explode = s.explode;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };

  // ------------------------------------------------------------ controls
  const B = ui.btn;
  const on = (b, fn) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      takeOver();
      fn();
    });
  STOPS.forEach((s, i) => on(B['v_' + s.id], () => setView(i)));
  for (const m of ['solid', 'section', 'glass']) on(B['c_' + m], () => (S.cut = m));
  on(B.o_labels, () => (S.labels = !S.labels));
  on(B.o_flow, () => (S.flowOn = !S.flowOn));
  on(B.loads, () => (S.loads = !S.loads));
  on(B.onb, () => {
    S.onBottom = true;
    S.loads = true;
  });
  on(B.offb, () => {
    S.onBottom = false;
    S.loads = true;
  });
  // PAUSE / PLAY: freezes and continues everything, the tour included; it doesn't take the tour away
  const togglePause = () => {
    lastInput = T;
    S.paused = !S.paused;
  };
  B.pause.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePause();
  });
  on(B.back, () => {
    S.paused = true;
    S.th -= 15 * D2R;
  });
  on(B.fwd, () => {
    S.paused = true;
    S.th += 15 * D2R;
  });
  for (const [k, v] of [['s1', 1], ['s2', 0.5], ['s4', 0.25], ['s10', 0.1]]) on(B[k], () => (S.play = v));
  ui.chip.addEventListener('click', (e) => {
    e.stopPropagation();
    if (S.tourOn) takeOver();
    else startTour();
  });
  const drag1 = (elx, apply) => {
    const move = (e) => {
      const r = elx.getBoundingClientRect();
      apply(clamp((e.clientX - r.left) / r.width, 0, 1));
      lastInput = T;
    };
    elx.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      takeOver();
      elx.setPointerCapture(e.pointerId);
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      move(e);
    });
  };
  drag1(ui.sliders.flow, (k) => (S.flow = k));
  drag1(ui.sliders.bend, (k) => (goal.bend = S.bend = Math.round(k * D.bendMax * 4) / 4));
  drag1(ui.sliders.explode, (k) => (goal.explode = S.explode = k));
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (/^[1-9]$/.test(k) && STOPS[+k - 1]) setView(+k - 1);
    else if (k === ' ') togglePause();
    else if (k === 'arrowleft' || k === 'arrowright') {
      takeOver();
      S.paused = true;
      S.th += (k === 'arrowleft' ? -15 : 15) * D2R;
    } else if (k === 'h') {
      takeOver();
      S.labels = !S.labels;
    } else return;
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    takeOver();
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az += ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -25, 60);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.25, 2.5);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ one frame
  const camTarget = () => {
    const c = STOPS[S.stopI].cam;
    const drift = c.drift * Math.sin(S.since * 0.22);
    return {...c, az: c.az + drift + off.az, el: clamp(c.el + off.el, -25, 80), d: c.d * off.k};
  };
  const labelItems = () => {
    if (!S.labels) return [];
    const out = [];
    for (const [id, dx, dy, text] of STOPS[S.stopI].labels) {
      const o = st.motor.anchors[id];
      if (!o) continue;
      const p = st.project(o);
      if (!p) continue;
      const alpha = S.tourOn ? clamp((S.since - 0.6) / 0.6, 0, 1) : 1;
      out.push({id, text, ax: p[0], ay: p[1], lx: clamp(p[0] + dx, 500, 1100), ly: clamp(p[1] + dy, 120, 770), alpha});
    }
    return out;
  };
  const draw = (snapCam) => {
    const t = camTarget();
    if (snapCam) Object.assign(cam, t);
    S.bend += (goal.bend - S.bend) * (snapCam ? 1 : 0.08);
    S.explode += (goal.explode - S.explode) * (snapCam ? 1 : 0.06);
    st.frame(
      {th: S.th, bend: S.bend, explode: S.explode, flow: S.flowOn ? 1 : 0, loads: S.loads ? 1 : 0, onBottom: S.onBottom, cut: S.cut, slice: S.explode < 0.3 ? 1 : 0, axes: STOPS[S.stopI].axes ? 1 : 0},
      {...cam, az: cam.az * D2R, el: cam.el * D2R},
    );
    st.motor.root.updateMatrixWorld(true);
    S.labelItems = labelItems();
    ui.update(S);
  };
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    if (S.tourOn) {
      if (!S.paused) tourC += dt;
      const {i, since} = stopAt(tourC % TOUR_LEN);
      applyStop(i, since);
    } else {
      S.since += dt;
      // left alone the tour comes back, from the stop on screen; never while the visitor has paused it
      if (!S.paused && T - lastInput > IDLE) startTour();
    }
    if (!S.paused) S.th += BASE * S.flow * S.play * dt;
    const t = camTarget();
    const k = 1 - Math.exp(-dt / (S.tourOn ? 0.55 : 0.4));
    cam.az += wrap(t.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (t[key] - cam[key]) * k;
    draw(false);
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(loop);
  };

  // deterministic frame for review: {stop, since, th, cut, flowOn, loads, onBottom, bend, explode, labels, tourOn}
  const shot = (o = {}) => {
    const i = typeof o.stop === 'number' ? o.stop : Math.max(0, STOPS.findIndex((s) => s.id === o.stop));
    S.tourOn = o.tourOn ?? true;
    applyStop(i, o.since ?? 3, true);
    for (const k of ['th', 'cut', 'flowOn', 'loads', 'onBottom', 'labels', 'paused']) if (o[k] !== undefined) S[k] = o[k];
    if (o.bend !== undefined) goal.bend = S.bend = o.bend;
    if (o.explode !== undefined) goal.explode = S.explode = o.explode;
    Object.assign(off, {az: o.az ?? 0, el: o.el ?? 0, k: o.k ?? 1});
    draw(true);
    return true;
  };
  window.LIVE = {st, S, shot, startTour, takeOver};
  applyStop(0, 0, true);
  if (shotMode) {
    warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => {
      shot({stop: 0});
      window.READY = true;
    });
    return;
  }
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(loop));
}
