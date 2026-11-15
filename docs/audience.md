# Polaris Window — Target Audience & User Personas

Polaris Window serves four primary user personas, balancing high-precision aerospace rigor with clear, intuitive accessibility.

---

## 1. NASA Space Apps Challenge Judges & Evaluators
- **Profile**: Aerospace engineers, planetary data scientists, software evaluators, and educational outreach specialists assessing challenge submissions.
- **Key Goals**:
  - Verify mathematical and scientific validity of the landing-window calculations.
  - Review traceability to official NASA datasets (LOLA altimetry, JPL NAIF SPICE).
  - Verify cross-checks against published NASA Goddard PGDA benchmarks ($r = 0.99$).
  - Experience a compelling, intuitive 30-second demonstration journey without software crashes, UI occlusions, or complex setup.
- **UI Requirements**: Prominent "How It Works" (Science) tab, explicit data source citations, mathematical formulas, and a reliable automated 1-minute guided tour.

---

## 2. Mission Planners & Aerospace Engineers
- **Profile**: Systems engineers, lunar payload architects, and trajectory analysts planning robotic or crewed surface sorties.
- **Key Goals**:
  - Filter candidate landing zones by operational constraints: mission duration (e.g., 14-day lunar day sortie), minimum required sunlight %, direct Earth radio visibility %, and maximum tolerable blackout duration.
  - Inspect terrain slope angles against lander tilt margins (threshold: $< 8^\circ$).
  - Assess battery survival margins and power degradation during shadow passages.
  - Compare competing landing sites side-by-side.
  - Export a consolidated, printable mission brief for flight readiness reviews.
- **UI Requirements**: Precise parameter sliders, ranked candidate window tables, downloadable CSV telemetry, and printable PDF briefs.

---

## 3. High School & University Students & Educators
- **Profile**: Astronomy, aerospace engineering, and physics students learning about orbital mechanics, lunar librations, and polar illumination.
- **Key Goals**:
  - Understand why the Moon's south pole differs from equatorial landing sites (e.g. Apollo).
  - Observe how grazing sunlight ($< 1.5^\circ$) creates moving shadow dynamics across crater rims.
  - Complete structured curriculum scenarios (accessible via the "Classroom" link).
- **UI Requirements**: Plain-English terminology ("Direct Earth View" instead of "DTE LOS", "Ground Slope" instead of "Surface Gradient"), interactive time scrubbing, and educational tooltips explaining the physics.

---

## 4. General Public & Space Enthusiasts
- **Profile**: General public following NASA's Artemis program, planetary exploration enthusiasts, and science communicators.
- **Key Goals**:
  - Explore the Moon's south pole in immersive 3D.
  - See what the Sun and Earth look like from the surface of candidate landing sites (e.g. Shackleton Rim).
  - Easily share specific dates and perspectives with friends or colleagues via links or QR codes.
- **UI Requirements**: Instant visual feedback, fast loading times, clean aesthetic without clutter, intuitive controls, and responsive layout for mobile and tablet devices.
