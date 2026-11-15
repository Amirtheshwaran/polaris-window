# Pre-submission audit — 15 November 2026

Readiness: release candidate & visual redesign verified locally; ready for deployment to GitHub Pages.

## Findings & Resolutions

- BLOCKER (resolved): Modal overlay occlusion and sticky Share dialog resolved. Author stylesheet rule `.modal-overlay { display: flex; }` was overriding user-agent `[hidden] { display: none; }`, keeping `#shareBox` visible at z-index 60 even after dismissal. Added `[hidden] { display: none !important; }` and `.modal-overlay[hidden] { display: none !important; }` in `web/css/style.css`, and bound `Escape` key listener in `web/js/main.js`.
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
- Syntax & Architecture: JS syntax validation passed across all modules (`data.js`, `main.js`, `pano.js`, `scene.js`).
- Local Server & Assets: Zero missing assets, 100% 200 OK responses on local server `http://127.0.0.1:8000/`.
- Full Journey: Explore → Plan → Science workflows verified end-to-end.
- Interactive Tools: 3D terrain canvas, skyline panorama, 12-month calendar, battery survival check, heatmaps, side-by-side comparison, mission brief modal, and share QR generation verified.
- Mobile / Responsive: Responsive breakpoints verified across desktop, tablet, and mobile (820px, 674px).
