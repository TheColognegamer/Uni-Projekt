// Plumbing-Test der KI-Vorschlags-Strecke mit der ATTRAPPE (MOCK=1): prüft Frontend <-> Server, nicht die Erkennungsqualität.
import { createRequire } from 'module'; import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const photo = process.argv[2], shot = process.argv[3];
const mock = process.env.NOKEY !== '1';
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT: '8123', MOCK: mock ? '1' : '0', ANTHROPIC_API_KEY: '' }, stdio: 'pipe' });
await new Promise((r) => srv.stdout.on('data', (d) => /App:/.test(d) && r()));
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
await pg.goto('http://localhost:8123/');
await pg.setInputFiles('#file', photo); await pg.waitForFunction(() => document.querySelector('#cv').width === 1344);
const box = await pg.locator('#cv').boundingBox();
const click = (p) => pg.mouse.click(box.x + p[0] * box.width / 1344, box.y + p[1] * box.height / 768);
await pg.click('#auto'); await pg.waitForTimeout(800);
const hint = (await pg.textContent('#hint')).trim();
if (mock) {
  await pg.click('[data-tool=calib]'); await pg.fill('#calW', '1.01'); await pg.fill('#calH', '2.01');
  for (const p of [[616, 428], [689, 428], [689, 583], [616, 583]]) await click(p);
}
const t = async (id) => (await pg.textContent(id)).trim();
const res = { hint, fassade: await t('#rFacade'), oeffnungen: await t('#rWin'), netto: await t('#rNet'), n: await pg.$$eval('#shapes li', (l) => l.length), errs };
console.log(JSON.stringify(res, null, 1));
if (shot) await pg.screenshot({ path: shot });
await b.close(); srv.kill();
const ok = mock ? (res.n === 7 && res.fassade.startsWith('61,57') && !errs.length) : /ANTHROPIC_API_KEY/.test(hint);
console.log(ok ? 'OK' : 'FEHLGESCHLAGEN'); process.exit(ok ? 0 : 1);
