// Plumbing-Test der KI-Vorschlags-Strecke mit der ATTRAPPE (MOCK=1): prüft Frontend <-> Server, nicht die Erkennungsqualität.
import { createRequire } from 'module'; import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const photo = process.argv[2], shot = process.argv[3];
const mock = process.env.NOKEY !== '1';
const srv = spawn('node', ['server.mjs'], { env: { ...process.env, PORT: '8123', MOCK: mock ? '1' : '0', ANTHROPIC_API_KEY: '' }, stdio: 'pipe' });
await new Promise((r) => srv.stdout.on('data', (d) => /App:/.test(d) && r()));
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
await pg.addInitScript(() => { window.__fl = null; window.addEventListener('flaechen', (e) => { window.__fl = e.detail; }); });
await pg.goto('http://localhost:8123/');
// Handy-Ablauf: ein Foto aufnehmen -> Erkennung + Auto-Maßstab laufen von selbst
await pg.setInputFiles('#snap', photo); await pg.waitForFunction(() => document.querySelector('#hint').textContent.length > 25 && !document.querySelector('#hint').textContent.includes('analysiert'));
const hint = (await pg.textContent('#hint')).trim();
// Schnittstelle 'flaechen' (docs/schnittstelle-aufmass.md): Felder und Werte prüfen
let ifaceOk = true;
if (mock) {
  const d = await pg.evaluate(() => window.__fl);
  const net = parseFloat((await pg.textContent('#rNet')).replace(',', '.'));
  ifaceOk = !!d && Math.abs(d.aWand - net) < 0.02 && d.fenster.length === 5 && d.tueren.length === 1 && d.anzahl === 6 &&
    d.fenster.every((f) => f.b > 0.5 && f.b < 3 && f.h > 0.5 && f.h < 3) && d.tueren[0].h > 1.5 && d.quelle === 'foto' && Array.isArray(d.massstab.spanneWand_m2);
  console.log('Ereignis flaechen:', JSON.stringify({ aWand: d && +d.aWand.toFixed(2), aFenster: d && +d.aFenster.toFixed(2), anzahl: d && d.anzahl, fenster: d && d.fenster.length, tueren: d && d.tueren.length }), ifaceOk ? 'ok' : 'FEHLER');
}
// Standard: KI schätzt den Maßstab (Attrappe: Haustür 2,01 m) -> 55,27 m², Spanne sichtbar
const num = async (id) => parseFloat((await pg.textContent(id)).replace(',', '.'));
let modesOk = true;
if (mock) {
  const est = await num('#rFacade'); const range = (await pg.textContent('#rRange')).trim(); const refsN = await pg.$$eval('#refs li', (l) => l.length);
  console.log('Schätzung:', est, 'Spanne:', range, 'Referenzen:', refsN);
  modesOk = Math.abs(est - 55.27) < 0.6 && /–/.test(range) && refsN === 2;
  // Nachträglicher Wechsel ohne neuen Erkennungsaufruf: Fassadenbreite 10 m -> 53,9 m²; Tür (Annahme) -> 57,7 m²
  await pg.check('input[name=amode][value=width]'); await pg.fill('#autoW', '10'); await pg.waitForTimeout(200);
  const fw = await num('#rFacade'); modesOk &&= Math.abs(fw - 53.9) < 0.6; console.log('Breite 10 m:', fw);
  await pg.check('input[name=amode][value=door]'); await pg.waitForTimeout(200);
  const fd = await num('#rFacade'); modesOk &&= Math.abs(fd - 57.7) < 0.6; console.log('Tür-Annahme:', fd);
}
const t = async (id) => (await pg.textContent(id)).trim();
const res = { hint, warn: await pg.$$eval('#warnings li', (l) => l.map((x) => x.textContent)), fassade: await t('#rFacade'), oeffnungen: await t('#rWin'), netto: await t('#rNet'), n: await pg.$$eval('#shapes li', (l) => l.length), errs };
console.log(JSON.stringify(res, null, 1));
if (shot) await pg.screenshot({ path: shot });
await b.close(); srv.kill();
const ok = mock ? (res.n === 7 && modesOk && ifaceOk && !errs.length) : /ANTHROPIC_API_KEY/.test(hint);
console.log(ok ? 'OK' : 'FEHLGESCHLAGEN'); process.exit(ok ? 0 : 1);
