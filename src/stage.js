// Pale studio for the motor: a gradient backdrop, soft boxes for the metal to catch, one sun with a soft shadow on an
// invisible floor. frame(state, cam) poses the motor and draws one frame.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildMotor} from './motor.js';

const V3 = THREE.Vector3;

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 512;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#f4f4f5');
    gr.addColorStop(0.6, '#eaebed');
    gr.addColorStop(1, '#e2e3e6');
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
  }
  const camera = new THREE.PerspectiveCamera(24, 16 / 9, 0.01, 80);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());

  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#d6d7da');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(14, 10, new V3(0, 14, 3), 2.4);
    box(3, 14, new V3(-12, 4, 7), 3.0);
    box(3, 14, new V3(12, 4, -5), 2.0);
    box(20, 2, new V3(0, 1.5, 14), 1.5);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#c4c5c8', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -2;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    pm.dispose();
  }
  const sun = new THREE.DirectionalLight('#ffffff', 2.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 12;
  sun.shadow.blurSamples = 20;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.002;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfd0d3', 0.8));
  const FLOOR_Y = -0.42;
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({color: '#5d636c', opacity: 0.2, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}));
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = FLOOR_Y;
  shade.receiveShadow = true;
  scene.add(shade);

  const motor = buildMotor();
  scene.add(motor.root);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  // cam: target (tx, ty, tz) m, azimuth from +z toward +x, elevation (radians), distance (m), sx/sy screen shift (px)
  const frame = (s, cam) => {
    motor.setCut(s.cut, !!s.rotorCut);
    const p = motor.update(s);
    const {tx, ty, tz, az, el, d} = cam;
    camera.position.set(tx + d * Math.cos(el) * Math.sin(az), ty + d * Math.sin(el), tz + d * Math.cos(el) * Math.cos(az));
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    // the shadow camera follows what's framed
    const span = Math.max(1.2, d * 0.75);
    Object.assign(sun.shadow.camera, {left: -span, right: span, top: span, bottom: -span, near: 0.5, far: 30});
    sun.shadow.camera.updateProjectionMatrix();
    sun.target.position.set(tx, 0, tz);
    sun.position.set(tx - 2.5, 7, tz + 3.5);
    composer.render();
    return p;
  };
  const pv = new V3();
  const project = (o) => {
    o.getWorldPosition(pv);
    pv.project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  return {renderer, scene, camera, composer, motor, resize, frame, project, size};
}
