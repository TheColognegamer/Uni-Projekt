/* Plausibilitätsprüfung der Kette Aufmaß -> U-Werte/Dämmdicken -> Fenster -> LCA mit fünf erfundenen Gebäuden.
 * Aufruf: node tests/szenarien.test.js   (gibt eine Tabelle aus; Prüfungen schlagen mit Exit-Code 1 an)
 *
 * Drei Arten von Prüfungen:
 *  H  Handrechnung: eigene, unabhängig hingeschriebene Formel gegen den Code
 *  I  Invariante: Eigenschaft, die immer gelten muss (Summen, Monotonie, 50 a >= 30 a, ...)
 *  G  Größenordnung: Werte liegen in einem üblichen Bereich (Heuristik, KEINE Norm)
 */
const B = require('../src/bauphysik.js');
const L = require('../src/lca.js');

const SZENARIEN = [
  { id: 'S1', name: 'Gründerzeit-MFH', baujahr: 1905, wand: 'vollstein', dicke: 0.38, geschosse: 5, wandNetto: 410,
    fenster: Array(36).fill({ b: 1.10, h: 1.60 }) },
  { id: 'S2', name: 'Zeilenbau 50er (Testgebäude Nord)', baujahr: 1956, wand: 'lochstein', dicke: 0.365, geschosse: 3, wandNetto: 222.5,
    fenster: [...Array(24).fill({ b: 1.35, h: 1.40 }), ...Array(6).fill({ b: 1.45, h: 0.80 }), ...Array(3).fill({ b: 1.00, h: 0.80 })] },
  { id: 'S3', name: 'Einfamilienhaus 70er', baujahr: 1974, wand: 'lochstein', dicke: 0.30, geschosse: 2, wandNetto: 96,
    fenster: [...Array(9).fill({ b: 1.20, h: 1.20 }), ...Array(2).fill({ b: 1.00, h: 2.10 })] },
  { id: 'S4', name: 'MFH 90er, zweischalig mit Dämmung', baujahr: 1991, wand: 'zweischaligDaemm', dicke: 0.36, geschosse: 4, wandNetto: 320,
    fenster: Array(32).fill({ b: 1.25, h: 1.40 }) },
  { id: 'S5', name: 'Neubau 2006', baujahr: 2006, wand: 'lochstein', dicke: 0.365, geschosse: 3, wandNetto: 150,
    fenster: Array(15).fill({ b: 1.30, h: 1.50 }) },
];

const FASSADEN = [
  { label: 'WDVS Mineralwolle', system: 'wdvs', dk: 'mw', konfig: { daemmstoff: 'mw', putz: 'mineralisch' } },
  { label: 'WDVS EPS', system: 'wdvs', dk: 'eps', konfig: { daemmstoff: 'eps', putz: 'mineralisch' } },
  { label: 'WDVS Holzfaser', system: 'wdvs', dk: 'holzfaser', konfig: { daemmstoff: 'holzfaser', putz: 'mineralisch' } },
  { label: 'VHF MW Holz-UK/Holz', system: 'vhf', dk: 'mw', uk: 'holz', konfig: { daemmstoff: 'mw', uk: 'holz', bekleidung: 'holz' } },
  { label: 'VHF MW Alu-UK/Alu', system: 'vhf', dk: 'mw', uk: 'alu', konfig: { daemmstoff: 'mw', uk: 'alu', bekleidung: 'alu' } },
];

const fehler = [], hinweise = [];
let geprueft = 0;
const pruefe = (art, ok, text) => { geprueft++; if (!ok) fehler.push(`[${art}] ${text}`); };
const flag = (text) => hinweise.push(text);
const nah = (a, b, tol) => Math.abs(a - b) <= tol;
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2), f0 = (x) => Math.round(x).toString();
const zeilen = [];
const ergebnisse = {};

for (const s of SZENARIEN) {
  const wand = B.bestandswand(s.baujahr, s.wand, s.dicke);
  const gk = B.gebaeudeklasse(s.geschosse);
  const aF = s.fenster.reduce((a, f) => a + f.b * f.h, 0);
  const res = { wand, gk, aF, fassaden: [] };

  // ---- U-Wert Bestand
  pruefe('G', wand.u >= 0.3 && wand.u <= 2.6, `${s.id}: U Bestand ${wand.u} außerhalb 0,3–2,6 W/(m²K)`);
  pruefe('H', nah(wand.R, 1 / wand.u - 0.13 - 0.04, 1e-9), `${s.id}: R-Wert passt nicht zu U`);

  // ---- Dämmdicke je System: Handrechnung (unabhängig von daemmdicke())
  for (const F of FASSADEN) {
    const dm = B.DAEMMSTOFFE[F.dk], sys = B.SYSTEME[F.system];
    const dU = F.system === 'vhf' ? B.UNTERKONSTRUKTION[F.uk].deltaU : sys.deltaU;
    const di = B.daemmdicke(wand, F.system, F.dk, { gk: gk.key, uk: F.uk });
    // Hand: Rtot_ziel = 1/(0,24 − ΔU); Rtot_alt = 0,13 + R_wand + Rse(System); d = λ · (Rziel − Ralt)
    const rse = F.system === 'vhf' ? 0.13 : 0.04;
    const dHand = Math.max(0, dm.lambda * (1 / (0.24 - dU) - (0.13 + wand.R + rse)));
    pruefe('H', nah(di.dTheoretisch, dHand, 1e-9), `${s.id} ${F.label}: Dämmdicke ${di.dTheoretisch} ≠ Handrechnung ${dHand}`);
    pruefe('I', di.d >= di.dTheoretisch - 1e-9 && di.d - di.dTheoretisch < 0.02 + 1e-9, `${s.id} ${F.label}: Aufrunden auf 2 cm falsch`);
    pruefe('I', di.uNeu <= 0.24 + 1e-9 && di.erfuellt, `${s.id} ${F.label}: U neu ${di.uNeu} > 0,24`);
    pruefe('G', di.d <= 0.30, `${s.id} ${F.label}: Dicke ${di.d} m unüblich groß`);
    res.fassaden.push({ ...F, di });
  }
  // Wärmeleitfähigkeit: schlechterer Dämmstoff braucht mehr Dicke
  const dd = (dk) => res.fassaden.find((x) => x.dk === dk && x.system === 'wdvs').di.dTheoretisch;
  if (dd('mw') > 0) pruefe('I', dd('holzfaser') >= dd('mw') - 1e-12, `${s.id}: Holzfaser (λ 0,04) nicht dicker als MW (λ 0,035)`);
  // VHF mit Alu-UK braucht mehr Dämmung als mit Holz-UK (größeres ΔU)
  const vh = res.fassaden.find((x) => x.uk === 'holz').di.dTheoretisch, va = res.fassaden.find((x) => x.uk === 'alu').di.dTheoretisch;
  if (va > 0) pruefe('I', va >= vh - 1e-12, `${s.id}: Alu-UK braucht weniger Dämmung als Holz-UK`);
  if (s.baujahr >= 2002) pruefe('G', dd('mw') <= 0.12, `${s.id}: Neubau braucht ${dd('mw')} m MW, erwartet wenig`);
  if (s.baujahr >= 1984) flag(`${s.id}: Hinweis „Wand nach 1983“ vorhanden: ${wand.hinweise.some((h) => /1983/.test(h))}`);
  if (s.wand.startsWith('zweischalig')) pruefe('I', res.fassaden[0].di.warnungen.some((w) => /Zweischalig/.test(w)), `${s.id}: Hinweis zweischalige Wand fehlt`);

  // ---- Brandschutz: GK 4–5 darf kein EPS-WDVS ohne Auflage/Abstriche haben (Hinweis ausgeben)
  const eps = res.fassaden.find((x) => x.dk === 'eps').di.brandschutz;
  if (s.geschosse >= 4) pruefe('I', eps && (!eps.zulaessig || !!eps.auflage), `${s.id}: GK ${gk.kurz}: EPS ohne Einschränkung zugelassen`);
  else pruefe('I', eps && eps.zulaessig, `${s.id}: GK ${gk.kurz}: EPS-WDVS müsste zulässig sein`);

  // ---- Fenster
  const opts = B.fensterOptionen(s.fenster, 0.30);
  pruefe('I', nah(opts[0].flaeche, aF, 1e-9), `${s.id}: Fensterfläche ${opts[0].flaeche} ≠ Summe ${aF}`);
  pruefe('I', nah(opts[0].flaecheGlas + opts[0].flaecheRahmen, aF, 1e-9), `${s.id}: Glas + Rahmen ≠ Fensterfläche`);
  for (const o of opts) {
    pruefe('G', o.uwNeu >= 0.7 && o.uwNeu <= 1.6, `${s.id}: Uw ${o.rahmen}/${o.verglasung} = ${f2(o.uwNeu)} außerhalb 0,7–1,6`);
    if (o.verglasung === 'dreifach') pruefe('G', o.uwNeu <= 1.1, `${s.id}: 3-fach Uw ${f2(o.uwNeu)} > 1,1`);
  }
  const uw = (r, v) => opts.find((o) => o.rahmen === r && o.verglasung === v).uwNeu;
  pruefe('I', ['pvc', 'holz', 'holzalu'].every((r) => uw(r, 'dreifach') < uw(r, 'zweifach')), `${s.id}: 3-fach nicht besser als 2-fach`);
  res.opts = opts;

  // ---- LCA je Fassade + Fenster (Holz 3-fach), beide Dickenmodi
  const flaechen = { wandNetto: s.wandNetto, fenster: aF };
  const geo = L.fensterGeometrie(s.fenster, 0.30);
  const fenstKonf = { konfig: { rahmen: 'holz', verglasung: 'dreifach' } };
  for (const F of res.fassaden) {
    for (const modus of ['dTheoretisch', 'd']) {
      const ctx = { fenster: geo, dicke: () => F.di[modus] };
      const g = L.gesamt({ system: F.system, konfig: F.konfig }, fenstKonf, flaechen, ctx);
      F['lca_' + modus] = g;
      for (const T of [30, 50]) {
        pruefe('I', nah(g[T].summe, g[T].opak + g[T].fenster, 1e-6), `${s.id} ${F.label} ${T} a: Summe ≠ opak + Fenster`);
        pruefe('I', nah(g[T].opak, g[T].opakM2 * s.wandNetto, 1e-6), `${s.id} ${F.label} ${T} a: opak ≠ m² × Fläche`);
        pruefe('I', nah(g[T].fenster, g[T].fensterM2 * aF, 1e-6), `${s.id} ${F.label} ${T} a: Fenster ≠ m² × Fläche`);
      }
      pruefe('I', g[50].opakM2 >= g[30].opakM2 - 1e-9 && g[50].fensterM2 >= g[30].fensterM2 - 1e-9, `${s.id} ${F.label}: 50 a < 30 a`);
    }
    const g = F.lca_dTheoretisch;
    // dickere Platte (aufgerundet) hat nie weniger GWP als die theoretische Dicke
    pruefe('I', F.lca_d[30].opakM2 >= g[30].opakM2 - 1e-9, `${s.id} ${F.label}: Plattendicke ergibt weniger GWP als theoretische Dicke`);
    pruefe('G', g[30].opakM2 > 5 && g[30].opakM2 < 130, `${s.id} ${F.label}: GWP 30 a ${f1(g[30].opakM2)} kg/m² außerhalb 5–130`);
  }
  // Skalierung: doppelte Fläche -> doppelte Summe
  const F0 = res.fassaden[0];
  const g2 = L.gesamt({ system: F0.system, konfig: F0.konfig }, fenstKonf, { wandNetto: 2 * s.wandNetto, fenster: 2 * aF }, { fenster: geo, dicke: () => F0.di.dTheoretisch });
  pruefe('I', nah(g2[30].summe, 2 * F0.lca_dTheoretisch[30].summe, 1e-6), `${s.id}: GWP skaliert nicht linear mit der Fläche`);
  ergebnisse[s.id] = { s, ...res };
}

// ---- Vergleiche zwischen den Szenarien
const dMW = (id) => ergebnisse[id].fassaden[0].di.dTheoretisch;
pruefe('I', dMW('S1') >= dMW('S2') - 1e-9 && dMW('S2') >= dMW('S5') - 1e-9, `Dicke nimmt mit dem Baujahr nicht ab (S1 ${dMW('S1')}, S2 ${dMW('S2')}, S5 ${dMW('S5')})`);
pruefe('I', ergebnisse.S1.wand.u > ergebnisse.S5.wand.u, 'Altbau hat nicht den größeren U-Wert als der Neubau');
const gwp = (id, i, m = 'dTheoretisch') => ergebnisse[id].fassaden[i]['lca_' + m][30].opakM2;
pruefe('I', gwp('S1', 0) >= gwp('S5', 0) - 1e-9, 'GWP je m² bei dickerer Dämmung (Altbau) nicht höher als beim Neubau');
pruefe('G', gwp('S2', 4) > gwp('S2', 3), 'VHF mit Alu-UK/Alu-Bekleidung nicht klimaschädlicher als Holz-UK/Holz');

// ---- Ausgabe
console.log('\nBESTAND UND DÄMMUNG (λ MW 0,035; Ziel U ≤ 0,24)');
console.log('Nr  Gebäude                                   Baujahr  Wand            U Best.  GK     Wand netto  Fenster   | MW-WDVS: d theor / Platte / U neu');
for (const s of SZENARIEN) {
  const r = ergebnisse[s.id], d = r.fassaden[0].di;
  console.log(`${s.id}  ${s.name.padEnd(40)}  ${String(s.baujahr).padEnd(7)}  ${(s.wand + ' ' + (s.dicke * 100).toFixed(0) + ' cm').padEnd(16)}${f2(r.wand.u).padStart(5)}    ${r.gk.kurz.padEnd(6)} ${f1(s.wandNetto).padStart(7)} m²  ${f1(r.aF).padStart(5)} m² |  ${f1(d.dTheoretisch * 100).padStart(5)} cm / ${f0(d.d * 100).padStart(3)} cm / ${f2(d.uNeu)}`);
}
console.log('\nDÄMMDICKE (Plattenstärke, cm) je System');
console.log('Nr  ' + FASSADEN.map((F) => F.label.padEnd(20)).join(''));
for (const s of SZENARIEN) console.log(`${s.id}  ` + ergebnisse[s.id].fassaden.map((F) => (f0(F.di.d * 100) + (F.di.brandschutz && !F.di.brandschutz.zulaessig ? ' (unzul.)' : F.di.brandschutz && F.di.brandschutz.auflage ? ' (Auflage)' : '')).padEnd(20)).join(''));
console.log('\nFENSTER Uw neu (Rahmenanteil 30 %, W/(m²K)): PVC 2f / PVC 3f / Holz 2f / Holz 3f / Holz-Alu 2f / 3f');
for (const s of SZENARIEN) { const o = ergebnisse[s.id].opts; console.log(`${s.id}  ` + o.map((x) => f2(x.uwNeu)).join('   ') + `   zulässig: ${o.filter((x) => x.erfuellt).length}/6`); }
console.log('\nLCA GWP-total (kg CO₂-Äq.): je m² Wand | ganze Wand 30 a | 50 a (Fenster Holz 3-fach separat) – Dämmdicke exakt U = 0,24');
console.log('Nr  ' + FASSADEN.map((F) => F.label.padEnd(24)).join(''));
for (const s of SZENARIEN) console.log(`${s.id}  ` + ergebnisse[s.id].fassaden.map((F) => { const g = F.lca_dTheoretisch; return `${f1(g[30].opakM2)}|${f0(g[30].opak)}|${f0(g[50].opak)}`.padEnd(24); }).join(''));
console.log('\nGanze Fassade WDVS-MW inkl. Fenster Holz 3-fach: 30 a / 50 a (kg CO₂-Äq.), je m² Wand netto');
for (const s of SZENARIEN) { const g = ergebnisse[s.id].fassaden[0].lca_dTheoretisch; console.log(`${s.id}  ${f0(g[30].summe).padStart(6)} / ${f0(g[50].summe).padStart(6)}   (${f1(g[30].summe / s.wandNetto)} kg/m² Wand, Fenster-Anteil ${f0(g[30].fenster / g[30].summe * 100)} %)`); }

if (hinweise.length) console.log('\nHinweise:\n  ' + hinweise.join('\n  '));
console.log(`\n${geprueft} Prüfungen, ${fehler.length} Abweichungen`);
if (fehler.length) { console.log(fehler.map((f) => '  ' + f).join('\n')); process.exit(1); }
console.log('Alle Plausibilitätsprüfungen bestanden.');
