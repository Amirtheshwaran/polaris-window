# Polaris Window — Technical Stack & Architecture

## 1. Architectural Principles
Polaris Window is engineered with an emphasis on **resilience, scientific transparency, and zero operational overhead**:
- **Zero Runtime Backend**: All terrain rendering, orbital interpolation, horizon raycasting lookups, constraint filtering, and battery simulations run 100% client-side in the browser.
- **Fast Static Delivery**: Pre-computed, optimized binary arrays deliver high-precision orbital ephemeris and horizon silhouettes with minimal download footprints.
- **Framework-Free Simplicity**: Built using modular vanilla JavaScript (ES2022+), WebGL via Three.js, and standard web APIs rather than heavy reactive frameworks.

---

## 2. Technology Inventory

### Client-Side Frontend
| Layer / Library | Version | Role in Polaris Window |
|---|---|---|
| **Vanilla JavaScript** | ES2022+ | Core application logic, event dispatching, DOM manipulation, URL routing |
| **Three.js** | r128 | 3D WebGL rendering of the lunar south pole digital elevation mesh, directional solar lighting, camera orbit controls, and pin markers |
| **Chart.js** | v3.9.1 | 2D telemetry histograms, battery state-of-charge curves, and comparison charts |
| **qrcode-generator**| v1.4.4 | Client-side generation of lightweight SVG QR codes for shareable URL states |
| **HTML5 Canvas 2D** | Native | High-frequency rendering of the 360° horizon skyline and 60-day daylight/comm status strips |
| **CSS3** | Modern | Flexbox/Grid responsive layout, CSS variables design tokens, reduced-motion queries |

### Offline Scientific Data Pipeline
| Component | Technologies | Purpose |
|---|---|---|
| **Altimetry Processing** | Python 3.12, NumPy, SciPy `ndimage`, Pillow | Ingests NASA LOLA `LDEM_80S_80M` 80-meter elevation raster; computes slope gradients, normal vectors, and downsampled multi-resolution mesh assets |
| **Ephemeris Generation** | Python, `spiceypy` (NAIF SPICE), Astropy | Extracts Sun and Earth position vectors in the Moon Mean Earth / Polar Axis (`MOON_ME`) reference frame from JPL `DE440` ephemeris at 1-hour resolution |
| **Horizon Raycasting** | Python, NumPy | Computes 720 azimuthal horizon elevation profiles for candidate sites up to a 220 km radius, with curvature compensation ($h - d^2/2R_{moon}$) |
| **Binary Asset Packaging** | Python `struct`, zlib | Compresses ephemeris vectors and horizon masks into compact binary assets (`ephem.bin`, `hz_core.bin`, `hz_regional.bin`) |

---

## 3. Data Flow & Execution Model

```
[NASA LOLA DEM + JPL SPICE DE440]
                 │
                 ▼  (Offline Python Pipeline)
[Compact Binary Data: ephem.bin, hz_core.bin, sites.json]
                 │
                 ▼  (Static HTTP GET / CDN)
         [Browser Client]
                 │
  ┌──────────────┼────────────────────────┐
  ▼              ▼                        ▼
[data.js]   [scene.js]                [pano.js]
Data Cache   3D Mesh & Solar Vectors  2D Horizon Silhouette
  │              │                        │
  └──────────────┼────────────────────────┘
                 ▼
         [main.js / Modules]
State Management, Navigation, Window Finder, Telemetry
                 │
                 ▼
          [DOM UI & HUD]
```

---

## 4. State Management & Deep Linking
- **State Object (`ST`)**: Centralized single source of truth:
  - `site`: Currently active landing location (e.g. `ridge`, `shackleton`).
  - `t`: Current time index ($0 \dots 8759$, representing hourly steps across the operational year).
  - `tab`: Active destination view (`site` / Explore, `windows` / Plan, `valid` / Science, `compare`, `heat`).
  - `mode`: High-level workflow mode (`explore`, `plan`, `science`).
  - `layer`: Active terrain surface visualization (`light`, `elev`, `slope`, `heat`).
- **Two-Way Hash Binding**:
  - `readHash()`: Parses `location.hash` on page load or `hashchange` to restore identical session state.
  - `writeHash()`: Updates URL hash without polluting browser history, making any view immediately bookmarkable and shareable.

---

## 5. Deployment & Hosting
- **Repository**: Hosted at `https://github.com/Amirtheshwaran/polaris-window`.
- **Public URL**: Deployed directly via GitHub Pages from branch `main` at `https://amirtheshwaran.github.io/polaris-window/`.
- **Performance**: Zero external API dependencies; all resources are cached in browser memory, enabling offline execution once loaded.
