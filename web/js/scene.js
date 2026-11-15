import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { D, sunVec, earthVec, gridIllum, heightAt } from './data.js';

const R = 1737400;
let renderer, scene, camera, controls, meshR, meshC, sunSpr, earthSpr, markers = new THREE.Group(), regionGrp = new THREE.Group(), raycaster = new THREE.Raycaster();
const U = {
  illumR: { value: null }, illumC: { value: null }, heatR: { value: null }, heatC: { value: null }, ramp: { value: null },
  mode: { value: 0 }, sunDir: { value: new THREE.Vector3(1, .02, 0) }, coreHalf: { value: 40000 }, regHalf: { value: 192000 }, isCore: { value: 0 },
};
let bufR, bufC, exag = 3, onPick = null, labelEls = [], standingMode = false;
export const S = { get camera() { return camera; } };

function tex(n) { const t = new THREE.DataTexture(new Uint8Array(n * n), n, n, THREE.RedFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; }

export function rampTexture(stops) {
  const d = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const f = i / 255 * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(f)), w = f - k;
    for (let c = 0; c < 3; c++) d[i * 4 + c] = stops[k][c] * (1 - w) + stops[k + 1][c] * w; d[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(d, 256, 1); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}
export const RAMP = [[0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99], [212, 72, 66], [245, 125, 21], [250, 193, 39], [252, 255, 164]];

const vs = `attribute vec2 mxy; varying vec2 vM; varying vec3 vN;
void main(){ vM = mxy; vN = normalize(normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const fs = `uniform sampler2D illumR, illumC, heatR, heatC, ramp; uniform int mode; uniform vec3 sunDir; uniform float coreHalf, regHalf; uniform int isCore;
varying vec2 vM; varying vec3 vN;
void main(){
  bool inCore = abs(vM.x) < coreHalf*0.995 && abs(vM.y) < coreHalf*0.995;
  if (isCore == 0 && inCore) discard;
  float hh = isCore==1 ? coreHalf : regHalf;
  vec2 uv = vec2((vM.x + hh)/(2.0*hh), (hh - vM.y)/(2.0*hh));
  vec3 N = normalize(vN);
  float hill = 0.55 + 0.45*max(dot(N, normalize(vec3(-0.4,0.8,0.3))), 0.0);
  vec3 col;
  if (mode == 0) {
    float lit = isCore==1 ? texture2D(illumC, uv).r : texture2D(illumR, uv).r;
    float dif = max(dot(N, sunDir), 0.0);
    float sh = lit * clamp(0.18 + 3.0*dif, 0.0, 1.0);
    vec3 base = vec3(0.56, 0.55, 0.53);
    col = base*sh + vec3(0.05,0.06,0.09)*hill;          // faint earthshine so shadowed terrain stays readable
  } else {
    float h = isCore==1 ? texture2D(heatC, uv).r : texture2D(heatR, uv).r;
    col = texture2D(ramp, vec2(h, 0.5)).rgb * (0.35 + 0.75*hill);
  }
  gl_FragColor = vec4(pow(col, vec3(1.0/1.6)), 1.0);
}`;

function buildMesh(heights, half, n, isCore) {
  const g = new THREE.BufferGeometry(), N = n * n, pos = new Float32Array(N * 3), mxy = new Float32Array(N * 2), idx = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const k = i * n + j, x = -half + 2 * half * j / (n - 1), y = half - 2 * half * i / (n - 1);
    mxy[k * 2] = x; mxy[k * 2 + 1] = y; pos[k * 3] = x / 1000; pos[k * 3 + 2] = -y / 1000;
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j; idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1); }
  g.setIndex(idx); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('mxy', new THREE.BufferAttribute(mxy, 2));
  g.userData = { heights, n };
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { ...U, isCore: { value: isCore } }, vertexShader: vs, fragmentShader: fs }));
  // share uniform objects (except isCore)
  for (const k in U) m.material.uniforms[k] = U[k];
  m.material.uniforms.isCore = { value: isCore };
  return m;
}
function applyHeights(m) {
  const { heights, n } = m.geometry.userData, p = m.geometry.attributes.position.array, mxy = m.geometry.attributes.mxy.array;
  for (let k = 0; k < n * n; k++) { const x = mxy[k * 2], y = mxy[k * 2 + 1]; p[k * 3 + 1] = (heights[k] * exag - (x * x + y * y) / (2 * R)) / 1000; }
  m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere();
}
export const sceneY = (x, y, h) => (h * exag - (x * x + y * y) / (2 * R)) / 1000;

function glow(color, size) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, '#fff'); gr.addColorStop(.18, color); gr.addColorStop(.45, color + '55'); gr.addColorStop(1, color + '00');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, transparent: true })); s.scale.set(size, size, 1); return s;
}

export function initScene(el, pick) {
  onPick = pick;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); el.appendChild(renderer.domElement);
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);
  camera.position.set(60, 160, 200);
  controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.maxDistance = 900;
  U.illumR.value = tex(D.grids.regional.n); U.illumC.value = tex(D.grids.core.n);
  U.heatR.value = tex(D.grids.regional.n); U.heatC.value = tex(D.grids.core.n); U.ramp.value = rampTexture(RAMP);
  bufR = new Uint8Array(D.grids.regional.n ** 2); bufC = new Uint8Array(D.grids.core.n ** 2);
  meshR = buildMesh(D.terrain, D.meta.terrain.half, D.meta.terrain.n, 0);
  meshC = buildMesh(D.terrainCore, D.meta.terrain_core.half, D.meta.terrain_core.n, 1);
  applyHeights(meshR); applyHeights(meshC); scene.add(meshR, meshC, markers, regionGrp);
  // stars
  const sp = new Float32Array(3000 * 3); for (let i = 0; i < sp.length; i += 3) { const v = new THREE.Vector3().randomDirection().multiplyScalar(3000); sp.set([v.x, v.y, v.z], i); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x9aa4b8, size: 1.2, sizeAttenuation: false })));
  sunSpr = glow('#ffd36b', 140); earthSpr = glow('#5fa8ff', 70); scene.add(sunSpr, earthSpr);
  const ro = new ResizeObserver(() => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }); ro.observe(el);
  // click vs drag
  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const r = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
    const hit = raycaster.intersectObjects([meshC, meshR])[0];
    if (hit) { const x = hit.point.x * 1000, y = -hit.point.z * 1000; if (!(hit.object === meshR && Math.abs(x) < 39800 && Math.abs(y) < 39800)) onPick && onPick(x, y); }
  });
  (function loop() { requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); updateLabels(); })();
}

export const toScene = v => new THREE.Vector3(v[1], -v[2], -v[0]).normalize(); // MOON_ME -> scene (south pole up)

export function setTime(t) {
  const s = toScene(sunVec(t)); U.sunDir.value.copy(s);
  sunSpr.position.copy(s).multiplyScalar(1500);
  const e = earthVec(t); earthSpr.position.copy(toScene(e)).multiplyScalar(1400);
  U.illumR.value.image.data.set(gridIllum(D.grids.regional, t, bufR)); U.illumR.value.needsUpdate = true;
  U.illumC.value.image.data.set(gridIllum(D.grids.core, t, bufC)); U.illumC.value.needsUpdate = true;
}

export function setHeat(name, vals, vmax) {
  const t = name === 'core' ? U.heatC.value : U.heatR.value, d = t.image.data;
  for (let i = 0; i < vals.length; i++) d[i] = Math.min(255, 255 * vals[i] / vmax); t.needsUpdate = true;
}
export function setMode(m) { U.mode.value = m === 'heat' ? 1 : 0; }
export function setExag(v) { exag = v; applyHeights(meshR); applyHeights(meshC); drawRegions(); }
// Artemis III candidate region outlines (USGS footprints), draped on the terrain
let regionSites = [], regionSel = null;
export function setRegions(sites, selId) { regionSites = sites.filter(s => s.region); regionSel = selId; drawRegions(); }
function drawRegions() {
  regionGrp.clear();
  for (const s of regionSites) {
    const o = s.region.outline, pts = [];
    for (let e = 0; e < 4; e++) {
      const [x0, y0] = o[e], [x1, y1] = o[(e + 1) % 4], n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 400));
      for (let k = 0; k < n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; pts.push(new THREE.Vector3(x / 1000, sceneY(x, y, heightAt(x, y)) + 0.25, -y / 1000)); }
    }
    const on = s.id === regionSel;
    regionGrp.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: on ? 0xfbbf24 : 0x34d399, transparent: true, opacity: on ? 1 : .7 })));
  }
}

export function setMarkers(sites, selId, onSel) {
  markers.clear(); labelEls.forEach(l => l.remove()); labelEls = [];
  const box = document.getElementById('labels');
  for (const s of sites) {
    const y = sceneY(s.x, s.y, s.elev), on = s.id === selId;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(on ? .35 : .22, .05, 6, 8), new THREE.MeshBasicMaterial({ color: on ? 0xfbbf24 : (s.custom ? 0xa78bfa : 0x60a5fa) }));
    pin.position.set(s.x / 1000, y + 3, -s.y / 1000); markers.add(pin);
    const l = document.createElement('div'); l.className = 'lbl' + (on ? ' on' : ''); l.textContent = s.name; l.onclick = () => onSel(s.id);
    l._p = new THREE.Vector3(s.x / 1000, y + 6.5, -s.y / 1000); box.appendChild(l); labelEls.push(l);
  }
  for (const [txt, x, y] of [['⊕ South Pole', 0, 0], ['🌍 Earth is this way →', 0, 150000]]) {
    const l = document.createElement('div'); l.className = 'lbl geo'; l.textContent = txt;
    l._p = new THREE.Vector3(x / 1000, sceneY(x, y, heightAt(x, y)) + 3, -y / 1000); box.appendChild(l); labelEls.push(l);
  }
}
function updateLabels() {
  const r = renderer.domElement.getBoundingClientRect();
  for (const l of labelEls) {
    const p = l._p.clone().project(camera), vis = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05 && !(standingMode && l.classList.contains('geo'));
    l.style.display = vis ? '' : 'none';
    if (vis) { l.style.left = (r.left + (p.x + 1) / 2 * r.width) + 'px'; l.style.top = (r.top + (1 - p.y) / 2 * r.height) + 'px'; }
  }
}

export function flyTo(s, standing, look = 'sun') {
  standingMode = !!standing;
  const y = sceneY(s.x, s.y, s.elev), tgt = new THREE.Vector3(s.x / 1000, y, -s.y / 1000);
  let pos;
  if (standing) { // eye 30 m (×exaggeration) above ground, look toward the Sun
    const sd = (look === 'earth' ? earthSpr.position.clone().normalize() : U.sunDir.value.clone()).setY(0).normalize();
    const eye = tgt.clone().add(new THREE.Vector3(0, 0.03 * exag + 0.02, 0));
    controls.target.copy(eye.clone().add(sd.multiplyScalar(0.05))); pos = eye; controls.minDistance = 0.001;
  } else {
    controls.minDistance = 0.5; controls.target.copy(tgt);
    const off = camera.position.clone().sub(controls.target); off.setLength(s.custom ? 30 : 45); if (off.y < 12) off.y = 18; pos = tgt.clone().add(off);
  }
  const p0 = camera.position.clone(), t0 = performance.now();
  (function anim() { const k = Math.min(1, (performance.now() - t0) / 900), e = k * k * (3 - 2 * k); camera.position.lerpVectors(p0, pos, e); if (k < 1) requestAnimationFrame(anim); })();
}
export function autoRotate(on, speed = 0.6) { controls.autoRotate = on; controls.autoRotateSpeed = speed; }
export function overview() {
  standingMode = false; controls.minDistance = .5; controls.target.set(0, 0, 0); camera.position.set(60, 160, 200); }
export function snapshot() { return renderer.domElement.toDataURL('image/png'); }
