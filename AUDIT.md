# Pre-submission audit — 15 November 2026

Readiness: release candidate, modular architecture refactor, minimalist lunar observatory UX redesign, and continuous 3D lunar globe visualization verified across desktop, tablet, and mobile; verified by automated tests and browser test matrix; ready for deployment to GitHub Pages.

## Continuous 3D Lunar Visualization & Environment Polish

The 3D lunar visualization in Three.js has been upgraded to provide a continuous, realistic planetary exploration experience without inventing unscientific elevation data:

1. **Curved Lunar Globe Backdrop & Rectangular Slab Elimination**:
   - Seamlessly blended the rectangular regional NASA LOLA DEM ($192\text{ km}$ half-width) into a curved concentric lunar globe backdrop extending to $750\text{ km}$ radius.
   - Built with physical lunar radius $R = 1,737.4\text{ km}$ matching the NASA LOLA lunar reference sphere (`R = 1737400.0 m`).
   - Between $r = 160\text{ km}$ and $r = 186\text{ km}$, regional topography smoothly and tangentially tapers to datum $h = 0$, completely eliminating square slab edges.
   - Dynamic solar illumination and realistic lunar day/night terminator sweep across both the local LOLA craters and the global lunar sphere in lockstep with the JPL NAIF SPICE ephemeris.

2. **Accurate Site Label Projection & Occlusion**:
   - Resolved camera-relative coordinate calculation and strict front-of-camera plane check (`toPoint.dot(camDir) > 1.0`), completely eliminating the upper-left corner detachment artifact.
   - Incorporated lunar horizon curvature occlusion (`normal.dot(viewDir) < -0.1`), ensuring sites on the far side of the Moon are occluded cleanly rather than rendering backward.
   - Scale-based decluttering dynamically hides non-selected minor site labels during extreme regional zoom-out while preserving selected and landmark pins.

3. **Subtle Scale & Polar Orientation Indicators**:
   - **Dynamic Ground Scale Bar**: Computes ground distance in real time across the target depth (`camera.position.distanceTo(target)` and vertical FOV), displaying discrete standard increments (`500 m`, `2 km`, `5 km`, `10 km`, `20 km`, `50 km`).
   - **Polar Orientation Compass**: Minimalist $30\text{px}$ ring with a central South Pole mark and an orientation needle pointing toward Earth ($0^\circ\text{ Longitude}$ / Prime Meridian).
   - Interactive re-alignment: Clicking the compass smoothly rotates the camera to align with Earth heading.

4. **Camera Bounds & Motion Transitions**:
   - Bounded zoom range (`minDistance = 6.0 km`, `maxDistance = 420.0 km`), preventing camera penetration through ground polygons and preventing zooming out into an empty black void.
   - Bounded polar angle (`maxPolarAngle = Math.PI * 0.48`), preventing the camera from dipping beneath the lunar horizon.
   - Smooth cubic ease-in-out interpolation for all fly-to transitions and overview resets.

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
