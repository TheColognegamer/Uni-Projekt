/* Prüft den LCA-Rechenkern gegen die Excel LCA_Fassadensanierung_WDVS_VHF.xlsx (Startwerte der Dicken).
 * Aufruf: node tests/lca.test.js
 * Werden Annahmen in src/lca-data.js bewusst geändert (z. B. Nutzungsdauern), hier die Sollwerte anpassen. */
const assert = require('assert');
const D = require('../src/lca-data.js');
const L = require('../src/lca.js');
const B = require('../src/bauphysik.js');
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// 1) Austauschzyklen: n = ABRUNDEN((T − 1) / RSL)
assert.strictEqual(L.austausch(30, 40), 0);
assert.strictEqual(L.austausch(50, 40), 1);
assert.strictEqual(L.austausch(50, 50), 0);
assert.strictEqual(L.austausch(30, 30), 0);
assert.strictEqual(L.austausch(50, 30), 1);
assert.throws(() => L.austausch(30, 0), /Nutzungsdauer/);

// 2) Fenstergeometrie Normfenster 1,23 × 1,48 m (Blatt Parameter)
const fg = L.fensterGeometrie();
near(fg.blendrahmen, 2.9773676115, 1e-9, 'Blendrahmen m/m²');
near(fg.fluegelrahmen, 2.7576356845, 1e-9, 'Flügelrahmen m/m²');
near(fg.glas, 0.7, 1e-12, 'Glasanteil');
near(fg.beschlag, 0.5493298176, 1e-9, 'Beschläge Stk/m²');

// 3) Einzelne Schichten (Blatt LCA_Schichten)
const sch = (sys, code) => D.SCHICHTEN[sys].find((s) => s.code === code);
const mw = L.schichtGwp(sch('wdvs', 'W-D-MW'), 50);
near(mw.menge, 0.1648, 1e-12, 'Menge MW WDVS');
near(mw.herstellung, 19.90784, 1e-9, 'A1–A3 MW WDVS');
near(mw.total, 40.53780064, 1e-8, 'GWP 50 a MW WDVS');
near(L.schichtGwp(sch('wdvs', 'W-ARM'), 30).menge, 6.72, 1e-9, 'Armierung kg/m² = d · ρ · (1+f)');
near(L.schichtGwp(sch('vhf', 'V-B-ALU'), 30).total, 61.07157, 1e-8, 'Alublech 30 a');
near(L.schichtGwp(sch('fenster', 'F-R-PVC-B'), 50).total, 66.568580532, 1e-8, 'PVC-Blendrahmen 50 a');

// 4) Alle Varianten je m² (Blatt Variantenvergleich, Spalten G/H)
const SOLL_FASSADE = {
  'WDVS Mineralwolle / mineralischer Putz': [29.27813454, 58.55626908],
  'WDVS Mineralwolle / Silikatputz': [30.38472324, 60.76944648],
  'WDVS EPS / mineralischer Putz': [25.05910622, 50.11821244],
  'WDVS EPS / Silikatputz': [26.16569492, 52.33138984],
  'WDVS Holzfaser / mineralischer Putz': [24.50311222, 49.00622444],
  'WDVS Holzfaser / Silikatputz': [25.60970092, 51.21940184],
  'VHF Mineralwolle / Holz-UK / Holzbekleidung': [19.3348394, 24.7104074],
  'VHF Mineralwolle / Holz-UK / Metallbekleidung': [75.0308414, 75.0308414],
  'VHF Mineralwolle / Alu-UK / Holzbekleidung': [41.1438644, 46.5194324],
  'VHF Mineralwolle / Alu-UK / Metallbekleidung': [96.8398664, 96.8398664],
  'VHF EPS / Holz-UK / Holzbekleidung': [23.988709, 29.364277],
  'VHF EPS / Holz-UK / Metallbekleidung': [79.684711, 79.684711],
  'VHF EPS / Alu-UK / Holzbekleidung': [45.797734, 51.173302],
  'VHF EPS / Alu-UK / Metallbekleidung': [101.493736, 101.493736],
  'VHF Holzfaser / Holz-UK / Holzbekleidung': [23.432715, 28.808283],
  'VHF Holzfaser / Holz-UK / Metallbekleidung': [79.128717, 79.128717],
  'VHF Holzfaser / Alu-UK / Holzbekleidung': [45.24174, 50.617308],
  'VHF Holzfaser / Alu-UK / Metallbekleidung': [100.937742, 100.937742],
};
const fv = L.fassadenVarianten();
assert.strictEqual(fv.length, 18, '18 Fassadenvarianten');
fv.forEach((v) => {
  const soll = SOLL_FASSADE[v.name];
  assert.ok(soll, 'Variante fehlt in Excel: ' + v.name);
  const r = L.jeZeitraum(v.system, v.konfig);
  near(r[30].total, soll[0], 1e-6, v.name + ' 30 a');
  near(r[50].total, soll[1], 1e-6, v.name + ' 50 a');
});

const SOLL_FENSTER = {
  'Fenster Holz / 2-fach-Verglasung': [56.37596361, 112.75192722],
  'Fenster Holz / 3-fach-Verglasung': [72.60288061, 145.20576122],
  'Fenster Aluminium / 2-fach-Verglasung': [135.40868928, 170.87620452],
  'Fenster Aluminium / 3-fach-Verglasung': [151.63560628, 203.33003852],
  'Fenster PVC / 2-fach-Verglasung': [104.1537809, 208.30756181],
  'Fenster PVC / 3-fach-Verglasung': [120.3806979, 240.76139581],
};
const fe = L.fensterVarianten();
assert.strictEqual(fe.length, 6, '6 Fenstervarianten');
fe.forEach((v) => {
  const soll = SOLL_FENSTER[v.name];
  assert.ok(soll, 'Fenstervariante fehlt in Excel: ' + v.name);
  const r = L.jeZeitraum('fenster', v.konfig);
  near(r[30].total, soll[0], 1e-6, v.name + ' 30 a');
  near(r[50].total, soll[1], 1e-6, v.name + ' 50 a');
});

// 5) Gesamtfassade (Dropdown-Beispiel aus der Excel): 250 m² Wand, 40 m² Fenster
const g = L.gesamt({ system: 'wdvs', konfig: { daemmstoff: 'mw', putz: 'mineralisch' } }, { konfig: { rahmen: 'alu', verglasung: 'zweifach' } }, { wandNetto: 250, fenster: 40 });
near(g[30].opak, 7319.533635, 1e-5, 'Opak 30 a');
near(g[30].fenster, 5416.347571, 1e-5, 'Fenster 30 a');
near(g[30].summe, 12735.881206, 1e-5, 'Summe 30 a');
near(g[50].summe, 21474.115451, 1e-5, 'Summe 50 a');

// 6) Dicken aus der U-Wert-Berechnung (Modul Sanierung) gehen ein: doppelte Dicke -> doppelte Dämm-Menge
const ctx = { dicke: (s) => (s.code === 'W-D-EPS' ? 0.32 : undefined) };
const eps2 = L.schichtGwp(sch('wdvs', 'W-D-EPS'), 30, ctx);
near(eps2.menge, 0.32 * 1.03, 1e-12, 'EPS-Menge aus übergebener Dicke');
//    gleiche Wärmedämmwirkung: Dicken aus bauphysik.js für alle Dämmstoffe -> alle U = 0,24
const wand = B.bestandswand(1960, 'lochstein', 0.36);
['mw', 'eps', 'holzfaser'].forEach((dk) => {
  const r = B.daemmdicke(wand, 'wdvs', dk, {});
  const u = 1 / (B.RSI + wand.R + r.dTheoretisch / r.lambda + B.RSE);
  near(u, 0.24, 1e-9, 'U = 0,24 bei ' + dk);
});

// 7) Fenstergeometrie aus dem Aufmaß
const fa = L.fensterGeometrie([{ b: 1.2, h: 1.4 }, { b: 1.2, h: 1.4 }], 0.3);
near(fa.flaeche, 3.36, 1e-12, 'Fensterfläche');
near(fa.blendrahmen, (2 * 2 * 2.6) / 3.36, 1e-12, 'Blendrahmen aus Aufmaß');
near(fa.beschlag, 2 / 3.36, 1e-12, 'Beschläge aus Aufmaß');
assert.throws(() => L.aufbau('wdvs', { daemmstoff: 'kork', putz: 'mineralisch' }), /kork/);

console.log('lca.test.js: alle Prüfungen bestanden (' + (fv.length + fe.length) + ' Varianten gegen Excel)');
