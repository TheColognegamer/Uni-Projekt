/* PDF-Bericht „Fassadensanierung“ aus dem Ergebnis des Sanierungsmoduls (window.SanierungUI.ergebnis()).
 * Nutzt MiniPDF (src/pdf.js) und Bauphysik (src/bauphysik.js). Im Browser: window.PdfBericht.erzeugen(r). */
(function (root) {
  'use strict';
  const MiniPDF = typeof module !== 'undefined' && module.exports ? require('./pdf.js').MiniPDF : root.MiniPDF;
  const BP = typeof module !== 'undefined' && module.exports ? require('./bauphysik.js') : root.Bauphysik;

  const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '–');
  const AKZENT = '#0b6bcb', GRAU = '#5b6475', LINIE = '#d9dde5', HELL = '#f1f4f8', ROT = '#b42318', GRUEN = '#1a7f45';

  function erzeugen(r, B = BP, opts = {}) {
    if (!r || !r.varianten || !r.wand) throw new Error('Noch kein vollständiges Ergebnis – bitte Eingaben prüfen.');
    const doc = new MiniPDF();
    const L = 50, R = doc.W - 50, BREITE = R - L, UNTEN = doc.H - 60;
    let y = 0;
    const neueSeite = () => { doc.addPage(); y = 56; };
    const platz = (h) => { if (y + h > UNTEN) neueSeite(); };

    const absatz = (text, o = {}) => {
      const size = o.size || 9.5, lh = size * 1.35;
      doc.wrap(text, o.breite || BREITE, size, o.bold).forEach((z) => { platz(lh); doc.text(o.x || L, y + size, z, { size, bold: o.bold, color: o.color }); y += lh; });
    };
    const titel = (text) => {
      platz(40); y += 14;
      doc.text(L, y + 11, text, { size: 12, bold: true, color: AKZENT });
      y += 16; doc.line(L, y, R, y, { color: LINIE, w: 0.8 }); y += 8;
    };
    const liste = (punkte, size = 9) => punkte.forEach((p) => {
      const zeilen = doc.wrap(p, BREITE - 12, size);
      platz(zeilen.length * size * 1.35 + 2);
      doc.text(L + 2, y + size, '•', { size, color: GRAU });
      zeilen.forEach((z) => { doc.text(L + 12, y + size, z, { size }); y += size * 1.35; });
      y += 2;
    });
    /** Tabelle mit Zeilenumbruch in Zellen und Seitenumbruch (Kopf wird wiederholt) */
    const tabelle = (spalten, zeilen, o = {}) => {
      const size = o.size || 9, lh = size * 1.3, pad = 4;
      const summe = spalten.reduce((a, s) => a + s.w, 0), k = BREITE / summe;
      const ws = spalten.map((s) => s.w * k);
      const zelle = (txt, i, bold) => doc.wrap(txt == null ? '' : String(txt), ws[i] - 2 * pad, size, bold);
      const kopf = () => {
        const h = Math.max(...spalten.map((s, i) => zelle(s.t, i, true).length)) * lh + 2 * pad;
        doc.rect(L, y, BREITE, h, { fill: HELL });
        let x = L;
        spalten.forEach((s, i) => {
          zelle(s.t, i, true).forEach((z, j) => doc.text(s.align === 'right' ? x + ws[i] - pad : x + pad, y + pad + size + j * lh, z, { size, bold: true, align: s.align }));
          x += ws[i];
        });
        y += h;
      };
      platz(40); kopf();
      zeilen.forEach((row) => {
        const zell = row.zellen.map((t, i) => zelle(t, i, row.bold));
        const h = Math.max(...zell.map((z) => z.length)) * lh + 2 * pad;
        if (y + h > UNTEN) { neueSeite(); kopf(); }
        if (row.fill) doc.rect(L, y, BREITE, h, { fill: row.fill });
        let x = L;
        zell.forEach((zs, i) => {
          const s = spalten[i], farbe = (row.farben && row.farben[i]) || row.color;
          zs.forEach((z, j) => doc.text(s.align === 'right' ? x + ws[i] - pad : x + pad, y + pad + size + j * lh, z, { size, bold: row.bold, color: farbe, align: s.align }));
          x += ws[i];
        });
        y += h; doc.line(L, y, R, y, { color: LINIE, w: 0.5 });
      });
      y += 4;
    };

    // ---------- Kopf ----------
    neueSeite();
    doc.rect(L, y - 6, BREITE, 4, { fill: AKZENT });
    y += 12;
    doc.text(L, y + 16, 'Fassadensanierung – Ergebnisbericht', { size: 18, bold: true });
    y += 26;
    const datum = opts.datum || new Date().toLocaleDateString('de-DE');
    doc.text(L, y + 9, `Grobabschätzung für Leistungsphase 2 · erstellt am ${datum}`, { size: 9.5, color: GRAU });
    y += 22;

    // Kennzahlen
    const w = r.wand, g = r.gebaeude || {}, gk = B.GEBAEUDEKLASSEN[g.gebaeudeklasse] || { kurz: '–' };
    const zul = r.varianten.filter((x) => x.brandschutz && x.brandschutz.zulaessig);
    const kpis = [
      ['Baujahr', String(w.baujahr), w.baualtersklasse],
      ['U-Wert Wand heute', `${fmt(w.u, 1)} W/(m²K)`, `Ziel ≤ ${fmt(B.ANFORDERUNG.aussenwand.uMax)}`],
      ['Gebäudeklasse', gk.kurz, `${g.geschosse || '–'} Geschosse`],
      ['Wand netto', `${fmt(r.bezugsflaeche_m2, 0)} m²`, r.flaechen && r.flaechen.quelle === 'aufmass' ? 'aus Aufmaß' : 'Annahme'],
      ['Fenster', r.fenster ? `${r.fenster.anzahl} Stk.` : '–', r.fenster ? `${fmt(r.fenster.flaeche, 1)} m²` : ''],
    ];
    const kb = (BREITE - 4 * 6) / 5;
    kpis.forEach((k, i) => {
      const x = L + i * (kb + 6);
      doc.rect(x, y, kb, 48, { fill: HELL });
      doc.text(x + 7, y + 13, k[0], { size: 7.5, color: GRAU });
      doc.text(x + 7, y + 30, k[1], { size: 12, bold: true });
      doc.text(x + 7, y + 42, k[2], { size: 7.5, color: GRAU });
    });
    y += 58;

    // ---------- 1 Gebäude ----------
    titel('1  Gebäude und Bestand');
    const kon = B.WANDKONSTRUKTIONEN[w.konstruktion];
    tabelle([{ t: 'Merkmal', w: 1.3 }, { t: 'Wert', w: 3 }], [
      ['Baujahr / Baualtersklasse', `${w.baujahr} / ${w.baualtersklasse}`],
      ['Außenwand', `${kon ? kon.name : w.konstruktion}, ${fmt(w.gesamtDicke_m * 100, 0)} cm`],
      ['U-Wert Außenwand heute', `${fmt(w.u, 2)} W/(m²K) – Pauschalwert nach ${w.quelle}`],
      ['Geschosse / Gebäudeklasse', `${g.geschosse || '–'} Geschosse, ${g.manuell ? 'manuell gewählt' : 'Fußboden oberstes Geschoss ca. ' + fmt(g.hoeheOberstesGeschoss_m, 1) + ' m'} → ${gk.name || '–'}`],
      ['Flächen', `Wand netto ${fmt(r.bezugsflaeche_m2)} m²; ${r.fenster ? r.fenster.anzahl + ' Fenster, ' + fmt(r.fenster.flaeche) + ' m²' : 'keine Fenster'} (${r.flaechen && r.flaechen.quelle === 'aufmass' ? 'aus dem Foto-Aufmaß' : 'Annahme'})`],
    ].map((z) => ({ zellen: z })), { size: 9 });

    // ---------- 2 Anforderungen ----------
    titel('2  Anforderungen nach Sanierung');
    absatz(`Nach ${B.ANFORDERUNG.quelle} gelten bei Erneuerung der Bauteile: Außenwand U ≤ ${fmt(B.ANFORDERUNG.aussenwand.uMax)} W/(m²K), Fenster Uw ≤ ${fmt(B.ANFORDERUNG.fenster.uMax, 1)} W/(m²K). Brandschutz: Zulässigkeit der Dämmstoffe nach Gebäudeklasse (MBO § 28, MVV TB Anhang 6).`);

    // ---------- 3 Dämmung ----------
    titel('3  Dämmvarianten');
    const uk = r.unterkonstruktion_vhf ? B.UNTERKONSTRUKTION[r.unterkonstruktion_vhf].name : '';
    tabelle([
      { t: 'System', w: 1.5 }, { t: 'Dämmstoff', w: 1.15 }, { t: 'λ W/(mK)', w: 0.8, align: 'right' }, { t: 'Dicke exakt', w: 0.85, align: 'right' },
      { t: 'Platte', w: 0.7, align: 'right' }, { t: 'U neu', w: 0.7, align: 'right' }, { t: 'Menge', w: 0.8, align: 'right' }, { t: 'Brandschutz', w: 1.5 },
    ], r.varianten.map((x) => {
      const ok = x.brandschutz.zulaessig;
      return {
        zellen: [x.system === 'vhf' ? `Vorhangfassade (${uk.replace('-Unterkonstruktion', '-UK')})` : 'WDVS', B.DAEMMSTOFFE[x.daemmstoff].name,
          fmt(x.lambda, 3), `${fmt(x.dTheoretisch * 100, 1)} cm`, `${fmt(x.d * 100, 0)} cm`, fmt(x.uNeu, 3), `${fmt(x.volumen_m3, 1)} m³`,
          ok ? (x.brandschutz.auflage ? 'zulässig mit Auflage' : 'zulässig') : 'nicht zulässig'],
        color: ok ? undefined : GRAU, farben: { 7: ok ? GRUEN : ROT },
      };
    }), { size: 8.5 });
    absatz('Dicke exakt = Dämmdicke für genau U = 0,24 (Vergleich bei gleicher Dämmwirkung). Platte = auf 2 cm aufgerundete Ausführungsdicke. Menge = Wand netto × Plattendicke.', { size: 8, color: GRAU });
    const auflagen = [...new Set(r.varianten.filter((x) => x.brandschutz.zulaessig && x.brandschutz.auflage).map((x) => `${B.DAEMMSTOFFE[x.daemmstoff].name} (${B.SYSTEME[x.system].name}): ${x.brandschutz.auflage}`))];
    const gruende = [...new Set(r.varianten.filter((x) => !x.brandschutz.zulaessig).map((x) => `${B.SYSTEME[x.system].name} mit ${B.DAEMMSTOFFE[x.daemmstoff].name}: ${x.brandschutz.grund}`))];
    if (auflagen.length || gruende.length) { y += 4; liste([...auflagen.map((t) => 'Auflage – ' + t), ...gruende.map((t) => 'Nicht zulässig – ' + t)], 8.5); }

    // ---------- 4 Fenster ----------
    titel('4  Mögliche Fenster');
    if (r.fenster) {
      const o0 = r.fenster.optionen[0];
      tabelle([{ t: 'Rahmen', w: 1.6 }, { t: 'Verglasung', w: 1 }, { t: 'Uw W/(m²K)', w: 1, align: 'right' }, { t: 'GModG (Uw ≤ 1,3)', w: 1.4 }],
        [...r.fenster.optionen].sort((a, b) => a.uwNeu - b.uwNeu).map((f) => ({
          zellen: [B.RAHMEN[f.rahmen].name, B.VERGLASUNG[f.verglasung].name, fmt(f.uwNeu), f.erfuellt ? 'zulässig' : 'nicht zulässig'],
          color: f.erfuellt ? undefined : GRAU, farben: { 3: f.erfuellt ? GRUEN : ROT },
        })), { size: 9 });
      absatz(`${r.fenster.anzahl} Fenster mit zusammen ${fmt(r.fenster.flaeche)} m² (Glas ${fmt(o0.flaecheGlas)} m², Rahmen ${fmt(o0.flaecheRahmen)} m², Rahmenanteil ${fmt(r.fenster.rahmenanteil * 100, 0)} %). Uw nach DIN EN ISO 10077-1; zulässig nur, wenn jedes einzelne Fenster den Höchstwert einhält.`, { size: 8, color: GRAU });
    } else absatz('Keine Fenster angegeben.');

    // ---------- 5 Hinweise ----------
    const hinweise = [...new Set([...(w.hinweise || []), ...r.varianten.flatMap((x) => x.warnungen)])];
    if (hinweise.length) { titel('5  Hinweise'); liste(hinweise); }

    // ---------- 6 Grundlagen ----------
    titel(`${hinweise.length ? 6 : 5}  Grundlagen und Annahmen`);
    liste([
      'U-Wert Bestand: Bekanntmachung der Regeln zur Datenaufnahme und Datenverwendung im Wohngebäudebestand vom 08.10.2020 (BAnz AT 04.12.2020 B1), Tabelle 2.',
      'Höchstwerte nach Sanierung: Gebäudemodernisierungsgesetz (GModG, vormals GEG) Anlage 7.',
      'Dämmdicke nach DIN EN ISO 6946: WDVS mit Rse = 0,04; hinterlüftete Fassade mit Rse = Rsi = 0,13 m²K/W und Wärmebrückenzuschlag ΔU (Holz-UK 0,02, Alu-UK 0,04 W/(m²K), Annahme).',
      'Wärmeleitfähigkeit laut Projektkonzept: Mineralwolle und EPS 0,035, Holzfaser 0,040 W/(mK); maßgeblich ist das Produktdatenblatt.',
      `Fenster nach DIN EN ISO 10077-1 mit Richtwerten: Ug 2-fach ${fmt(B.VERGLASUNG.zweifach.ug, 1)} / 3-fach ${fmt(B.VERGLASUNG.dreifach.ug, 1)}, Uf ${fmt(B.RAHMEN.pvc.uf, 1)}–${fmt(B.RAHMEN.holz.uf, 1)}, ψ ${fmt(B.VERGLASUNG.dreifach.psi)} W/(mK) (warme Kante).`,
      `Gebäudeklasse vereinfacht aus der Höhe (${fmt(B.EG_HOEHE, 1)} m + ${fmt(B.GESCHOSSHOEHE, 1)} m je Geschoss); Zahl und Größe der Nutzungseinheiten nicht berücksichtigt.`,
    ], 8.5);
    y += 6;
    absatz('Dieser Bericht ist eine grobe Abschätzung für Leistungsphase 2 und ersetzt keine Fachplanung (Wärme-, Feuchte- und Brandschutz, Statik). Kosten und CO₂-Bilanz werden im Kosten-/LCA-Modul ergänzt.', { size: 8, color: GRAU });

    // Fußzeilen
    doc.pages.forEach((p, i) => {
      doc.cur = p;
      doc.line(L, doc.H - 40, R, doc.H - 40, { color: LINIE });
      doc.text(L, doc.H - 28, 'Lebenszyklusvergleich von Fassadensystemen · Gruppe 2 · TH Köln', { size: 7.5, color: GRAU });
      doc.text(R, doc.H - 28, `Seite ${i + 1} von ${doc.pages.length}`, { size: 7.5, color: GRAU, align: 'right' });
    });
    return doc.output({ title: 'Fassadensanierung – Ergebnisbericht' });
  }

  const api = { erzeugen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PdfBericht = api;
})(typeof self !== 'undefined' ? self : this);
