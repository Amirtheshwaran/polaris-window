# Pre-submission audit — 15 November 2026

Readiness: release candidate, modular architecture refactor & visual redesign verified locally and automated; ready for deployment to GitHub Pages.

## Architectural Modularization & Clean Separation

The monolithic codebase (`web/css/style.css` 1,525 lines and `web/js/main.js` 1,251 lines) has been restructured into cohesive, single-responsibility modules following Ponytail principles, native ES2022 modules (zero bundler overhead), and indexed via Graphify:

### CSS Modules (`web/css/`)
1. `tokens.css`: Design tokens, Obsidian `#101113` & Lunar White `#E9E7E1` palette, typography, elevation.
2. `base.css`: CSS reset, typography, base inputs and tooltips.
3. `header.css`: Primary header bar, logo, and utility navigation.
4. `layout.css`: 3D viewport canvas positioning, loading screen, and skip links.
5. `sites.css`: Left-hand landing site selector drawer, category chips, and filter items.
6. `deck.css`: Bottom-right contextual telemetry deck and expandable cards.
7. `explore.css`: Vital metrics (Sun, Earth, Slope), panorama silhouettes, and 12-month calendar.
8. `plan.css`: Mission constraints form, presets, window finder results, and survival simulator.
9. `science.css`: NASA ground-truth validation benchmarks, methodology diagram, and data limits.
10. `compare.css`: Multi-site side-by-side comparison tables and Chart.js telemetry charts.
11. `timeline.css`: Bottom timeline transport controls, speed selector, and scrubber.
12. `modals.css`: Accessible dialog overlays (Share, Settings, Mission Brief PDF preview).
13. `responsive.css`: Media queries for tablet (<=820px) and mobile (<=674px).
*Master Entrypoint:* `style.css` cleanly imports the above 13 modular stylesheets.

### JavaScript Modules (`web/js/`)
1. `state.js`: Central reactive state (`ST`), DOM selector helpers (`$`, `$$`), site aliases, deep-link hash serialization (`readHash`, `writeHash`).
2. `ui-components.js`: Reusable toast notifications, accessible accordion accordions, modal lifecycle helpers.
3. `router.js`: Destination routing (`Explore`, `Plan`, `Science`), mode switching, and active destination styling.
4. `timeline.js`: Timeline transport, simulation clock playback (`play`, `pause`, `step`), speed sync, and scrub handlers.
5. `site-selector.js`: Site list rendering, drawer toggling, coordinate picking, and custom site creation.
6. `window-finder.js`: Constraint validation, landing window search, score evaluation, CSV export, and battery survival model.
7. `compare.js`: Multi-site comparison metrics, difference matrices, and Chart.js illumination profiles.
8. `heatmaps.js`: Altimetry and illumination spatial heatmap rasterization, colormap shading, and layer switching.
9. `reports.js`: NASA mission brief generation, print/PDF preview dialog, JPL Horizons URL generation, and QR share modal.
10. `tour.js`: Interactive mission tour step-through and demo script orchestrator.
11. `views/explore-view.js`: Explore tab site telemetry deck, primary metrics, terrain slopes, and horizon panorama.
12. `views/science-view.js`: NASA validation benchmarks, error scatter plots, and methodology documentation.
13. `main.js`: Minimal bootstrap orchestrator coordinating WebGL scene mount, asset hydration, and global keyboard/window listeners.

## Tooling & Dependency Verification

- **Graphify**: Indexed workspace via `graphifyy` AST parser. Verified 3,355 nodes, 6,429 edges, and 187 communities with clean caller/callee cross-module relationships.
- **Ponytail**: Integrated `.agents/rules/ponytail.md` and `AGENTS.md` to maintain minimal abstraction overhead, keep vanilla Three.js/ES modules, and prevent bloated frameworks.
- **Automated Test Suite**:
  - `tests/test_pipeline.py`: 6 passed in 1.93s (`numba` + `spiceypy` horizon raycasting, stereographic transforms, dip angle geometry, ephemeris accuracy).
  - `tests/test_js_science.mjs`: Node.js science regression tests passed (stereographic coordinates, sun fraction arithmetic, window ranking comparator).
  - `web/js/**/*.js`: 100% syntax check passed across all 16 JS modules.

## Findings & Resolutions

- BLOCKER (resolved): Monolithic file maintainability resolved via single-responsibility CSS and JS modularization.
- BLOCKER (resolved): Modal overlay occlusion and sticky Share dialog resolved. Author stylesheet rule `.modal-overlay { display: flex; }` was overriding user-agent `[hidden] { display: none; }`, keeping `#shareBox` visible at z-index 60 even after dismissal. Added `[hidden] { display: none !important; }` and `.modal-overlay[hidden] { display: none !important; }` in `web/css/modals.css`, and bound `Escape` key listener in `web/js/main.js`.
- BLOCKER (resolved): Inactive destination panels isolated via `.tab { display: none; }` and `.tab.on { display: block; }`. Explore → Plan → Science routing verified.
- HIGH (resolved): Visual redesign completed with strict monochrome design system: Obsidian `#101113` and Lunar White `#E9E7E1` exclusively. Neon gradients and colored button accents removed.
- HIGH (resolved): Terminology simplified into plain-English labels suitable for non-technical visitors ("Explore the Pole", "Find a Landing Date", "How It Works", "Direct Earth view", "Ground slope", "Terrain horizon").
- HIGH (resolved): Primary landing action properly sets selected-site scope (`wSites = 'sel'`) before evaluation, preventing duplicate search cycles.
- MEDIUM (resolved): Mobile layout overlap resolved below 820px breakpoint (`#panel-deck` bottom dock, `#panel-sites` z-index 35, full `#timeInput` visibility).
- MEDIUM (resolved): Mission-specific evaluation period (e.g. 14-day mission vs annual average) dynamically reflected in vital metrics and telemetry labels when inspecting a ranked window.
- MEDIUM (resolved): In-app mission brief preview added with modal preview and print/save PDF options, bypassing browser popup blocker restrictions.
- MEDIUM (resolved): Local return-to-finder navigation control (`#compareBack`) added to the comparison view.
- MEDIUM (resolved): Guided tour narration reviewed to ensure all assertions reflect sampled comparison data and educational screening rather than flight certification.
- LOW (resolved): Visual consistency and button alignment across classroom and forecast components.

## Scientific Evidence & Data Provenance

Pipeline and metadata trace directly to NASA LOLA `LDEM_80S_80M` (80 m altimetry raster), JPL NAIF SPICE `DE440` / `MOON_ME` body-fixed frame, NASA GSFC PGDA illumination reference atlas (Mazarico et al., 2011), and USGS Astrogeology Artemis III footprints (McClernan 2024, DOI: 10.5066/P1MEQ6UK).
Terrain horizon profile uses 120 grid azimuths and 720 site azimuths up to 220 km radius with lunar curvature correction ($d^2 / 2R$).
Evaluations sample landing starts at 6-hour increments; ranking formula: 55% sunlight availability + 30% Earth line-of-sight + 15% continuous darkness penalty, broken by terrain clearance margin.
Ground-truth correlations: sunlight $r = 0.990$ (MAE 1.5%), Earth line-of-sight $r = 0.992$ (MAE 1.8%), ephemeris match $< 0.001^\circ$ vs JPL Horizons.

## Verification Summary

- Strict Monochrome Palette: Obsidian `#101113` and Lunar White `#E9E7E1` verified across UI, shaders, canvas horizons, and Chart.js telemetry charts.
- Syntax & Architecture: JS syntax validation passed across all modules (`data.js`, `main.js`, `pano.js`, `scene.js`, views, controllers).
- Local Server & Assets: Zero missing assets, 100% 200 OK responses on local server `http://127.0.0.1:8000/`.
- Full Journey: Explore → Plan → Science workflows verified end-to-end.
- Interactive Tools: 3D terrain canvas, skyline panorama, 12-month calendar, battery survival check, heatmaps, side-by-side comparison, mission brief modal, and share QR generation verified.
- Mobile / Responsive: Responsive breakpoints verified across desktop, tablet, and mobile (820px, 674px).
