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
      <AbsoluteFill style={{ opacity: ramp(f, 0, 42) }}><Seq dir="hook" count={75} rate={0.32} scaleFrom={1.08} scaleTo={1.02} len={s(4.45)} /></AbsoluteFill>
      <Shade top={0.7} bottom={0.5} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 300 }}>
        <div style={{ position: 'relative', width: 900, height: 150 }}>
          <AbsoluteFill style={{ alignItems: 'center' }}><Title text="WHERE?" at={s(1.55)} out={s(3.05)} size={128} weight={300} /></AbsoluteFill>
          <AbsoluteFill style={{ alignItems: 'center' }}><Title text="WHEN?" at={s(3.38)} size={128} weight={600} /></AbsoluteFill>
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

const Product: React.FC = () => {
  const f = useCurrentFrame();
  const a = s(15.3) - s(12.6), b = s(17.8) - s(12.6), c = s(19.15) - s(12.6), L = s(21.6) - s(12.6);
  const xf = (k: number) => ramp(f, k - 6, k + 6);
  return (
    <AbsoluteFill style={{ background: OBS }}>
      {/* 1. cinematic orbit over the real south-pole terrain */}
      <Sequence durationInFrames={a + 6}><AbsoluteFill style={{ opacity: 1 - xf(a) }}><Seq dir="orbit" count={90} rate={1.1} scaleFrom={1.0} scaleTo={1.05} len={a} /></AbsoluteFill></Sequence>
      <Sequence durationInFrames={a + 6}><AbsoluteFill style={{ justifyContent: 'flex-start', padding: '84px 120px', opacity: 1 - xf(a) }}><Kicker o={ramp(f, 4, 20)}>Real NASA LOLA terrain · lunar south pole</Kicker></AbsoluteFill></Sequence>
      {/* 2. selected landing location with real sunlight and Earth-view metrics */}
      <Sequence from={a - 6} durationInFrames={b - a + 12}>
        <AbsoluteFill style={{ opacity: ramp(f, a - 6, a + 6) }}><Shot src="03-site.png" len={b - a} from={1.0} to={1.22} ox={2} oy={96} /></AbsoluteFill>
        <Focus x={52} y={818} w={322} h={78} at={14} zoom={1.22} ox={2} oy={96} len={b - a} from={1.0} />
      </Sequence>
      {/* 3. compare locations: real side-by-side table */}
      <Sequence from={b - 6} durationInFrames={c - b + 12}>
        <AbsoluteFill style={{ opacity: ramp(f, b - 6, b + 6) }}><Shot src="05-compare.png" len={c - b} from={1.12} to={1.24} ox={99} oy={62} /></AbsoluteFill>
      </Sequence>
      {/* 4–6. landing-date planning and the real recommended window */}
      <Sequence from={c - 6} durationInFrames={L - c + 6}>
        <AbsoluteFill style={{ opacity: ramp(f, c - 6, c + 6) }}><Shot src="01-plan.png" len={L - c} from={1.12} to={1.3} ox={99} oy={58} /></AbsoluteFill>
        <Focus x={1426} y={486} w={444} h={238} at={16} label="Recommended landing window" zoom={1.3} ox={99} oy={58} len={L - c} from={1.12} />
      </Sequence>
    </AbsoluteFill>
  );
};

const Science: React.FC = () => {
  const f = useCurrentFrame(), L = s(25.3) - s(21.6);
  const item = (k: number, t: string, sub: string) => (
    <div style={{ opacity: ramp(f, k, k + 12), transform: `translateY(${(1 - ramp(f, k, k + 16)) * 16}px)` }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 44, fontWeight: 600, letterSpacing: '0.08em', color: LUNAR }}>{t}</div>
      <div style={{ fontFamily: SANS, fontSize: 19, color: LUNAR, opacity: 0.6, marginTop: 6 }}>{sub}</div>
    </div>
  );
  const stat = (k: number, v: string, l: string) => (
    <div style={{ opacity: ramp(f, k, k + 12) }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 72, fontWeight: 300, color: LUNAR, letterSpacing: '0.02em' }}>{v}</div>
      <div style={{ fontFamily: SANS, fontSize: 18, color: LUNAR, opacity: 0.62, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{l}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: OBS }}>
      <AbsoluteFill style={{ opacity: 0.22 }}><Shot src="02-science.png" len={L} from={1.08} to={1.14} ox={80} oy={50} /></AbsoluteFill>
      <AbsoluteFill style={{ flexDirection: 'row', padding: '150px 140px', gap: 140 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 46, flex: 1 }}>
          <Kicker o={ramp(f, 0, 14)}>How it works</Kicker>
          {item(6, 'NASA LOLA TERRAIN', 'Lunar Reconnaissance Orbiter laser altimetry, 80 m polar grid')}
          {item(20, 'NASA/JPL SPICE', 'Hourly Sun and Earth positions, 2025–2030')}
          {item(34, 'LANDING-WINDOW ANALYSIS', 'Terrain horizons vs. Sun and Earth, every hour')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40, flex: 1, borderLeft: `1px solid rgba(233,231,225,${0.25 * ramp(f, 40, 56)})`, paddingLeft: 80 }}>
          <Kicker o={ramp(f, 44, 58)}>Checked against NASA reference maps</Kicker>
          {stat(52, 'r = 0.990', 'Sunlight map correlation · NASA PGDA')}
          {stat(64, 'r = 0.992', 'Earth-visibility map correlation · NASA PGDA')}
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
      <AbsoluteFill style={{ opacity: ramp(f, 0, 16) }}><Seq dir="hook" count={75} rate={0.12} scaleFrom={1.14} scaleTo={1.06} len={L} /></AbsoluteFill>
      <AbsoluteFill style={{ background: 'rgba(16,17,19,0.5)' }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 22, paddingBottom: 80 }}>
        <div style={{ opacity: ramp(f, t1, t1 + 16) }}><Mark p={ramp(f, t1, t1 + 26)} size={56} /></div>
        <Title text="POLARIS WINDOW" at={t1} size={96} weight={600} track={[0.3, 0.18]} />
        <div style={{ fontFamily: DISPLAY, fontSize: 40, fontWeight: 300, color: LUNAR, opacity: ramp(f, t2, t2 + 14), letterSpacing: '0.02em' }}>Find your window to the Moon.</div>
        <div style={{ height: 30 }} />
        <div style={{ fontFamily: SANS, fontSize: 22, color: LUNAR, opacity: 0.8 * ramp(f, t3, t3 + 14), letterSpacing: '0.06em' }}>{URL}</div>
        <div style={{ fontFamily: SANS, fontSize: 15, color: LUNAR, opacity: 0.55 * ramp(f, t3 + 4, t3 + 18), letterSpacing: '0.22em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.8 }}>
          {CHALLENGE}<br />{TEAM_NAME} · {TEAM_MEMBERS.join(' · ')}
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
