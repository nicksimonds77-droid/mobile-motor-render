// The console: a fixed 1600 x 900 overlay. Title, the stop card, playback controls, three live panels (the DH-8 slice,
// the driveshaft's joint angles, the bearing load path), the view / cutaway / overlay buttons and the 3D labels.
// update(state) redraws everything from the frame's state, so nothing on screen can disagree with the motion.
import {D, Lr, N_R, N_S, orbit, pose, rr, rs, slice, SLICE_X, STATOR_MAJOR, STATOR_MINOR, ROTOR_MAJOR, ROTOR_MINOR, HIDDEN_STAGES, CAV_PER_RAD} from './kin.js';
import {PARTS, STOPS} from './tour.js';

const TAU = Math.PI * 2;
const ACC = '#e3172c';
const deg = (r) => (((r * 180) / Math.PI) % 360 + 360) % 360;

export const CSS = `
html,body{background:#ecedef;overflow:hidden;margin:0}
#app{position:absolute;left:0;top:0;width:1600px;height:900px;transform-origin:0 0;font-family:Inter,system-ui,sans-serif;color:#16181b;-webkit-font-smoothing:antialiased}
#gl{position:absolute;inset:0;width:1600px;height:900px;touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.ui{position:absolute;inset:0;pointer-events:none}
.pn{position:absolute;background:rgba(255,255,255,.93);border:1px solid #e1e3e6;padding:13px 15px;pointer-events:auto}
.h{font:700 9.5px Inter;letter-spacing:1.5px;text-transform:uppercase;color:#16181b;display:flex;align-items:center;gap:8px}
.h .r{margin-left:auto;font:600 8.5px Inter;color:#8a8f96;letter-spacing:1.2px}
.k{font:600 8.5px Inter;letter-spacing:1.1px;color:#868b92;text-transform:uppercase}
.v{font:600 12.5px 'JetBrains Mono',monospace;color:#16181b;white-space:nowrap}
.v small{font:500 9.5px 'JetBrains Mono',monospace;color:#868b92}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:7px 12px;margin-top:9px}
.inf{display:inline-block;font:700 7.5px Inter;letter-spacing:.9px;color:#8a5a00;background:#fff4d6;border:1px solid #edcf7d;padding:1px 4px 0;vertical-align:1px;white-space:nowrap}
.ref{display:inline-block;font:600 8.5px 'JetBrains Mono',monospace;color:#2f5f97;background:#eef4fb;border:1px solid #cddbec;padding:1px 5px 0;white-space:nowrap}
.tb{display:inline-flex;align-items:center;justify-content:center;height:24px;padding:0 9px;border:1px solid #d7dade;background:#fff;color:#16181b;font:700 8.8px Inter;letter-spacing:1.1px;cursor:pointer;user-select:none;white-space:nowrap}
.tb:hover{border-color:#9aa0a8}
.tb.on{background:#16181b;border-color:#16181b;color:#fff}
.tb.acc.on{background:${ACC};border-color:${ACC}}
.rw{display:flex;gap:5px;align-items:center;flex-wrap:nowrap}
.ttl{position:absolute;left:40px;top:28px;width:290px}
.ttl i{display:block;width:38px;height:3px;background:${ACC};margin-bottom:12px}
.ttl b{display:block;font:800 25px/1 Inter;letter-spacing:-.3px}
.ttl span{display:block;margin-top:8px;font:600 9.5px 'JetBrains Mono',monospace;letter-spacing:1.4px;color:#5d6269}
.ttl em{display:block;margin-top:5px;font:500 10px Inter;font-style:normal;color:#868b92}
.card .n{font:800 17px/1.15 Inter;margin:7px 0 7px;letter-spacing:-.2px}
.card p{margin:9px 0 0;font:400 11.5px/1.5 Inter;color:#3a3e44}
.card ul{list-style:none;margin:10px 0 0;padding:9px 0 0;border-top:1px solid #eceef0}
.card li{font:500 10.5px/1.35 Inter;color:#3a3e44;margin:0 0 5px;display:flex;gap:6px;align-items:baseline}
.card li .ref{margin-left:auto}
.sl{position:relative;height:22px;margin-top:3px;cursor:ew-resize}
.sl .tr{position:absolute;left:0;right:0;top:10px;height:2px;background:#dcdfe3}
.sl .fi{position:absolute;left:0;top:10px;height:2px;background:#16181b}
.sl .kn{position:absolute;top:5px;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:#fff;border:2px solid #16181b}
.ctl .k{display:flex;justify-content:space-between;margin-top:11px}
.ctl .k b{font:600 10px 'JetBrains Mono',monospace;color:#16181b;letter-spacing:0;text-transform:none}
.bar{position:absolute;left:352px;width:896px;display:flex;gap:5px;align-items:center;pointer-events:auto}
.bar .k{margin-right:4px}
.bar .sp{width:14px}
.foot{position:absolute;left:352px;top:876px;width:896px;font:500 8.5px 'JetBrains Mono',monospace;letter-spacing:.6px;color:#8a8f96;text-align:center}
.chip{position:absolute;left:800px;top:28px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:22px;padding:0 11px;border:1px solid #e1e3e6;background:rgba(255,255,255,.96);font:700 8.8px Inter;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.chip i{display:block;width:6px;height:6px;border-radius:50%;background:${ACC}}
.chip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.lbl{position:absolute;transform:translate(-50%,-50%);background:rgba(255,255,255,.95);border:1px solid #d7dade;padding:4px 7px 4px;font:700 10px Inter;white-space:nowrap;display:flex;gap:6px;align-items:center;transition:opacity .25s}
.lbl.hl{border-color:${ACC}}
svg.lines{position:absolute;inset:0;width:1600px;height:900px;overflow:visible}
canvas.c{display:block;margin-top:8px}
.legend{position:absolute;left:352px;top:62px;width:896px;justify-content:center;display:flex;gap:14px;font:600 8.5px Inter;letter-spacing:1px;color:#5d6269}
.legend span{display:flex;align-items:center;gap:5px}
.legend i{display:block;width:8px;height:8px;border-radius:50%}
`;

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const INF = '<span class="inf">INFERRED</span>';

function hiDPI(c, w, h) {
  const r = 2;
  c.width = w * r;
  c.height = h * r;
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  const g = c.getContext('2d');
  g.scale(r, r);
  return g;
}

export function createConsole(app) {
  const root = el('div', 'ui');
  app.appendChild(root);
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lines.setAttribute('class', 'lines');
  root.appendChild(lines);
  const labelLayer = el('div', '');
  root.appendChild(labelLayer);

  root.appendChild(
    el('div', 'ttl', `<i></i><b>Downhole Mud Motor</b><span>${N_R}:${N_S} POWER SECTION · MUD-LUBRICATED BEARINGS · 6¾ IN OD</span><em>Educational model · not a manufacturing replica</em>`),
  );
  root.appendChild(el('div', 'legend', `<span><i style="background:#2a7de1"></i>DRILLING FLUID (CONCEPTUAL)</span><span><i style="background:#f29a1d"></i>BEARING BLEED</span><span><i style="background:${ACC}"></i>LOAD PATH</span>`));

  // ------------------------------------------------------------ stop card
  const card = el('div', 'pn card');
  Object.assign(card.style, {left: '40px', top: '136px', width: '290px'});
  root.appendChild(card);

  // ------------------------------------------------------------ controls
  const ctl = el('div', 'pn ctl');
  Object.assign(ctl.style, {left: '40px', top: '596px', width: '290px'});
  root.appendChild(ctl);
  const btn = {};
  const mkBtn = (parent, key, text, cls = '') => {
    const b = el('div', 'tb ' + cls, text);
    parent.appendChild(b);
    btn[key] = b;
    return b;
  };
  ctl.appendChild(el('div', 'h', 'Playback<span class="r">SPACE · ← →</span>'));
  const r1 = el('div', 'rw');
  r1.style.marginTop = '9px';
  ctl.appendChild(r1);
  mkBtn(r1, 'pause', '❚❚ PAUSE', 'acc').style.width = '82px';
  mkBtn(r1, 'back', '−15°');
  mkBtn(r1, 'fwd', '+15°');
  const speeds = [
    ['s1', '1×', 1],
    ['s2', '½×', 0.5],
    ['s4', '¼×', 0.25],
    ['s10', '1/10×', 0.1],
  ];
  const r2 = el('div', 'rw');
  r2.style.marginTop = '6px';
  ctl.appendChild(r2);
  r2.appendChild(el('div', 'k', 'SPEED'));
  r2.lastChild.style.width = '44px';
  for (const [k, t] of speeds) mkBtn(r2, k, t);
  const slider = (label, fmt) => {
    const k = el('div', 'k', `<span>${label}</span><b></b>`);
    ctl.appendChild(k);
    const s = el('div', 'sl', '<div class="tr"></div><div class="fi"></div><div class="kn"></div>');
    ctl.appendChild(s);
    return {
      el: s,
      set(v) {
        s.querySelector('.fi').style.width = `${v * 100}%`;
        s.querySelector('.kn').style.left = `${v * 100}%`;
        k.querySelector('b').innerHTML = fmt(v);
      },
    };
  };
  const sFlow = slider('Flow rate · relative', (v) => `${Math.round(v * 100)}%`);
  const sBend = slider(`Bend setting ${INF}`, (v) => `${(v * D.bendMax).toFixed(2)}°`);
  const sExp = slider('Exploded view', (v) => `${Math.round(v * 100)}%`);

  // ------------------------------------------------------------ panel A: the slice (DH-8)
  const pa = el('div', 'pn');
  Object.assign(pa.style, {left: '1270px', top: '28px', width: '290px'});
  root.appendChild(pa);
  pa.appendChild(el('div', 'h', `Power section slice <span class="ref">DH-8</span>`));
  const ca = el('canvas', 'c');
  pa.appendChild(ca);
  const ga = hiDPI(ca, 258, 152);
  const gridA = el('div', 'grid');
  pa.appendChild(gridA);
  const cellA = (k) => {
    const d = el('div', '', `<div class="k">${k}</div><div class="v"></div>`);
    gridA.appendChild(d);
    return d.querySelector('.v');
  };
  const vLobes = cellA('Lobes');
  const vTh = cellA('Rotor turn θ');
  const vPsi = cellA('Axis orbit ψ');
  const vE = cellA('Eccentricity e');
  const vStage = cellA('Stage = stator lead');
  const vLead = cellA('Rotor lead');
  const vCav = cellA('Cavities moved');
  const vSeal = cellA('Seal lines');

  // ------------------------------------------------------------ panel B: driveshaft
  const pb = el('div', 'pn');
  Object.assign(pb.style, {left: '1270px', top: '418px', width: '290px'});
  root.appendChild(pb);
  pb.appendChild(el('div', 'h', `Driveshaft joints <span class="r">ONE ORBIT</span>`));
  const cb = el('canvas', 'c');
  pb.appendChild(cb);
  const gb = hiDPI(cb, 258, 74);
  const gridB = el('div', 'grid');
  gridB.style.gridTemplateColumns = '1fr 1fr 1fr';
  pb.appendChild(gridB);
  const cellB = (k) => {
    const d = el('div', '', `<div class="k">${k}</div><div class="v"></div>`);
    gridB.appendChild(d);
    return d.querySelector('.v');
  };
  const vUp = cellB('<span style="color:#7461ad">●</span> Upper');
  const vLo = cellB('<span style="color:#8a8f96">●</span> Lower');
  const vBend = cellB('Bend');

  // ------------------------------------------------------------ panel C: bearings
  const pc = el('div', 'pn');
  Object.assign(pc.style, {left: '1270px', top: '596px', width: '290px'});
  root.appendChild(pc);
  pc.appendChild(el('div', 'h', `Bearings · load path <span class="ref">DH-14</span>`));
  const rc = el('div', 'rw');
  rc.style.marginTop = '9px';
  pc.appendChild(rc);
  mkBtn(rc, 'onb', 'ON BOTTOM', 'acc');
  mkBtn(rc, 'offb', 'OFF BOTTOM', 'acc');
  mkBtn(rc, 'loads', 'SHOW IN 3D');
  const cc = el('canvas', 'c');
  pc.appendChild(cc);
  const gc = hiDPI(cc, 258, 58);
  const txC = el('div', '');
  txC.style.cssText = 'margin-top:6px;font:400 10.5px/1.45 Inter;color:#3a3e44;min-height:46px';
  pc.appendChild(txC);

  // ------------------------------------------------------------ bottom bars
  const views = el('div', 'bar');
  views.style.top = '808px';
  root.appendChild(views);
  views.appendChild(el('div', 'k', 'VIEW'));
  for (const s of STOPS) mkBtn(views, 'v_' + s.id, s.btn).style.flex = '1';
  const modes = el('div', 'bar');
  modes.style.top = '840px';
  root.appendChild(modes);
  modes.appendChild(el('div', 'k', 'CUTAWAY'));
  mkBtn(modes, 'c_solid', 'SOLID');
  mkBtn(modes, 'c_section', 'LONGITUDINAL SECTION');
  mkBtn(modes, 'c_glass', 'TRANSPARENT HOUSING');
  modes.appendChild(el('div', 'sp'));
  modes.appendChild(el('div', 'k', 'OVERLAYS'));
  mkBtn(modes, 'o_labels', 'LABELS');
  mkBtn(modes, 'o_flow', 'FLOW');
  modes.appendChild(el('div', 'sp'));
  modes.appendChild(el('div', 'k', 'KEYS 1–9 · H'));
  root.appendChild(el('div', 'foot', `All dimensions inferred (scaled to a 6¾-in OD from DH-5) · INFERRED marks form not shown in the excerpt · break hides ${HIDDEN_STAGES} of ${D.stages} stages · no ratings implied`));
  const chip = el('div', 'chip');
  root.appendChild(chip);

  // ------------------------------------------------------------ drawing
  const drawSlice = (th, flowOn) => {
    const g = ga;
    g.clearRect(0, 0, 258, 152);
    const cx = 72;
    const cy = 76;
    const s = 68 / 85.75;
    const {bS, rot, C} = slice(SLICE_X, th);
    // looking downhole: y to the right, z down the canvas
    const P = (y, z) => [cx + y * s, cy + z * s];
    g.beginPath();
    g.arc(cx, cy, 85.75 * s, 0, TAU);
    g.fillStyle = '#c98c84';
    g.fill();
    g.beginPath();
    g.arc(cx, cy, D.tubeIR * s, 0, TAU);
    g.fillStyle = '#3a3d42';
    g.fill();
    const N = 240;
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      const r = rs(a);
      const [x, y] = P(r * Math.cos(a + bS), r * Math.sin(a + bS));
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.fillStyle = flowOn ? '#cfe1f6' : '#f4f5f6';
    g.fill();
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      const r = rr(a);
      const [x, y] = P(C[0] + r * Math.cos(a + rot), C[1] + r * Math.sin(a + rot));
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.fillStyle = '#c3c8cf';
    g.fill();
    g.strokeStyle = '#8d939b';
    g.lineWidth = 1;
    g.stroke();
    // the axis orbit: circle of radius e round the stator centre, rotor centre on it
    g.setLineDash([2, 2]);
    g.beginPath();
    g.arc(cx, cy, D.e * s, 0, TAU);
    g.strokeStyle = ACC;
    g.stroke();
    g.setLineDash([]);
    const [rx, ry] = P(C[0], C[1]);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(rx, ry);
    g.stroke();
    g.beginPath();
    g.arc(rx, ry, 2.6, 0, TAU);
    g.fillStyle = ACC;
    g.fill();
    g.beginPath();
    g.arc(cx, cy, 1.6, 0, TAU);
    g.fillStyle = '#16181b';
    g.fill();
    // a mark on the rotor, so its slow turn reads against the fast orbit
    const [mx, my] = P(C[0] + 0.62 * ROTOR_MINOR * Math.cos(rot), C[1] + 0.62 * ROTOR_MINOR * Math.sin(rot));
    g.beginPath();
    g.moveTo(rx, ry);
    g.lineTo(mx, my);
    g.strokeStyle = '#16181b';
    g.lineWidth = 1.4;
    g.stroke();
    // labels in the DH-8 manner
    g.font = '600 8.5px Inter';
    g.fillStyle = '#3a3e44';
    g.strokeStyle = '#9aa0a8';
    g.lineWidth = 0.8;
    const lab = (t, ax, ay, lx, ly) => {
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(lx - 3, ly - 3);
      g.stroke();
      g.fillText(t, lx, ly);
    };
    lab('STATOR TUBE', cx + 50, cy - 42, 156, 18);
    lab('ELASTOMER', cx + 49, cy - 24, 156, 40);
    lab('CAVITY', cx + 36, cy + 16, 156, 100);
    lab('ROTOR', rx + 14, ry + 8, 156, 78);
    g.fillStyle = ACC;
    g.fillText('AXIS ORBIT, r = e', 156, 128);
    g.fillStyle = '#868b92';
    g.fillText('at the red ring,', 156, 140);
    g.fillText('looking downhole', 156, 150);
  };
  const drawJoints = (bendDeg, psiNow) => {
    const g = gb;
    g.clearRect(0, 0, 258, 74);
    const n = 90;
    const up = [];
    const lo = [];
    for (let i = 0; i <= n; i++) {
      // one orbit = 1/5 of a rotor turn
      const p = pose(-((i / n) * TAU) / N_R, bendDeg);
      up.push(p.upperJointDeg);
      lo.push(p.lowerJointDeg);
    }
    const mx = Math.max(1, ...up, ...lo) * 1.15;
    const X0 = 26;
    const W = 226;
    const Y = (v) => 62 - (v / mx) * 54;
    g.strokeStyle = '#e6e8eb';
    g.lineWidth = 1;
    g.font = '500 8px "JetBrains Mono"';
    g.fillStyle = '#9aa0a8';
    for (const v of [0, mx / 2, mx]) {
      g.beginPath();
      g.moveTo(X0, Y(v));
      g.lineTo(X0 + W, Y(v));
      g.stroke();
      g.fillText(v.toFixed(1) + '°', 0, Y(v) + 3);
    }
    const line = (arr, col) => {
      g.beginPath();
      arr.forEach((v, i) => (i ? g.lineTo(X0 + (i / n) * W, Y(v)) : g.moveTo(X0, Y(v))));
      g.strokeStyle = col;
      g.lineWidth = 1.6;
      g.stroke();
    };
    line(lo, '#8a8f96');
    line(up, '#7461ad');
    const u = ((((-psiNow / TAU) % 1) + 1) % 1);
    g.strokeStyle = ACC;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(X0 + u * W, 6);
    g.lineTo(X0 + u * W, 64);
    g.stroke();
    g.fillStyle = '#9aa0a8';
    g.fillText('ψ 0°', X0, 73);
    g.fillText('360°', X0 + W - 22, 73);
  };
  const drawBearings = (on, show) => {
    const g = gc;
    g.clearRect(0, 0, 258, 58);
    const rows = 28;
    const off = 8;
    const x0 = 44;
    const w = 170;
    g.fillStyle = '#cfd25d';
    g.fillRect(4, 18, 36, 18);
    g.fillRect(218, 18, 36, 18);
    for (let k = 0; k < rows; k++) {
      const lit = on ? k >= off : k < off;
      g.fillStyle = lit ? ACC : '#c6cad0';
      g.beginPath();
      g.arc(x0 + 3 + (k / (rows - 1)) * (w - 6), 27, 2.6, 0, TAU);
      g.fill();
    }
    g.font = '600 7.5px Inter';
    g.fillStyle = '#5d6269';
    g.fillText('UPPER', 8, 12);
    g.fillText('RADIAL', 6, 48);
    g.fillText('LOWER', 222, 12);
    g.fillText('RADIAL', 220, 48);
    g.fillText(`OFF-BTM ${off} ROWS`, x0, 12);
    g.fillText(`ON-BTM ${rows - off} ROWS`, x0 + 82, 12);
    g.fillStyle = '#8a5a00';
    g.fillText('ROW SPLIT INFERRED', x0 + 44, 50);
    // the arrow: on bottom the bit pushes up (toward the top sub, left); off bottom the mandrel is pushed down
    g.strokeStyle = ACC;
    g.fillStyle = ACC;
    g.lineWidth = 2;
    const ay = 56;
    const [a, b] = on ? [200, 120] : [60, 140];
    g.beginPath();
    g.moveTo(a, ay - 2);
    g.lineTo(b, ay - 2);
    g.stroke();
    const d = Math.sign(b - a);
    g.beginPath();
    g.moveTo(b + d * 6, ay - 2);
    g.lineTo(b - d * 2, ay - 6);
    g.lineTo(b - d * 2, ay + 2);
    g.fill();
    void show;
  };

  // ------------------------------------------------------------ labels
  const pool = [];
  const lineEls = [];
  const drawLabels = (items) => {
    while (pool.length < items.length) {
      const d = el('div', 'lbl');
      labelLayer.appendChild(d);
      pool.push(d);
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('stroke', '#7f858d');
      l.setAttribute('stroke-width', '1');
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('r', '2.6');
      c.setAttribute('fill', '#16181b');
      lines.append(l, c);
      lineEls.push([l, c]);
    }
    pool.forEach((d, i) => {
      const it = items[i];
      const [l, c] = lineEls[i];
      if (!it) {
        d.style.display = 'none';
        l.style.display = c.style.display = 'none';
        return;
      }
      d.style.display = l.style.display = c.style.display = '';
      const key = it.id + it.text;
      if (d.dataset.k !== key) {
        d.dataset.k = key;
        const p = PARTS[it.id] || {name: it.id};
        d.innerHTML = `${it.text || p.name}${p.refs && p.refs !== '—' ? ` <span class="ref">${p.refs}</span>` : ''}${p.inf ? ` <span class="inf">INFERRED · ${p.inf.toUpperCase()}</span>` : ''}`;
      }
      d.style.left = `${it.lx}px`;
      d.style.top = `${it.ly}px`;
      d.style.opacity = it.alpha;
      l.setAttribute('x1', it.ax);
      l.setAttribute('y1', it.ay);
      l.setAttribute('x2', it.lx);
      l.setAttribute('y2', it.ly);
      l.style.opacity = c.style.opacity = it.alpha;
      c.setAttribute('cx', it.ax);
      c.setAttribute('cy', it.ay);
    });
  };

  // ------------------------------------------------------------ the frame's redraw
  let cardKey = '';
  const update = (S) => {
    const st = STOPS[S.stopI];
    const key = st.id + S.tourOn;
    if (key !== cardKey) {
      cardKey = key;
      const parts = st.labels.map(([id]) => id).filter((id, i, a) => a.indexOf(id) === i && PARTS[id]);
      card.innerHTML =
        `<div class="h">Stop ${S.stopI + 1} / ${STOPS.length}<span class="r">${S.tourOn ? 'GUIDED TOUR' : 'YOUR VIEW'}</span></div>` +
        `<div class="n">${st.name}</div><span class="ref">${st.refs}</span><p>${st.text}</p>` +
        `<ul>${parts.map((id) => `<li>${PARTS[id].name.replace(/^\/\/ /, '')}${PARTS[id].inf ? ` <span class="inf">INFERRED · ${PARTS[id].inf.toUpperCase()}</span>` : ''}</li>`).join('')}</ul>`;
    }
    btn.pause.classList.toggle('on', S.paused);
    const pTxt = S.paused ? '▶ PLAY' : '❚❚ PAUSE';
    if (btn.pause.textContent !== pTxt) btn.pause.textContent = pTxt;
    for (const [k, , v] of speeds) btn[k].classList.toggle('on', S.play === v);
    for (const s of STOPS) btn['v_' + s.id].classList.toggle('on', s.id === st.id);
    for (const m of ['solid', 'section', 'glass']) btn['c_' + m].classList.toggle('on', S.cut === m);
    btn.o_labels.classList.toggle('on', S.labels);
    btn.o_flow.classList.toggle('on', S.flowOn);
    btn.onb.classList.toggle('on', S.onBottom);
    btn.offb.classList.toggle('on', !S.onBottom);
    btn.loads.classList.toggle('on', S.loads);
    sFlow.set(S.flow);
    sBend.set(S.bend / D.bendMax);
    sExp.set(S.explode);
    chip.classList.toggle('on', S.tourOn);
    const cTxt = S.tourOn ? (S.paused ? '<i></i>GUIDED TOUR PAUSED · PRESS PLAY' : '<i></i>GUIDED TOUR · CLICK TO TAKE OVER') : '▶ RESUME GUIDED TOUR FROM HERE';
    if (chip.dataset.t !== cTxt) {
      chip.dataset.t = cTxt;
      chip.innerHTML = cTxt;
    }

    const th = S.th;
    vLobes.innerHTML = `${N_R} : ${N_S} <small>rotor : stator</small>`;
    vTh.innerHTML = `${deg(th).toFixed(0).padStart(3, ' ')}°`;
    vPsi.innerHTML = `${deg(orbit(th)).toFixed(0)}° <small>= −5θ</small>`;
    vE.innerHTML = `${D.e} mm ${INF}`;
    vStage.innerHTML = `${D.Ls} mm ${INF}`;
    vLead.innerHTML = `${Lr.toFixed(0)} mm <small>5/6 stage</small>`;
    vCav.innerHTML = `${((CAV_PER_RAD * th) / D.Ls).toFixed(1)} <small>stages</small>`;
    vSeal.innerHTML = `${N_S} <small>n + 1, sealed</small>`;
    drawSlice(th, S.flowOn);
    const p = pose(th, S.bend);
    drawJoints(S.bend, p.psi);
    vUp.innerHTML = `${p.upperJointDeg.toFixed(2)}°`;
    vLo.innerHTML = `${p.lowerJointDeg.toFixed(2)}°`;
    vBend.innerHTML = `${S.bend.toFixed(2)}°`;
    drawBearings(S.onBottom, S.loads);
    txC.innerHTML = S.onBottom
      ? '<b>On bottom.</b> Weight on bit pushes the bit box up; the mandrel passes it through the on-bottom rows into the housing and drill string.'
      : '<b>Off bottom.</b> The pressure drop across the rotor and the bit pushes the mandrel down; the off-bottom rows carry it.';
    drawLabels(S.labelItems || []);
  };

  const sliders = {flow: sFlow.el, bend: sBend.el, explode: sExp.el};
  return {root, btn, chip, sliders, update, STOP_COUNT: STOPS.length, dims: {STATOR_MAJOR, STATOR_MINOR, ROTOR_MAJOR, ROTOR_MINOR}};
}
