import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, Easing, getInputProps } from 'remotion';
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
const camAt = (f: number, ks: K[], free = false) => {
  if (ks.length === 1) ks = [ks[0], [ks[0][0] + 1, ks[0][1], ks[0][2], ks[0][3]]];
  const fr = ks.map(k => k[0]);
  const g = (i: number) => interpolate(f, fr, ks.map(k => k[i]), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const z = g(3), cl = (v: number, h: number, H: number) => Math.min(H - h / z, Math.max(h / z, v));
  // free: the frame may extend below the screenshot (that area is always under the solid caption band)
  return { cx: cl(g(1), 960, 1920), cy: free ? Math.max(540 / z, g(2)) : cl(g(2), 540, 1080), z };
};
const Cam: React.FC<{ src: string; ks: K[]; free?: boolean }> = ({ src, ks, free = false }) => {
  const f = useCurrentFrame(); const { cx, cy, z } = camAt(f, ks, free);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img src={staticFile(`captures/${src}`)} style={{ position: 'absolute', width: 1920, height: 1080, left: 0, top: 0, filter: GRADE, transformOrigin: '0 0', transform: `translate(${960 - cx * z}px, ${540 - cy * z}px) scale(${z})` }} />
    </AbsoluteFill>
  );
};
// Thin outline drawn around a source-pixel rect, following the Cam.
const Box: React.FC<{ ks: K[]; x: number; y: number; w: number; h: number; at: number; out?: number; free?: boolean }> = ({ ks, x, y, w, h, at, out = 1e9, free = false }) => {
  const f = useCurrentFrame(); const { cx, cy, z } = camAt(f, ks, free);
  const X = 960 + (x - cx) * z, Y = 540 + (y - cy) * z, W = w * z, H = h * z, per = 2 * (W + H) + 80;
  const p = ramp(f, at, at + 18), o = 1 - ramp(f, out, out + 8);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <svg width={1920} height={1080} style={{ position: 'absolute' }}><rect x={X - 10} y={Y - 10} width={W + 20} height={H + 20} rx={6} fill="none" stroke={LUNAR} strokeWidth={2} strokeDasharray={per} strokeDashoffset={(1 - p) * per} /></svg>
    </AbsoluteFill>
  );
};

const Kicker: React.FC<{ children: React.ReactNode; o: number; style?: React.CSSProperties; id?: string }> = ({ children, o, style, id = 'kicker' }) => (
  <div data-txt={id} style={{ fontFamily: SANS, fontSize: 22, letterSpacing: '0.24em', textTransform: 'uppercase', color: LUNAR, opacity: 0.78 * o, ...style }}>{children}</div>
);

// Label chip on an opaque obsidian plate, used over product footage so it never sits on UI text.
const Chip: React.FC<{ children: React.ReactNode; o: number; id: string }> = ({ children, o, id }) => (
  <div data-txt={id} data-box="1" style={{ display: 'inline-block', fontFamily: SANS, fontSize: 22, letterSpacing: '0.2em', textTransform: 'uppercase', color: LUNAR, opacity: o, background: 'rgba(16,17,19,0.9)', border: '1px solid rgba(233,231,225,0.22)', padding: '10px 18px', borderRadius: 6 }}>{children}</div>
);

// Masked editorial title: rises out of a clip and tracks in.
const Title: React.FC<{ text: string; at: number; size: number; out?: number; weight?: number; track?: [number, number] }> = ({ text, at, size, out = 1e9, weight = 600, track = [0.12, 0.04] }) => {
  const f = useCurrentFrame();
  const p = ramp(f, at, at + 18), o = Math.min(p, 1 - ramp(f, out, out + 10));
  return (
    <div style={{ overflow: 'hidden', paddingBottom: size * 0.12 }}>
      <div data-txt={'title-' + text} style={{ fontFamily: DISPLAY, fontWeight: weight, fontSize: size, lineHeight: 1, color: LUNAR, opacity: o, letterSpacing: `${interpolate(p, [0, 1], track)}em`, transform: `translateY(${(1 - p) * 100}%)` }}>{text}</div>
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
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 58 }}>
      <div data-txt="caption" data-box="1" style={{ fontFamily: SANS, fontSize: 36, fontWeight: 500, lineHeight: 1.25, color: LUNAR, opacity: 0.96 * o, background: 'rgba(16,17,19,0.84)', padding: '9px 24px', borderRadius: 8, letterSpacing: '0.005em', maxWidth: 1600, textAlign: 'center' }}>{c[2]}</div>
    </AbsoluteFill>
  );
};

// Frame-by-frame text check: measures every visible text element and logs overlaps,
// title-safe violations and undersized text to the render log.
const CHECK = !!(getInputProps() as { check?: boolean }).check;
const TextCheck: React.FC = () => {
  const f = useCurrentFrame();
  React.useLayoutEffect(() => {
    if (!CHECK) return;
    const els = Array.from(document.querySelectorAll('[data-txt]')) as HTMLElement[];
    const eff = (el: HTMLElement) => { let o = 1; let n: HTMLElement | null = el; while (n) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= parseFloat(cs.opacity || '1'); n = n.parentElement; } return o; };
    const clipOf = (el: HTMLElement) => { let c = { l: 0, t: 0, r: 1920, b: 1080 }; let n = el.parentElement; while (n) { const cs = getComputedStyle(n); if (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflowY === 'hidden') { const r = n.getBoundingClientRect(); c = { l: Math.max(c.l, r.left), t: Math.max(c.t, r.top), r: Math.min(c.r, r.right), b: Math.min(c.b, r.bottom) }; } n = n.parentElement; } return c; };
    type B = { id: string; el: HTMLElement; o: number; rects: { l: number; t: number; r: number; b: number }[]; fs: number };
    const boxes: B[] = [];
    for (const el of els) {
      const o = eff(el); if (o < 0.06) continue;
      const c = clipOf(el);
      let raw: DOMRect[];
      if (el.dataset.box) raw = [el.getBoundingClientRect()];
      else { const r = document.createRange(); r.selectNodeContents(el); raw = Array.from(r.getClientRects()); }
      const rects = raw.map(q => ({ l: Math.max(q.left, c.l), t: Math.max(q.top, c.t), r: Math.min(q.right, c.r), b: Math.min(q.bottom, c.b) })).filter(q => q.r - q.l > 1 && q.b - q.t > 1);
      if (!rects.length) continue;
      boxes.push({ id: el.dataset.txt || '?', el, o, rects, fs: parseFloat(getComputedStyle(el).fontSize) });
    }
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i];
      for (const q of a.rects) if (q.l < 96 || q.r > 1824 || q.t < 54 || q.b > 1026) console.log(`TXTCHECK SAFE f=${f} ${a.id} [${q.l.toFixed(0)},${q.t.toFixed(0)},${q.r.toFixed(0)},${q.b.toFixed(0)}] o=${a.o.toFixed(2)}`);
      if (a.fs < 20 && a.o > 0.3) console.log(`TXTCHECK SMALL f=${f} ${a.id} ${a.fs}px`);
      for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        for (const p of a.rects) for (const q of b.rects) {
          const ix = Math.min(p.r, q.r) - Math.max(p.l, q.l), iy = Math.min(p.b, q.b) - Math.max(p.t, q.t);
          if (ix > 1 && iy > 1) console.log(`TXTCHECK COLLISION f=${f} ${a.id}(o=${a.o.toFixed(2)}) x ${b.id}(o=${b.o.toFixed(2)}) ${ix.toFixed(0)}x${iy.toFixed(0)}`);
        }
      }
    }
    console.log(`TXTCHECK FRAME f=${f} n=${boxes.length}`);
  }, [f]);
  return null;
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
// Timing rule: every scene's text starts only after the 8-frame cross-fade has finished, and every
// outgoing scene clears its text before its cut, so text from two scenes is never on screen together.
const XF = 8;

const Hook: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: OBS }}>
      {/* real orbital approach, shifted down so the lunar limb stays clear of the titles */}
      <AbsoluteFill style={{ opacity: ramp(f, 0, 14), transform: 'translateY(96px)' }}><Seq dir="approach" count={134} rate={1} scaleFrom={1.06} scaleTo={1.0} len={s(4.45)} /></AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(16,17,19,1) 0%, rgba(16,17,19,0.94) 15%, rgba(16,17,19,0.55) 27%, rgba(16,17,19,0) 42%, rgba(16,17,19,0) 80%, rgba(16,17,19,0.6) 100%)' }} />
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 64 }}>
        <div style={{ position: 'relative', width: 900, height: 140 }}>
          {/* WHERE? is fully gone (frame 94) before WHEN? begins (frame 99) */}
          <AbsoluteFill style={{ alignItems: 'center' }}><Title text="WHERE?" at={s(1.55)} out={s(2.8)} size={112} weight={300} /></AbsoluteFill>
          <AbsoluteFill style={{ alignItems: 'center' }}><Title text="WHEN?" at={s(3.3)} out={s(4.45) - 10} size={112} weight={600} /></AbsoluteFill>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Problem: React.FC = () => {
  const f = useCurrentFrame(), L = s(10.6) - s(4.45), A = s(5.97) - s(4.45), B = s(7.94) - s(4.45);
  const textOut = 1 - ramp(f, L - 10, L);
  const line = (at: number, w: number) => <svg width={w} height={4}><line x1="0" y1="2" x2={w * ramp(f, at + 4, at + 22)} y2="2" stroke={LUNAR} strokeWidth="1.5" /></svg>;
  const row = (at: number, a: string, b: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, opacity: ramp(f, at, at + 14), transform: `translateX(${(1 - ramp(f, at, at + 18)) * -24}px)` }}>
      <span data-txt={'row-' + a} style={{ fontFamily: DISPLAY, fontSize: 64, fontWeight: 600, letterSpacing: '0.06em', color: LUNAR }}>{a}</span>
      {line(at, 120)}
      <span data-txt={'row-' + b} style={{ fontFamily: DISPLAY, fontSize: 64, fontWeight: 300, letterSpacing: '0.06em', color: LUNAR, opacity: ramp(f, at + 14, at + 30) }}>{b}</span>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: OBS }}>
      <Seq dir="problem" count={75} rate={0.41} scaleFrom={1.04} scaleTo={1.12} len={L} />
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(16,17,19,0.84) 0%, rgba(16,17,19,0.5) 48%, rgba(16,17,19,0) 75%)' }} />
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 140, gap: 34, opacity: textOut }}>
        <Kicker id="kicker-pole" o={ramp(f, XF + 2, XF + 20)}>Lunar south pole</Kicker>
        {row(A, 'SUNLIGHT', 'POWER')}
        {row(B, 'EARTH VIEW', 'COMMUNICATION')}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// The reveal ends on the exact first frame of the product shot, so the cut into the product is seamless.
const SITE_KS: K[] = [[0, 960, 660, 1.0], [40, 900, 700, 1.12], [80, 212, 905, 2.6], [150, 212, 905, 2.75]];
const Reveal: React.FC = () => {
  const f = useCurrentFrame(), L = s(12.6) - s(10.6);
  const t = ramp(f, 6, 30), out = ramp(f, L - 18, L - 10), ui = ramp(f, L - 10, L);
  return (
    <AbsoluteFill style={{ background: OBS }}>
      <AbsoluteFill style={{ opacity: ui }}><Cam src="10-site.png" ks={[SITE_KS[0]]} free /><CaptionBand /></AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 26, opacity: 1 - out }}>
        <Mark p={ramp(f, 4, 28)} size={72} />
        <div style={{ textAlign: 'center' }}>
          <div data-txt="reveal-polaris" style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 112, color: LUNAR, letterSpacing: `${interpolate(t, [0, 1], [0.5, 0.22])}em`, opacity: t, lineHeight: 1.22, marginRight: '-0.22em' }}>POLARIS</div>
          <div data-txt="reveal-window" style={{ fontFamily: DISPLAY, fontWeight: 200, fontSize: 112, color: LUNAR, letterSpacing: `${interpolate(ramp(f, 10, 34), [0, 1], [0.5, 0.22])}em`, opacity: ramp(f, 10, 34), lineHeight: 1.22, marginRight: '-0.22em' }}>WINDOW</div>
        </div>
        <Kicker id="reveal-challenge" o={ramp(f, 22, 36)} style={{ fontSize: 24, letterSpacing: '0.2em' }}>{CHALLENGE}</Kicker>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const CaptionBand: React.FC = () => (
  <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(16,17,19,0) 0%, rgba(16,17,19,0) 76%, rgba(16,17,19,0.96) 83.5%, rgb(16,17,19) 86%, rgb(16,17,19) 100%)' }} />
);

// One location, one story: select it, read its sunlight and Earth view, open Find Landing Dates, reveal the window.
// No text labels are drawn on the UI (the UI names every highlighted element itself); captions sit on a dark band.
const FIND_KS: K[] = [[0, 1500, 540, 1.12], [30, 1648, 380, 1.9], [62, 1648, 605, 2.15], [114, 1648, 605, 2.25]];
const Product: React.FC = () => {
  const f = useCurrentFrame();
  const A = s(17.8) - s(12.6), L = s(21.6) - s(12.6);
  const siteO = 1 - ramp(f, A - 6, A), findO = ramp(f, A, A + 6);
  return (
    <AbsoluteFill style={{ background: OBS }}>
      <Sequence durationInFrames={A + 1}>
        <AbsoluteFill style={{ opacity: siteO }}>
          <Cam src="10-site.png" ks={SITE_KS} free />
          <Box ks={SITE_KS} x={54} y={818} w={88} h={86} at={92} free />
          <Box ks={SITE_KS} x={154} y={818} w={88} h={86} at={112} free />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={A} durationInFrames={L - A + XF}>
        <AbsoluteFill style={{ opacity: findO }}>
          <Cam src="11-finder.png" ks={FIND_KS} />
          <Box ks={FIND_KS} x={1426} y={442} w={444} h={30} at={20} out={54} />
          <Box ks={FIND_KS} x={1426} y={486} w={444} h={238} at={66} />
        </AbsoluteFill>
      </Sequence>
      <CaptionBand />
      {/* source label on an opaque chip, shown while the camera crosses open terrain */}
      <AbsoluteFill style={{ padding: '84px 96px' }}><div><Chip id="chip-terrain" o={ramp(f, 40, 50) * (1 - ramp(f, 66, 74))}>Real NASA LOLA terrain · Connecting Ridge</Chip></div></AbsoluteFill>
    </AbsoluteFill>
  );
};

const Science: React.FC = () => {
  const f = useCurrentFrame(), L = s(25.3) - s(21.6), textOut = 1 - ramp(f, L - 10, L);
  const item = (k: number, t: string, sub: string) => (
    <div style={{ opacity: ramp(f, k, k + 12), transform: `translateY(${(1 - ramp(f, k, k + 16)) * 16}px)` }}>
      <div data-txt={'sci-' + t} style={{ fontFamily: DISPLAY, fontSize: 40, fontWeight: 600, letterSpacing: '0.08em', lineHeight: 1.15, color: LUNAR }}>{t}</div>
      <div data-txt={'sci-sub-' + t} style={{ fontFamily: SANS, fontSize: 23, lineHeight: 1.35, color: LUNAR, opacity: 0.72, marginTop: 8 }}>{sub}</div>
    </div>
  );
  const stat = (k: number, v: string, l: string) => (
    <div style={{ opacity: ramp(f, k, k + 12) }}>
      <div data-txt={'stat-' + v} style={{ fontFamily: DISPLAY, fontSize: 60, fontWeight: 300, lineHeight: 1.15, color: LUNAR, letterSpacing: '0.02em' }}>{v}</div>
      <div data-txt={'stat-label-' + v} style={{ fontFamily: SANS, fontSize: 20, color: LUNAR, opacity: 0.78, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>{l}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: OBS }}>
      <AbsoluteFill style={{ flexDirection: 'row', padding: '120px 120px', gap: 90, opacity: textOut }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 44, flex: 1 }}>
          <Kicker id="sci-kicker" o={ramp(f, XF + 2, XF + 14)}>How it works</Kicker>
          {item(XF + 4, 'NASA LOLA TERRAIN', 'Lunar Reconnaissance Orbiter laser altimetry, 80 m polar grid')}
          {item(XF + 16, 'NASA/JPL SPICE', 'Hourly Sun and Earth positions, 2025–2030')}
          {item(XF + 28, 'LANDING-WINDOW ANALYSIS', 'Terrain horizons vs. Sun and Earth, every hour')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, flex: 1.4, borderLeft: `1px solid rgba(233,231,225,${0.25 * ramp(f, 40, 56)})`, paddingLeft: 70 }}>
          <Kicker id="sci-kicker-2" o={ramp(f, 30, 44)}>Validated against NASA reference maps</Kicker>
          <div style={{ width: 820, height: 324, overflow: 'hidden', opacity: ramp(f, 34, 50), clipPath: `inset(0 ${(1 - ramp(f, 34, 62)) * 100}% 0 0)` }}>
            <Img src={staticFile('captures/12-validation.png')} style={{ width: 820, filter: 'grayscale(1) contrast(1.15) brightness(1.1)' }} />
          </div>
          <div style={{ display: 'flex', gap: 70 }}>
            {stat(52, 'r = 0.990', 'Sunlight vs NASA PGDA')}
            {stat(64, 'r = 0.992', 'Earth view vs NASA PGDA')}
          </div>
          <div data-txt="sci-disclaimer" style={{ fontFamily: SANS, fontSize: 22, color: LUNAR, opacity: 0.64 * ramp(f, 72, 86), maxWidth: 780, lineHeight: 1.45 }}>Correlation with published maps (Mazarico et al. 2011). An educational planning tool, not NASA-endorsed or flight-certified.</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Ending: React.FC = () => {
  const f = useCurrentFrame(), L = DURATION - s(25.3);
  const t1 = XF + 4, t2 = s(26.86) - s(25.3), t3 = s(27.3) - s(25.3);
  const [ch1, ch2] = CHALLENGE.split(' · ');
  const credit = (k: number, text: string, strong = false) => (
    <div data-txt={'credit-' + text} style={{ fontFamily: SANS, fontSize: 22, fontWeight: strong ? 600 : 400, color: LUNAR, opacity: (strong ? 0.9 : 0.78) * ramp(f, k, k + 14), letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.7 }}>{text}</div>
  );
  return (
    <AbsoluteFill style={{ background: OBS }}>
      <AbsoluteFill style={{ opacity: ramp(f, 0, 16), transform: 'translate(-420px, -50px)', WebkitMaskImage: 'radial-gradient(ellipse 48% 60% at 50% 50%, #000 70%, transparent 100%)' }}><Seq dir="final" count={130} rate={1} scaleFrom={0.9} scaleTo={0.86} len={L} /></AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(16,17,19,0) 28%, rgba(16,17,19,0.9) 55%)' }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 1040, paddingBottom: 70 }}>
        <div style={{ opacity: ramp(f, t1, t1 + 16), marginBottom: 18 }}><Mark p={ramp(f, t1, t1 + 26)} size={56} /></div>
        <Title text="POLARIS" at={t1} size={92} weight={600} track={[0.24, 0.16]} />
        <Title text="WINDOW" at={t1 + 6} size={92} weight={200} track={[0.24, 0.16]} />
        <div data-txt="tagline" style={{ marginTop: 14, fontFamily: DISPLAY, fontSize: 42, fontWeight: 300, lineHeight: 1.2, color: LUNAR, opacity: ramp(f, t2, t2 + 14), letterSpacing: '0.01em' }}>Find your window to the Moon.</div>
        <div data-txt="url" style={{ marginTop: 34, fontFamily: SANS, fontSize: 26, lineHeight: 1.3, color: LUNAR, opacity: 0.88 * ramp(f, t3, t3 + 14), letterSpacing: '0.04em' }}>{URL}</div>
        <div style={{ marginTop: 16 }}>
          {credit(t3 + 4, ch1)}
          {credit(t3 + 4, ch2)}
          <div style={{ height: 12 }} />
          {credit(t3 + 10, TEAM_NAME, true)}
          {TEAM_MEMBERS.map(m => <React.Fragment key={m}>{credit(t3 + 14, m)}</React.Fragment>)}
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
        <Sequence key={i} from={cut[i]} durationInFrames={cut[i + 1] - cut[i] + (i < 5 ? XF : 0)}>
          <AbsoluteFill style={{ opacity: i === 0 ? 1 : ramp(f, cut[i], cut[i] + XF) }}><S /></AbsoluteFill>
        </Sequence>
      ))}
      <Captions />
      <AbsoluteFill style={{ background: OBS, opacity: ramp(f, DURATION - 6, DURATION) }} />
      <TextCheck />
      <Audio src={staticFile('assets/polaris-voiceover.mp3')} />
      <Audio src={staticFile('assets/ambient.wav')} volume={0.32} />
    </AbsoluteFill>
  );
};
