// Plumbing-Test der KI-Vorschlags-Strecke mit der ATTRAPPE (MOCK=1): prüft Frontend <-> Server, nicht die Erkennungsqualität.
import { createRequire } from 'module'; import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const photo = process.argv[2], shot = process.argv[3];
const mock = process.env.NOKEY !== '1';
const srv = spawn('node', ['server.mjs'], { env: { ...process.env, PORT: '8123', MOCK: mock ? '1' : '0', ANTHROPIC_API_KEY: '' }, stdio: 'pipe' });
await new Promise((r) => srv.stdout.on('data', (d) => /App:/.test(d) && r()));
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
await pg.goto('http://localhost:8123/');
// Handy-Ablauf: ein Foto aufnehmen -> Erkennung + Auto-Maßstab laufen von selbst
await pg.setInputFiles('#snap', photo); await pg.waitForFunction(() => document.querySelector('#hint').textContent.length > 25 && !document.querySelector('#hint').textContent.includes('analysiert'));
const hint = (await pg.textContent('#hint')).trim();
const t = async (id) => (await pg.textContent(id)).trim();
const res = { hint, warn: await pg.$$eval('#warnings li', (l) => l.map((x) => x.textContent)), fassade: await t('#rFacade'), oeffnungen: await t('#rWin'), netto: await t('#rNet'), n: await pg.$$eval('#shapes li', (l) => l.length), errs };
console.log(JSON.stringify(res, null, 1));
if (shot) await pg.screenshot({ path: shot });
await b.close(); srv.kill();
const ok = mock ? (res.n === 7 && Math.abs(parseFloat(res.fassade.replace(',', '.')) - 57.7) < 0.6 && !errs.length) : /ANTHROPIC_API_KEY/.test(hint);
console.log(ok ? 'OK' : 'FEHLGESCHLAGEN'); process.exit(ok ? 0 : 1);
