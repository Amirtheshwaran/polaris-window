# Polaris Window — Domain Patterns & Mathematical Foundations

## 1. Lunar South Pole Topography & Coordinate System
- **Reference Frame**: Moon Mean Earth / Polar Axis (`MOON_ME`) body-fixed frame.
- **Projection**: Polar Stereographic projection centered on the South Pole ($90^\circ\text{S}$).
- **Elevation Datum**: Mean lunar radius $R_{moon} = 1737.4\text{ km}$. Elevations are relative to this reference sphere.
- **Primary Topographic Source**: NASA Lunar Reconnaissance Orbiter (LRO) Lunar Orbiter Laser Altimeter (LOLA) `LDEM_80S_80M` raster ($80\text{ m/pixel}$ resolution).

---

## 2. Solar & Terrestrial Ephemeris Mechanics

### Sub-Solar & Sub-Earth Vectors
- Position vectors for the Sun and Earth are derived from the NASA JPL NAIF SPICE `DE440` ephemeris sampled at 1-hour resolution across the target operational year (November 2026 – November 2027, $N = 8760\text{ hours}$).
- For any site coordinate $(\phi, \lambda)$ at time $t$:
  1. Transform site spherical coordinates into a local topocentric East-North-Up (ENU) coordinate frame.
  2. Compute the local azimuth $\alpha$ ($0^\circ = \text{North}, 90^\circ = \text{East}$) and apparent elevation angle $\theta$ (angle above local horizontal tangent plane) for both the Sun and Earth center.

### Lunar Libration Cycles
- Because the Moon’s orbit has an eccentricity of $\sim 0.0549$ and an inclination of $\sim 6.68^\circ$ relative to the ecliptic, the apparent position of the Earth in the lunar sky oscillates by up to $\pm 6.7^\circ$ in latitude and $\pm 8^\circ$ in longitude with a synodic cycle of $\sim 27.3\text{ days}$.
- At the south pole, Earth hangs perpetually on or near the horizon; librations cause it to dip below local crater rim horizons, severing direct radio links.

---

## 3. Horizon Masking & Visibility Raycasting

### 360° Azimuthal Horizon Skyline
- For each landing site, the surrounding terrain skyline is computed across 720 azimuthal bearings ($0.5^\circ$ angular resolution) extending to a search radius of $R_{max} = 220\text{ km}$.
- Along each radial ray at distance $d$, the topographic elevation $z(d)$ is corrected for lunar surface curvature:
  $$\theta_{horizon}(\alpha) = \max_{0 < d \le R_{max}} \left[ \arctan\left( \frac{z(d) - z_{site} - \frac{d^2}{2 R_{moon}}}{d} \right) \right]$$
- **Sunlight Visibility Condition**:
  $$\text{Sunlit}(t) = \begin{cases} 1 & \text{if } \theta_{sun}(t) > \theta_{horizon}(\alpha_{sun}(t)) \\ 0 & \text{otherwise} \end{cases}$$
- **Direct Earth View Condition**:
  $$\text{EarthView}(t) = \begin{cases} 1 & \text{if } \theta_{earth}(t) > \theta_{horizon}(\alpha_{earth}(t)) \\ 0 & \text{otherwise} \end{cases}$$

---

## 4. Multi-Constraint Landing Window Ranking Algorithm

A mission window of duration $D$ hours starting at index $t_0$ is evaluated against screening constraints:
1. **Total Sunlight Availability**:
   $$S(t_0, D) = \frac{1}{D} \sum_{k=0}^{D-1} \text{Sunlit}(t_0 + k)$$
2. **Total Direct Earth Communication Availability**:
   $$C(t_0, D) = \frac{1}{D} \sum_{k=0}^{D-1} \text{EarthView}(t_0 + k)$$
3. **Continuous Darkness Penalty**:
   Identify the longest contiguous sequence of hours where $\text{Sunlit} = 0$:
   $$L_{dark}(t_0, D) = \max \{ \text{duration of consecutive dark hours in } [t_0, t_0 + D) \}$$
4. **Feasibility Composite Score**:
   Candidate windows satisfying user constraint thresholds ($S \ge S_{min}$, $C \ge C_{min}$, $L_{dark} \le L_{max}$) are ranked via:
   $$\text{Score} = 0.55 \cdot S + 0.30 \cdot C + 0.15 \cdot \left(1 - \frac{L_{dark}}{D}\right)$$
   Ties are broken by the minimum terrain clearance margin (elevation of Sun above terrain skyline).

---

## 5. Battery State-of-Charge (SoC) Dynamics
The lander electrical power system is simulated over the mission timeline using a simplified continuous watt-hour integration:
$$E(t+1) = \min\left(E_{max}, E(t) + \left[ P_{solar} \cdot \text{Sunlit}(t) - P_{payload} \right] \cdot \Delta t\right)$$
- If $E(t) \le E_{min}$, a critical power depletion warning is flagged, and the window's viability is downgraded.
- The simulator models typical lunar sortie configurations: $2000\text{ W}\cdot\text{h}$ battery capacity, $350\text{ W}$ solar array peak output, and $85\text{ W}$ continuous hotel/payload load.

---

## 6. Ground Slope & Landing Hazard Screening
- **Slope Angle Formulation**:
  $$\text{Slope} = \arctan\left(\sqrt{ \left(\frac{\partial z}{\partial x}\right)^2 + \left(\frac{\partial z}{\partial y}\right)^2 }\right)$$
- Evaluated using a $3\times3$ Sobel gradient filter over the 80m LOLA DEM.
- Threshold: Slopes $\le 8^\circ$ are marked nominal for Artemis-class landers; slopes between $8^\circ$ and $15^\circ$ carry caution flags; slopes $> 15^\circ$ are deemed non-viable due to rollover risk.
