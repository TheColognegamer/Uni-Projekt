// Gleiche fünf Szenarien wie tests/szenarien.test.js, aber durch die OBERFLÄCHE (Ereignis 'flaechen', Eingabefelder, Reiter LCA)
// und Abgleich mit dem Rechenkern. Prüft, dass die Verdrahtung nichts verfälscht.
// Aufruf: node tests/szenarien-ui.mjs
import { createRequire } from 'module'; import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); const B = require('../src/bauphysik.js'); const KO = require('../src/kosten.js');
const S = [
  { id: 'S1', baujahr: 1905, wand: 'vollstein', dicke: 38, geschosse: 5, wandNetto: 410, fenster: Array(36).fill({ b: 1.10, h: 1.60 }) },
  { id: 'S2', baujahr: 1956, wand: 'lochstein', dicke: 36.5, geschosse: 3, wandNetto: 222.5, fenster: [...Array(24).fill({ b: 1.35, h: 1.40 }), ...Array(6).fill({ b: 1.45, h: 0.80 }), ...Array(3).fill({ b: 1.00, h: 0.80 })] },
  { id: 'S3', baujahr: 1974, wand: 'lochstein', dicke: 30, geschosse: 2, wandNetto: 96, fenster: [...Array(9).fill({ b: 1.20, h: 1.20 }), ...Array(2).fill({ b: 1.00, h: 2.10 })] },
  { id: 'S4', baujahr: 1991, wand: 'zweischaligDaemm', dicke: 36, geschosse: 4, wandNetto: 320, fenster: Array(32).fill({ b: 1.25, h: 1.40 }) },
  { id: 'S5', baujahr: 2006, wand: 'lochstein', dicke: 36.5, geschosse: 3, wandNetto: 150, fenster: Array(15).fill({ b: 1.30, h: 1.50 }) },
];
const srv = spawn('node', ['server.mjs'], { env: { ...process.env, PORT: '8190', MOCK: '1', ANTHROPIC_API_KEY: '' }, stdio: 'pipe' });
await new Promise((r) => srv.stdout.on('data', (d) => /App:/.test(d) && r()));
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1360, height: 1000 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await pg.goto('http://localhost:8190/');
const probs = []; let n = 0; const ok = (c, t) => { n++; if (!c) probs.push(t); };
const near = (a, b2, tol) => Math.abs(a - b2) <= tol;
for (const s of S) {
  await pg.click('.tabs [data-tab=tabSanierung]');
  await pg.fill('#sBaujahr', String(s.baujahr)); await pg.fill('#sDicke', String(s.dicke)); await pg.fill('#sGeschosse', String(s.geschosse));
  await pg.check(`input[name=sKonstr][value=${s.wand}]`);
  const aF = s.fenster.reduce((a, f) => a + f.b * f.h, 0);
  await pg.evaluate((d) => window.dispatchEvent(new CustomEvent('flaechen', { detail: d })), { aWand: s.wandNetto, aFenster: aF, anzahl: s.fenster.length, fenster: s.fenster });
  await pg.waitForTimeout(250);
  const ui = await pg.evaluate(() => JSON.parse(JSON.stringify(window.SanierungUI.ergebnis())));
  // Rechenkern
  const wand = B.bestandswand(s.baujahr, s.wand, s.dicke / 100), gk = B.gebaeudeklasse(s.geschosse);
  const kern = B.variantenWand(wand, { gk: gk.key, vhf: { uk: 'holz' } });
  ok(!ui.fehler.length, `${s.id}: Fehler in der Oberfläche: ${ui.fehler.join('; ')}`);
  ok(ui.flaechen.quelle === 'aufmass' && near(ui.bezugsflaeche_m2, s.wandNetto, 1e-9), `${s.id}: Fläche aus Aufmaß nicht übernommen (${ui.flaechen.quelle}, ${ui.bezugsflaeche_m2})`);
  ok(near(ui.wand.u, wand.u, 1e-9), `${s.id}: U Bestand UI ${ui.wand.u} ≠ Kern ${wand.u}`);
  ok(ui.gebaeude.gebaeudeklasse === gk.key, `${s.id}: Gebäudeklasse UI ${ui.gebaeude.gebaeudeklasse} ≠ ${gk.key}`);
  ok(ui.varianten.length === kern.length, `${s.id}: Variantenzahl ${ui.varianten.length} ≠ ${kern.length}`);
  kern.forEach((k, i) => {
    const u = ui.varianten[i];
    ok(u.system === k.system && u.daemmstoff === k.daemmstoff && near(u.d, k.d, 1e-9) && near(u.uNeu, k.uNeu, 1e-9) && near(u.dTheoretisch, k.dTheoretisch, 1e-9), `${s.id}: Variante ${k.system}/${k.daemmstoff} weicht ab`);
    ok(near(u.volumen_m3, s.wandNetto * k.d, 1e-9), `${s.id}: Volumen ${k.system}/${k.daemmstoff} ≠ Fläche × Dicke`);
    ok((u.brandschutz && u.brandschutz.zulaessig) === (k.brandschutz && k.brandschutz.zulaessig), `${s.id}: Brandschutz ${k.system}/${k.daemmstoff} weicht ab`);
  });
  const opts = B.fensterOptionen(s.fenster, 0.30);
  ok(ui.fenster && ui.fenster.optionen.length === 6 && ui.fenster.optionen.every((o, i) => near(o.uwNeu, opts[i].uwNeu, 1e-9)), `${s.id}: Fenster-Uw weicht ab`);
  ok(near(ui.fenster.flaeche, aF, 1e-9), `${s.id}: Fensterfläche UI ${ui.fenster.flaeche} ≠ ${aF}`);
  // LCA-Reiter zeigt die gleichen Eingangsgrößen
  await pg.click('.tabs [data-tab=tabLca]'); await pg.waitForTimeout(500);
  const kp = await pg.$$eval('#tabLca .kpi', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  const fmt1 = (x) => x.toFixed(1).replace('.', ',');
  ok(kp.some((t) => t.includes(fmt1(s.wandNetto) + ' m²')), `${s.id}: LCA zeigt Wandfläche ${fmt1(s.wandNetto)} nicht (${kp[0]})`);
  ok(kp.some((t) => t.includes(fmt1(aF) + ' m²')), `${s.id}: LCA zeigt Fensterfläche ${fmt1(aF)} nicht (${kp[1]})`);
  ok(kp.some((t) => t.includes(gk.kurz)), `${s.id}: LCA zeigt Gebäudeklasse ${gk.kurz} nicht`);
  ok(await pg.$$eval('#tabLca svg.chart', (x) => x.length) >= 1, `${s.id}: LCA ohne Diagramm`);
  await pg.click('.tabs [data-tab=tabEmpfehlung]'); await pg.waitForTimeout(400);
  const emp = await pg.evaluate(() => { const r = window.KostenUI.ergebnis(), e = r.empfehlung; return { p: e.premium && e.premium.id, pl: e.preisLeistung && e.preisLeistung.id, u: e.umwelt && e.umwelt.id, lcc: r.kandidaten.map((k) => [k.id, k.lcc.gesamt, k.gwp[50].gesamt]) }; });
  const kE = KO.empfehlung(KO.kandidaten({ bezugsflaeche_m2: s.wandNetto, varianten: kern }), { zeitraum: 50 }), kK = KO.kandidaten({ bezugsflaeche_m2: s.wandNetto, varianten: kern });
  ok(emp.p === kE.premium.id && emp.pl === kE.preisLeistung.id && emp.u === kE.umwelt.id, `${s.id}: Empfehlung UI (${emp.p}/${emp.pl}/${emp.u}) ≠ Kern (${kE.premium.id}/${kE.preisLeistung.id}/${kE.umwelt.id})`);
  ok(emp.lcc.every(([id, lcc, gwp], i) => id === kK[i].id && near(lcc, kK[i].lcc.gesamt, 1e-6) && near(gwp, kK[i].gwp[50].gesamt, 1e-6)), `${s.id}: Kosten/GWP der Oberfläche weichen vom Kern ab`);
  ok(await pg.$$eval('#tabEmpfehlung .rec', (x) => x.length) === 3, `${s.id}: Empfehlungskarten fehlen`);
  console.log(`${s.id}  Oberfläche = Rechenkern: Wand U ${ui.wand.u.toFixed(2)}, MW-WDVS ${(ui.varianten[0].d * 100).toFixed(0)} cm, GK ${gk.kurz}, Empfehlung ${emp.p} / ${emp.pl} / ${emp.u}; LCA-Kennzahlen: ${kp.slice(0, 2).map((t) => t.replace(/\(aus Aufmaß\)/, '').trim()).join(' | ')}`);
}
ok(!errs.length, 'Konsolenfehler: ' + errs.join(' | '));
await b.close(); srv.kill();
console.log(`\n${n} Abgleiche, ${probs.length} Abweichungen`); if (probs.length) { console.log(probs.join('\n')); process.exit(1); }
console.log('Oberfläche und Rechenkern stimmen für alle fünf Szenarien überein.');
