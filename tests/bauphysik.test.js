const assert = require('assert');
const B = require('../src/bauphysik.js');
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// 1) Bestand: Vollziegel 36,5 cm + 1,5 cm Innenputz + 2 cm Außenputz = 40 cm gesamt (Handrechnung)
//    R = 0,015/0,70 + 0,365/0,81 + 0,020/1,00 = 0,49205 m²K/W;  U = 1/(0,13 + 0,49205 + 0,04) = 1,5105
const w = B.bestandswand('vollziegel', 0.40);
near(w.dMauer, 0.365, 1e-9, 'Mauerwerksdicke');
near(w.R, 0.49205, 1e-4, 'R Bestand');
near(w.u, 1.5105, 1e-3, 'U Bestand');

// 2) WDVS mit EPS 035: R fehlt = 1/0,24 - 0,13 - 0,04 - 0,49205 = 3,50462 -> d = 12,27 cm -> 14 cm (2-cm-Stufen)
const e = B.daemmdicke(w, 'wdvs', 'eps');
near(e.dTheoretisch, 0.12266, 1e-4, 'EPS theoretisch');
near(e.d, 0.14, 1e-9, 'EPS gerundet');
near(e.uNeu, 0.2145, 1e-3, 'U neu WDVS');
assert.ok(e.erfuellt, 'WDVS erfüllt GModG');

// 3) VHF mit Mineralwolle: Rse = Rsi = 0,13, ΔU = 0,03 -> Ziel 0,21
//    R fehlt = 1/0,21 - 0,26 - 0,49205 = 4,00985 -> d = 14,03 cm -> 16 cm; U = 1/(0,26+0,49205+4,5714)+0,03 = 0,2179
const v = B.daemmdicke(w, 'vhf', 'mw');
near(v.dTheoretisch, 0.14034, 1e-4, 'VHF theoretisch');
near(v.d, 0.16, 1e-9, 'VHF gerundet');
near(v.uNeu, 0.2179, 1e-3, 'U neu VHF');
assert.ok(v.erfuellt, 'VHF erfüllt GModG');

// 4) Jede Variante erfüllt nach Rundung den Höchstwert; schlechtere Wand braucht mehr Dämmung
const varianten = B.variantenWand(w);
assert.strictEqual(varianten.length, 6, '3 Dämmstoffe je System');
varianten.forEach((x) => assert.ok(x.erfuellt && x.uNeu <= 0.24, `${x.system}/${x.daemmstoff}`));
const beton = B.bestandswand('beton', 0.235);
assert.ok(B.daemmdicke(beton, 'wdvs', 'eps').dTheoretisch > e.dTheoretisch, 'Beton braucht mehr Dämmung als Ziegel');

// 5) Höherer λ (Holzfaser) -> dickere Dämmung bei gleichem Ziel
assert.ok(B.daemmdicke(w, 'wdvs', 'holzfaser').dTheoretisch > e.dTheoretisch, 'Holzfaser dicker als EPS');

// 6) Fenster: alle neuen Typen unter 1,3; Eingabe-Override wird geprüft
['kunststoff', 'holz', 'holzalu'].forEach((k) => assert.ok(B.fensterTausch(10, 4, 'isolier', k).erfuellt, k));
assert.strictEqual(B.fensterTausch(10, 4, 'isolier', 'holz', { uw: 1.4 }).erfuellt, false, 'Uw 1,4 nicht zulässig');

// 7) Ungültige Eingaben werfen verständliche Fehler
assert.throws(() => B.bestandswand('vollziegel', 0.06), /zu gering/);
assert.throws(() => B.daemmdicke(w, 'wdvs', 'gibtsnicht'), /Unbekannter Dämmstoff/);

console.log('Varianten Vollziegel 40 cm (U Bestand ' + w.u.toFixed(2) + '):');
varianten.forEach((x) => console.log(`  ${x.system.padEnd(4)} ${x.daemmstoff.padEnd(10)} ${(x.d * 100).toFixed(0)} cm  U = ${x.uNeu.toFixed(3)}`));
console.log('Alle Bauphysik-Tests bestanden.');
