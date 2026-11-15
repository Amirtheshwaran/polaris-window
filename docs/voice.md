# Polaris Window — Tone of Voice & Copy Guidelines

## 1. Editorial Voice & Personality
The voice of Polaris Window is **authoritative, understated, transparent, and precise**.

It embodies the culture of mission control and planetary science:
- **Calm and Intentional**: Every word serves a communicative purpose. No marketing hype, exclamation points, artificial excitement, or corporate buzzwords.
- **Scientifically Transparent**: Never claim operational flight certification or NASA endorsement. Clearly differentiate between authoritative NASA source measurements and our client-side approximations.
- **Accessible Without Condescension**: Speak plain English to non-technical users while preserving exact scientific figures and units for technical evaluators.

---

## 2. Terminology & Jargon Replacement Rules

To maintain high accessibility without diluting scientific precision, the interface adheres to strict terminology mappings:

| Technical / Internal Jargon | Preferred Plain-English UI Label | Rationale |
|---|---|---|
| `DTE LOS` / `Line-of-Sight` | **Direct Earth View** | Instantly conveys radio and visual line-of-sight to Earth without technical acronyms. |
| `Solar Illumination Availability` | **Average Sunlit Time** | Clear to students and judges evaluating solar power feasibility. |
| `Surface Slope Gradient` | **Ground Slope** | Direct and understandable; paired with "Safe limit (<8°)". |
| `Terrain Elevation Horizon Mask` | **Terrain Horizon Silhouette** | Clarifies the 360° skyline blocking the Sun or Earth. |
| `Ephemeris Vector Search` | **Find a Landing Date** | Action-oriented for the primary navigation header. |
| `Model Validation & Verification` | **How It Works (Science)** | Welcoming entry point to data sources, math, and limitations. |
| `Lander State of Charge (SoC)` | **Lander Battery Check** | Relatable terminology for power survival under crater shadow. |

---

## 3. Scientific Disclaimers & Ethics

### Permitted Claims
- "Calculated from NASA Lunar Reconnaissance Orbiter (LOLA) 80m elevation data."
- "Orbits computed using NASA JPL NAIF SPICE ephemerides (DE440)."
- "Correlated against NASA Goddard Space Flight Center PGDA illumination models ($r = 0.990$)."
- "Candidate landing locations based on USGS Artemis III published footprints (McClernan 2024)."

### Prohibited Claims
- **Do not imply NASA certification**: Never use phrases like "Certified for NASA flight operations", "Official NASA mission plan", or "Approved landing vector".
- **Disclose resolution limits**: Always make clear that modeled 80-meter slopes screen for macro-topography; sub-meter boulders, micro-craters, and surface geotechnical properties require ultra-high-resolution imaging (LROC NAC) and lander hazard detection sensors.

---

## 4. Error & Status Messaging
- **Loading State**: *"Loading NASA Moon terrain… 9.7 MB"* (informs user of asset magnitude and source).
- **No Results Found**: *"No landing windows match all constraints at this site. Try lowering minimum sunlight, increasing allowed darkness, or testing another site."*
- **Copy Feedback**: *"Mission link copied to clipboard"* (simple toast notification, auto-dismissing in 2.4s).
