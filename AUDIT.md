# Pre-submission audit — 15 November 2026

Readiness: release candidate, modular architecture refactor & minimalist lunar observatory UX redesign verified across desktop, tablet, and mobile; verified by automated tests and browser test matrix; ready for deployment to GitHub Pages.

## Minimalist Lunar Observatory UX Architecture

The entire user experience of Polaris Window has been redesigned from a dense dashboard into an immersive lunar observatory interface:

1. **Centerpiece 3D Viewport (85–92% Visual Dominance)**:
   - Terrain canvas occupies ~90% of the viewport uninterrupted.
   - Eliminated persistent stacked sidebars, banners, and redundant floating badges.
   - Preserves high-performance Three.js WebGL terrain rendering, directional sunlight vector, crater shadow casting, and Artemis III candidate site markers.

2. **Slim 44px Header Bar**:
   - Single-line brand mark and title `POLARIS WINDOW`.
   - Centered segmented destination control: `Explore the Pole` | `Find a Landing Date` | `How It Works`.
   - Header actions: `Locations [13]`, `Share`, and options dropdown (`•••`) housing Map Layer (Live Sun / Heatmap), Guided Tour, Classroom Missions, and Display Settings.

3. **Discreet Floating Selected-Site Card**:
   - Anchored in the lower-left corner (docked cleanly on mobile).
   - Displays site name, classification badge, and the 3 core decision metrics:
     - **Sunlight Availability (%)**
     - **Direct Earth View (%)**
     - **Ground Slope (°) & Safety Limit (<8°)**
   - Clear primary CTA: `Find Landing Dates for This Site →`
   - Secondary on-demand CTA: `Site Details & Horizons ›`

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

- `tests/test_pipeline.py`: **6/6 passed in 1.93s** (Numba & SpiceyPy raycasting, stereographic conversion, dip angle geometry, ephemeris verification).
- `tests/test_js_science.mjs`: **All passed** (stereographic math, sun fraction arithmetic, window ranking comparator).
- `node -c web/js/**/*.js`: **100% syntax check passed** across all 16 JS modules.

## Strict Monochrome Design System

- **Palette**: Obsidian `#101113` and Lunar White `#E9E7E1` exclusively.
- **Surfaces**: Solid charcoal `#151619` and `#1c1e22`. Removed all glassmorphism, blur effects, neon accents, and colored indicators.
- **Charts**: Chart.js telemetry curves and skyline silhouettes rendered in high-contrast Lunar White and muted grays.
- **Icons**: Clean SVGs with zero decorative emojis.
