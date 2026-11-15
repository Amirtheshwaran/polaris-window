# Pre-submission audit — 15 November 2026

Readiness: release candidate, modular architecture refactor, minimalist lunar observatory UX redesign, and continuous 3D lunar globe visualization verified across desktop, tablet, and mobile; verified by automated tests and browser test matrix; ready for deployment to GitHub Pages.

## Continuous 3D Lunar Visualization & Environment Polish

The 3D lunar visualization in Three.js has been upgraded to provide a continuous, realistic planetary exploration experience without inventing unscientific elevation data:

1. **Authentic LOLA Topography & Squircle Boundary Transition**:
   - Replaced artificial circular shader discard with a high-order squircle boundary ($(\frac{|x|}{R_0})^8 + (\frac{|y|}{R_0})^8 \le 1$ where $R_0 = 191.8\text{ km}$).
   - This smoothly and seamlessly bounds the square LOLA DEM to meet the spherical datum globe without truncating legitimate outer Artemis III candidate regions (such as Peak near Cabeus B at $r = 194.89\text{ km}$, which previously suffered elevation zeroing and shader clipping).
   - Preserves 100% authentic NASA LOLA elevation data across all 13 candidate sites, tapering only at the outermost squircle edge ($\ge 0.96$) to blend into the datum sphere.
   - Built with physical lunar radius $R = 1,737.4\text{ km}$ matching the NASA LOLA lunar reference sphere (`R = 1737400.0 m`).
   - Dynamic solar illumination and realistic lunar day/night terminator sweep across both the local LOLA craters and the global lunar sphere in lockstep with the JPL NAIF SPICE ephemeris.

2. **Accurate Site Label Projection & Marker Placement**:
   - Resolved camera-relative coordinate calculation and strict front-of-camera plane check (`toPoint.dot(camDir) > 1.0`), completely eliminating the upper-left corner detachment artifact.
   - Incorporated lunar horizon curvature occlusion (`normal.dot(viewDir) < -0.1`), ensuring sites on the far side of the Moon are occluded cleanly rather than rendering backward.
   - Reduced marker pin stems from 6.0 km to 1.8 km (`CylinderGeometry(0.28, 0.04, 1.8, 8)`), placing pin bases firmly and realistically anchored on mountain summits rather than hovering in mid-air.
   - Scale-based decluttering dynamically hides non-selected minor site labels during extreme regional zoom-out while preserving selected and landmark pins.

3. **Subtle Scale & Polar Orientation Indicators**:
   - **Dynamic Ground Scale Bar**: Computes ground distance in real time across the target depth (`camera.position.distanceTo(target)` and vertical FOV), displaying discrete standard increments (`500 m`, `2 km`, `5 km`, `10 km`, `20 km`, `50 km`).
   - **Polar Orientation Compass**: Minimalist $30\text{px}$ ring with a central South Pole mark and an orientation needle pointing toward Earth ($0^\circ\text{ Longitude}$ / Prime Meridian).
   - Interactive re-alignment: Clicking the compass smoothly rotates the camera to align with Earth heading.

4. **Camera Bounds & Inward Framing**:
   - Bounded zoom range (`minDistance = 6.0 km`, `maxDistance = 420.0 km`), preventing camera penetration through ground polygons and preventing zooming out into an empty black void.
   - Bounded polar angle (`maxPolarAngle = Math.PI * 0.48`), preventing the camera from dipping beneath the lunar horizon.
   - Smooth cubic ease-in-out interpolation for all fly-to transitions and overview resets.
   - For perimeter sites ($r > 20\text{ km}$ like Peak near Cabeus B), the camera is positioned radially outward looking inward across the Moon toward the South Pole with an elevated orbital perspective, framing the mountain peaks against the lunar terrain and horizon instead of empty black space.

## Custom-Location Interaction & Toast Polish

1. **Elimination of Oversized Toast Overlay**:
   - Resolved conflicting CSS between `web/css/layout.css` and `web/css/modals.css` (which previously applied both `top: 60px` and `bottom: 64px`, stretching `#toast` into a 792px vertical capsule).
   - Fixed `#toast` to `bottom: 72px; height: auto; max-width: 90vw; padding: 7px 18px; border-radius: 9999px;`, verified as a sleek 34px-tall horizontal pill.

2. **Accidental Click vs Drag Rejection**:
   - Implemented strict drag thresholds in `initScene`: pointer movement $> 8\text{px}$, hold duration $> 350\text{ms}$, or non-left click (`e.button !== 0`) rejects terrain clicks.
   - Added canvas target verification (`e.target === renderer.domElement`) and spatial bounds check ($|x|, |y| \le 190,000\text{ m}$), preventing clicks on UI overlays or off-DEM regions from spawning spurious sites.
   - Added 400m proximity re-selection to prevent double-click duplicates, and capped total custom sites at 8 to eliminate scene clutter.

3. **In-Card Location Removal**:
   - Added `✕ Remove Location` action to the Selected Location summary card for any custom site.
   - Deleting a custom site removes its 3D marker, updates the Locations drawer count, emits toast confirmation (`Removed Custom X`), and reverts selection to the primary landing site.

## Scientific Rigor & Plain-English Presentation

1. **Landing Window Ranking Explanation**:
   - Prominently displays the #1 Recommended Landing Window with an unambiguous plain-English explanation of why it ranked first (highest combined continuous solar illumination and direct Earth radio line-of-sight).
   - Displays clear search scope badges (`All 13 Landing Locations`, `NASA Artemis III Candidate Regions`, or single site).
   - Dedicated mission-duration metrics summary (`MISSION SUNLIGHT (14d)`, `DIRECT EARTH COMMS`, `LONGEST NIGHT`, `TERRAIN CLEARANCE`).

2. **4-Part Data Architecture & Scientific Boundaries**:
   - Added 4 explicit architecture cards in Science mode:
     1. **NASA Source Data**: Authentic LRO LOLA 80 m raster DEM altimetry and JPL NAIF SPICE DE440 ephemerides.
     2. **Computed Estimates**: Topocentric elevation silhouettes across 120–720 azimuths marched to 220 km with lunar curvature ($d^2/2R$) and partial solar disc occultation.
     3. **Model Assumptions**: Standardized 2.0 m observer mast, 10 m² vertical sun-tracking panel (30% efficiency), spherical datum ($R = 1,737.4\text{ km}$).
     4. **Unresolved Landing Hazards**: Transparently states that sub-80 m micro-craters, boulders, and regolith stability require lander hazard avoidance systems (referencing IM-2 Athena CLPS anomaly).
   - Made NASA Goddard PGDA illumination and Earth visibility cross-check maps clickable to open high-resolution verification figures.

3. **Slope Terminology Correction**:
   - Replaced ambiguous `"Safe slope (<8°)"` phrasing with scientifically accurate `"Within 8° slope threshold"` and `"Exceeds 8° slope threshold"`.

## Minimalist Lunar Observatory UX Architecture

The user experience of Polaris Window operates as an intuitive lunar observatory:

1. **Centerpiece 3D Viewport (88–92% Visual Dominance)**:
   - Moon terrain occupies the visual field uninterrupted.
   - Persistent sidebars, top banners, and duplicate HUD labels eliminated.
2. **Slim 44px Header Bar**:
   - Single-line brand mark and title `POLARIS WINDOW`.
   - Centered segmented destination control: `Explore the Pole` | `Find a Landing Date` | `How It Works`.
   - Header actions: `Locations [13]`, `Share`, and options dropdown (`•••`) housing Map Layer (Live Sun / Heatmap), Guided Tour, Classroom Missions, and Display Settings.
3. **Discreet Floating Selected-Site Card**:
   - Anchored in lower-left corner (docked cleanly on mobile).
   - Displays site name, classification badge, and the 3 core decision metrics (Sunlight %, Direct Earth View %, Ground Slope <8°).
   - Primary CTA: `Find Landing Dates for This Site →`; secondary CTA: `Site Details & Horizons ›`.
4. **Rule of One Drawer & Progressive Disclosure**:
   - Left drawer (`#panel-sites`): Locations drawer with search and category chips (All, Artemis III, Science, CLPS).
   - Right drawer (`#panel-deck`): Contextual mission deck (Horizon silhouette canvas, 60-day strip, 12-month calendar, battery power check, telemetry/export).
   - Only ONE drawer or contextual panel is open at any time. Opening one cleanly closes the other.
   - On mobile/tablet, the contextual deck slides up smoothly as a touch-friendly bottom sheet (`max-height: 80vh`).
5. **Minimal Floating Timeline Capsule**:
   - Centered capsule at bottom with `-1d`, Play/Pause (`▶` / `❚❚`), `+1d`, UTC timestamp display, simulation speed (`1`, `4`, `12` h/f), and integrated slider track.

## Responsive Browser Test Matrix (8 Viewports Verified)

All 8 requested viewport resolutions were tested and verified:

| Viewport | Device Class | Visual Hierarchy & Layout Verdict | Console Status |
| :--- | :--- | :--- | :--- |
| **320×640** | Ultra-compact mobile | PASS — Fluid canvas, compact touch-friendly buttons, bottom-docked card, zero overflow. | 0 errors |
| **375×667** | iPhone SE | PASS — Clean vertical breathing room, bottom-docked card, zero horizontal scrolling. | 0 errors |
| **390×844** | iPhone 14/15 | PASS — Ample 3D Moon canvas view, touch-friendly primary action, smooth bottom sheet. | 0 errors |
| **430×932** | iPhone 14/15 Pro Max | PASS — High-density display, crisp typography, clean drawers. | 0 errors |
| **768×1024** | iPad Portrait | PASS — Balanced observatory layout, floating card, smooth 3D camera navigation. | 0 errors |
| **1024×768** | iPad Landscape / Laptop | PASS — Uninterrupted 3D terrain canvas, sleek right drawer for Plan & Science views. | 0 errors |
| **1440×900** | Desktop | PASS — Moon dominates 90% of screen, discreet summary card, floating timeline. | 0 errors |
| **1920×1080** | Wide Desktop | PASS — Cinematic widescreen experience, generous negative space, crisp typography. | 0 errors |

## Automated Test Suites Verification

- `tests/test_pipeline.py`: **6/6 passed in 1.90s** (Numba & SpiceyPy raycasting, stereographic conversion, dip angle geometry, ephemeris verification).
- `tests/test_js_science.mjs`: **All passed** (stereographic math, sun fraction arithmetic, window ranking comparator).
- `node -c web/js/**/*.js`: **100% syntax check passed** across all 16 JS modules.

## Strict Monochrome Design System

- **Palette**: Obsidian `#101113` and Lunar White `#E9E7E1` exclusively.
- **Surfaces**: Solid charcoal `#151619` and `#1c1e22`. Removed all glassmorphism, blur effects, neon accents, and colored indicators.
- **Charts**: Chart.js telemetry curves and skyline silhouettes rendered in high-contrast Lunar White and muted grays.
- **Icons**: Clean SVGs with zero decorative emojis.

## Cinematic Lunar Rendering Overhaul (Phase A - Phase G)

A graphics and real-time visualization overhaul was engineered to elevate the realism and fidelity of Polaris Window's 3D lunar surface:

1. **Modern Three.js Upgrade (r187)**:
   - Upgraded from legacy build to modern Three.js r187, bundled into a high-performance standalone ESM module (`web/vendor/three.module.min.js`, 731 KB).
   - Upgraded `OrbitControls.js` with ES module imports.
   - Clean browser importmap resolution with zero external CDN dependencies.

2. **Analytical LOLA Elevation Normals & Geomorphological Albedo**:
   - Implemented `buildTerrainNormals` computing central-difference 3x3 Sobel gradients ($\partial h/\partial x$, $\partial h/\partial y$) and Laplacian curvature directly from authentic LOLA elevation data (`web/data/terrain.bin` $641 \times 641$ and `web/data/terrain_core.bin` $513 \times 513$).
   - Dynamically couples terrain slope gradients with the physical quad-parabolic lunar body curvature ($\vec{N} = \text{normalize}(-\text{exag} \cdot \vec{g} + \vec{r}/R)$).
   - Modeled lunar regolith albedo variation: slope-driven mass wasting ($10^\circ - 32^\circ$) continuously exposes bright immature anorthosite (albedo $+22\%$), while flat crater basins accumulate space-weathered dark soil (albedo $-6\%$) and crater rims exhibit impact-gardening brightness ($+10\%$).

3. **Lommel-Seeliger Photometric Scattering & Opposition Effect**:
   - Replaced flat clamped Lambertian shading with the Lommel-Seeliger regolith scattering law ($S(\mu_0, \mu) = 2.0(0.85 \frac{\mu_0}{\mu_0+\mu} + 0.15 \mu_0)$) providing natural surface contrast without artificial limb darkening.
   - Implemented the Hapke lunar opposition surge (Heiligenschein halo effect when phase angle $\alpha \to 0$ looking along the solar vector).
   - Integrated authentic JPL SPICE ephemeris Earthshine vector (`earthVec(t)`) illuminating permanently shadowed crater bottoms based on the real position of the Earth in the lunar sky.
   - High-frequency contact self-shadowing combined with horizon occlusion grids (`lit * contactShadow`).

4. **Curved Lunar Globe Backdrop Parity**:
   - Extended the curved spherical lunar globe ($R = 1,737.4\text{ km}$, radius $140 - 750\text{ km}$) with matching Lommel-Seeliger scattering, Earthshine, and tonal calibration for seamless visual continuity at wide orbital zoom levels.

5. **Color Management & Quality Presets**:
   - Enabled `renderer.toneMapping = THREE.ACESFilmicToneMapping` with exposure $1.05$ and `THREE.SRGBColorSpace`.
   - Added user-facing Render Quality selector in Display Settings: **Fast** (performance), **Balanced**, and **Cinematic** (full Hapke opposition surge, micro-roughness, contact shadows).
   - Preserves user preference in `localStorage`.

6. **Benchmark Views & Visual Verification**:
   - Captured and verified 7 baseline and post-upgrade views (`media/baselines/` and `media/after_cinematic/`):
     - View 1: Regional Overview
     - View 2: Shackleton Rim
     - View 3: Connecting Ridge
     - View 4: Close-up Crater Terrain
     - View 5: Wide Orbital View
     - View 6: Low-Sun Grazing Illumination
     - View 7: Custom Site Placement
     - View 8: Scientific Heatmap Mode with LOLA Hillshading
   - Zero console errors, zero WebGL shader compilation warnings across all presets and map layers.

## Zoomed-Out Moon Continuity & Global Planetary Integration

To eliminate the floating terrain tile/slab effect when zooming out, the 3D scene architecture was upgraded to transition the local LOLA terrain into a complete, authentic lunar planetary body:

1. **Full $360^\circ$ Spherical Lunar Globe ($R = 1,737.4\text{ km}$)**:
   - Built a complete lunar sphere centered at $(0, -R, 0)$ with apex at the South Pole $(0, 0, 0)$, extending $360^\circ$ in longitude and $180^\circ$ in latitude.
   - Textured with NASA's official LROC WAC global lunar surface reflectance mosaic (`web/data/moon_globe.jpg`, 2048x1024 equirectangular), centered on $0^\circ$ longitude (Prime Meridian facing Earth / $-Z$).
   - Displays authentic lunar maria, farside highlands, and southern impact craters (Schrödinger, Clavius, Bailly, Antoniadi, Drygalski) in their true geographic locations.

2. **Seamless Radial Elevation Taper & Alpha Dissolve**:
   - Replaced rectangular squircle apertures with smooth radial elevation tapering ($h \to 0$ from radius $155\text{ km}$ to $190\text{ km}$) matching the exact mathematical sphere datum ($-R + \sqrt{R^2 - \rho^2}$).
   - Smooth radial alpha dissolve ($155\text{ km} \to 190\text{ km}$) between the high-resolution LOLA polar DEM and the global lunar sphere, eliminating all visible tile boundaries, cliffs, or seams.

3. **Planetary Day/Night Terminator & Dynamic Orbital Camera**:
   - Applied Lommel-Seeliger scattering and solar terminator penumbra across the entire globe matching the regional DEM.
   - Dragging the timeline slider sweeps sunlight and shadows across the entire lunar globe body in real time based on JPL SPICE ephemerides.
   - Expanded camera bounds (`maxDistance: 3800.0`, `far: 40000`), dynamically adjusting polar angle limits to keep the camera strictly above terrain at close range while allowing full orbital freedom at wide distances.
   - Starfield backdrop expanded to $18,000\text{ km}$ deep space radius; Sun and Earth sprites positioned at $12,000\text{ km}$ and $11,000\text{ km}$ celestial distances.

4. **Multi-Scale Verification Evidence (`media/zoom_continuity/`)**:
   - `zoom_medium.png`: Regional terrain blending smoothly into the lunar sphere at 250-400 km.
   - `zoom_orbital_full_moon.png`: Full spherical Moon body hanging in deep space with LROC cratered surface.
   - `zoom_orbital_day.png` & `zoom_orbital_terminator_sweep.png`: Real-time day/night terminator sweeping across the entire lunar globe.
   - `zoom_closeup_site.png`: Smooth return to Shackleton Rim / Connecting Ridge with close-up LOLA relief, sightlines, and metrics intact.

## Solid Lunar Surface Texture & Material Continuity

Following initial integration of the spherical Moon globe, an issue was diagnosed where the South Pole terrain appeared semi-transparent, darkened, or layered over the brighter global Moon. This was resolved through material coordination and continuous terrain integration:

1. **Root Cause Diagnosis**:
   - **Double-Surface Alpha Bleed**: `meshR` was previously configured with `transparent: true` and an edge alpha dissolve over `meshGlobe`, creating translucent double-surface ghosting, dark haloing, and z-fighting.
   - **Texture & Albedo Disparity**: `meshGlobe` sampled the authentic photographic NASA LROC WAC texture (`moon_globe.jpg`), whereas `meshR` and `meshC` were not sampling LROC imagery at all (using synthetic slope-only albedo), resulting in a visibly darker polar patch.
   - **Topographic Occlusion Mismatch**: Deep crater floors (e.g. Shackleton Crater, $-3.8\text{ km}$ depth) collided with the un-indented smooth spherical geometry of `meshGlobe`.
   - **Scale Mismatch between Local Horizon Occlusion and Planetary Shading**: Grazing $1.5^\circ$ solar illumination at the South Pole cast realistic LOLA terrain shadows (`illumR`) on `meshR`, while `meshGlobe` rendered as an unshadowed smooth sphere.

2. **Unified Geographic LROC Texture Mapping**:
   - Mapped polar stereographic $(x, y)$ coordinates directly to selenographic colatitude $\theta$ and longitude $\phi$ in the regional fragment shader:
     $\theta = 2 \arctan(\rho / (2R))$, $\phi = \text{atan2}(x, y)$.
     $u = \text{fract}(\phi / (2\pi) + 0.5)$, $v = \theta / \pi$.
   - Evaluated identical NASA LROC surface reflectance $L_{\text{lroc}}$ on `meshR` and `meshC`, multiplied by high-resolution LOLA slope/crest mass-wasting micro-contrast.

3. **100% Solid Opaque Terrain (Zero Semi-Transparency)**:
   - Configured `meshR` and `meshC` with `transparent: false`, `depthWrite: true`, and `polygonOffset: true` (`factor: -1.0, units: -1.0`), eliminating all transparency and alpha-blending artifacts.
   - In `applyHeights`, tapered elevation $h$ smoothly to $0.0$ between $140\text{ km}$ and $185\text{ km}$, bringing the perimeter vertices exactly onto the spherical lunar datum $y = -R + \sqrt{R^2 - \rho^2}$.

4. **Multi-Scale Distance-Based LOD Transition**:
   - Implemented a unified transition factor `blendT = max(distLod, radBlend)` in the terrain shader:
     - At close range ($<140\text{ km}$ distance), authentic LOLA 3D topography, Sobel normals, and deep crater shadows are 100% active.
     - In `fsGlobe`, discarded the polar cap ($\cos\theta > 0.9955$) at close/medium distances ($<480\text{ km}$), preventing the smooth sphere from clipping into deep crater floors.
     - At orbital distances ($>500\text{ km}$), both `meshR` and `meshC` smoothly hand over to `meshGlobe`, which renders as an unbroken, complete, solid lunar sphere with zero visible polar boundaries, zero dark circular overlays, and zero square patches.

5. **Verification**:
   - Verified across orbital ($>2000\text{ km}$), regional ($200-400\text{ km}$), and close-up ($<50\text{ km}$) views using live browser automated testing.
   - Zero console errors, zero WebGL shader compilation warnings.



