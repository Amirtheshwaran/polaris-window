# Polaris Window — Product Overview

## 1. Mission Statement
**Polaris Window** is an interactive, NASA-data-driven lunar south pole landing-window exploration, screening, and mission-feasibility application developed for the NASA Space Apps Challenge 2026.

Its mission is to make complex lunar orbital mechanics, polar terrain shadows, and direct-to-Earth communication geometries immediately understandable and actionable for mission planners, students, judges, and space enthusiasts.

---

## 2. Core Value Proposition
Landing at the lunar south pole is one of the most demanding navigational challenges in planetary exploration:
- **Low Solar Elevation**: The Sun skims the horizon at angles between $-1.5^\circ$ and $+1.5^\circ$, casting massive moving shadows across crater rims and deep permanently shadowed regions (PSRs).
- **Intermittent Communication**: Earth wobbles in the lunar sky due to lunar librations ($\pm 6.7^\circ$), causing direct radio communication to dip behind high terrain.
- **Extreme Thermal & Power Risk**: Solar-powered landers and rovers face catastrophic battery freezing if landed during extended darkness.
- **Slope Hazards**: Steep crater walls present severe touchdown tilt and rollover hazards.

Polaris Window solves this by providing a unified, client-side, interactive environment to:
1. **Explore the Lunar South Pole**: Visualize NASA LOLA 80-meter elevation terrain in full 3D, inspecting candidate Artemis landing sites and custom landing coordinates.
2. **Find Viable Landing Windows**: Filter a continuous 365-day operational timeline (November 2026 – November 2027) against user-defined mission constraints (duration, minimum sunlight %, Earth line-of-sight %, maximum allowable darkness, and slope limits).
3. **Verify Scientific Trust**: Expose transparent methodology, dataset provenance, and side-by-side validation against peer-reviewed NASA Goddard PGDA illumination models ($r = 0.990$).

---

## 3. The Three Primary Destinations

### 1. Explore (`tab=site`, `mode=explore`)
- **Default Landing Experience**: Users arrive directly at an interactive 3D map of the Moon's south pole with immediate directional sun-casting.
- **Artemis Site Selector**: Searchable, categorized drawer containing all 13 official Artemis III candidate landing regions (Connecting Ridge, Shackleton Rim, de Gerlache Rim, Peak Near Shackleton, etc.) plus custom coordinate input.
- **Contextual Site Metrics**: Instant readout of three primary screening metrics:
  - *Sunlit Time*: Annual percentage of time the site receives direct solar illumination.
  - *Direct Earth View*: Line-of-sight percentage for direct communication.
  - *Ground Slope*: Modeled slope angle evaluated against the $8^\circ$ landing safety limit.
- **Terrain Silhouette & Sky Paths**: 360-degree interactive horizon panorama showing the exact terrain skyline, annual Sun track, and Earth track with interactive "Stand at Site" first-person views.
- **Interactive Timeline**: 60-day visual status strips and dynamic UTC slider to scrub forward and backward in time, watching shadows sweep across crater rims.

### 2. Plan (`tab=windows`, `mode=plan`)
- **Mission Constraint Setup**: Set mission duration (e.g. 14-day surface sortie, 7-day demo, 30-day extended stay), minimum sunlight percentage, minimum Earth visibility percentage, and maximum continuous blackout limit.
- **Ranked Landing Windows**: Real-time evaluation sampling start dates at 6-hour increments across the target year, displaying top-recommended landing dates with composite feasibility scores.
- **12-Month Landing Calendar**: Year-at-a-glance visualization of monthly lighting cycles and viable launch/touchdown dates.
- **Battery & Power Survival Simulation**: Dynamic battery State of Charge (SoC) simulator tracking watt-hour storage, payload draw, and battery depletion during eclipses/shadows.
- **Multi-Site & Multi-Date Comparison**: Side-by-side evaluation comparing competing sites or different touchdown dates across total sunlight, communication coverage, and maximum dark stretches.
- **Mission Brief Export**: Automated generation of printable, high-density PDF mission briefs detailing site coordinates, solar geometry, risk factors, and recommended landing slots.

### 3. Science (`tab=valid`, `mode=science`)
- **Data Provenance**: Complete traceability to NASA Lunar Reconnaissance Orbiter (LRO) LOLA altimetry, JPL NAIF SPICE ephemerides, and USGS Astrogeology Artemis candidate footprints.
- **Validation Figures**: Ground-truth cross-checks demonstrating $r = 0.990$ sunlight correlation and $r = 0.992$ comms correlation against NASA Goddard Space Flight Center PGDA benchmarks.
- **Methodology & Mathematical Pipeline**: Explanation of 720-azimuth horizon skyline raycasting, lunar curvature correction ($d^2 / 2R$), and vector coordinate transformations.
- **Assumptions & Limitations**: Clear disclosure of 80m spatial resolution limits, micro-boulder hazards below DEM resolution, and solar disk point-source approximations.

---

## 4. Operational Requirements & Delivery
- **Zero-Install Static Web Application**: Runs entirely in modern browsers via GitHub Pages without backend server requirements.
- **Determinism & Deep-Linking**: All application states (selected site, timeline timestamp, active tab, layer mode) encode into URL hash parameters (`#site=...&t=...&tab=...`) and generate scannable SVG QR codes for instant sharing.
