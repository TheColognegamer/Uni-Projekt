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

// 3) VHF mit Mineralwolle, Alu-UK: Rse = Rsi = 0,13, ΔU = 0,04 -> Ziel 0,20
//    R fehlt = 1/0,20 - 0,26 - 0,49205 = 4,24795 -> d = 14,87 cm -> 16 cm; U = 1/(0,26+0,49205+4,5714)+0,04 = 0,2279
const v = B.daemmdicke(w, 'vhf', 'mw', { uk: 'alu' });
near(v.dTheoretisch, 0.14868, 1e-4, 'VHF Alu theoretisch');
near(v.d, 0.16, 1e-9, 'VHF Alu gerundet');
near(v.uNeu, 0.2279, 1e-3, 'U neu VHF Alu');
assert.ok(v.erfuellt, 'VHF erfüllt GModG');
//    Holz-UK, ΔU = 0,02 -> Ziel 0,22: R fehlt = 3,79340 -> 13,28 cm -> 14 cm
const vh = B.daemmdicke(w, 'vhf', 'mw', { uk: 'holz' });
near(vh.dTheoretisch, 0.13277, 1e-4, 'VHF Holz theoretisch');
near(vh.d, 0.14, 1e-9, 'VHF Holz gerundet');
assert.ok(vh.warnungen.length === 0, 'Mineralwolle in VHF ohne Brandschutz-Warnung');
assert.ok(B.daemmdicke(w, 'vhf', 'eps').warnungen.some((t) => /nichtbrennbar/.test(t)), 'EPS in VHF warnt');

// 4) Je System die 3 Dämmstoffe aus dem Projektkonzept; alle erfüllen nach Rundung den Höchstwert
const varianten = B.variantenWand(w, { vhf: { uk: 'holz' } });
assert.strictEqual(varianten.length, 6, '3 Dämmstoffe je System');
varianten.forEach((x) => assert.ok(x.erfuellt && x.uNeu <= 0.24, `${x.system}/${x.daemmstoff}`));
const beton = B.bestandswand('beton', 0.235);
assert.ok(B.daemmdicke(beton, 'wdvs', 'eps').dTheoretisch > e.dTheoretisch, 'Beton braucht mehr Dämmung als Ziegel');

// 5) Höherer λ (Holzfaser 0,040) -> dickere Dämmung bei gleichem Ziel, exakt im Verhältnis der λ
near(B.daemmdicke(w, 'wdvs', 'holzfaser').dTheoretisch / e.dTheoretisch, 0.040 / 0.035, 1e-9, 'Dicke ∝ λ');

// 6) Fenster nach DIN EN ISO 10077-1: 1,2 x 1,4 m, Rahmenanteil 30 %
//    Ag = 1,176; Af = 0,504; lg = 2·(1,2+1,4)·√0,7 = 4,3506
//    PVC 3-fach: (1,176·0,6 + 0,504·1,1 + 4,3506·0,05)/1,68 = 0,8795
near(B.uwFenster(1.2, 1.4, 0.3, 'pvc', 'dreifach').uw, 0.8795, 1e-3, 'Uw PVC 3-fach');
near(B.uwFenster(1.2, 1.4, 0.3, 'pvc', 'zweifach').uw, 1.2295, 1e-3, 'Uw PVC 2-fach');
//    kleines Fenster 0,6 x 0,8 Holz 2-fach: Randverbund dominiert -> Uw 1,374 > 1,3
near(B.uwFenster(0.6, 0.8, 0.3, 'holz', 'zweifach').uw, 1.374, 1e-3, 'Uw kleines Holz 2-fach');
const ft = B.fensterTausch([{ b: 1.2, h: 1.4 }, { b: 0.6, h: 0.8 }], 'isolier', 'holz', 'zweifach');
assert.strictEqual(ft.erfuellt, false, 'ein Fenster über 1,3 -> Tausch nicht konform');
assert.ok(B.fensterTausch([{ b: 1.2, h: 1.4 }, { b: 0.6, h: 0.8 }], 'isolier', 'holz', 'dreifach').erfuellt, '3-fach konform');
near(ft.flaeche, 1.68 + 0.48, 1e-9, 'Fensterfläche Summe');

// 7) Ungültige Eingaben werfen verständliche Fehler
assert.throws(() => B.bestandswand('vollziegel', 0.06), /zu gering/);
assert.throws(() => B.daemmdicke(w, 'wdvs', 'gibtsnicht'), /Unbekannter Dämmstoff/);

console.log('Varianten Vollziegel 40 cm (U Bestand ' + w.u.toFixed(2) + '):');
varianten.forEach((x) => console.log(`  ${x.system.padEnd(4)} ${x.daemmstoff.padEnd(10)} ${(x.d * 100).toFixed(0)} cm  U = ${x.uNeu.toFixed(3)}`));
console.log('Alle Bauphysik-Tests bestanden.');
