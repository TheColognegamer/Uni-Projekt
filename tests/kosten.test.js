/* Prüft den Kosten-/Empfehlungs-Kern gegen die Kosten-Excel (Blatt LCC, 1.000 m²) und auf Invarianten.
 * Aufruf: node tests/kosten.test.js */
const assert = require('assert');
const B = require('../src/bauphysik.js');
const K = require('../src/kosten-data.js');
const C = require('../src/kosten.js');
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// 1) Blatt LCC der Excel: Investition, Folgekosten, LCC gesamt je Variante für 1.000 m² bei 160 mm
const LCC_EXCEL = { 'wdvs-eps': [190000, 105840, 295840], 'wdvs-mw': [215000, 105840, 320840], 'wdvs-holzfaser': [240000, 105840, 345840],
  'vhf-eps': [325000, 78600, 403600], 'vhf-mw': [340000, 78600, 418600], 'vhf-holzfaser': [370000, 78600, 448600] };
const san160 = { bezugsflaeche_m2: 1000, varianten: Object.keys(LCC_EXCEL).map((id) => { const [system, daemmstoff] = id.split('-');
  return { system, daemmstoff, unterkonstruktion: system === 'vhf' ? 'holz' : null, d: 0.16, dTheoretisch: 0.16, uNeu: 0.23, erfuellt: true, brandschutz: { zulaessig: true }, warnungen: [] }; }) };
const k160 = C.kandidaten(san160);
assert.strictEqual(k160.length, 6);
for (const k of k160) { const [i, f, l] = LCC_EXCEL[k.id]; near(k.invest.gesamt, i, 1e-6, k.id + ' Investition'); near(k.folge.gesamt, f, 1e-6, k.id + ' Folgekosten'); near(k.lcc.gesamt, l, 1e-6, k.id + ' LCC'); }

// 2) Dickenabhängigkeit WDVS (Blatt WDVS: EPS +10, Mineralwolle +12,5 je 20 mm); VHF unabhängig
near(C.investition('wdvs', 'eps', 0.18).mid, 200, 1e-9, 'EPS 180 mm');
near(C.investition('wdvs', 'eps', 0.14).mid, 180, 1e-9, 'EPS 140 mm');
near(C.investition('wdvs', 'mw', 0.18).mid, 227.5, 1e-9, 'MW 180 mm');
near(C.investition('wdvs', 'holzfaser', 0.20).mid, 240 + 14.4 * 2, 1e-9, 'Holzfaser 200 mm');
near(C.investition('vhf', 'mw', 0.20).mid, C.investition('vhf', 'mw', 0.16).mid, 1e-12, 'VHF dickenunabhängig');
near(C.investition('wdvs', 'eps', 0.04).mid, 130, 1e-9, 'EPS 40 mm linear');
near(C.investition('wdvs', 'eps', 0.001).mid, 190 * K.MIN_ANTEIL, 1e-9, 'Untergrenze 60 % bei extrem dünner Dämmung');
assert.ok(C.investition('wdvs', 'eps', 0.06).hinweise.length === 1 && C.investition('wdvs', 'eps', 0.16).hinweise.length === 0, 'Hinweis außerhalb der Preisbasis');
for (const sys of ['wdvs', 'vhf']) for (const dk of ['eps', 'mw', 'holzfaser']) { const x = C.investition(sys, dk, 0.16); assert.ok(x.lo < x.mid && x.mid < x.hi, `Spanne ${sys}/${dk}`); }
near(C.investition('wdvs', 'eps', 0.16).lo, 190 * 145 / 155, 1e-9, 'Spanne EPS unten');

// 3) Qualität
near(K.KRITERIEN.reduce((a, k) => a + k.gewicht, 0), 100, 1e-9, 'Gewichte ergeben 100');
const q = (s, d) => C.qualitaet(s, d).punkte;
for (const s of ['wdvs', 'vhf']) for (const d of ['eps', 'mw', 'holzfaser']) assert.ok(q(s, d) > 20 && q(s, d) <= 100, `Qualität ${s}/${d} im Bereich`);
assert.ok(q('vhf', 'mw') > q('wdvs', 'mw') && q('wdvs', 'mw') > q('wdvs', 'eps'), 'Rangfolge Qualität');
assert.ok(C.qualitaet('wdvs', 'eps', { dauer: 0, feuchte: 0, brand: 0, schall: 0, sommer: 0, rueckbau: 0, gewicht: 10 }).punkte > q('wdvs', 'eps'), 'Gewichte wirken (EPS leicht)');

// 4) Empfehlungen für fünf Gebäude (gleiche wie tests/szenarien.test.js)
const S = [
  { id: 'S1', baujahr: 1905, wand: 'vollstein', dicke: 0.38, geschosse: 5, netto: 410 },
  { id: 'S2', baujahr: 1956, wand: 'lochstein', dicke: 0.365, geschosse: 3, netto: 222.5 },
  { id: 'S3', baujahr: 1974, wand: 'lochstein', dicke: 0.30, geschosse: 2, netto: 96 },
  { id: 'S4', baujahr: 1991, wand: 'zweischaligDaemm', dicke: 0.36, geschosse: 4, netto: 320 },
  { id: 'S5', baujahr: 2006, wand: 'lochstein', dicke: 0.365, geschosse: 3, netto: 150 },
];
const san = (s) => { const w = B.bestandswand(s.baujahr, s.wand, s.dicke), gk = B.gebaeudeklasse(s.geschosse);
  return { bezugsflaeche_m2: s.netto, varianten: B.variantenWand(w, { gk: gk.key, vhf: { uk: 'holz' } }), gk }; };
const ERG = {};
for (const s of S) {
  const sn = san(s), ks = C.kandidaten(sn); ERG[s.id] = { s, sn, ks };
  assert.strictEqual(ks.length, 6, s.id + ' sechs Varianten');
  for (const k of ks) {
    near(k.lcc.gesamt, k.lcc.m2 * s.netto, 1e-6, `${s.id} ${k.id} LCC gesamt`);
    near(k.lcc.m2, k.invest.m2 + k.folge.m2, 1e-9, `${s.id} ${k.id} LCC = Invest + Folge`);
    near(k.gwp[50].gesamt, k.gwp[50].m2 * s.netto, 1e-6, `${s.id} ${k.id} GWP gesamt`);
    assert.ok(k.gwp[50].m2 >= k.gwp[30].m2 - 1e-9, `${s.id} ${k.id} 50 a >= 30 a`);
    assert.ok(k.lcc.lo < k.lcc.m2 && k.lcc.m2 < k.lcc.hi, `${s.id} ${k.id} Spanne`);
  }
  for (const T of [30, 50]) {
    const e = C.empfehlung(ks, { zeitraum: T }), ok = ks.filter((k) => k.zulaessig && k.erfuellt);
    for (const n of ['premium', 'preisLeistung', 'umwelt']) assert.ok(e[n] && e[n].zulaessig, `${s.id} ${T} a: ${n} zulässig`);
    assert.ok(ok.every((k) => k.qualitaet.punkte <= e.premium.qualitaet.punkte + 1e-9), `${s.id}: Premium hat nicht die höchste Qualität`);
    assert.ok(ok.every((k) => k.gwp[T].m2 >= e.umwelt.gwp[T].m2 - 1e-9), `${s.id} ${T} a: Umwelt nicht minimal`);
    assert.ok(ok.every((k) => k.qualitaet.punkte / k.lcc.m2 <= e.preisLeistung.qualitaet.punkte / e.preisLeistung.lcc.m2 + 1e-12), `${s.id}: Preis-Leistung nicht maximal`);
    assert.ok(e.guenstigste.lcc.m2 <= e.preisLeistung.lcc.m2 + 1e-9 && e.preisLeistung.lcc.m2 <= e.teuerste.lcc.m2 + 1e-9, `${s.id}: Preisordnung`);
    assert.ok(e.umwelt.gwp[T].m2 <= e.premium.gwp[T].m2 + 1e-9 && e.umwelt.gwp[T].m2 <= e.preisLeistung.gwp[T].m2 + 1e-9, `${s.id}: Umwelt hat nicht das kleinste GWP`);
  }
  { const e = C.empfehlung(ks, { zeitraum: 50 });
    if (e.umwelt.id === e.premium.id || e.umwelt.id === e.preisLeistung.id) assert.ok(e.alternative.umwelt && ![e.premium.id, e.preisLeistung.id].includes(e.alternative.umwelt.id), s.id + ': Alternative bei Doppelsieger fehlt'); }
  // GK 4–5: Holzfaser (WDVS und VHF) und VHF mit EPS nie empfohlen; GK 1–3: alles zulässig
  const unzul = ks.filter((k) => !k.zulaessig).map((k) => k.id).sort();
  if (sn.gk.key === 'gk45') assert.deepStrictEqual(unzul, ['vhf-eps', 'vhf-holzfaser', 'wdvs-holzfaser'], s.id + ' unzulässige Varianten in GK 4–5');
  else assert.deepStrictEqual(unzul, [], s.id + ' alles zulässig in GK 1–3');
}
// Skalierung: doppelte Fläche -> doppelte Kosten und doppeltes GWP, gleiche Empfehlung
{ const a = ERG.S2, k2 = C.kandidaten({ ...a.sn, bezugsflaeche_m2: 2 * a.s.netto });
  k2.forEach((k, i) => { near(k.lcc.gesamt, 2 * a.ks[i].lcc.gesamt, 1e-6, 'Kosten linear'); near(k.gwp[50].gesamt, 2 * a.ks[i].gwp[50].gesamt, 1e-6, 'GWP linear'); });
  assert.strictEqual(C.empfehlung(k2).premium.id, C.empfehlung(a.ks).premium.id, 'Empfehlung unabhängig von der Fläche'); }
// Keine zulässige Variante -> keine Empfehlung, kein Absturz
{ const sn = san(S[1]); sn.varianten.forEach((v) => { v.brandschutz = { zulaessig: false, grund: 'Test' }; }); const e = C.empfehlung(C.kandidaten(sn));
  assert.ok(e.premium === null && e.preisLeistung === null && e.umwelt === null, 'ohne zulässige Variante keine Empfehlung'); }
// Fehlende Eingaben
assert.deepStrictEqual(C.kandidaten(null), []); assert.deepStrictEqual(C.kandidaten({ varianten: [], bezugsflaeche_m2: 0 }), []);

// Ausgabe zur Sichtprüfung
const f0 = (x) => Math.round(x).toLocaleString('de-DE');
console.log('Empfehlungen (GWP 50 a) – Kosten je m² Wand | Gesamt');
for (const s of S) {
  const { ks } = ERG[s.id], e = C.empfehlung(ks, { zeitraum: 50 });
  const z = (k) => `${k.name.padEnd(30)} LCC ${f0(k.lcc.m2)} €/m² (${f0(k.lcc.gesamt)} €), GWP ${f0(k.gwp[50].m2)} kg/m², Q ${f0(k.qualitaet.punkte)}`;
  console.log(`${s.id} ${ERG[s.id].sn.gk.kurz}  Premium: ${z(e.premium)}\n        Preis-Leistung: ${z(e.preisLeistung)}\n        Umwelt: ${z(e.umwelt)}`);
}
console.log('kosten.test.js: alle Prüfungen bestanden');
