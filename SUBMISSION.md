# Space Apps submission: paste-ready

## Project Name
Polaris Window

## High-Level Project Summary
Polaris Window is a free, browser-based mission planner for the lunar south pole that answers the question planners actually ask: when and where should we land? It combines NASA LOLA terrain with NASA/JPL SPICE ephemeris to show, for any site and any hour from 2025 to 2030, whether the Sun (power) and Earth (direct-to-Earth comms) are above the real terrain horizon. You can watch real shadows sweep across a 3D south pole, stand at a site to see the Sun and Earth paths cross a 360° horizon, compare sites side by side, color the region with sunlight or comms heatmaps, and let the auto window finder rank the best landing dates for your mission's power and comms limits. Our illumination model reproduces NASA's published south-pole illumination map (r = 0.99) and matches JPL Horizons to 0.001°, so planners, educators and the public can trust the numbers.

## Link to Project Demo
<YouTube link: 30-second video>

## Link to Final Project
https://amirtheshwaran.github.io/polaris-window/  (source code: https://github.com/Amirtheshwaran/polaris-window)

## Detailed Project Description
**What it does**
- **Live 3D south pole:** 384 × 384 km of real LOLA terrain. Scrub or play the timeline and the shadows move with the true Sun position.
- **Stand at site:** a 360° panorama of the real horizon at any site, with the Sun path (gold) and Earth path (blue) for the next lunar month. Where a path dips behind terrain, you lose power or comms. One click puts you on the surface in 3D.
- **Auto window finder:** enter a mission length (for example 14 days), minimum sunlight %, minimum Earth visibility %, maximum continuous darkness and maximum comms blackout. It evaluates every 6-hour landing slot from 2025 to 2030 at every site and ranks the best windows.
- **Side-by-side compare:** 2 to 4 sites, or up to 4 landing dates at one site, with sunlight %, Earth visibility %, sun AND Earth %, longest darkness, longest blackout and estimated solar energy, plus charts for each lunation over a year.
- **Heatmap mode:** colors the whole region by sunlight, Earth visibility or both, for any date range, computed live in the browser.
- **Custom sites:** click anywhere on the terrain to add a site with full analysis.
- **12-month landing forecast:** a calendar for each site with one colored square per day (sun and Earth, partial, or night), like a weather forecast for the Moon.
- **Will your lander survive?** Pick a solar panel, battery and power use, and the battery is simulated hour by hour with the real sunlight at that site and date.
- **Sight-lines and ice map:** lines from the site to the Sun and Earth show when terrain blocks them, and a one-click map shows where the Sun never shines (cold traps for water ice).
- **Real CLPS case study:** IM-2 Athena (2025). Its site and date were good, and it was lost to a small crater and a tip-over.
- **Comms elevation mask (Planner mode):** require Earth to clear the terrain by 1–5°, as real antennas need, and every statistic updates.
- **Mission brief:** one click produces a printable or PDF report for the chosen site and date, with sunlight, Earth visibility, longest night and blackout, safety margin, panorama and a day-by-day table.
- **Shareable links:** every site, date, tab and heatmap is encoded in the URL, so a teacher can send a class to the exact moment the Sun clears a crater rim. The share dialog also shows a QR code for projectors, and the guided tour can read itself aloud.
- **Explore mode with a guided tour** for the public and classrooms, and **Planner mode** for engineers.
- **Classroom missions (learn.html):** six 5-minute, printable missions for ages 10+. Each opens the app at the exact place and date, with a question and an answer (for example, find the crater that never sees the Sun, or be the mission planner).
- **Landing safety:** a slope layer from LOLA and a "best landing spots" map (sun + Earth + ground flatter than 8°).

**How it works**
1. A Python pipeline reads the LOLA LDEM_80S_80M DEM (80 m/pixel) and ray-marches every terrain point's horizon in 120 to 720 directions out to 220 km, including lunar curvature (131,000 grid points plus 8 named sites). It's accelerated with Numba.
2. SpiceyPy with NAIF kernels (DE440, high-accuracy lunar orientation, MOON_ME frame) produces hourly Sun and Earth vectors in the same body-fixed frame as LOLA.
3. Everything is precomputed into static binary files (about a 10 MB download, with horizon grids delta-encoded and compressed). The browser does the rest: local azimuth and elevation, horizon comparison, statistics, window search and heatmaps. There's no server, so nothing can go down.
4. **Validation:** we recomputed NASA PGDA's published average-illumination map (Mazarico et al. 2011) for the same 2009–2013 period. Our sunlight map correlates at r = 0.990 (mean absolute error 1.5 percentage points, 98.9% of cells within 10 points). Our Earth-visibility map, which covers direct-to-Earth comms, correlates with NASA's Earth-visibility map at r = 0.992 (mean error 1.8 points). Our Sun and Earth elevations match JPL Horizons to within 0.001°. Both comparisons are shown in the app.

**Benefits:** it turns hours of work across Horizons, Quickmap and spreadsheets into seconds. Checking whether the Sun or Earth is above the real terrain, which normally means combining ephemeris queries with a terrain horizon you build yourself, becomes one click. Ranking every landing date for a mission, which would normally need thousands of queries, takes about a second. A landing-date decision becomes a ranked list. Educators and the public get an intuitive, accurate picture of why the south pole is so hard, and so valuable.

**Tools:** Python, NumPy, SciPy, Numba, SpiceyPy, Matplotlib, JavaScript, Three.js, Chart.js, GitHub Pages.

**What's next:** relay-satellite comms, slope and hazard layers from LOLA, power-system sizing, and higher-resolution (5 to 20 m) DEMs for site-scale planning.

## Use of Super Intelligence (SI)
[Team to complete.]

## NASA Data
- **LRO LOLA gridded polar DEM, LDEM_80S_80M** (PDS Geosciences Node): the terrain for the 3D view and all horizon calculations.
- **NASA/JPL NAIF SPICE kernels** (DE440s planetary ephemeris, MOON_PA_DE440 lunar orientation, MOON_ME frame kernel, leap seconds): Sun and Earth positions.
- **NASA GSFC PGDA Lunar Polar Illumination, AVGVISIB_75S_120M_201608** (Mazarico et al. 2011): validation of our illumination model.
- **JPL Horizons System** (API): independent validation of Sun and Earth elevation at a south-pole site.
- **Quickmap / Moon Trek:** used to explore and cross-check site locations.

## Space Agency Partner Data and Other References
- CSA Moon Exploration portal (background on Artemis and lunar exploration).
- Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., Torrence, M. H. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus* 211, 1066–1081.
- McClernan, M.T. (2024). Down Selected Artemis III Candidate Landing Site Navigational Grids. USGS data release, https://doi.org/10.5066/P1MEQ6UK, the official footprints of the nine NASA Artemis III candidate landing regions (Oct 2024).
- Open-source libraries: Three.js (MIT), Chart.js (MIT), qrcode-generator (MIT, Kazuhiko Arase), NumPy, SciPy, Numba, SpiceyPy, Matplotlib (BSD/MIT).

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

**Easiest way to record:** open https://amirtheshwaran.github.io/polaris-window/#demo=1 in Chrome, press F11 (fullscreen), start a screen recorder (Windows: Win+Alt+R with Xbox Game Bar; Mac: Cmd+Shift+5), then reload the page. A 30-second choreographed sequence plays with English captions built in. Trim to 30 s or less, add the voiceover (optional, since the captions already tell the story), and upload to YouTube as Public or Unlisted. Test the link in a private window. For YouTube, upload `media/demo-captions.srt` as English subtitles (it matches demo mode's timing) and use `media/youtube-thumbnail.png` as the thumbnail.

---

# Pre-submit checklist (do this before clicking "Submit for Judging")

- [ ] All checkpoint patches are pushed, and the GitHub Actions run "Deploy to GitHub Pages" is green. The site updates within about 10 minutes, because Pages caches files for 600 s.
- [ ] Open https://amirtheshwaran.github.io/polaris-window/ in a **private window** on a laptop: the welcome screen appears, the guided tour runs, and the NASA check tab shows both validation figures.
- [ ] Open it on a **phone**: the page scrolls, and the 3D view and panorama show.
- [ ] Demo video is **30 seconds or less**, uploaded as Public or Unlisted, with English captions (demo mode has them built in). The link opens in a private window without logging in.
- [ ] Project page: every required field is filled in, in English; "Link to Final Project" = the site URL; "Link to Project Demo" = the video; NASA Data and References sections are pasted from this file; the SI section is completed.
- [ ] Images uploaded to the project page are JPG, PNG or GIF under 10 MB (the `media/` screenshots qualify), with no NASA logos and no people under 18.
- [ ] Optional but recommended: request a FortiGuard web filter classification for the site URL (category: Education).
- [ ] Click **Submit for Judging** before Sun Nov 15, 11:59 pm local time. You can edit and resubmit until the deadline, and the last saved submission is judged.
