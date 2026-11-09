const assert = require('assert');
const G = require('../src/geometry.js');
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// 1) Homographie bildet die 4 Stützpunkte exakt ab
const src = [[160, 120], [1020, 190], [1000, 700], [180, 640]];
const dst = [[0, 0], [10, 0], [10, 6], [0, 6]];
const H = G.homography(src, dst);
src.forEach((p, i) => { const q = G.applyH(H, p); near(q[0], dst[i][0], 1e-6, 'x'); near(q[1], dst[i][1], 1e-6, 'y'); });

// 2) Synthetisch: bekannte Wand 10x6 m, Fenster 1.2x1.4 m, perspektivisch projiziert -> Fläche muss zurückkommen
const Hinv = G.homography(dst, src); // metrisch -> Bild
const proj = (poly) => poly.map((p) => G.applyH(Hinv, p));
const win = [[2, 1], [3.2, 1], [3.2, 2.4], [2, 2.4]];
const cal = G.calibrationFromRect(src, 10, 6);
near(G.areaMetric(cal, src), 60, 1e-6, 'Wandfläche');
near(G.areaMetric(cal, proj(win)), 1.2 * 1.4, 1e-6, 'Fensterfläche');

// 3) Referenzrechteck = Tür (1x2 m): Fenster bleibt korrekt, Fehler wächst aber mit Klickrauschen
const door = [[4.5, 4], [5.5, 4], [5.5, 6], [4.5, 6]];
const calDoor = G.calibrationFromRect(proj(door), 1, 2);
near(G.areaMetric(calDoor, proj(win)), 1.68, 1e-6, 'Fenster via Tür-Kalibrierung (ohne Rauschen)');

// 4) Fallback-Maßstab: bei frontaler Aufnahme exakt
const calLine = G.calibrationFromLine([0, 0], [100, 0], 2); // 100 px = 2 m
near(G.areaMetric(calLine, [[0, 0], [100, 0], [100, 50], [0, 50]]), 2 * 1, 1e-9, 'Linien-Maßstab');

// 5) Selbstüberschneidung
assert.strictEqual(G.selfIntersects([[0, 0], [1, 1], [1, 0], [0, 1]]), true);
assert.strictEqual(G.selfIntersects([[0, 0], [1, 0], [1, 1], [0, 1]]), false);

// 6) Sensitivität: 2 px Klickrauschen bei Wand-Kalibrierung vs. Tür-Kalibrierung (Monte-Carlo, fester Seed)
let seed = 42; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 4; // ±2 px
function err(calPts, w, h) {
  let sum = 0; const N = 500;
  for (let i = 0; i < N; i++) {
    const noisy = calPts.map((p) => [p[0] + rnd(), p[1] + rnd()]);
    const c = G.calibrationFromRect(noisy, w, h);
    sum += Math.abs(G.areaMetric(c, proj(win)) - 1.68) / 1.68;
  }
  return sum / N;
}
const eWall = err(src, 10, 6), eDoor = err(proj(door), 1, 2);
console.log(`Mittlerer Fensterflächenfehler bei ±2px Klickrauschen: Wand-Kalibrierung ${(eWall * 100).toFixed(1)} %, Tür-Kalibrierung ${(eDoor * 100).toFixed(1)} %`);
assert.ok(eWall < eDoor, 'Große Referenz soll robuster sein als kleine');
console.log('Alle Geometrie-Tests bestanden.');
