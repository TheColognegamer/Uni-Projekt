const assert = require('assert');
const B = require('../src/bauphysik.js');
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// 1) Amtliche Pauschalwerte (Bekanntmachung Datenaufnahme 2020, Tab. 2)
assert.strictEqual(B.bestandswand(1955, 'vollstein', 0.38).u, 1.5, '1949–57 Vollstein über 30 cm');
assert.strictEqual(B.bestandswand(1955, 'vollstein', 0.25).u, 1.8, '1949–57 Vollstein 20–30 cm');
assert.strictEqual(B.bestandswand(1950, 'sonstige', 0.18).u, 3.0, '1949–57 sonstige bis 20 cm');
assert.strictEqual(B.bestandswand(1962, 'lochstein', 0.30).u, 1.4, '1958–68 Hochloch/Bims-Hohlstein');
assert.strictEqual(B.bestandswand(1970, 'lochstein', 0.30).u, 1.0, '1969–78 Hochloch/Bims-Hohlstein');
assert.strictEqual(B.bestandswand(1972, 'zweischaligDaemm', 0.36).u, 0.9, '1969–78 zweischalig mit Dämmung');
//    Vollstein ab 1958: Tabelle „keine Angabe“ -> Ersatz „sonstige massive Wandaufbauten“ mit Hinweis
const ers = B.bestandswand(1962, 'vollstein', 0.36);
assert.strictEqual(ers.u, 1.4); assert.strictEqual(ers.konstruktion, 'sonstige'); assert.ok(ers.hinweise.length === 1);
assert.throws(() => B.bestandswand(1940, 'lochstein', 0.3), /1949–1978/);
assert.throws(() => B.bestandswand(1960, 'lochstein', 0.05), /Wandstärke/);

// 2) WDVS EPS auf Vollstein 1955, 38 cm: R Wand = 1/1,5 − 0,17 = 0,49667
//    R fehlt = 1/0,24 − 0,17 − 0,49667 = 3,5 -> d = 12,25 cm -> 14 cm; U = 1/(0,17 + 0,49667 + 4,0) = 0,2143
const w = B.bestandswand(1955, 'vollstein', 0.38);
near(w.R, 0.49667, 1e-4, 'R Wand');
const e = B.daemmdicke(w, 'wdvs', 'eps');
near(e.dTheoretisch, 0.1225, 1e-4, 'EPS theoretisch');
near(e.d, 0.14, 1e-9, 'EPS gerundet');
near(e.uNeu, 0.2143, 1e-3, 'U neu WDVS');

// 3) VHF Mineralwolle, Alu-UK (ΔU 0,04) auf Bims-Hohlstein 1962: R Wand = 1/1,4 − 0,17 = 0,54429
//    R fehlt = 1/0,20 − 0,26 − 0,54429 = 4,19571 -> 14,69 cm -> 16 cm; U = 1/(0,26+0,54429+4,57143)+0,04 = 0,2260
const wl = B.bestandswand(1962, 'lochstein', 0.30);
const v = B.daemmdicke(wl, 'vhf', 'mw', { uk: 'alu' });
near(v.dTheoretisch, 0.14685, 1e-4, 'VHF Alu theoretisch');
near(v.d, 0.16, 1e-9, 'VHF Alu gerundet');
near(v.uNeu, 0.2260, 1e-3, 'U neu VHF Alu');
assert.ok(B.daemmdicke(wl, 'vhf', 'mw', { uk: 'holz' }).d <= v.d, 'Holz-UK braucht nicht mehr als Alu');
assert.ok(B.daemmdicke(wl, 'vhf', 'eps').warnungen.some((t) => /nichtbrennbar/.test(t)), 'EPS in VHF warnt');

// 4) Alle 6 Varianten erfüllen nach Rundung U <= 0,24; Dicke proportional zu λ
const varianten = B.variantenWand(wl, { vhf: { uk: 'holz' } });
assert.strictEqual(varianten.length, 6);
varianten.forEach((x) => assert.ok(x.erfuellt && x.uNeu <= 0.24, `${x.system}/${x.daemmstoff}`));
near(B.daemmdicke(wl, 'wdvs', 'holzfaser').dTheoretisch / B.daemmdicke(wl, 'wdvs', 'eps').dTheoretisch, 0.040 / 0.035, 1e-9, 'Dicke ∝ λ');
assert.ok(B.daemmdicke(B.bestandswand(1972, 'zweischalig', 0.36), 'wdvs', 'mw').warnungen.some((t) => /Kerndämmung/.test(t)), 'Hinweis Kerndämmung');

// 5) Fenster nach DIN EN ISO 10077-1: 1,2 x 1,4 m, Rahmenanteil 30 %
//    PVC 3-fach: (1,176·0,6 + 0,504·1,1 + 4,3506·0,05)/1,68 = 0,8795
near(B.uwFenster(1.2, 1.4, 0.3, 'pvc', 'dreifach').uw, 0.8795, 1e-3, 'Uw PVC 3-fach');
near(B.uwFenster(1.2, 1.4, 0.3, 'pvc', 'zweifach').uw, 1.2295, 1e-3, 'Uw PVC 2-fach');
near(B.uwFenster(0.6, 0.8, 0.3, 'holz', 'zweifach').uw, 1.374, 1e-3, 'Uw kleines Holz 2-fach');
const ft = B.fensterTausch([{ b: 1.2, h: 1.4 }, { b: 0.6, h: 0.8 }], 'holz', 'zweifach');
assert.strictEqual(ft.erfuellt, false, 'ein Fenster über 1,3 -> nicht konform');
near(ft.flaeche, 2.16, 1e-9, 'Fensterfläche'); near(ft.flaecheGlas + ft.flaecheRahmen, 2.16, 1e-9, 'Glas + Rahmen');
const opt = B.fensterOptionen([{ b: 1.2, h: 1.4 }]);
assert.strictEqual(opt.length, 6, '3 Rahmen × 2 Verglasungen');

console.log('Varianten Bims-Hohlstein 1962, 30 cm (U Bestand ' + wl.u + '):');
varianten.forEach((x) => console.log(`  ${x.system.padEnd(4)} ${x.daemmstoff.padEnd(10)} ${(x.dTheoretisch * 100).toFixed(1)} → ${(x.d * 100).toFixed(0)} cm  U = ${x.uNeu.toFixed(3)}`));
console.log('Alle Bauphysik-Tests bestanden.');
