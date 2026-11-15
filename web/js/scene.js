import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { D, sunVec, earthVec, gridIllum, heightAt } from './data.js';

const R = 1737400; // Mean lunar radius in meters
const R_KM = 1737.4; // Mean lunar radius in km

let renderer, scene, camera, controls;
let meshR, meshC, meshGlobe;
let sunSpr, earthSpr;
let markers = new THREE.Group();
let regionGrp = new THREE.Group();
let rays = new THREE.Group();
let raycaster = new THREE.Raycaster();

const U = {
  illumR: { value: null },
  illumC: { value: null },
  heatR: { value: null },
  heatC: { value: null },
  ramp: { value: null },
  mode: { value: 0 },
  sunDir: { value: new THREE.Vector3(1, 0.02, 0) },
  coreHalf: { value: 40000 },
  regHalf: { value: 192000 },
  isCore: { value: 0 },
};

let bufR, bufC, exag = 3, onPick = null, labelEls = [], standingMode = false;
export const S = { get camera() { return camera; } };

function tex(n) {
  const t = new THREE.DataTexture(new Uint8Array(n * n), n, n, THREE.RedFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export function rampTexture(stops) {
  const d = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const f = i / 255 * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(f));
    const w = f - k;
    for (let c = 0; c < 3; c++) d[i * 4 + c] = stops[k][c] * (1 - w) + stops[k + 1][c] * w;
    d[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(d, 256, 1);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export const RAMP = [
  [16, 17, 19],
  [42, 44, 49],
  [76, 79, 87],
  [116, 119, 128],
  [156, 158, 165],
  [191, 192, 196],
  [218, 217, 213],
  [233, 231, 225]
];

// Terrain Shaders
const vs = `
attribute vec2 mxy;
varying vec2 vM;
varying vec3 vN;
void main() {
  vM = mxy;
  vN = normalize(normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fs = `
uniform sampler2D illumR, illumC, heatR, heatC, ramp;
uniform int mode;
uniform vec3 sunDir;
uniform float coreHalf, regHalf;
uniform int isCore;
varying vec2 vM;
varying vec3 vN;

void main() {
  bool inCore = abs(vM.x) < coreHalf * 0.995 && abs(vM.y) < coreHalf * 0.995;
  if (isCore == 0 && inCore) discard;

  // Smooth squircle aperture cutoff: discard rectangular corners of regional DEM beyond 191.8 km
  // Seamlessly accommodates all 13 NASA candidate regions (including Peak near Cabeus B at 194.9 km)
  if (isCore == 0) {
    float qx = abs(vM.x) / 191800.0;
    float qy = abs(vM.y) / 191800.0;
    float squircle = qx*qx*qx*qx*qx*qx*qx*qx + qy*qy*qy*qy*qy*qy*qy*qy;
    if (squircle > 1.0) discard;
  }

  float hh = isCore == 1 ? coreHalf : regHalf;
  vec2 uv = vec2((vM.x + hh) / (2.0 * hh), (hh - vM.y) / (2.0 * hh));
  vec3 N = normalize(vN);
  float hill = 0.55 + 0.45 * max(dot(N, normalize(vec3(-0.4, 0.8, 0.3))), 0.0);
  vec3 col;

  if (mode == 0) {
    float lit = isCore == 1 ? texture2D(illumC, uv).r : texture2D(illumR, uv).r;
    float dif = max(dot(N, sunDir), 0.0);
    float sh = lit * clamp(0.18 + 3.0 * dif, 0.0, 1.0);
    vec3 base = vec3(0.56, 0.55, 0.53);
    col = base * sh + vec3(0.05, 0.06, 0.09) * hill; // faint earthshine
  } else {
    float h = isCore == 1 ? texture2D(heatC, uv).r : texture2D(heatR, uv).r;
    col = texture2D(ramp, vec2(h, 0.5)).rgb * (0.35 + 0.75 * hill);
  }
  gl_FragColor = vec4(pow(col, vec3(1.0 / 1.6)), 1.0);
}
`;

// Outer Lunar Globe Shaders (curved lunar body extension)
const vsGlobe = `
attribute float aDist;
varying vec3 vN;
varying float vDist;
void main() {
  vN = normalize(normal);
  vDist = aDist;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fsGlobe = `
uniform vec3 sunDir;
uniform int mode;
varying vec3 vN;
varying float vDist;

void main() {
  vec3 N = normalize(vN);
  float dif = max(dot(N, sunDir), 0.0);
  float sunTerm = smoothstep(-0.04, 0.08, dot(N, sunDir));
  float hill = 0.55 + 0.45 * max(dot(N, normalize(vec3(-0.4, 0.8, 0.3))), 0.0);

  vec3 col;
  if (mode == 0) {
    vec3 base = vec3(0.52, 0.51, 0.50);
    float sh = sunTerm * clamp(0.18 + 3.0 * dif, 0.0, 1.0);
    col = base * sh + vec3(0.04, 0.05, 0.07) * hill;
  } else {
    // Neutral dark background in scientific heatmap mode
    col = vec3(0.14, 0.15, 0.17) * hill;
  }

  // Soft atmospheric-free outer limb fade into space
  float fade = smoothstep(750.0, 600.0, vDist);
  gl_FragColor = vec4(pow(col, vec3(1.0 / 1.6)), fade);
}
`;

function buildMesh(heights, half, n, isCore) {
  const g = new THREE.BufferGeometry();
  const N = n * n;
  const pos = new Float32Array(N * 3);
  const mxy = new Float32Array(N * 2);
  const idx = [];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const k = i * n + j;
      const x = -half + 2 * half * j / (n - 1);
      const y = half - 2 * half * i / (n - 1);
      mxy[k * 2] = x;
      mxy[k * 2 + 1] = y;
      pos[k * 3] = x / 1000;
      pos[k * 3 + 2] = -y / 1000;
    }
  }

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j;
      idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
    }
  }

  g.setIndex(idx);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('mxy', new THREE.BufferAttribute(mxy, 2));
  g.userData = { heights, n };

  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    uniforms: { ...U, isCore: { value: isCore } },
    vertexShader: vs,
    fragmentShader: fs
  }));

  for (const k in U) m.material.uniforms[k] = U[k];
  m.material.uniforms.isCore = { value: isCore };
  return m;
}

// Build lower-detail curved lunar backdrop extending to 750 km radius (mean spherical lunar datum)
function buildGlobe() {
  const nr = 40; // radial rings
  const na = 96; // angular segments
  const rMin = 140.0; // km (overlaps beneath regional DEM boundary)
  const rMax = 750.0; // km (curves downward to form lunar limb)

  const numVerts = (nr + 1) * (na + 1);
  const pos = new Float32Array(numVerts * 3);
  const norm = new Float32Array(numVerts * 3);
  const dist = new Float32Array(numVerts);
  const idx = [];

  for (let i = 0; i <= nr; i++) {
    const t = i / nr;
    const rKm = rMin + (rMax - rMin) * Math.pow(t, 1.25);
    const rM = rKm * 1000.0;
    // Physical lunar surface curvature (quad-parabolic Taylor expansion of sphere radius R)
    const yKm = -(rM * rM) / (2.0 * R) / 1000.0;

    for (let j = 0; j <= na; j++) {
      const phi = (j / na) * Math.PI * 2.0;
      const xKm = rKm * Math.sin(phi);
      const zKm = -rKm * Math.cos(phi);

      const vIdx = i * (na + 1) + j;
      pos[vIdx * 3] = xKm;
      pos[vIdx * 3 + 1] = yKm;
      pos[vIdx * 3 + 2] = zKm;

      // Surface normal pointing outward from spherical lunar center
      const nVec = new THREE.Vector3(xKm / R_KM, 1.0, zKm / R_KM).normalize();
      norm[vIdx * 3] = nVec.x;
      norm[vIdx * 3 + 1] = nVec.y;
      norm[vIdx * 3 + 2] = nVec.z;

      dist[vIdx] = rKm;
    }
  }

  for (let i = 0; i < nr; i++) {
    for (let j = 0; j < na; j++) {
      const row1 = i * (na + 1);
      const row2 = (i + 1) * (na + 1);
      idx.push(row1 + j, row2 + j, row1 + j + 1);
      idx.push(row1 + j + 1, row2 + j, row2 + j + 1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  g.setAttribute('aDist', new THREE.BufferAttribute(dist, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      sunDir: U.sunDir,
      mode: U.mode
    },
    vertexShader: vsGlobe,
    fragmentShader: fsGlobe,
    transparent: true,
    depthWrite: true
  });

  const mesh = new THREE.Mesh(g, mat);
  return mesh;
}

function applyHeights(m) {
  const { heights, n } = m.geometry.userData;
  const p = m.geometry.attributes.position.array;
  const mxy = m.geometry.attributes.mxy.array;
  const isCore = m.material.uniforms.isCore.value === 1;

  for (let k = 0; k < n * n; k++) {
    const x = mxy[k * 2];
    const y = mxy[k * 2 + 1];
    let h = heights[k];

    // Smooth edge taper only at the absolute squircle boundary (> 0.96) to blend into lunar globe
    // Preserves 100% of authentic NASA LOLA terrain elevations across all candidate regions
    if (!isCore) {
      const qx = Math.abs(x) / 191800.0;
      const qy = Math.abs(y) / 191800.0;
      const qx4 = qx * qx * qx * qx;
      const qy4 = qy * qy * qy * qy;
      const sq = qx4 * qx4 + qy4 * qy4;
      if (sq > 0.96) {
        const t = Math.max(0, Math.min(1, (1.0 - sq) / (1.0 - 0.96)));
        const smooth = t * t * (3 - 2 * t);
        h *= smooth;
      }
    }

    p[k * 3 + 1] = (h * exag - (x * x + y * y) / (2 * R)) / 1000;
  }

  m.geometry.attributes.position.needsUpdate = true;
  m.geometry.computeVertexNormals();
  m.geometry.computeBoundingSphere();
}

export const sceneY = (x, y, h) => (h * exag - (x * x + y * y) / (2 * R)) / 1000;

function glow(color, size) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, '#fff');
  gr.addColorStop(0.18, color);
  gr.addColorStop(0.45, color + '55');
  gr.addColorStop(1, color + '00');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);

  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c),
    depthWrite: false,
    transparent: true
  }));
  s.scale.set(size, size, 1);
  return s;
}

export function initScene(el, pick) {
  onPick = pick;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  el.appendChild(renderer.domElement);

  renderer.domElement.setAttribute('aria-label', '3D map of the lunar south pole. Drag to rotate, scroll to zoom, click to add a landing site.');
  renderer.domElement.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    const m = document.createElement('div');
    m.className = 'glLost';
    m.innerHTML = 'The 3D view was paused by your graphics card. <button onclick="location.reload()">Reload</button><br><small>Everything else keeps working.</small>';
    el.appendChild(m);
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => el.querySelector('.glLost')?.remove());

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0b0d);

  camera = new THREE.PerspectiveCamera(45, 1, 0.05, 5000);
  camera.position.set(50, 160, 210);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 1.0;
  controls.minDistance = 6.0;
  controls.maxDistance = 420.0;
  controls.maxPolarAngle = Math.PI * 0.48; // ~86.4°, keeps camera above lunar horizon

  U.illumR.value = tex(D.grids.regional.n);
  U.illumC.value = tex(D.grids.core.n);
  U.heatR.value = tex(D.grids.regional.n);
  U.heatC.value = tex(D.grids.core.n);
  U.ramp.value = rampTexture(RAMP);

  bufR = new Uint8Array(D.grids.regional.n ** 2);
  bufC = new Uint8Array(D.grids.core.n ** 2);

  meshR = buildMesh(D.terrain, D.meta.terrain.half, D.meta.terrain.n, 0);
  meshC = buildMesh(D.terrainCore, D.meta.terrain_core.half, D.meta.terrain_core.n, 1);
  meshGlobe = buildGlobe();

  applyHeights(meshR);
  applyHeights(meshC);

  scene.add(meshGlobe, meshR, meshC, markers, regionGrp, rays);

  // Starfield backdrop
  const sp = new Float32Array(3000 * 3);
  for (let i = 0; i < sp.length; i += 3) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(3000);
    sp.set([v.x, v.y, v.z], i);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x8a92a2, size: 1.1, sizeAttenuation: false })));

  sunSpr = glow('#ffd36b', 140);
  earthSpr = glow('#5fa8ff', 70);
  scene.add(sunSpr, earthSpr);

  const ro = new ResizeObserver(() => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  ro.observe(el);

  // Click vs Drag detection with strict movement, duration, and target filtering
  let downPos = null;
  let downTime = 0;
  let downBtn = 0;

  renderer.domElement.addEventListener('pointerdown', e => {
    downPos = [e.clientX, e.clientY];
    downTime = performance.now();
    downBtn = e.button;
  });

  renderer.domElement.addEventListener('pointerup', e => {
    if (!downPos || downBtn !== 0) return;
    const moveDist = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]);
    const duration = performance.now() - downTime;
    downPos = null;

    // Distinguish intentional click from camera drag / orbit:
    // Drag threshold 8px, maximum click duration 350ms
    if (moveDist > 8 || duration > 350) return;

    // Ensure click occurred directly on the 3D canvas and not through UI overlays
    if (e.target !== renderer.domElement) return;

    const r = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1),
      camera
    );
    const hit = raycaster.intersectObjects([meshC, meshR])[0];
    if (hit) {
      const x = hit.point.x * 1000;
      const y = -hit.point.z * 1000;
      // Reject points outside analyzed LOLA terrain region
      if (Math.abs(x) > 190000 || Math.abs(y) > 190000) return;
      if (!(hit.object === meshR && Math.abs(x) < 39800 && Math.abs(y) < 39800)) {
        onPick && onPick(x, y);
      }
    }
  });

  // Orientation compass click to align view to Earth
  const compassEl = document.getElementById('orientationCompass');
  if (compassEl) {
    compassEl.onclick = () => {
      alignToEarth();
    };
  }

  // Animation Loop with Adaptive Resolution
  let fN = 0, fT0 = 0;
  (function loop(ts) {
    requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
    updateLabels();
    updateHudIndicators();

    if (fN >= 0 && ts) {
      if (!fT0) fT0 = ts;
      if (++fN >= 60 || (fN > 3 && ts - fT0 > 2500)) {
        const ms = (ts - fT0) / (fN - 1);
        if (ms > 33 && renderer.getPixelRatio() > 1) {
          renderer.setPixelRatio(1);
          const w = el.clientWidth;
          const h = el.clientHeight;
          renderer.setSize(w, h);
          console.info('Polaris Window: switched to standard resolution for smoother 3D');
        }
        fN = -1;
      }
    }
  })();
}

export const toScene = v => new THREE.Vector3(v[1], -v[2], -v[0]).normalize();

export function setTime(t) {
  const s = toScene(sunVec(t));
  U.sunDir.value.copy(s);
  sunSpr.position.copy(s).multiplyScalar(1500);

  const e = earthVec(t);
  earthSpr.position.copy(toScene(e)).multiplyScalar(1400);

  U.illumR.value.image.data.set(gridIllum(D.grids.regional, t, bufR));
  U.illumR.value.needsUpdate = true;
  U.illumC.value.image.data.set(gridIllum(D.grids.core, t, bufC));
  U.illumC.value.needsUpdate = true;
}

export function setRays(s, st) {
  rays.children.forEach(c => { c.geometry.dispose(); c.material.dispose(); });
  rays.clear();
  if (!s || standingMode) return;

  const o = new THREE.Vector3(s.x / 1000, sceneY(s.x, s.y, s.elev) + 0.3, -s.y / 1000);
  const mk = (dir, color, vis) => {
    const d = dir.clone();
    d.y *= exag;
    d.normalize();
    const g = new THREE.BufferGeometry().setFromPoints([o, o.clone().add(d.multiplyScalar(45))]);
    const l = new THREE.Line(g, vis
      ? new THREE.LineBasicMaterial({ color })
      : new THREE.LineDashedMaterial({ color, dashSize: 1.2, gapSize: 1.2, transparent: true, opacity: 0.45 }));
    if (!vis) l.computeLineDistances();
    rays.add(l);
  };

  mk(U.sunDir.value, 0xE9E7E1, st.sun > 0.5);
  mk(earthSpr.position.clone().normalize(), 0x9AA7BC, !!st.earth);
}

export function setHeat(name, vals, vmax) {
  const t = name === 'core' ? U.heatC.value : U.heatR.value;
  const d = t.image.data;
  for (let i = 0; i < vals.length; i++) d[i] = Math.min(255, 255 * vals[i] / vmax);
  t.needsUpdate = true;
}

export function setMode(m) {
  U.mode.value = m === 'heat' ? 1 : 0;
}

export function setExag(v) {
  exag = v;
  applyHeights(meshR);
  applyHeights(meshC);
  drawRegions();
}

let regionSites = [], regionSel = null;
export function setRegions(sites, selId) {
  regionSites = sites.filter(s => s.region);
  regionSel = selId;
  drawRegions();
}

function drawRegions() {
  regionGrp.clear();
  for (const s of regionSites) {
    const o = s.region.outline;
    const pts = [];
    for (let e = 0; e < 4; e++) {
      const [x0, y0] = o[e];
      const [x1, y1] = o[(e + 1) % 4];
      const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 400));
      for (let k = 0; k < n; k++) {
        const x = x0 + (x1 - x0) * k / n;
        const y = y0 + (y1 - y0) * k / n;
        pts.push(new THREE.Vector3(x / 1000, sceneY(x, y, heightAt(x, y)) + 0.25, -y / 1000));
      }
    }
    const on = s.id === regionSel;
    regionGrp.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: on ? 0xE9E7E1 : 0x72706B, transparent: true, opacity: on ? 1 : 0.6 })
    ));
  }
}

export function setMarkers(sites, selId, onSel) {
  markers.clear();
  labelEls.forEach(l => l.remove());
  labelEls = [];

  const box = document.getElementById('labels');
  if (!box) return;

  for (const s of sites) {
    const y = sceneY(s.x, s.y, s.elev);
    const on = s.id === selId;

    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(on ? 0.28 : 0.18, 0.04, 1.8, 8),
      new THREE.MeshBasicMaterial({ color: on ? 0xE9E7E1 : 0x8A8D98 })
    );
    pin.position.set(s.x / 1000, y + 0.9, -s.y / 1000);
    markers.add(pin);

    const l = document.createElement('div');
    l.className = 'lbl' + (on ? ' on' : '');
    l.textContent = s.name;
    l.onclick = () => onSel(s.id);
    l._p = new THREE.Vector3(s.x / 1000, y + 2.5, -s.y / 1000);
    box.appendChild(l);
    labelEls.push(l);
  }

  for (const [txt, x, y] of [['⊕ South Pole', 0, 0], ['Earth direction →', 0, 150000]]) {
    const l = document.createElement('div');
    l.className = 'lbl geo';
    l.textContent = txt;
    l._p = new THREE.Vector3(x / 1000, sceneY(x, y, heightAt(x, y)) + 1.8, -y / 1000);
    box.appendChild(l);
    labelEls.push(l);
  }

  const pri = l => l.classList.contains('on') ? 0 : l.classList.contains('geo') ? 2 : 1;
  labelEls.sort((a, b) => pri(a) - pri(b));
}

// Robust 3D Site Labels: Eliminates upper-left detachment & occlusion errors
function updateLabels() {
  const box = document.getElementById('labels');
  if (!box || !renderer || !camera) return;

  const canvasRect = renderer.domElement.getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();
  const offsetX = canvasRect.left - boxRect.left;
  const offsetY = canvasRect.top - boxRect.top;

  const camDir = camera.getWorldDirection(new THREE.Vector3());
  const camDist = camera.position.distanceTo(controls.target);
  const placed = [];

  for (const l of labelEls) {
    const pt = l._p;
    const toPoint = pt.clone().sub(camera.position);

    // 1. Strict front-of-camera plane check (prevents points behind camera projecting to upper-left!)
    if (toPoint.dot(camDir) <= 1.0) {
      l.style.display = 'none';
      continue;
    }

    // 2. Horizon / lunar curvature occlusion check
    // At site (x, z), lunar surface normal points roughly (x / R, 1, z / R)
    const normal = new THREE.Vector3(pt.x / R_KM, 1.0, pt.z / R_KM).normalize();
    const viewDir = toPoint.clone().negate().normalize();
    if (normal.dot(viewDir) < -0.1) {
      l.style.display = 'none';
      continue;
    }

    // 3. Project to normalized device coordinates [-1, 1]
    const p = pt.clone().project(camera);
    let vis = p.z < 1.0 && Math.abs(p.x) < 0.98 && Math.abs(p.y) < 0.98 && !(standingMode && l.classList.contains('geo'));

    // 4. Scale decluttering: hide unselected site labels at extreme zoom-out
    const isSelected = l.classList.contains('on');
    const isGeo = l.classList.contains('geo');
    if (!isSelected && camDist > 360 && !isGeo) {
      vis = false;
    }

    if (vis) {
      const x = offsetX + (p.x + 1) / 2 * canvasRect.width;
      const y = offsetY + (1 - p.y) / 2 * canvasRect.height;
      if (!l._w && l.offsetWidth) l._w = l.offsetWidth;
      const w = l._w || 90;
      const h = l._h || 22;
      const aabb = [x - w / 2 - 4, y - h - 4, x + w / 2 + 4, y + 4];

      if (!isSelected && placed.some(q => aabb[0] < q[2] && aabb[2] > q[0] && aabb[1] < q[3] && aabb[3] > q[1])) {
        vis = false;
      } else {
        placed.push(aabb);
        l.style.left = `${x}px`;
        l.style.top = `${y}px`;
      }
    }

    l.style.display = vis ? '' : 'none';
  }
}

// Subtle Scale & Orientation HUD Indicators
function updateHudIndicators() {
  // 1. Update Orientation Compass
  const needle = document.getElementById('compassNeedle');
  if (needle && camera && controls) {
    const dx = camera.position.x - controls.target.x;
    const dz = camera.position.z - controls.target.z;
    const angleRad = Math.atan2(dx, -dz); // angle relative to -Z (Earth direction +0° lon)
    const angleDeg = angleRad * (180 / Math.PI);
    needle.setAttribute('transform', `rotate(${-angleDeg}, 18, 18)`);
  }

  // 2. Update Ground Scale Bar
  const scaleBarLine = document.getElementById('scaleBarLine');
  const scaleBarText = document.getElementById('scaleBarText');
  if (scaleBarLine && scaleBarText && camera && controls && renderer) {
    const dist = camera.position.distanceTo(controls.target);
    const vFovRad = camera.fov * Math.PI / 180;
    const canvasH = renderer.domElement.clientHeight || 600;
    const kmPerPx = (2 * dist * Math.tan(vFovRad / 2)) / canvasH;

    const rawKm = kmPerPx * 60;
    const steps = [0.5, 1, 2, 5, 10, 20, 50, 100, 200];
    let bestKm = steps[0];
    for (const s of steps) {
      if (Math.abs(s - rawKm) < Math.abs(bestKm - rawKm)) bestKm = s;
    }

    const widthPx = Math.round(bestKm / kmPerPx);
    scaleBarLine.style.width = `${Math.max(20, Math.min(120, widthPx))}px`;
    scaleBarText.textContent = bestKm < 1 ? `${Math.round(bestKm * 1000)} m` : `${bestKm} km`;
  }
}

function alignToEarth() {
  const target = controls.target.clone();
  const currentDist = camera.position.distanceTo(target);
  const currentY = camera.position.y - target.y;

  // Align along +Z in scene (looking toward Earth / 0° Lon)
  const horizDist = Math.sqrt(Math.max(0, currentDist * currentDist - currentY * currentY));
  const newPos = new THREE.Vector3(target.x, target.y + currentY, target.z + horizDist);

  const p0 = camera.position.clone();
  const t0 = performance.now();

  (function anim() {
    const k = Math.min(1, (performance.now() - t0) / 600);
    const e = k * k * (3 - 2 * k);
    camera.position.lerpVectors(p0, newPos, e);
    if (k < 1) requestAnimationFrame(anim);
  })();
}

export function flyTo(s, standing, look = 'sun') {
  standingMode = !!standing;
  const y = sceneY(s.x, s.y, s.elev);
  const tgt = new THREE.Vector3(s.x / 1000, y, -s.y / 1000);
  let pos;
  let targetLook = tgt.clone();

  if (standing) {
    const sd = (look === 'earth' ? earthSpr.position.clone().normalize() : U.sunDir.value.clone()).setY(0).normalize();
    const eye = tgt.clone().add(new THREE.Vector3(0, 0.03 * exag + 0.02, 0));
    controls.target.copy(eye.clone().add(sd.multiplyScalar(0.05)));
    pos = eye;
    controls.minDistance = 0.001;
    controls.maxDistance = 60.0;
    controls.maxPolarAngle = Math.PI * 0.52;
  } else {
    controls.minDistance = 6.0;
    controls.maxDistance = 420.0;
    controls.maxPolarAngle = Math.PI * 0.48;

    const rDist = Math.hypot(tgt.x, tgt.z);
    const camSpan = s.custom ? 32 : (rDist > 120 ? 52 : 42);
    const elevBoost = Math.max(0, (s.elev || 0) / 1000) * 0.5;
    targetLook = tgt.clone().add(new THREE.Vector3(0, 0.4 + elevBoost * 0.2, 0));
    controls.target.copy(targetLook);

    let off;
    if (rDist > 20) {
      // For regional and perimeter sites (e.g. Peak near Cabeus B at 195km, Mons Mouton at 139km),
      // position camera radially outward and looking back inward toward the site and the South Pole,
      // ensuring the Moon's peaks, craters, and curved horizon fill the entire view!
      const nx = tgt.x / rDist;
      const nz = tgt.z / rDist;
      const radLen = camSpan * 0.82;
      const tanLen = camSpan * 0.28;
      const camY = Math.max(16, 18 + elevBoost);
      off = new THREE.Vector3(
        nx * radLen - nz * tanLen,
        camY,
        nz * radLen + nx * tanLen
      );
    } else {
      off = camera.position.clone().sub(tgt);
      off.setLength(camSpan);
      if (off.y < 14) off.y = 16;
    }
    pos = tgt.clone().add(off);
  }

  const p0 = camera.position.clone();
  const l0 = controls.target.clone();
  const t0 = performance.now();

  (function anim() {
    const k = Math.min(1, (performance.now() - t0) / 800);
    const e = k * k * (3 - 2 * k);
    camera.position.lerpVectors(p0, pos, e);
    if (!standing) controls.target.lerpVectors(l0, targetLook, e);
    if (k < 1) requestAnimationFrame(anim);
  })();
}

export function autoRotate(on, speed = 0.6) {
  controls.autoRotate = on;
  controls.autoRotateSpeed = speed;
}

export function overview() {
  standingMode = false;
  controls.minDistance = 6.0;
  controls.maxDistance = 420.0;
  controls.maxPolarAngle = Math.PI * 0.48;

  const targetPos = new THREE.Vector3(50, 160, 210);
  const targetLook = new THREE.Vector3(0, 0, 0);

  const p0 = camera.position.clone();
  const l0 = controls.target.clone();
  const t0 = performance.now();

  (function anim() {
    const k = Math.min(1, (performance.now() - t0) / 700);
    const e = k * k * (3 - 2 * k);
    camera.position.lerpVectors(p0, targetPos, e);
    controls.target.lerpVectors(l0, targetLook, e);
    if (k < 1) requestAnimationFrame(anim);
  })();
}

export function snapshot() {
  return renderer.domElement.toDataURL('image/png');
}
