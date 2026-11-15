# Polaris Window — Design System Specification

## 1. Aesthetic Philosophy
Polaris Window is designed as a **mission-grade scientific visualization instrument** rather than a consumer dashboard or generic AI-generated interface.

Its visual signature is guided by:
- **Restraint**: Maximum contrast and legibility without decorative neon glows, saturated card borders, or arbitrary gradients.
- **Strict Monochrome**: A dual-tone system pairing deep basaltic shadow (**Obsidian `#101113`**) with crisp regolith illumination (**Lunar White `#E9E7E1`**).
- **Subordination of UI to Data**: The 3D lunar surface and mathematical horizons are the focal point; controls are docked, minimal, and non-occluding.
- **Universal Accessibility**: High contrast ratios (WCAG AAA for primary text), clear visual hierarchy, keyboard navigability, and reduced-motion support.

---

## 2. Color System

### Primary Monochrome Tokens
| Token Name | Hex / Value | Semantic Role |
|---|---|---|
| `--obsidian` | `#101113` | Deep space background, core canvas background |
| `--obsidian-dark` | `#0A0B0D` | Header bar, base shell background |
| `--obsidian-surface-1` | `#151619` | Primary floating card & panel surfaces |
| `--obsidian-surface-2` | `#1C1E22` | Secondary surfaces, button resting states, inputs |
| `--obsidian-surface-3` | `#24262D` | Active list items, input hover states, table rows |
| `--obsidian-surface-hover`| `#2B2E36` | High-emphasis hover surfaces |
| `--lunar-white` | `#E9E7E1` | Primary text, active badges, key focus rings, solid buttons |

### Alpha & Surface Modifiers
- `--lunar-white-90`: `rgba(233, 231, 225, 0.90)` (High-emphasis headings)
- `--lunar-white-75`: `rgba(233, 231, 225, 0.75)` (Secondary labels and descriptions)
- `--lunar-white-55`: `rgba(233, 231, 225, 0.55)` (Muted meta captions, unit indicators)
- `--lunar-white-35`: `rgba(233, 231, 225, 0.35)` (Tertiary notes, inactive indicators)
- `--lunar-white-20`: `rgba(233, 231, 225, 0.20)` (Subtle track backgrounds)
- `--lunar-white-12`: `rgba(233, 231, 225, 0.12)` (Standard border stroke)
- `--lunar-white-06`: `rgba(233, 231, 225, 0.06)` (Subtle row fills)

### Borders & Shadows
- `--border-subtle`: `rgba(233, 231, 225, 0.12)`
- `--border-medium`: `rgba(233, 231, 225, 0.24)`
- `--border-strong`: `rgba(233, 231, 225, 0.50)`
- `--shadow-panel`: `0 16px 40px -8px rgba(0, 0, 0, 0.90), 0 0 0 1px var(--border-subtle)`
- `--shadow-sm`: `0 2px 8px rgba(0, 0, 0, 0.60)`

---

## 3. Typography
- **UI & Prose Font**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
  - Font sizes: Base `13px`, Headings `16px` / `18px`, Small/Meta `11px`.
  - Leading: Clean `1.5` line height for readability in compact panels.
- **Telemetry & Numerics Font**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
  - Tabular numerics applied to timestamps, coordinates, angles, and percentages to prevent layout jitter during scrub.

---

## 4. UI Architecture & Spatial Layout

### Viewport Shell
```
+--------------------------------------------------------------------------+
| Header: Logo | [Explore] [Plan] [Science] | [Live Sun] [Tour] [Share]   | (48px)
+--------------------------------------------------------------------------+
| Left Drawer     |                                    | Right Dock        |
| [13 Sites List] |      3D Lunar Terrain Centerpiece  | [Site Details or  |
| (Collapsible,   |      (Three.js WebGL Full Canvas)  |  Mission Planner] |
|  260px wide)    |                                    | (380-440px wide)  |
+--------------------------------------------------------------------------+
| Bottom Dock: Timeline Transport, Speed, Date Picker, Scrub Slider (52px) |
+--------------------------------------------------------------------------+
```

### Modals & Dialogs
- Overlays use `.modal-overlay` with strict dismissal:
  ```css
  [hidden] {
    display: none !important;
  }
  .modal-overlay[hidden] {
    display: none !important;
  }
  ```
- All modals support clicking backdrop, clicking **✕**, or pressing <kbd>Esc</kbd> for instant dismissal.

---

## 5. 3D & 2D Scientific Colormaps
- **Elevation Colormap**: Custom linear gradient ramp mapped between $-4.0\text{ km}$ and $+2.5\text{ km}$ elevation from Obsidian (`#101113`) at lowest basin floors to Lunar White (`#E9E7E1`) on highest sunlit ridges.
- **Terrain Horizon Skyline**: Rendered on HTML5 canvas with solid dark fill for terrain masking, crisp white dots for solar path coordinates, and dashed gray dots for Earth path coordinates.
- **Lighting & Shadows**: Pure directional light modeling parallel solar rays at calculated sub-solar azimuth and elevation angles, combined with 0.08 ambient regolith bounce.
