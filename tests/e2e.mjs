// Smoke-Test im Headless-Chromium: Demo laden, Wand kalibrieren, Fassade + 4 Fenster klicken, Ergebnis prüfen.
import { createRequire } from 'module';
import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(new URL('..', import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); } });
}).listen(0);
const port = srv.address().port;
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1300, height: 900 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await pg.goto(`http://localhost:${port}/`);
await pg.click('#demo'); await pg.waitForFunction(() => window.__demo);
const demo = await pg.evaluate(() => window.__demo);
const box = await pg.locator('#cv').boundingBox();
const toScr = (p) => [box.x + p[0] * box.width / 1200, box.y + p[1] * box.height / 800];
const click = async (p) => { const [x, y] = toScr(p); await pg.mouse.click(x, y); };
for (const p of demo.wallImg) await click(p);                       // Maßstab = ganze Wand 10x6
await pg.click('[data-tool=facade]'); for (const p of demo.wallImg) await click(p); await pg.click('#finish');
await pg.click('[data-tool=window]');
// Fenster aus Wahrheits-Homographie ableiten (im Seitenkontext)
const wins = await pg.evaluate(() => {
  const G = window.Geometry, d = window.__demo;
  const h = G.homography([[0, 0], [10, 0], [10, 6], [0, 6]], d.wallImg);
  return [[1, 1.2], [3.2, 1.2], [5.8, 1.2], [8, 1.2]].map(([x, y]) => [[x, y], [x + 1.2, y], [x + 1.2, y + 1.4], [x, y + 1.4]].map((p) => G.applyH(h, p)));
});
for (const w of wins) { for (const p of w) await click(p); await pg.click('#finish'); }
const txt = async (id) => (await pg.textContent(id)).replace(',', '.');
const F = parseFloat(await txt('#rFacade')), Wn = parseFloat(await txt('#rWin')), N = parseFloat(await txt('#rNet'));
console.log({ F, Wn, N, dFacade: await pg.textContent('#dFacade'), dWin: await pg.textContent('#dWin'), errs });
await pg.screenshot({ path: process.argv[2] || 'screenshot.png' });
await b.close(); srv.close();
const ok = Math.abs(F - 60) < 0.6 && Math.abs(Wn - 6.72) < 0.15 && Math.abs(N - 53.28) < 0.6 && !errs.length;
console.log(ok ? 'E2E OK' : 'E2E FEHLGESCHLAGEN'); process.exit(ok ? 0 : 1);
