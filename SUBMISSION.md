# Space Apps submission: paste-ready

## Project Name
Polaris Window

## High-Level Project Summary
Polaris Window is a free, browser-based mission planner for the lunar south pole that answers the question planners actually ask: when and where should we land? It combines NASA LOLA terrain with NASA/JPL SPICE ephemeris to show, for any site and any hour from 2026 to 2030, whether the Sun (power) and Earth (direct-to-Earth comms) are above the real terrain horizon. You can watch real shadows sweep across a 3D south pole, stand at a site to see the Sun and Earth paths cross a 360° horizon, compare sites side by side, color the region with sunlight or comms heatmaps, and let the auto window finder rank the best landing dates for your mission's power and comms limits. Our illumination model reproduces NASA's published south-pole illumination map (r = 0.99) and matches JPL Horizons to 0.001°, so planners, educators and the public can trust the numbers.

## Link to Project Demo
<YouTube link: 30-second video>

## Link to Final Project
<https://USERNAME.github.io/polaris-window/>  (code: https://github.com/USERNAME/polaris-window)

## Detailed Project Description
**What it does**
- **Live 3D south pole:** 384 × 384 km of real LOLA terrain. Scrub or play the timeline and the shadows move with the true Sun position.
- **Stand at site:** a 360° panorama of the real horizon at any site, with the Sun path (gold) and Earth path (blue) for the next lunar month. Where a path dips behind terrain, you lose power or comms. One click puts you on the surface in 3D.
- **Auto window finder:** enter a mission length (for example 14 days), minimum sunlight %, minimum Earth visibility %, maximum continuous darkness and maximum comms blackout. It evaluates every 6-hour landing slot from 2026 to 2030 at every site and ranks the best windows.
- **Side-by-side compare:** 2 to 4 sites, with sunlight %, Earth visibility %, sun AND Earth %, longest darkness, longest blackout and estimated solar energy, plus charts for each lunation over a year.
- **Heatmap mode:** colors the whole region by sunlight, Earth visibility or both, for any date range, computed live in the browser.
- **Custom sites:** click anywhere on the terrain to add a site with full analysis.
- **Shareable links:** every site, date, tab and heatmap is encoded in the URL, so a teacher can send a class to the exact moment the Sun clears a crater rim.
- **Explore mode with a guided tour** for the public and classrooms, and **Planner mode** for engineers.

**How it works**
1. A Python pipeline reads the LOLA LDEM_80S_80M DEM (80 m/pixel) and ray-marches every terrain point's horizon in 120 to 720 directions out to 220 km, including lunar curvature (131,000 grid points plus 8 named sites). It's accelerated with Numba.
2. SpiceyPy with NAIF kernels (DE440, high-accuracy lunar orientation, MOON_ME frame) produces hourly Sun and Earth vectors in the same body-fixed frame as LOLA.
3. Everything is precomputed into about 18 MB of static binary files. The browser does the rest: local azimuth and elevation, horizon comparison, statistics, window search and heatmaps. There's no server, so nothing can go down.
4. **Validation:** we recomputed NASA PGDA's published average-illumination map (Mazarico et al. 2011) for the same 2009–2013 period. Our map correlates at r = 0.990 with a mean absolute error of 1.5 percentage points, and 98.9% of cells fall within 10 points. Our Sun and Earth elevations match JPL Horizons to within 0.001°. Both comparisons are shown in the app.

**Benefits:** it turns hours of work across Horizons, Quickmap and spreadsheets into seconds. A landing-date decision becomes a ranked list. Educators and the public get an intuitive, accurate picture of why the south pole is so hard, and so valuable.

**Tools:** Python, NumPy, SciPy, Numba, SpiceyPy, Matplotlib, JavaScript, Three.js, Chart.js, GitHub Pages.

**What's next:** relay-satellite comms, slope and hazard layers from LOLA, power-system sizing, and higher-resolution (5 to 20 m) DEMs for site-scale planning.

## Use of Super Intelligence (SI)
Yes. We used an AI coding assistant (Claude) to speed up writing the data pipeline and web application code, under our direction: the team chose the concept, the features, the data sources and the validation approach, and tested the results. ChatGPT was used for brainstorming feedback. All scientific data come from NASA sources. No AI-generated images, video or audio are used. AI assistance is acknowledged in the repository README.

## NASA Data
- **LRO LOLA gridded polar DEM, LDEM_80S_80M** (PDS Geosciences Node): the terrain for the 3D view and all horizon calculations.
- **NASA/JPL NAIF SPICE kernels** (DE440s planetary ephemeris, MOON_PA_DE440 lunar orientation, MOON_ME frame kernel, leap seconds): Sun and Earth positions.
- **NASA GSFC PGDA Lunar Polar Illumination, AVGVISIB_75S_120M_201608** (Mazarico et al. 2011): validation of our illumination model.
- **JPL Horizons System** (API): independent validation of Sun and Earth elevation at a south-pole site.
- **Quickmap / Moon Trek:** used to explore and cross-check site locations.

## Space Agency Partner Data and Other References
- CSA Moon Exploration portal (background on Artemis and lunar exploration).
- Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., Torrence, M. H. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus* 211, 1066–1081.
- NASA Artemis III candidate landing regions (2024 announcement), used for approximate site locations.
- Open-source libraries: Three.js (MIT), Chart.js (MIT), NumPy, SciPy, Numba, SpiceyPy, Matplotlib (BSD/MIT).

---

# 30-second demo video script (screen recording plus voiceover, with English subtitles)

| Time | Screen | Voiceover |
|---|---|---|
| 0:00 | Title card over the 3D south pole | "Hi, I'm Amir from team Polaris Window." |
| 0:02 | Timeline playing, shadows sweeping | "Landing at the Moon's south pole means fighting for sunlight and a line of sight to Earth." |
| 0:05 | Logo + tagline | "Polaris Window: know exactly when and where to land." |
| 0:08 | Click Connecting Ridge, then the panorama with the Sun and Earth paths | "Built on NASA's LOLA terrain and JPL ephemeris, you can stand at any site and watch the Sun and Earth cross the real horizon." |
| 0:14 | Window finder: enter 14 days, click, ranked list | "Give it your mission length, power and comms limits, and it ranks the best landing dates." |
| 0:19 | Heatmap sweep, then compare chart | "Compare sites, map sunlight and comms across the whole region..." |
| 0:23 | Validation tab (r = 0.99) | "...and every result is checked against NASA's own illumination maps." |
| 0:26 | Share link, then the 3D fly-over | "From mission planners to classrooms: pick your window to the Moon." |

Recording tips: record at 1920×1080 with Explore mode and the guided tour (`▶ Guided tour`). Hide the browser UI (F11). Use the speed set to 4 h/frame for the shadow sweep.
