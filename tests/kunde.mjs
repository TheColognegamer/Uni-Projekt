// Einfacher Kundenablauf im Browser: Foto -> Angaben -> Empfehlung (Attrappe), Fehlerfall ohne Erkennung, Umschalter zur Expertenansicht.
// Aufruf: node tests/kunde.mjs foto.png [bildordner]
import { createRequire } from 'module'; import { spawn } from 'node:child_process'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const photo = process.argv[2], shots = process.argv[3];
const start = async (port, env) => { const p = spawn('node', ['server.mjs'], { env: { ...process.env, PORT: String(port), ANTHROPIC_API_KEY: '', ...env }, stdio: 'pipe' }); await new Promise((r) => p.stdout.on('data', (d) => /App:/.test(d) && r())); return p; };
const srv = await start(8210, { MOCK: '1' }), srv2 = await start(8211, { MOCK: '0' });
const b = await chromium.launch(); const probs = []; let n = 0; const ok = (c, t) => { n++; if (!c) probs.push(t); };
const sichtbar = (pg, sel) => pg.locator(sel).first().isVisible();
async function lauf(name, viewport, mobil) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 1.5, isMobile: mobil, hasTouch: mobil }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await pg.goto('http://localhost:8210/'); await pg.waitForTimeout(500);
  // Start: einfach, keine Expertenelemente
  ok(await sichtbar(pg, '.k-step[data-step=start]'), `${name}: Startschritt nicht sichtbar`);
  ok(!(await sichtbar(pg, '.topbar .tabs')) && !(await sichtbar(pg, '#tabAufmass')), `${name}: Expertenelemente sichtbar`);
  if (shots) await pg.screenshot({ path: `${shots}/kunde-${name}-1-start.png` });
  // Foto -> Angaben
  await pg.setInputFiles('#snap', photo);
  await pg.waitForSelector('.k-step[data-step=fragen]:not([hidden])', { timeout: 15000 });
  ok(await pg.$eval('#kPreview', (c) => c.width > 100), `${name}: Vorschau leer`);
  ok(!(await sichtbar(pg, '#kBreitePflicht')), `${name}: Breite fälschlich Pflicht`);
  await pg.fill('#kBaujahr', '1956'); await pg.click('[data-g="1"]'); await pg.click('[data-g="-1"]');
  if (shots) await pg.screenshot({ path: `${shots}/kunde-${name}-2-angaben.png` });
  await pg.click('#kWeiter'); await pg.waitForSelector('.k-step[data-step=ergebnis]:not([hidden])');
  const cards = await pg.$$eval('.k-card', (e) => e.map((x) => ({ t: x.querySelector('h3').textContent, l: [...x.querySelectorAll('.k-label')].map((y) => y.textContent).join(' + '), p: x.querySelector('.k-preis').textContent })));
  ok(cards.length === 3 && cards.every((c) => /^ca\. [\d.]+ €$/.test(c.p)), `${name}: drei Karten mit Preis erwartet, bekommen ${JSON.stringify(cards)}`);
  const kern = await pg.evaluate(() => { const e = window.KostenUI.ergebnis().empfehlung; return [e.premium.id, e.preisLeistung.id, e.umwelt.id]; });
  const tit = { 'wdvs-mw': 'Wärmedämmverbundsystem mit Mineralwolle', 'vhf-mw': 'Vorgehängte Fassade mit Mineralwolle' };
  ok(cards[0].t === (tit[kern[0]] || cards[0].t) && cards[1].t === (tit[kern[1]] || cards[1].t), `${name}: Karten passen nicht zum Kern (${kern})`);
  const woerter = (await pg.$eval('.kunde', (e) => e.innerText)).split(/\s+/).filter(Boolean).length;
  console.log(`${name}: Ergebnis ${cards.map((c) => c.l + ': ' + c.t + ' ' + c.p).join(' | ')}; sichtbare Wörter im Ergebnis: ${woerter}`);
  ok(woerter < 260, `${name}: zu viel Text im Ergebnis (${woerter} Wörter)`);
  await pg.waitForTimeout(900); if (shots) await pg.screenshot({ path: `${shots}/kunde-${name}-3-ergebnis.png`, fullPage: true });
  // Breite angeben ändert die Rechnung und die Genauigkeitsangabe
  const preis1 = cards[0].p;
  await pg.click('#kAendern'); await pg.fill('#kBreite', '12'); await pg.click('#kWeiter'); await pg.waitForSelector('.k-step[data-step=ergebnis]:not([hidden])');
  const preis2 = await pg.$eval('.k-card .k-preis', (e) => e.textContent);
  ok(preis2 !== preis1, `${name}: Breite hat keinen Einfluss (${preis1} / ${preis2})`);
  ok(/±5 %/.test(await pg.$eval('.k-fuss', (e) => e.textContent)), `${name}: Genauigkeitsangabe für gemessene Breite fehlt`);
  // Fensterbreite statt Wandbreite
  await pg.click('#kAendern'); await pg.fill('#kBreite', ''); await pg.fill('#kFenster', '1,2'); await pg.click('#kWeiter'); await pg.waitForSelector('.k-step[data-step=ergebnis]:not([hidden])');
  ok(/±8 %/.test(await pg.$eval('.k-fuss', (e) => e.textContent)), `${name}: Genauigkeitsangabe für Fensterbreite fehlt`);
  // Umschalter Expertenansicht
  await pg.click('#modeBtn'); await pg.waitForTimeout(200);
  ok((await sichtbar(pg, '.topbar .tabs')) && (await sichtbar(pg, '#tabAufmass')) && !(await sichtbar(pg, '#kunde')), `${name}: Expertenansicht nicht sichtbar`);
  await pg.click('#modeBtn'); await pg.waitForTimeout(200);
  ok(await sichtbar(pg, '#kunde') && !(await sichtbar(pg, '.topbar .tabs')), `${name}: Rückschalten fehlgeschlagen`);
  ok(!errs.length, `${name}: Konsolenfehler ${errs.join(' | ')}`);
  await ctx.close();
}
await lauf('desktop', { width: 1280, height: 860 }, false);
await lauf('handy', { width: 390, height: 844 }, true);
// Demo-Modus: Server ohne Schlüssel (kein MOCK) -> Beispielhaus statt Fehler; eigene Fotos werden verständlich abgelehnt
{ const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto('http://localhost:8211/'); await pg.waitForSelector('#kDemoHinweis:not([hidden])', { timeout: 5000 });
  ok(await pg.$eval('#kBeispiel', (e) => e.classList.contains('btn-primary')), 'Demo: Beispielhaus nicht als Hauptaktion');
  await pg.waitForTimeout(900); if (shots) await pg.screenshot({ path: `${shots}/kunde-demo-start.png` });
  await pg.click('#kBeispiel'); await pg.waitForSelector('.k-step[data-step=fragen]:not([hidden])', { timeout: 8000 });
  ok(/Beispielhaus/.test(await pg.textContent('#kMock')) && await sichtbar(pg, '#kMock'), 'Demo: Kennzeichnung Beispielhaus fehlt');
  await pg.click('#kWeiter'); await pg.waitForSelector('.k-step[data-step=ergebnis]:not([hidden])');
  const dk = await pg.$$eval('.k-card', (e) => e.length), dtext = await pg.$eval('.kunde', (e) => e.innerText);
  ok(dk >= 2 && /Beispielrechnung/.test(dtext) && /5[01] m²/.test(dtext), `Demo-Ergebnis unvollständig (Karten ${dk}, Text: ${dtext.slice(0, 160)})`);
  await pg.waitForTimeout(900); if (shots) await pg.screenshot({ path: `${shots}/kunde-demo-ergebnis.png`, fullPage: true });
  await pg.click('#kNeu'); await pg.setInputFiles('#snap', photo); await pg.waitForSelector('.k-step[data-step=fehler]:not([hidden])', { timeout: 15000 });
  const text = await pg.textContent('#kFehlerText'); ok(/Schlüssel/.test(text) && !/ANTHROPIC|npm|503/.test(text), `Demo: Fehlertext ungeeignet für Kunden: ${text}`);
  ok(await sichtbar(pg, '#kFehlerBeispiel'), 'Demo: Beispielhaus-Knopf im Fehlerfall fehlt');
  await pg.click('#kFehlerBeispiel'); await pg.waitForSelector('.k-step[data-step=fragen]:not([hidden])', { timeout: 8000 });
  ok(!errs.length, 'Demo: Konsolenfehler ' + errs.join(' | ')); await ctx.close(); }
// Ganz ohne Server (nur statische Dateien, z. B. python -m http.server): Demo läuft trotzdem
{ const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  const stat = http.createServer((q, r) => { const u = q.url.split('?')[0], f = path.join(process.cwd(), u === '/' ? 'index.html' : u);
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); }).listen(8213);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto('http://localhost:8213/'); await pg.waitForSelector('#kDemoHinweis:not([hidden])', { timeout: 5000 });
  await pg.click('#kBeispiel'); await pg.waitForSelector('.k-step[data-step=fragen]:not([hidden])', { timeout: 8000 });
  await pg.click('#kWeiter'); await pg.waitForSelector('.k-step[data-step=ergebnis]:not([hidden])');
  ok((await pg.$$eval('.k-card', (e) => e.length)) >= 2, 'Ohne Server: Demo liefert keine Karten');
  ok(!errs.length, 'Ohne Server: Konsolenfehler ' + errs.join(' | ')); await ctx.close(); stat.close(); }
await b.close(); srv.kill(); srv2.kill();
console.log(`\n${n} Prüfungen, ${probs.length} Abweichungen`); if (probs.length) { console.log(probs.join('\n')); process.exit(1); }
console.log('Kundenablauf OK');
