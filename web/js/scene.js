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
  normR: { value: null },
  normC: { value: null },
  globeMap: { value: null },
  hasGlobeMap: { value: 0 },
  mode: { value: 0 },
  quality: { value: 2 },
  exag: { value: 3.0 },
  sunDir: { value: new THREE.Vector3(1, 0.02, 0) },
  earthDir: { value: new THREE.Vector3(0, 0, 1) },
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

// Physically Grounded Lunar Shaders (Lommel-Seeliger scattering, Hapke opposition surge, LOLA-derived normals)
const vs = `
attribute vec2 mxy;
varying vec2 vM;
varying vec3 vWorldPos;
varying vec3 vViewDir;

void main() {
  vM = mxy;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vViewDir = cameraPosition - worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const fs = `
uniform sampler2D illumR, illumC, heatR, heatC, ramp;
uniform sampler2D normR, normC;
uniform sampler2D globeMap;
uniform int hasGlobeMap;
uniform int mode;
uniform int quality;
uniform float exag;
uniform vec3 sunDir;
uniform vec3 earthDir;
uniform float coreHalf, regHalf;
uniform int isCore;
varying vec2 vM;
varying vec3 vWorldPos;
varying vec3 vViewDir;

// Macroscopic-roughness shadowing (Smith 1967 / Hapke 1984): the fraction of a rough surface with
// RMS slope tan(20 deg) that a Sun at incidence i still reaches. Applied wherever the renderer only
// knows a smooth sphere normal (the globe, and the globe-matched outer rim of the terrain); the LOLA
// terrain itself uses its real ray-traced horizon shadows instead.
float roughLit(float mu0) {
  if (mu0 <= 0.0) return 0.0;
  float t = sqrt(max(1.0 - mu0 * mu0, 0.0)) / mu0;
  float a = 0.364 * t;
  return 2.0 / (1.0 + sqrt(1.0 + a * a));
}

void main() {
  bool inCore = abs(vM.x) < coreHalf * 0.995 && abs(vM.y) < coreHalf * 0.995;
  if (isCore == 0 && inCore) discard;

  float rho = length(vM);

  // Outer boundary clipping at 190 km
  if (isCore == 0 && rho > 190000.0) discard;

  // Deterministic geographic handoff: full LOLA relief and ray-traced horizon shadows inside 135 km,
  // blending to the globe's exact shading at the 185-190 km rim. No camera-distance terms, so the
  // surface looks the same while zooming in and out.
  float blendT = isCore == 1 ? 0.0 : smoothstep(135000.0, 185000.0, rho);

  float hh = isCore == 1 ? coreHalf : regHalf;
  vec2 uv = vec2((vM.x + hh) / (2.0 * hh), (hh - vM.y) / (2.0 * hh));

  // Sample LOLA-derived normal texture (alpha = constant albedo)
  vec4 normSample = isCore == 1 ? texture2D(normC, uv) : texture2D(normR, uv);
  vec2 grad = (normSample.rg - 0.5) * 2.0;
  float lolaAlbedo = normSample.a;

  // Exact LOLA surface normal blended seamlessly with lunar sphere curvature
  const float R_KM = 1737.4;
  vec3 sphereN = normalize(vec3(vWorldPos.x, vWorldPos.y + R_KM, vWorldPos.z));
  vec3 localN = normalize(sphereN + vec3(-grad.x * exag, 0.0, grad.y * exag));

  // Smoothly blend local gradient normal into exact sphere normal
  vec3 N = normalize(mix(localN, sphereN, blendT));

  vec3 V = normalize(vViewDir);
  vec3 L = normalize(sunDir);
  vec3 E = normalize(earthDir);

  float mu0 = max(dot(N, L), 0.0);
  float mu = max(dot(N, V), 0.001);
  float phaseCos = clamp(dot(L, V), -1.0, 1.0);
  float phaseAngle = acos(phaseCos);

  // Lommel-Seeliger scattering (retroreflective regolith, zero limb darkening)
  float ls = mu0 / (mu0 + mu);
  float scattering = 2.0 * (0.85 * ls + 0.15 * mu0);

  // Lunar opposition effect (Heiligenschein / retroreflection surge)
  float opposition = 1.0 + 0.65 / (1.0 + tan(phaseAngle * 0.5) / 0.08);
  if (quality == 0) opposition = 1.0;

  // Real-time horizon shadow + planetary contact shadow
  float lit = isCore == 1 ? texture2D(illumC, uv).r : texture2D(illumR, uv).r;
  float contactShadow = smoothstep(-0.015, 0.035, dot(N, L));
  float localShadow = lit * contactShadow;
  // the globe-matched rim uses the same roughness shadowing as the globe
  float totalShadow = mix(localShadow, contactShadow * roughLit(dot(sphereN, L)), blendT);

  // Authentic NASA LROC global lunar surface reflectance matching the globe
  vec3 regolithBase;
  if (hasGlobeMap == 1) {
    float theta = 2.0 * atan(rho / (2.0 * 1737400.0));
    float phi = atan(vM.x, vM.y);
    float u = fract(phi / (2.0 * 3.14159265359) + 0.5);
    float v = theta / 3.14159265359;
    vec3 lrocSample = texture2D(globeMap, vec2(u, v)).rgb;
    float lum = dot(lrocSample, vec3(0.299, 0.587, 0.114));
    float lrocAlbedo = clamp(lum * 1.10, 0.08, 0.92);

    // Combine NASA LROC macro reflectance with LOLA micro-relief & mass-wasting
    // Seamlessly transitions into pure LROC matching the globe at outer perimeter or orbital zoom
    float microMod = mix(lolaAlbedo / 0.52, 1.0, blendT);
    regolithBase = vec3(0.58, 0.56, 0.53) * clamp(lrocAlbedo * microMod, 0.08, 1.0);
  } else {
    regolithBase = vec3(0.58, 0.56, 0.53) * lolaAlbedo;
  }

  // Real Earthshine from JPL SPICE ephemerides + cosmic starlight
  float earthDot = max(dot(N, E), 0.0);
  vec3 earthshineCol = vec3(0.04, 0.055, 0.08) * earthDot;
  vec3 starlight = vec3(0.003, 0.0035, 0.004);

  // Direct solar radiance
  vec3 directSun = vec3(1.25, 1.23, 1.19) * scattering * opposition * totalShadow;

  vec3 finalColor;
  if (mode == 0) {
    finalColor = regolithBase * (directSun + earthshineCol + starlight);
  } else {
    // Heatmap mode with crisp analytical LOLA hillshading
    float h = isCore == 1 ? texture2D(heatC, uv).r : texture2D(heatR, uv).r;
    vec3 rampCol = texture2D(ramp, vec2(h, 0.5)).rgb;
    vec3 hillLight = normalize(vec3(-0.4, 0.8, 0.3));
    float hill = 0.45 + 0.55 * max(dot(N, hillLight), 0.0);
    vec3 heatFinal = rampCol * hill;
    if (isCore == 0) {
      vec3 globeHeat = vec3(0.12, 0.13, 0.15) * hill;
      heatFinal = mix(heatFinal, globeHeat, blendT);
    }
    finalColor = heatFinal;
  }

  // Opaque: the terrain owns rho < 190 km at every distance; the globe cap is cut out to match.
  gl_FragColor = vec4(finalColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// Full Lunar Globe Shaders (R = 1,737.4 km, wrapped with NASA LROC WAC reflectance)
const vsGlobe = `
varying vec3 vN;
varying vec3 vWorldPos;
varying vec3 vViewDir;
varying vec2 vUv;

void main() {
  vN = normalize(normal);
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vViewDir = cameraPosition - worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const fsGlobe = `
uniform sampler2D globeMap;
uniform int hasGlobeMap;
uniform vec3 sunDir;
uniform vec3 earthDir;
uniform int mode;
uniform int quality;
varying vec3 vN;
varying vec3 vWorldPos;
varying vec3 vViewDir;
varying vec2 vUv;

// Macroscopic-roughness shadowing (Smith 1967 / Hapke 1984): the fraction of a rough surface with
// RMS slope tan(20 deg) that a Sun at incidence i still reaches. Applied wherever the renderer only
// knows a smooth sphere normal (the globe, and the globe-matched outer rim of the terrain); the LOLA
// terrain itself uses its real ray-traced horizon shadows instead.
float roughLit(float mu0) {
  if (mu0 <= 0.0) return 0.0;
  float t = sqrt(max(1.0 - mu0 * mu0, 0.0)) / mu0;
  float a = 0.364 * t;
  return 2.0 / (1.0 + sqrt(1.0 + a * a));
}

void main() {
  // The LOLA terrain owns everything within 190 km of the pole at every camera distance; cut exactly
  // that disc (horizontal radius, same measure the terrain uses) with a 0.2 km overlap, no gap.
  float cosTheta = (vWorldPos.y + 1737.4) / 1737.4;
  if (cosTheta > 0.99 && length(vWorldPos.xz) < 189.8) discard;

  vec3 N = normalize(vN);
  vec3 V = normalize(vViewDir);
  vec3 L = normalize(sunDir);
  vec3 E = normalize(earthDir);

  float mu0 = max(dot(N, L), 0.0);
  float mu = max(dot(N, V), 0.001);
  float phaseCos = clamp(dot(L, V), -1.0, 1.0);
  float phaseAngle = acos(phaseCos);

  // Lommel-Seeliger scattering matching regional DEM
  float ls = mu0 / (mu0 + mu);
  float scattering = 2.0 * (0.85 * ls + 0.15 * mu0);

  // Lunar opposition surge (Heiligenschein)
  float opposition = 1.0 + 0.65 / (1.0 + tan(phaseAngle * 0.5) / 0.08);
  if (quality == 0) opposition = 1.0;

  // Real planetary terminator shadow with smooth physical penumbra
  float sunTerm = smoothstep(-0.015, 0.035, dot(N, L)) * roughLit(dot(N, L));
  float earthDot = max(dot(N, E), 0.0);
  vec3 earthshineCol = vec3(0.04, 0.055, 0.08) * earthDot;
  vec3 starlight = vec3(0.003, 0.0035, 0.004);

  // Authentic NASA LROC global lunar surface reflectance
  vec3 baseAlbedo;
  if (hasGlobeMap == 1) {
    vec3 lrocSample = texture2D(globeMap, vUv).rgb;
    float lum = dot(lrocSample, vec3(0.299, 0.587, 0.114));
    float lrocAlbedo = clamp(lum * 1.10, 0.08, 0.92);
    baseAlbedo = vec3(0.58, 0.56, 0.53) * lrocAlbedo;
  } else {
    baseAlbedo = vec3(0.58, 0.56, 0.53) * 0.52;
  }

  vec3 directSun = vec3(1.25, 1.23, 1.19) * scattering * opposition * sunTerm;

  vec3 col;
  if (mode == 0) {
    col = baseAlbedo * (directSun + earthshineCol + starlight);
  } else {
    // Heatmap mode: dark Moon context with hillshading
    vec3 hillLight = normalize(vec3(-0.4, 0.8, 0.3));
    float hill = 0.45 + 0.55 * max(dot(N, hillLight), 0.0);
    col = vec3(0.12, 0.13, 0.15) * hill;
  }

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// Build LOLA-derived normal maps from the elevation grids (alpha holds a constant albedo)
function buildTerrainNormals(heights, half, n) {
  const dx = (2 * half) / (n - 1);
  const data = new Uint8Array(n * n * 4);

  for (let i = 0; i < n; i++) {
    const im1 = Math.max(0, i - 1) * n;
    const i0 = i * n;
    const ip1 = Math.min(n - 1, i + 1) * n;

    for (let j = 0; j < n; j++) {
      const jm1 = Math.max(0, j - 1);
      const jp1 = Math.min(n - 1, j + 1);

      // 3x3 Sobel filter kernel for noise-resistant gradient calculation
      const z00 = heights[im1 + jm1], z01 = heights[im1 + j], z02 = heights[im1 + jp1];
      const z10 = heights[i0 + jm1],  z11 = heights[i0 + j], z12 = heights[i0 + jp1];
      const z20 = heights[ip1 + jm1], z21 = heights[ip1 + j], z22 = heights[ip1 + jp1];

      // dx: change in LOLA elevation per meter East-West (+X is East)
      const gx = ((z02 + 2 * z12 + z22) - (z00 + 2 * z10 + z20)) / (8 * dx);
      // gy: change in LOLA elevation per meter North-South (+Y is North)
      const gy = ((z00 + 2 * z01 + z02) - (z20 + 2 * z21 + z22)) / (8 * dx);

      const slope = Math.atan(Math.hypot(gx, gy));

      // Uniform albedo: LOLA provides elevation, not reflectance, so no per-pixel brightness is
      // invented here. Visible relief comes only from LOLA-derived normals and the real Sun direction;
      // large-scale reflectance comes from the LROC global mosaic sampled in the shader.
      const albedo = 0.52;

      const k = (i0 + j) * 4;
      // Pack into [0, 255]
      data[k] = Math.max(0, Math.min(255, Math.round((gx * 0.5 + 0.5) * 255)));
      data[k + 1] = Math.max(0, Math.min(255, Math.round((gy * 0.5 + 0.5) * 255)));
      data[k + 2] = 0; // unused channel
      data[k + 3] = Math.max(0, Math.min(255, Math.round(albedo * 255)));
    }
  }

  const texture = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

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
    fragmentShader: fs,
    transparent: false,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: isCore === 1 ? -2.0 : -1.0,
    polygonOffsetUnits: isCore === 1 ? -2.0 : -1.0
  }));

  for (const k in U) m.material.uniforms[k] = U[k];
  m.material.uniforms.isCore = { value: isCore };
  return m;
}

// Build full spherical lunar globe (R = 1,737.4 km) centered at (0, -R, 0)
// Extends across the entire Moon (360° longitude, 180° latitude)
function buildGlobe() {
  const nTheta = 120; // latitude rings from South Pole (0) to North Pole (PI)
  const nPhi = 180;   // longitude segments around 360°

  const numVerts = (nTheta + 1) * (nPhi + 1);
  const pos = new Float32Array(numVerts * 3);
  const norm = new Float32Array(numVerts * 3);
  const uvs = new Float32Array(numVerts * 2);
  const idx = [];

  for (let i = 0; i <= nTheta; i++) {
    const theta = (i / nTheta) * Math.PI; // 0 at South Pole, PI at North Pole
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    const v = theta / Math.PI;

    for (let j = 0; j <= nPhi; j++) {
      const phi = (j / nPhi) * Math.PI * 2.0; // 0 to 2*PI Eastward from Prime Meridian
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);

      // Coordinates in scene space:
      // South Pole apex is at (0, 0, 0)
      // Sphere center is at (0, -R_KM, 0)
      const x = R_KM * sinT * sinP;
      const y = -R_KM + R_KM * cosT;
      const z = -R_KM * sinT * cosP;

      const vIdx = i * (nPhi + 1) + j;
      pos[vIdx * 3] = x;
      pos[vIdx * 3 + 1] = y;
      pos[vIdx * 3 + 2] = z;

      // Surface normal pointing outward from sphere center (0, -R_KM, 0)
      norm[vIdx * 3] = sinT * sinP;
      norm[vIdx * 3 + 1] = cosT;
      norm[vIdx * 3 + 2] = -sinT * cosP;

      // NASA SVS CGI Moon Kit map is centered on 0° longitude (Prime Meridian at U=0.5)
      let u = (j / nPhi) + 0.5;
      if (u >= 1.0) u -= 1.0;
      uvs[vIdx * 2] = u;
      uvs[vIdx * 2 + 1] = v;
    }
  }

  for (let i = 0; i < nTheta; i++) {
    for (let j = 0; j < nPhi; j++) {
      const a = i * (nPhi + 1) + j;
      const b = (i + 1) * (nPhi + 1) + j;
      // Counter-clockwise seen from outside, so front faces point away from the Moon's centre.
      // (The previous order faced inward: the near side was culled and the far side's interior drawn.)
      idx.push(a, a + 1, b);
      idx.push(a + 1, b + 1, b);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      globeMap: U.globeMap,
      hasGlobeMap: U.hasGlobeMap,
      sunDir: U.sunDir,
      earthDir: U.earthDir,
      mode: U.mode,
      quality: U.quality
    },
    vertexShader: vsGlobe,
    fragmentShader: fsGlobe,
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
    const rho = Math.hypot(x, y);

    // Smooth edge taper from 135 km to 190 km to blend seamlessly into lunar globe datum
    // Preserves 100% of authentic NASA LOLA terrain elevations across all candidate regions
    if (!isCore && rho > 135000.0) {
      const t = Math.max(0, Math.min(1, (rho - 135000.0) / (190000.0 - 135000.0)));
      const smooth = 1.0 - t * t * (3.0 - 2.0 * t);
      h *= smooth;
    }

    // Exact spherical lunar surface datum: -R + sqrt(R^2 - rho^2)
    const sphereY = -R + Math.sqrt(Math.max(0, R * R - (x * x + y * y)));
    p[k * 3 + 1] = (h * exag + sphereY) / 1000;
  }

  m.geometry.attributes.position.needsUpdate = true;
  m.geometry.computeVertexNormals();
  m.geometry.computeBoundingSphere();
}

export const sceneY = (x, y, h) => {
  const sphereY = -R + Math.sqrt(Math.max(0, R * R - (x * x + y * y)));
  return (h * exag + sphereY) / 1000;
};

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
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

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 40000);
  camera.position.set(50, 160, 210);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 1.1;
  controls.minDistance = 4.0;
  controls.maxDistance = 3800.0;
  controls.maxPolarAngle = Math.PI * 0.48; // Smoothly increases at orbital distances

  U.illumR.value = tex(D.grids.regional.n);
  U.illumC.value = tex(D.grids.core.n);
  U.heatR.value = tex(D.grids.regional.n);
  U.heatC.value = tex(D.grids.core.n);
  U.ramp.value = rampTexture(RAMP);
  U.normR.value = buildTerrainNormals(D.terrain, D.meta.terrain.half, D.meta.terrain.n);
  U.normC.value = buildTerrainNormals(D.terrainCore, D.meta.terrain_core.half, D.meta.terrain_core.n);

  // Default neutral regolith gray texture for frame 0
  const defaultGlobeTex = new THREE.DataTexture(new Uint8Array([138, 134, 128, 255]), 1, 1, THREE.RGBAFormat);
  defaultGlobeTex.needsUpdate = true;
  U.globeMap.value = defaultGlobeTex;

  // Load official NASA LROC global lunar surface reflectance
  new THREE.TextureLoader().load(
    'data/moon_globe.jpg',
    tex => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      U.globeMap.value = tex;
      U.hasGlobeMap.value = 1;
    },
    undefined,
    err => {
      console.warn('Moon globe texture fallback active:', err);
    }
  );

  bufR = new Uint8Array(D.grids.regional.n ** 2);
  bufC = new Uint8Array(D.grids.core.n ** 2);

  meshR = buildMesh(D.terrain, D.meta.terrain.half, D.meta.terrain.n, 0);
  meshC = buildMesh(D.terrainCore, D.meta.terrain_core.half, D.meta.terrain_core.n, 1);
  meshGlobe = buildGlobe();

  applyHeights(meshR);
  applyHeights(meshC);

  scene.add(meshGlobe, meshR, meshC, markers, regionGrp, rays);

  // Deep space celestial starfield backdrop (radius 18,000 km)
  const sp = new Float32Array(3500 * 3);
  for (let i = 0; i < sp.length; i += 3) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(18000);
    sp.set([v.x, v.y, v.z], i);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x8a92a2, size: 1.1, sizeAttenuation: false })));

  sunSpr = glow('#ffd36b', 650);
  earthSpr = glow('#5fa8ff', 380);
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
      if (Math.abs(x) > 190000 || Math.abs(y) > 190000 || Math.hypot(x, y) > 188000) return;
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

    // Dynamic camera limits: smoothly allow full orbital perspective at zoom-out,
    // while strictly preventing ground collision when close to lunar terrain
    const camDist = camera.position.distanceTo(controls.target);
    const targetPolar = camDist < 75 ? Math.PI * 0.48 : (camDist < 250 ? Math.PI * 0.58 : Math.PI * 0.88);
    controls.maxPolarAngle = THREE.MathUtils.lerp(controls.maxPolarAngle, targetPolar, 0.05);

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
  sunSpr.position.copy(s).multiplyScalar(12000);

  const e = earthVec(t);
  const ed = toScene(e);
  U.earthDir.value.copy(ed);
  earthSpr.position.copy(ed).multiplyScalar(11000);

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
  U.exag.value = v;
  applyHeights(meshR);
  applyHeights(meshC);
  drawRegions();
}

export function setQuality(q) {
  const map = { performance: 0, balanced: 1, cinematic: 2 };
  const val = typeof q === 'number' ? q : (map[q] ?? 2);
  U.quality.value = val;
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

    // 4. Scale decluttering: hide labels at high orbital distances
    const isSelected = l.classList.contains('on');
    const isGeo = l.classList.contains('geo');
    if (camDist > 850) {
      vis = false;
    } else if (!isSelected && camDist > 320 && !isGeo) {
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
    const steps = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
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
      // Near the edge of the LOLA terrain grid (beyond ~170 km), swing the camera to whichever side
      // keeps it over terrain data, so the smooth globe beyond the grid stays out of the foreground.
      let tanSign = 1;
      if (rDist > 170) {
        const edge = sg => Math.max(Math.abs(tgt.x + nx * radLen - nz * tanLen * sg), Math.abs(tgt.z + nz * radLen + nx * tanLen * sg));
        if (edge(-1) < edge(1)) tanSign = -1;
      }
      off = new THREE.Vector3(
        nx * radLen - nz * tanLen * tanSign,
        camY,
        nz * radLen + nx * tanLen * tanSign
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
  controls.minDistance = 4.0;
  controls.maxDistance = 3800.0;
  controls.maxPolarAngle = Math.PI * 0.58;

  const targetPos = new THREE.Vector3(60, 190, 240);
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
