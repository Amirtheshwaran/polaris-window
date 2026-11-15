// node orb.js <name> <frames> <test?> ; camera path in spherical coords around origin (pole)
const { chromium } = require('playwright'); const fs = require('fs');
const [,, name, nf, test] = process.argv; const N = +nf;
const OUT = `/home/user/pw-repo/demo-video/captures/${name}`; fs.mkdirSync(OUT, { recursive: true });
const PATHS = { // [dist0,dist1, polar0,polar1 (deg from +Y), az0,az1]
  approach: [3800, 650, 88, 50, 10, 10, 470, 0],
  limb: [3600, 3300, 84, 80, 120, 150],
  final: [3800, 3550, 88, 86, 22, 6, 470, 470],
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('console', m => m.type()==='error' && console.log('ERR', m.text()));
  await p.goto('http://127.0.0.1:8000/#site=ridge&t=2027-03-01T00&tab=site', { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForFunction(() => window.PW, null, { timeout: 180000 }); await p.waitForTimeout(4000);
  await p.evaluate(`(async()=>{ window.SC = await import('./js/scene.js'); SC.overview(); SC.setMarkers([],null,()=>{}); SC.setRegions([],null); })()`);
  await p.waitForTimeout(3000);
  const P = PATHS[name]; const idx = test ? [0, Math.floor(N/2), N-1] : [...Array(N).keys()];
  for (const i of idx) {
    const url = await p.evaluate(async ([i, N, P]) => {
      const k = i / (N - 1), e = k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2, L = (a, b) => a + (b - a) * e;
      const d = L(P[0], P[1]), po = L(P[2], P[3]) * Math.PI / 180, az = L(P[4], P[5]) * Math.PI / 180;
      const c=SC.S.camera; c.position.set(d * Math.sin(po) * Math.cos(az), d * Math.cos(po), d * Math.sin(po) * Math.sin(az)); const off=L(P[6]||0,P[7]||0); c.setViewOffset(1920,1036,0,off,1920,1036);
      for (let j = 0; j < 3; j++) await new Promise(r => requestAnimationFrame(r));
      return SC.snapshot();
    }, [i, N, P]);
    fs.writeFileSync(`${OUT}/${String(i).padStart(3, '0')}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log(name, 'done'); await b.close();
})();
