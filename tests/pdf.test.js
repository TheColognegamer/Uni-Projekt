const assert = require('assert');
const B = require('../src/bauphysik.js');
const { MiniPDF, winAnsi } = require('../src/pdf.js');
const { erzeugen } = require('../src/pdf-bericht.js');

// 1) Zeichensatz: Umlaute bleiben, nicht darstellbare Zeichen werden ersetzt
assert.strictEqual(winAnsi('Größe ≤ 0,24 m² – ok →'), 'Gr\xf6\xdfe <= 0,24 m\xb2 \x96 ok ->');
assert.ok(new MiniPDF().width('Wand', 10) > 0);

// 2) Bericht aus einem Ergebnis wie es das Sanierungsmodul liefert
const wand = B.bestandswand(1960, 'lochstein', 0.36);
const fenster = Array.from({ length: 16 }, () => ({ b: 1.2, h: 1.4 }));
const r = {
  flaechen: { quelle: 'annahme' }, bezugsflaeche_m2: 223.12, unterkonstruktion_vhf: 'holz',
  wand: { baujahr: 1960, baualtersklasse: wand.klasse, konstruktion: wand.konstruktion, gesamtDicke_m: 0.36, u: wand.u, quelle: wand.quelle, hinweise: wand.hinweise },
  gebaeude: { geschosse: 4, hoeheOberstesGeschoss_m: 9, gebaeudeklasse: 'gk45', manuell: false },
  varianten: B.variantenWand(wand, { gk: 'gk45', vhf: { uk: 'holz' } }).map((x) => ({ ...x, volumen_m3: 223.12 * x.d })),
  fenster: { anzahl: 16, flaeche: 26.88, rahmenanteil: 0.3, optionen: B.fensterOptionen(fenster, 0.3) },
};
const pdf = Buffer.from(erzeugen(r, B, { datum: '13.11.2026' })).toString('latin1');
assert.ok(pdf.startsWith('%PDF-1.4') && pdf.trimEnd().endsWith('%%EOF'), 'gültiger Rahmen');
['Ergebnisbericht', 'Dämmvarianten'.replace('ä', '\xe4'), 'nicht zul\xe4ssig', 'Seite 1 von'].forEach((t) => assert.ok(pdf.includes(t), 'enthält ' + t));
// xref-Offsets zeigen auf die Objekte
const xref = +pdf.match(/startxref\n(\d+)/)[1];
assert.ok(pdf.slice(xref).startsWith('xref'), 'startxref korrekt');
const offs = [...pdf.slice(xref).matchAll(/(\d{10}) 00000 n/g)].map((m) => +m[1]);
offs.forEach((o, i) => assert.ok(pdf.slice(o).startsWith(`${i + 1} 0 obj`), 'Objekt ' + (i + 1)));
assert.throws(() => erzeugen({}, B), /vollständiges Ergebnis/);
require('fs').writeFileSync(require('os').tmpdir() + '/bericht-test.pdf', Buffer.from(erzeugen(r, B)));
console.log('Alle PDF-Tests bestanden.');
