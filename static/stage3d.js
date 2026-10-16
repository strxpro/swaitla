/* Lumo — 3-D stage view (three.js r170, vendored in /static/vendor)
 *
 * Uses the same moving-head kinematics as stage.py:
 *   phi = yaw + pan_eff (about +Y, 0 = facing the audience +Z)
 *   hanging: DMX centre points straight down, floor: straight up; tilt swings toward phi.
 * Beam colour = fixture RGB, brightness = dimmer × grand master × strobe (× blackout),
 * so what you see is what the real fixture outputs.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const PH = window.PH;
const wrap = document.getElementById('stage3d');
const labelsEl = document.getElementById('labels3d');
const DEG = Math.PI / 180;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  const el = document.getElementById('s3d-err');
  el.hidden = false; el.textContent = 'WebGL niedostępny w tej przeglądarce – widok 3D wyłączony';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
wrap.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080a);
scene.fog = new THREE.FogExp2(0x07080a, 0.018);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, 1.2, 0);

scene.add(new THREE.HemisphereLight(0xb8c2d2, 0x101010, 1.1));
const keyLight = new THREE.DirectionalLight(0xcdd6e4, 0.9);   // dim house/work light so rigging stays readable
keyLight.position.set(4, 9, 12);
scene.add(keyLight);

/* ------------------------------------------------------------------ static stage geometry */
const stageGroup = new THREE.Group();
scene.add(stageGroup);
const matFloor = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.92, metalness: 0 });
const matDeck = new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 0.85, metalness: 0 });
const matWall = new THREE.MeshStandardMaterial({ color: 0x121419, roughness: 0.95, metalness: 0 });
const matMetal = new THREE.MeshStandardMaterial({ color: 0x8a919e, roughness: 0.4, metalness: 0.5 });
const matBody = new THREE.MeshStandardMaterial({ color: 0x3a3f49, roughness: 0.5, metalness: 0.35 });
let stageSig = '';

function disposeGroup(g) {
  g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  g.clear();
}

function buildStage(sg, fixtures) {
  disposeGroup(stageGroup);
  const W = sg.width, D = sg.depth;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 30, D + 30), matFloor);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; floor.name = 'floor';
  stageGroup.add(floor);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, D), matDeck);
  deck.position.y = -0.02; deck.name = 'floor';
  stageGroup.add(deck);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(W + 8, 10), matWall);
  wall.position.set(0, 5, -D / 2 - 0.6);
  stageGroup.add(wall);

  // 1 m grid + stage edge
  const pts = [];
  for (let x = Math.ceil(-W / 2); x <= W / 2; x++) pts.push(x, 0.002, -D / 2, x, 0.002, D / 2);
  for (let z = Math.ceil(-D / 2); z <= D / 2; z++) pts.push(-W / 2, 0.002, z, W / 2, 0.002, z);
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  stageGroup.add(new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0x252a33 })));
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, 0.001, D)),
    new THREE.LineBasicMaterial({ color: 0x3d4452 }));
  edge.position.y = 0.003;
  stageGroup.add(edge);
  // front edge marker
  const front = new THREE.Mesh(new THREE.BoxGeometry(W, 0.01, 0.06), new THREE.MeshBasicMaterial({ color: 0x6b4a0b }));
  front.position.set(0, 0.006, D / 2 - 0.03);
  stageGroup.add(front);

  // camera footprint (what the camera sees on the floor)
  if (sg.footprint) {
    const fp = sg.footprint.map(([x, z]) => new THREE.Vector3(x, 0.012, z));
    const g = new THREE.BufferGeometry().setFromPoints([...fp, fp[0]]);
    const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0x06b6d4, dashSize: 0.25, gapSize: 0.15, transparent: true, opacity: 0.6 }));
    l.computeLineDistances();
    stageGroup.add(l);
  }

  // truss for every row of hanging fixtures (grouped by height and depth)
  const rows = new Map();
  for (const f of fixtures) {
    if (f.mount !== 'hang') continue;
    const key = `${f.pos[1].toFixed(1)}|${f.pos[2].toFixed(1)}`;
    const r = rows.get(key) || { y: f.pos[1], z: f.pos[2], x0: Infinity, x1: -Infinity };
    r.x0 = Math.min(r.x0, f.pos[0]); r.x1 = Math.max(r.x1, f.pos[0]);
    rows.set(key, r);
  }
  for (const r of rows.values()) {
    const x0 = Math.min(r.x0 - 1, -W / 2), x1 = Math.max(r.x1 + 1, W / 2), len = x1 - x0, ty = r.y + 0.45;
    const truss = new THREE.Group();
    for (const [dy, dz] of [[0.14, 0.14], [0.14, -0.14], [-0.14, 0.14], [-0.14, -0.14]]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, len, 8), matMetal);
      c.rotation.z = Math.PI / 2; c.position.set((x0 + x1) / 2, ty + dy, r.z + dz);
      truss.add(c);
    }
    for (let x = x0; x <= x1; x += 0.5) {       // cross bracing
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.28, 0.015), matMetal);
      b.position.set(x, ty, r.z + 0.14); truss.add(b);
      const b2 = b.clone(); b2.position.z = r.z - 0.14; truss.add(b2);
    }
    for (const x of [x0, x1]) {                 // towers
      const tw = new THREE.Mesh(new THREE.BoxGeometry(0.3, ty + 0.15, 0.3), new THREE.MeshStandardMaterial({ color: 0x6a717e, roughness: 0.6, metalness: 0.4, wireframe: true }));
      tw.position.set(x, (ty + 0.15) / 2, r.z); truss.add(tw);
    }
    stageGroup.add(truss);
  }
}

/* ------------------------------------------------------------------ moving head model */
const beamVS = `
varying float vY; varying float vEdge;
void main() {
  vY = -position.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vEdge = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;
const beamFS = `
uniform vec3 color; uniform float intensity;
varying float vY; varying float vEdge;
void main() {
  float fall = pow(clamp(1.0 - vY, 0.0, 1.0), 1.3) * 0.85 + 0.15;
  float edge = pow(vEdge, 1.6);
  gl_FragColor = vec4(color * intensity * fall * edge * 0.42, 1.0);
}`;
const coneGeo = new THREE.ConeGeometry(1, 1, 48, 1, true);
coneGeo.translate(0, -0.5, 0);            // apex at origin, opens toward -Y, length 1
const poolGeo = new THREE.CircleGeometry(1, 48);
const poolTex = (() => {                  // soft-edged light pool
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

const heads = new Map();    // id → model
let fixSig = '';

/* ---- smoke machine: box + nozzle, puffs of haze instead of a beam */
const smokeTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 9; i++) {                 // lumpy puff, not a perfect disc
    const x = 64 + Math.cos(i * 2.1) * 18, y = 64 + Math.sin(i * 1.7) * 14, r = 34 + (i % 3) * 8;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function makeSmoke(f) {
  const root = new THREE.Group();
  const hang = f.mount === 'hang';
  root.position.set(f.pos[0], hang ? f.pos[1] : 0, f.pos[2]);
  root.rotation.y = f.yaw * DEG;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.3, 0.34), matBody);
  box.position.y = hang ? -0.2 : 0.15; box.userData.fid = f.id; root.add(box);
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.16), new THREE.MeshBasicMaterial({ color: 0x15181c }));
  grille.position.set(-0.261, box.position.y, 0); grille.rotation.y = -Math.PI / 2; root.add(grille);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.12, 12), matMetal);
  nozzle.rotation.x = Math.PI / 2; nozzle.position.set(0, box.position.y, 0.22); root.add(nozzle);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x331a00 });
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.018, 12), ledMat);
  led.position.set(0.16, box.position.y + 0.08, 0.171); root.add(led);
  const puffs = [];
  const haze = new THREE.Group(); haze.position.set(0, box.position.y, 0.3); root.add(haze);
  for (let i = 0; i < 40; i++) {
    const m = new THREE.SpriteMaterial({ map: smokeTex, color: 0xd9dee2, transparent: true, depthWrite: false, opacity: 0 });
    const sp = new THREE.Sprite(m); sp.visible = false; haze.add(sp);
    puffs.push({ sp, age: 99, life: 1, vx: 0, vy: 0, vz: 0, max: 0 });
  }
  const lab = document.createElement('div'); lab.className = 'lab3d'; labelsEl.appendChild(lab);
  const selRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0xffab1f, transparent: true, opacity: 0.9, depthWrite: false }));
  selRing.rotation.x = Math.PI / 2; selRing.position.y = hang ? -0.36 : 0.01; selRing.visible = false; root.add(selRing);
  scene.add(root);
  return { kind: 'smoke', root, lab, selRing, puffs, ledMat, hang, spawn: 0, lastT: 0 };
}
function updateSmoke(h, f, st, t) {
  const dt = Math.min(0.1, h.lastT ? t - h.lastT : 0.016); h.lastT = t;
  const level = (f.values.dimmer / 255) * ((st.grand_master ?? 255) / 255) * (st.blackout ? 0 : 1);
  h.ledMat.color.setRGB(level > 0.02 ? 1 : 0.2, level > 0.02 ? 0.55 : 0.1, 0);
  h.spawn = Math.min(3, h.spawn + (level > 0.02 ? dt * (5 + 9 * level) : 0));
  for (const p of h.puffs) {
    if (h.spawn >= 1 && p.age >= p.life) {        // re-use a dead puff
      h.spawn -= 1;
      p.age = 0; p.life = 3 + Math.random() * 2.5;
      p.vx = (Math.random() - 0.5) * 0.9; p.vy = 0.03 + Math.random() * 0.1; p.vz = 1.2 + Math.random() * 1.8;
      p.sp.position.set(0, 0, 0); p.y = 0; p.sp.visible = true; p.max = 0.06 + 0.1 * level;
      p.sp.material.rotation = Math.random() * Math.PI * 2; p.spin = (Math.random() - 0.5) * 0.4;
    }
    if (p.age >= p.life) { p.sp.visible = false; continue; }
    p.age += dt;
    const k = p.age / p.life;
    p.vz *= 1 - dt * 0.9;                          // the jet slows down and spreads
    const size = 0.3 + 3.4 * Math.sqrt(k);
    p.y += p.vy * dt;
    p.sp.position.x += p.vx * dt; p.sp.position.z += p.vz * dt;
    p.sp.position.y = p.y + (h.hang ? 0 : size * 0.3);        // a floor machine: the cloud sits on the floor, not in it
    p.sp.scale.set(size, size * 0.62, 1);
    p.sp.material.opacity = p.max * Math.sin(Math.PI * Math.min(1, k * 1.15));
    p.sp.material.rotation += p.spin * dt;
  }
}
// PAR can / strobe box / LED bar / laser instead of a moving-head yoke (they do not pan or tilt)
const STATIC_BODY = ['par', 'strobe', 'bar', 'laser', 'derby'];

function makeHead(f) {
  if (f.type === 'smoke') return makeSmoke(f);
  const hang = f.mount === 'hang', s = hang ? -1 : 1;     // s = beam axis direction at rest
  const root = new THREE.Group();
  root.position.set(f.pos[0], f.pos[1], f.pos[2]);
  root.rotation.y = f.yaw * DEG;

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.13, 0.34), matBody);
  base.position.y = -s * 0.33; base.userData.fid = f.id;
  root.add(base);
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0x0b3a44 }));
  disp.position.set(0, -s * 0.33, 0.171); root.add(disp);      // display marks the "front" (yaw 0 → audience)
  if (hang) {
    const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), matMetal);
    clamp.position.y = 0.48; root.add(clamp);
  }

  const kind = STATIC_BODY.includes(f.type) ? f.type : null;
  if (kind) base.visible = disp.visible = false;
  const yoke = new THREE.Group(); root.add(yoke);
  if (!kind) {
    for (const x of [-0.21, 0.21]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.13), matBody);
      arm.position.set(x, -s * 0.11, 0); arm.userData.fid = f.id; yoke.add(arm);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.05, 0.13), matBody);
    bar.position.y = -s * 0.26; yoke.add(bar);
  } else {                                    // U-bracket of a PAR / strobe / bar
    const br = new THREE.Mesh(new THREE.BoxGeometry(kind === 'bar' ? 0.9 : 0.36, 0.03, 0.08), matMetal);
    br.position.y = -s * 0.2; yoke.add(br);
  }

  const head = new THREE.Group(); yoke.add(head);
  const geo = kind === 'par' || kind === 'derby' ? new THREE.CylinderGeometry(0.14, 0.16, 0.3, 24)
    : kind === 'strobe' ? new THREE.BoxGeometry(0.46, 0.14, 0.2)
    : kind === 'bar' ? new THREE.BoxGeometry(0.95, 0.12, 0.14)
    : kind === 'laser' ? new THREE.BoxGeometry(0.26, 0.16, 0.22)
    : new THREE.CylinderGeometry(0.15, 0.12, 0.34, 24);
  const body = new THREE.Mesh(geo, matBody);
  body.userData.fid = f.id; head.add(body);
  const lensMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const lens = new THREE.Mesh(kind === 'strobe' ? new THREE.PlaneGeometry(0.4, 0.16) : kind === 'bar' ? new THREE.PlaneGeometry(0.88, 0.1)
    : new THREE.CircleGeometry(kind === 'laser' ? 0.04 : 0.12, 32), lensMat);
  lens.position.y = s * 0.172; lens.rotation.x = s * Math.PI / 2 * -1;
  head.add(lens);

  const beamMat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(1, 1, 1) }, intensity: { value: 0 } },
    vertexShader: beamVS, fragmentShader: beamFS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(coneGeo, beamMat);
  beam.position.y = s * 0.175;
  if (!hang) beam.rotation.x = Math.PI;
  beam.frustumCulled = false;
  head.add(beam);

  const light = new THREE.SpotLight(0xffffff, 0, 0, (f.beam_deg / 2) * DEG * 1.15, 0.45, 1.6);
  light.position.y = s * 0.18;
  const tgt = new THREE.Object3D(); tgt.position.y = s * 10;
  head.add(light); head.add(tgt); light.target = tgt;

  const poolPivot = new THREE.Group(); scene.add(poolPivot);
  const pool = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({
    map: poolTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
  }));
  pool.rotation.x = -Math.PI / 2; poolPivot.add(pool);

  const lab = document.createElement('div'); lab.className = 'lab3d'; labelsEl.appendChild(lab);
  const selRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.9, depthWrite: false }));
  selRing.rotation.x = Math.PI / 2; selRing.position.y = -s * 0.33; selRing.visible = false; root.add(selRing);
  scene.add(root);
  return { root, yoke, head, beam, beamMat, lensMat, light, poolPivot, pool, lab, hang, selRing,
           pan: f.values.pan, tilt: f.values.tilt };
}

function removeHead(h) {
  scene.remove(h.root); if (h.poolPivot) scene.remove(h.poolPivot);
  if (h.puffs) for (const p of h.puffs) p.sp.material.dispose();
  h.root.traverse((o) => { if (o.material && o.material.isShaderMaterial) o.material.dispose(); });
  h.lab.remove();
}

function syncFixtures(st) {
  const sig = st.fixtures.map((f) => `${f.id}:${f.type}:${f.pos}:${f.mount}:${f.yaw}:${f.beam_deg}`).join('|')
    + `|${st.stage.width}x${st.stage.depth}|${JSON.stringify(st.stage.footprint)}`;
  if (sig === fixSig) return;
  fixSig = sig;
  for (const h of heads.values()) removeHead(h);
  heads.clear();
  for (const f of st.fixtures) heads.set(f.id, makeHead(f));
  buildStage(st.stage, st.fixtures);
}

/* ------------------------------------------------------------------ per-frame update */
const col = new THREE.Color();
const v3 = new THREE.Vector3(), dir = new THREE.Vector3(), q = new THREE.Quaternion();
let targetRing;
{
  targetRing = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.26, 40), new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.8, depthWrite: false }));
  targetRing.rotation.x = -Math.PI / 2; targetRing.visible = false;
  scene.add(targetRing);
}

function placeLabel(h, f, st, sel, rect) {
  h.root.getWorldPosition(v3); v3.y += h.kind === 'smoke' ? 0.6 : h.hang ? 0.75 : 0.55;
  v3.project(camera);
  const visible = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
  h.lab.style.display = visible ? '' : 'none';
  if (!visible) return;
  h.lab.style.left = `${(v3.x * 0.5 + 0.5) * rect.width}px`;
  h.lab.style.top = `${(-v3.y * 0.5 + 0.5) * rect.height}px`;
  const fx = (st.effects.active || []).some((a) => (a.ids || []).includes(f.id));
  const txt = `${sel.has(f.id) ? '✓ ' : ''}${f.name} · ${String(f.address).padStart(3, '0')}${fx ? ' ✦' : ''}`;
  if (h.lab.textContent !== txt) h.lab.textContent = txt;
  h.lab.classList.toggle('on', f.id === st.active_id || sel.has(f.id));
}

function updateHeads(st, t) {
  const W = st.stage.width, D = st.stage.depth;
  const sel = new Set(st.selection || []);
  for (const [fid, h] of heads) {
    h.selRing.visible = sel.has(fid);
    if (h.selRing.visible) h.selRing.material.opacity = 0.6 + 0.35 * Math.sin(t * 4);
  }
  const rect = wrap.getBoundingClientRect();
  for (const f of st.fixtures) {
    const h = heads.get(f.id); if (!h) continue;
    if (h.kind === 'smoke') { updateSmoke(h, f, st, t); placeLabel(h, f, st, sel, rect); continue; }
    // smooth 30 Hz server values into 60 fps motion
    h.pan += (f.values.pan - h.pan) * 0.35;
    h.tilt += (f.values.tilt - h.tilt) * 0.35;
    let pe = (h.pan / 65535 - 0.5) * f.pan_deg, te = (h.tilt / 65535 - 0.5) * f.tilt_deg;
    if (f.invert_pan) pe = -pe;
    if (f.invert_tilt) te = -te;
    h.yoke.rotation.y = pe * DEG;
    h.head.rotation.x = (h.hang ? -te : te) * DEG;

    const I = PH.intensity(f, t);
    const [r, g, b] = PH.rgbOf(f);
    col.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    h.beamMat.uniforms.color.value.copy(col);
    h.beamMat.uniforms.intensity.value = I;
    h.lensMat.color.copy(col).multiplyScalar(0.08 + 0.92 * I);
    h.light.color.copy(col);
    h.light.intensity = I * 90;

    // beam length: to floor or back wall
    h.head.updateWorldMatrix(true, false);
    h.beam.getWorldPosition(v3);
    dir.set(0, h.hang ? -1 : 1, 0).applyQuaternion(h.head.getWorldQuaternion(q)).normalize();
    let L = 18, hit = null;
    if (dir.y < -1e-3) { L = -v3.y / dir.y; hit = v3.clone().addScaledVector(dir, L); }
    else if (dir.z < -1e-3) L = (-D / 2 - 0.6 - v3.z) / dir.z;
    L = Math.min(Math.max(L, 0.2), 30);
    const rad = L * Math.tan((f.beam_deg / 2) * DEG);
    h.beam.scale.set(rad, L, rad);
    h.beam.visible = I > 0.005;

    if (hit && I > 0.005) {                 // elliptical pool where the beam meets the floor
      h.poolPivot.visible = true;
      h.poolPivot.position.set(hit.x, 0.008, hit.z);
      h.poolPivot.rotation.y = Math.atan2(dir.x, dir.z);
      const stretch = 1 / Math.max(0.2, Math.abs(dir.y));
      h.pool.scale.set(rad, rad * stretch, 1);
      h.pool.material.color.copy(col);
      h.pool.material.opacity = Math.min(1, I * 0.55);
    } else h.poolPivot.visible = false;

    placeLabel(h, f, st, sel, rect);
  }
  if (st.target) {
    targetRing.visible = true;
    targetRing.position.set(st.target[0], 0.015, st.target[2]);
    targetRing.material.opacity = 0.5 + 0.3 * Math.sin(t * 4);
  } else targetRing.visible = false;
}

/* ------------------------------------------------------------------ people from the stage camera */
const people = new Map();       // track id → {root, mat, lab, x, z}
const bodyGeo = new THREE.CapsuleGeometry(0.2, 1.1, 4, 10);
const headGeo = new THREE.SphereGeometry(0.14, 14, 10);
function updatePeople(st) {
  const sc = st.stagecam, seen = new Set();
  const rect = wrap.getBoundingClientRect();
  const list = (sc && sc.on ? sc.tracks : []).slice();
  if (st.track_floor) list.push({ id: 'main', floor: st.track_floor, ok: true, color: '#f59e0b', name: '◎' });
  for (const tr of list) {
    if (!tr.floor) continue;
    seen.add(tr.id);
    let p = people.get(tr.id);
    if (!p) {
      const mat = new THREE.MeshStandardMaterial({ color: tr.color, roughness: 0.6, transparent: true, opacity: 0.85 });
      const root = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, mat); body.position.y = 0.75;
      const head = new THREE.Mesh(headGeo, mat); head.position.y = 1.55;
      root.add(body, head); scene.add(root);
      const lab = document.createElement('div'); lab.className = 'lab3d person'; labelsEl.appendChild(lab);
      p = { root, mat, lab, x: tr.floor[0], z: tr.floor[1] };
      people.set(tr.id, p);
    }
    p.x += (tr.floor[0] - p.x) * 0.3; p.z += (tr.floor[1] - p.z) * 0.3;
    p.root.position.set(p.x, 0, p.z);
    p.mat.opacity = tr.ok ? 0.9 : 0.35;
    v3.set(p.x, 2.0, p.z).project(camera);
    const vis = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
    p.lab.style.display = vis ? '' : 'none';
    if (vis) {
      p.lab.style.left = `${(v3.x * 0.5 + 0.5) * rect.width}px`;
      p.lab.style.top = `${(-v3.y * 0.5 + 0.5) * rect.height}px`;
      const txt = `${sc.follow === tr.id ? '◎ ' : ''}${tr.name || '#' + tr.id}`;
      if (p.lab.textContent !== txt) p.lab.textContent = txt;
      p.lab.style.borderColor = tr.color;
    }
  }
  for (const [id, p] of people) {
    if (seen.has(id)) continue;
    scene.remove(p.root); p.mat.dispose(); p.lab.remove(); people.delete(id);
  }
}

/* ------------------------------------------------------------------ camera presets */
function setView(v) {
  const st = PH.S.st; if (!st) return;
  const W = st.stage.width, D = st.stage.depth, a = PH.activeFx();
  const views = {
    foh: [[0, 4.2, D / 2 + Math.max(W, D) * 0.75], [0, 2.0, -0.8]],
    top: [[0, Math.max(W, D) * 1.6, 0.01], [0, 0, 0]],
    side: [[W / 2 + Math.max(W, D) * 1.2, 4, 0], [0, 1.5, 0]],
    fx: a ? [[a.pos[0] + 1.6, a.pos[1] - 0.6, a.pos[2] + 2.4], [a.pos[0], a.pos[1] - 0.4, a.pos[2]]] : null,
  };
  const p = views[v]; if (!p) return;
  camera.position.set(...p[0]); controls.target.set(...p[1]); controls.update();
  for (const b of document.querySelectorAll('#view-tabs button')) b.classList.toggle('on', b.dataset.view === v);
}
for (const b of document.querySelectorAll('#view-tabs button')) b.onclick = () => setView(b.dataset.view);

/* ------------------------------------------------------------------ interaction: pick, drag, place */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const snap = (v) => Math.round(v * 4) / 4;            // 25 cm grid
const P3 = { placing: null, ghost: null, drag: null, down: null };

function setRay(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
function floorPoint(e, height = 0) {
  setRay(e);
  floorPlane.constant = -height;                    // horizontal plane y = height
  const p = new THREE.Vector3();
  if (!ray.ray.intersectPlane(floorPlane, p)) return null;
  const sg = PH.S.st.stage, mx = sg.width / 2 + 3, mz = sg.depth / 2 + 3;
  p.x = Math.max(-mx, Math.min(mx, p.x)); p.z = Math.max(-mz, Math.min(mz, p.z));
  return p;
}
function pickFixture(e) {
  setRay(e);
  const meshes = [];
  for (const h of heads.values()) h.root.traverse((o) => { if (o.userData.fid !== undefined) meshes.push(o); });
  const hit = ray.intersectObjects(meshes, false)[0];
  return hit ? hit.object.userData.fid : null;
}

// the lamp drawn nearest to the pointer (within px on the screen) - small heads are easy to hit
function nearFixture(e, px) {
  const r = renderer.domElement.getBoundingClientRect(), v = new THREE.Vector3();
  let best = null, bd = px;
  for (const [fid, h] of heads) {
    h.root.getWorldPosition(v).project(camera);
    if (v.z > 1) continue;                            // behind the camera
    const d = Math.hypot(r.left + (v.x + 1) / 2 * r.width - e.clientX, r.top + (1 - v.y) / 2 * r.height - e.clientY);
    if (d < bd) { bd = d; best = fid; }
  }
  return best;
}

function makeGhost(mount) {
  const st = PH.S.st, y = mount === 'hang' ? st.stage.truss_height : 0.4;
  const g = new THREE.Group();
  const amber = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.85, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.34, 40), amber);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.34),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: true, transparent: true, opacity: 0.9 }));
  box.position.y = y; g.add(box);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, y, 0)]),
    new THREE.LineDashedMaterial({ color: 0xf59e0b, dashSize: 0.15, gapSize: 0.1 }));
  line.computeLineDistances(); g.add(line);
  g.userData.y = y; g.visible = false;
  return g;
}
function startPlacement(mount, libraryKey) {
  if (!PH.S.st) return;
  cancelPlacement();
  P3.placing = mount;
  P3.key = libraryKey || null;
  P3.ghost = makeGhost(mount);
  scene.add(P3.ghost);
  wrap.classList.add('placing-mode');
  document.getElementById('placing').hidden = false;
  document.getElementById('scene-empty').hidden = true;
  document.getElementById('inspector').hidden = true;
}
function cancelPlacement() {
  if (P3.ghost) { scene.remove(P3.ghost); P3.ghost.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  P3.placing = null; P3.ghost = null;
  wrap.classList.remove('placing-mode');
  document.getElementById('placing').hidden = true;
}
window.PH3D = { get placing() { return !!P3.placing; }, startPlacement, cancelPlacement };

// capture phase on the wrapper runs before OrbitControls, so grabbing a fixture never rotates the view
wrap.addEventListener('pointerdown', (e) => {
  if (e.target !== renderer.domElement || e.button !== 0) return;
  P3.down = [e.clientX, e.clientY];
  if (P3.placing) { controls.enabled = false; return; }
  if (e.shiftKey) return;
  const fid = pickFixture(e);
  if (fid !== null) {
    controls.enabled = false;
    P3.drag = { fid, moved: false, h: heads.get(fid) };
    try { renderer.domElement.setPointerCapture(e.pointerId); } catch (err) {}
  }
}, true);

renderer.domElement.addEventListener('pointermove', (e) => {
  if (P3.placing && P3.ghost) {
    const p = floorPoint(e);
    if (p) { P3.ghost.visible = true; P3.ghost.position.set(snap(p.x), 0, snap(p.z)); }
    return;
  }
  if (P3.drag) {
    if (!P3.drag.moved && P3.down && Math.hypot(e.clientX - P3.down[0], e.clientY - P3.down[1]) > 4) P3.drag.moved = true;
    if (P3.drag.moved && P3.drag.h) {
      const p = floorPoint(e, P3.drag.h.root.position.y);   // drag in the fixture's own height plane
      if (p) { P3.drag.h.root.position.x = snap(p.x); P3.drag.h.root.position.z = snap(p.z); }
      wrap.style.cursor = 'grabbing';
    }
    return;
  }
  if (e.buttons === 0) wrap.style.cursor = pickFixture(e) !== null ? 'grab' : '';
});

renderer.domElement.addEventListener('pointerup', (e) => {
  const click = P3.down && Math.hypot(e.clientX - P3.down[0], e.clientY - P3.down[1]) <= 4;
  P3.down = null;
  if (P3.placing) {
    controls.enabled = true;
    const p = click && e.button === 0 ? floorPoint(e) : null;
    if (p && P3.ghost) {
      PH.send({ type: 'add_fixture', mount: P3.placing, library_key: P3.key,
                pos: [snap(p.x), P3.ghost.userData.y, snap(p.z)] });
      cancelPlacement();
    }
    return;
  }
  if (P3.drag) {
    const { fid, moved, h } = P3.drag;
    P3.drag = null; controls.enabled = true; wrap.style.cursor = '';
    if (moved && h) {
      const f = PH.fixtures().find((x) => x.id === fid);
      if (f) PH.send({ type: 'update_fixture', id: fid, pos: [h.root.position.x, f.pos[1], h.root.position.z] });
    } else if (e.ctrlKey || e.metaKey) PH.toggleSel(fid);
    else PH.send({ type: 'select', id: fid });
    return;
  }
  if (click && e.button === 0 && e.shiftKey) {            // Shift+click on the floor = aim here
    const p = floorPoint(e);
    if (p) PH.send({ type: 'aim', x: p.x, y: 0, z: p.z, all: e.altKey });
  }
});
// right click (without dragging the view) = a menu: on a lamp its actions, on the floor add / aim / views
let rdown = null;
wrap.addEventListener('pointerdown', (e) => { if (e.button === 2) rdown = [e.clientX, e.clientY]; }, true);
wrap.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const moved = rdown && Math.hypot(e.clientX - rdown[0], e.clientY - rdown[1]) > 5;
  rdown = null;
  if (moved || P3.placing || !PH.lampMenu) return;           // a right-drag pans the view
  const fid = pickFixture(e) ?? nearFixture(e, 40);
  if (fid !== null) { PH.lampMenu(e.clientX, e.clientY, fid); return; }
  const t = PH.t, p = floorPoint(e);
  PH.stageMenu(e.clientX, e.clientY, [
    ...(p ? [{ icon: 'target', label: t('cx.aim'), fn: () => PH.send({ type: 'aim', x: p.x, y: 0, z: p.z, all: true }) }] : []),
    { icon: 'scene', label: t('cx.vFoh'), fn: () => setView('foh') },
    { icon: 'arrows', label: t('cx.vTop'), fn: () => setView('top') },
    { icon: 'move', label: t('cx.vSide'), fn: () => setView('side') },
  ]);
}, true);
renderer.domElement.addEventListener('dblclick', (e) => {
  const fid = pickFixture(e);
  if (fid !== null) { const f = PH.fixtures().find((x) => x.id === fid); if (f) PH.openFixtureDialog(f); }
});

/* ------------------------------------------------------------------ loop */
function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(wrap);
resize();

let visible = true, firstView = false;
new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(wrap);

function loop(now) {
  requestAnimationFrame(loop);
  const st = PH.S.st;
  if (!st || !visible) return;
  syncFixtures(st);
  if (!firstView) { setView('foh'); firstView = true; }
  updateHeads(st, now / 1000);
  updatePeople(st);
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
