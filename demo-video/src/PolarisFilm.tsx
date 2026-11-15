import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, Easing } from 'remotion';
import { CAPTIONS, CHALLENGE, TEAM_MEMBERS, TEAM_NAME, URL } from './config';

export const FPS = 30;
export const DURATION = 885; // 29.5 s
const OBS = '#101113', LUNAR = '#E9E7E1';
const DISPLAY = '"Inter Display", Inter, sans-serif', SANS = 'Inter, sans-serif';
const ease = Easing.bezier(0.22, 1, 0.36, 1);
const s = (sec: number) => Math.round(sec * FPS);
const ramp = (f: number, a: number, b: number, from = 0, to = 1) => interpolate(f, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
const fadeWin = (f: number, a: number, b: number, d = 10) => Math.min(ramp(f, a, a + d), 1 - ramp(f, b - d, b));
const GRADE = 'grayscale(1) contrast(1.06)';

// Real application frame sequence (captured from the WebGL renderer), played at `rate` source frames per video frame.
const Seq: React.FC<{ dir: string; count: number; rate: number; scaleFrom?: number; scaleTo?: number; len: number }> = ({ dir, count, rate, scaleFrom = 1, scaleTo = 1.04, len }) => {
  const f = useCurrentFrame();
  const i = Math.min(count - 1, Math.floor(f * rate));
  const sc = interpolate(f, [0, len], [scaleFrom, scaleTo]);
  return <Img src={staticFile(`captures/${dir}/${String(i).padStart(3, '0')}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: GRADE, transform: `scale(${sc})` }} />;
};

// Real application screenshot with slow cinematic push toward a focal point.
const Shot: React.FC<{ src: string; len: number; from?: number; to?: number; ox?: number; oy?: number }> = ({ src, len, from = 1, to = 1.06, ox = 50, oy = 50 }) => {
  const f = useCurrentFrame();
  const sc = interpolate(f, [0, len], [from, to], { easing: Easing.inOut(Easing.cubic) });
  return <Img src={staticFile(`captures/${src}`)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: GRADE, transform: `scale(${sc})`, transformOrigin: `${ox}% ${oy}%` }} />;
};


// Continuous virtual camera over one real screenshot: keyframes [frame, centerX, centerY, zoom] in source pixels.
type K = [number, number, number, number];
const camAt = (f: number, ks: K[]) => {
  const fr = ks.map(k => k[0]);
  const g = (i: number) => interpolate(f, fr, ks.map(k => k[i]), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const z = g(3), cl = (v: number, h: number, H: number) => Math.min(H - h / z, Math.max(h / z, v));
  return { cx: cl(g(1), 960, 1920), cy: cl(g(2), 540, 1080), z };
};
const Cam: React.FC<{ src: string; ks: K[] }> = ({ src, ks }) => {
  const f = useCurrentFrame(); const { cx, cy, z } = camAt(f, ks);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img src={staticFile(`captures/${src}`)} style={{ position: 'absolute', width: 1920, height: 1080, left: 0, top: 0, filter: GRADE, transformOrigin: '0 0', transform: `translate(${960 - cx * z}px, ${540 - cy * z}px) scale(${z})` }} />
    </AbsoluteFill>
  );
};
// Thin outline drawn around a source-pixel rect, following the Cam.
const Box: React.FC<{ ks: K[]; x: number; y: number; w: number; h: number; at: number; out?: number; label?: string }> = ({ ks, x, y, w, h, at, out = 1e9, label }) => {
  const f = useCurrentFrame(); const { cx, cy, z } = camAt(f, ks);
  const X = 960 + (x - cx) * z, Y = 540 + (y - cy) * z, W = w * z, H = h * z, per = 2 * (W + H) + 80;
  const p = ramp(f, at, at + 18), o = 1 - ramp(f, out, out + 8);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <svg width={1920} height={1080} style={{ position: 'absolute' }}><rect x={X - 10} y={Y - 10} width={W + 20} height={H + 20} rx={6} fill="none" stroke={LUNAR} strokeWidth={2} strokeDasharray={per} strokeDashoffset={(1 - p) * per} /></svg>
      {label && <div style={{ position: 'absolute', left: X - 10, top: Y - 52, fontFamily: SANS, fontSize: 20, letterSpacing: '0.26em', color: LUNAR, opacity: ramp(f, at + 8, at + 22), textTransform: 'uppercase' }}>{label}</div>}
    </AbsoluteFill>
  );
};

const Kicker: React.FC<{ children: React.ReactNode; o: number; style?: React.CSSProperties }> = ({ children, o, style }) => (
  <div style={{ fontFamily: SANS, fontSize: 18, letterSpacing: '0.32em', textTransform: 'uppercase', color: LUNAR, opacity: 0.62 * o, ...style }}>{children}</div>
);

// Masked editorial title: rises out of a clip and tracks in.
const Title: React.FC<{ text: string; at: number; size: number; out?: number; weight?: number; track?: [number, number] }> = ({ text, at, size, out = 1e9, weight = 600, track = [0.12, 0.04] }) => {
  const f = useCurrentFrame();
  const p = ramp(f, at, at + 18), o = Math.min(p, 1 - ramp(f, out, out + 10));
  return (
    <div style={{ overflow: 'hidden', paddingBottom: size * 0.12 }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: weight, fontSize: size, lineHeight: 1, color: LUNAR, opacity: o, letterSpacing: `${interpolate(p, [0, 1], track)}em`, transform: `translateY(${(1 - p) * 100}%)` }}>{text}</div>
    </div>
  );
};

// Thin frame that draws around a real UI region (coordinates in source screenshot pixels).
const Focus: React.FC<{ x: number; y: number; w: number; h: number; at: number; label?: string; zoom: number; ox: number; oy: number; len: number; from: number }> = ({ x, y, w, h, at, label, zoom, ox, oy, len, from }) => {
  const f = useCurrentFrame();
  const sc = interpolate(f, [0, len], [from, zoom], { easing: Easing.inOut(Easing.cubic) });
  const map = (px: number, py: number) => [(px - ox * 19.2) * sc + ox * 19.2, (py - oy * 10.8) * sc + oy * 10.8];
  const [x1, y1] = map(x, y), [x2, y2] = map(x + w, y + h), p = ramp(f, at, at + 16), per = 2 * ((x2 - x1) + (y2 - y1));
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: 'absolute' }}>
        <rect x={x1 - 8} y={y1 - 8} width={x2 - x1 + 16} height={y2 - y1 + 16} fill="none" stroke={LUNAR} strokeWidth={1.5} strokeDasharray={per + 64} strokeDashoffset={(1 - p) * (per + 64)} opacity={0.9} />
      </svg>
      {label && <div style={{ position: 'absolute', left: x1 - 8, top: y1 - 40, fontFamily: SANS, fontSize: 15, letterSpacing: '0.24em', color: LUNAR, opacity: p * 0.85, textTransform: 'uppercase' }}>{label}</div>}
    </AbsoluteFill>
  );
};

const Captions: React.FC = () => {
  const f = useCurrentFrame(), t = f / FPS;
  const c = CAPTIONS.find(([a, b]) => t >= a && t <= b + 0.15);
  if (!c) return null;
  const o = Math.min(ramp(f, s(c[0]), s(c[0]) + 5), 1 - ramp(f, s(c[1] + 0.15) - 4, s(c[1] + 0.15)));
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 34 }}>
      <div style={{ fontFamily: SANS, fontSize: 30, fontWeight: 450, color: LUNAR, opacity: 0.92 * o, background: 'rgba(16,17,19,0.62)', padding: '7px 18px', borderRadius: 6, letterSpacing: '0.005em' }}>{c[2]}</div>
    </AbsoluteFill>
  );
};

const Shade: React.FC<{ top?: number; bottom?: number }> = ({ top = 0.55, bottom = 0.75 }) => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(16,17,19,${top}) 0%, rgba(16,17,19,0) 30%, rgba(16,17,19,0) 62%, rgba(16,17,19,${bottom}) 100%)` }} />
);

const Mark: React.FC<{ p: number; size?: number }> = ({ p, size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="29" fill="none" stroke={LUNAR} strokeWidth="1.5" strokeDasharray="183" strokeDashoffset={183 * (1 - p)} />
    <path d="M9 40 Q32 22 55 40" fill="none" stroke={LUNAR} strokeWidth="2" strokeDasharray="60" strokeDashoffset={60 * (1 - ramp(p, 0.35, 1))} />
    <circle cx="44" cy="18" r="4" fill={LUNAR} opacity={ramp(p, 0.6, 1)} />
  </svg>
);

// ---------------------------------------------------------------------- scenes
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: OBS }}>
      <AbsoluteFill style={{ opacity: ramp(f, 0, 14) }}><Seq dir="approach" count={134} rate={1} scaleFrom={1.06} scaleTo={1.0} len={s(4.45)} /></AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(16,17,19,0.9) 0%, rgba(16,17,19,0.55) 30%, rgba(16,17,19,0) 55%, rgba(16,17,19,0) 80%, rgba(16,17,19,0.6) 100%)' }} />
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 110 }}>
        <div style={{ position: 'relative', width: 900, height: 150 }}>
          <AbsoluteFill style={{ alignItems: 'center' }}><Title text="WHERE?" at={s(1.55)} out={s(3.05)} size={120} weight={300} /></AbsoluteFill>
          <AbsoluteFill style={{ alignItems: 'center' }}><Title text="WHEN?" at={s(3.38)} size={120} weight={600} /></AbsoluteFill>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Problem: React.FC = () => {
  const f = useCurrentFrame(), A = s(5.97) - s(4.45), B = s(7.94) - s(4.45);
  const line = (at: number, w: number) => <svg width={w} height={4}><line x1="0" y1="2" x2={w * ramp(f, at + 4, at + 22)} y2="2" stroke={LUNAR} strokeWidth="1.5" /></svg>;
  const row = (at: number, a: string, b: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, opacity: ramp(f, at, at + 14), transform: `translateX(${(1 - ramp(f, at, at + 18)) * -24}px)` }}>
      <span style={{ fontFamily: DISPLAY, fontSize: 64, fontWeight: 600, letterSpacing: '0.06em', color: LUNAR }}>{a}</span>
      {line(at, 120)}
      <span style={{ fontFamily: DISPLAY, fontSize: 64, fontWeight: 300, letterSpacing: '0.06em', color: LUNAR, opacity: ramp(f, at + 14, at + 30) }}>{b}</span>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: OBS }}>
      <Seq dir="problem" count={75} rate={0.41} scaleFrom={1.04} scaleTo={1.12} len={s(6.15)} />
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(16,17,19,0.82) 0%, rgba(16,17,19,0.45) 48%, rgba(16,17,19,0) 75%)' }} />
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 140, gap: 34 }}>
        <Kicker o={ramp(f, 6, 24)}>Lunar south pole</Kicker>
        {row(A, 'SUNLIGHT', 'POWER')}
        {row(B, 'EARTH VIEW', 'COMMUNICATION')}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Reveal: React.FC = () => {
  const f = useCurrentFrame(), L = s(12.6) - s(10.6);
  const t = ramp(f, 4, 40), out = ramp(f, L - 12, L);
  return (
    <AbsoluteFill style={{ background: OBS }}>
      <AbsoluteFill style={{ opacity: out }}><Shot src="00-home.png" len={L} from={1.12} to={1.08} /></AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 26, opacity: 1 - out }}>
        <Mark p={ramp(f, 0, 30)} size={72} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 112, color: LUNAR, letterSpacing: `${interpolate(t, [0, 1], [0.6, 0.22])}em`, opacity: t, lineHeight: 1.02, marginRight: '-0.22em' }}>POLARIS</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 200, fontSize: 112, color: LUNAR, letterSpacing: `${interpolate(ramp(f, 10, 46), [0, 1], [0.6, 0.22])}em`, opacity: ramp(f, 10, 46), lineHeight: 1.02, marginRight: '-0.22em' }}>WINDOW</div>
        </div>
        <Kicker o={ramp(f, 30, 48)} style={{ fontSize: 16 }}>{CHALLENGE}</Kicker>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// One location, one story: select it, read its sunlight and Earth view, open Find Landing Dates, reveal the window.
const SITE_KS: K[] = [[0, 960, 540, 1.0], [40, 900, 600, 1.12], [80, 210, 868, 2.6], [160, 212, 870, 2.75]];
const FIND_KS: K[] = [[0, 1500, 540, 1.12], [30, 1648, 380, 1.9], [62, 1648, 605, 2.15], [114, 1648, 605, 2.25]];
const Product: React.FC = () => {
  const f = useCurrentFrame();
  const A = s(17.8) - s(12.6), L = s(21.6) - s(12.6), x = ramp(f, A - 8, A + 8);
  return (
    <AbsoluteFill style={{ background: OBS }}>
      <Sequence durationInFrames={A + 8}>
        <AbsoluteFill style={{ opacity: 1 - x }}>
          <Cam src="10-site.png" ks={SITE_KS} />
          <Box ks={SITE_KS} x={54} y={818} w={88} h={86} at={92} label="Sunlight" />
          <Box ks={SITE_KS} x={154} y={818} w={88} h={86} at={112} label="Earth" />
          <AbsoluteFill style={{ padding: '84px 120px' }}><Kicker o={ramp(f, 4, 20) * (1 - ramp(f, 60, 72))}>Real NASA LOLA terrain · Connecting Ridge</Kicker></AbsoluteFill>
        </AbsoluteFill>
      </Sequence>
      <Sequence from={A - 8} durationInFrames={L - A + 8}>
        <AbsoluteFill style={{ opacity: x }}>
          <Cam src="11-finder.png" ks={FIND_KS} />
          <Box ks={FIND_KS} x={1426} y={442} w={444} h={30} at={20} out={56} label="Find landing dates" />
          <Box ks={FIND_KS} x={1426} y={486} w={444} h={238} at={66} label="Recommended landing window" />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

const Science: React.FC = () => {
  const f = useCurrentFrame(), L = s(25.3) - s(21.6);
  const item = (k: number, t: string, sub: string) => (
    <div style={{ opacity: ramp(f, k, k + 12), transform: `translateY(${(1 - ramp(f, k, k + 16)) * 16}px)` }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 40, fontWeight: 600, letterSpacing: '0.08em', color: LUNAR }}>{t}</div>
      <div style={{ fontFamily: SANS, fontSize: 19, color: LUNAR, opacity: 0.6, marginTop: 6 }}>{sub}</div>
    </div>
  );
  const stat = (k: number, v: string, l: string) => (
    <div style={{ opacity: ramp(f, k, k + 12) }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 60, fontWeight: 300, color: LUNAR, letterSpacing: '0.02em' }}>{v}</div>
      <div style={{ fontFamily: SANS, fontSize: 18, color: LUNAR, opacity: 0.62, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{l}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: OBS }}>
      <AbsoluteFill style={{ flexDirection: 'row', padding: '130px 120px', gap: 90 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 46, flex: 1 }}>
          <Kicker o={ramp(f, 0, 14)}>How it works</Kicker>
          {item(6, 'NASA LOLA TERRAIN', 'Lunar Reconnaissance Orbiter laser altimetry, 80 m polar grid')}
          {item(20, 'NASA/JPL SPICE', 'Hourly Sun and Earth positions, 2025–2030')}
          {item(34, 'LANDING-WINDOW ANALYSIS', 'Terrain horizons vs. Sun and Earth, every hour')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, flex: 1.4, borderLeft: `1px solid rgba(233,231,225,${0.25 * ramp(f, 40, 56)})`, paddingLeft: 70 }}>
          <Kicker o={ramp(f, 30, 44)}>Validated against NASA reference maps</Kicker>
          <div style={{ width: 820, height: 324, overflow: 'hidden', opacity: ramp(f, 34, 50), clipPath: `inset(0 ${(1 - ramp(f, 34, 62)) * 100}% 0 0)` }}>
            <Img src={staticFile('captures/12-validation.png')} style={{ width: 820, filter: 'grayscale(1) contrast(1.15) brightness(1.1)' }} />
          </div>
          <div style={{ display: 'flex', gap: 70 }}>
            {stat(52, 'r = 0.990', 'Sunlight vs NASA PGDA')}
            {stat(64, 'r = 0.992', 'Earth view vs NASA PGDA')}
          </div>
          <div style={{ fontFamily: SANS, fontSize: 15, color: LUNAR, opacity: 0.45 * ramp(f, 72, 86), maxWidth: 520, lineHeight: 1.45 }}>Correlation with published maps (Mazarico et al. 2011). An educational planning tool, not NASA-endorsed or flight-certified.</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Ending: React.FC = () => {
  const f = useCurrentFrame(), L = DURATION - s(25.3);
  const t1 = s(25.5) - s(25.3), t2 = s(26.86) - s(25.3), t3 = s(27.4) - s(25.3);
  return (
    <AbsoluteFill style={{ background: OBS }}>
      <AbsoluteFill style={{ opacity: ramp(f, 0, 16), transform: 'translate(-330px, -50px)', WebkitMaskImage: 'radial-gradient(ellipse 48% 60% at 50% 50%, #000 70%, transparent 100%)' }}><Seq dir="final" count={130} rate={1} scaleFrom={0.9} scaleTo={0.86} len={L} /></AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(16,17,19,0) 30%, rgba(16,17,19,0.85) 62%)' }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-start', gap: 22, paddingLeft: 1020, paddingBottom: 40 }}>
        <div style={{ opacity: ramp(f, t1, t1 + 16) }}><Mark p={ramp(f, t1, t1 + 26)} size={56} /></div>
        <Title text="POLARIS WINDOW" at={t1} size={78} weight={600} track={[0.3, 0.14]} />
        <div style={{ fontFamily: DISPLAY, fontSize: 40, fontWeight: 300, color: LUNAR, opacity: ramp(f, t2, t2 + 14), letterSpacing: '0.02em' }}>Find your window to the Moon.</div>
        <div style={{ height: 30 }} />
        <div style={{ fontFamily: SANS, fontSize: 22, color: LUNAR, opacity: 0.8 * ramp(f, t3, t3 + 14), letterSpacing: '0.06em' }}>{URL}</div>
        <div style={{ fontFamily: SANS, fontSize: 17, color: LUNAR, opacity: 0.75 * ramp(f, t3 + 4, t3 + 18), letterSpacing: '0.16em', textTransform: 'uppercase', textAlign: 'left', lineHeight: 1.8 }}>
          {CHALLENGE}<br />{TEAM_NAME}<br />{TEAM_MEMBERS.join(' · ')}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const PolarisFilm: React.FC = () => {
  const f = useCurrentFrame();
  const cut = [0, s(4.45), s(10.6), s(12.6), s(21.6), s(25.3), DURATION];
  const Scenes = [Hook, Problem, Reveal, Product, Science, Ending];
  return (
    <AbsoluteFill style={{ background: OBS }}>
      {Scenes.map((S, i) => (
        <Sequence key={i} from={cut[i]} durationInFrames={cut[i + 1] - cut[i] + (i < 5 ? 8 : 0)}>
          <AbsoluteFill style={{ opacity: i === 0 ? 1 : ramp(f, cut[i], cut[i] + 8) }}><S /></AbsoluteFill>
        </Sequence>
      ))}
      <Captions />
      <AbsoluteFill style={{ background: OBS, opacity: ramp(f, DURATION - 6, DURATION) }} />
      <Audio src={staticFile('assets/polaris-voiceover.mp3')} />
      <Audio src={staticFile('assets/ambient.wav')} volume={0.32} />
    </AbsoluteFill>
  );
};
