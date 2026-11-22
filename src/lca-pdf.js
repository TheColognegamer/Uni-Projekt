/* PDF-Bericht „LCA-Vergleich Fassadensanierung“ aus window.LcaUI.ergebnis().
 * Nutzt MiniPDF (src/pdf.js, ohne Abhängigkeiten). Im Browser: window.LcaPdf.erzeugen(e). */
(function (root) {
  'use strict';
  const MiniPDF = typeof module !== 'undefined' && module.exports ? require('./pdf.js').MiniPDF : root.MiniPDF;
  const D = typeof module !== 'undefined' && module.exports ? require('./lca-data.js') : root.LcaDaten;

  const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
  const AKZENT = '#0b6bcb', GRAU = '#5b6475', LINIE = '#d9dde5', HELL = '#f1f4f8', ROT = '#b42318';
  const FARBE = { 30: '#4472c4', 50: '#c0504d', A: '#2f7d6d', B: '#d08c2b' };

  function erzeugen(e) {
    if (!e || !e.fv) throw new Error('Noch kein Ergebnis – bitte den Reiter LCA öffnen.');
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
      platz(46); y += 14;
      doc.text(L, y + 11, text, { size: 12, bold: true, color: AKZENT });
      y += 16; doc.line(L, y, R, y, { color: LINIE, w: 0.8 }); y += 8;
    };
    const liste = (punkte, size = 9, x = L, breite = BREITE) => punkte.forEach((p) => {
      const zeilen = doc.wrap(p, breite - 12, size);
      platz(zeilen.length * size * 1.35 + 2);
      doc.text(x + 2, y + size, '•', { size, color: GRAU });
      zeilen.forEach((z) => { doc.text(x + 12, y + size, z, { size }); y += size * 1.35; });
      y += 2;
    });
    const tabelle = (spalten, zeilen, size = 9) => {
      const lh = size * 1.3, pad = 4, k = BREITE / spalten.reduce((a, s) => a + s.w, 0), ws = spalten.map((s) => s.w * k);
      const zelle = (t, i, b) => doc.wrap(t == null ? '' : String(t), ws[i] - 2 * pad, size, b);
      const kopf = () => {
        const h = Math.max(...spalten.map((s, i) => zelle(s.t, i, true).length)) * lh + 2 * pad;
        doc.rect(L, y, BREITE, h, { fill: HELL });
        let x = L;
        spalten.forEach((s, i) => { zelle(s.t, i, true).forEach((z, j) => doc.text(s.r ? x + ws[i] - pad : x + pad, y + pad + size + j * lh, z, { size, bold: true, align: s.r ? 'right' : undefined })); x += ws[i]; });
        y += h;
      };
      platz(40); kopf();
      zeilen.forEach((row) => {
        const z = row.z.map((t, i) => zelle(t, i, row.b));
        const h = Math.max(...z.map((q) => q.length)) * lh + 2 * pad;
        if (y + h > UNTEN) { neueSeite(); kopf(); }
        let x = L;
        z.forEach((zs, i) => { zs.forEach((t, j) => doc.text(spalten[i].r ? x + ws[i] - pad : x + pad, y + pad + size + j * lh, t, { size, bold: row.b, color: row.c, align: spalten[i].r ? 'right' : undefined })); x += ws[i]; });
        y += h; doc.line(L, y, R, y, { color: LINIE });
      });
      y += 6;
    };
    /** Horizontales Balkendiagramm wie im Excel. zeilen: [{label, werte:{serie:wert}, blass}] */
    const balken = (zeilen, serien, einheit, labelW = 210) => {
      const barH = 6, gap = 1.5, rowH = serien.length * (barH + gap) + 5;
      const werte = zeilen.flatMap((z) => serien.map((s) => z.werte[s])).filter(Number.isFinite);
      const max = niceMax(Math.max(1, ...werte));
      const x0 = L + labelW + 4, bw = R - x0 - 34;
      platz(30 + Math.min(zeilen.length, 6) * rowH);
      // Legende
      let lx = L;
      serien.forEach((s) => { doc.rect(lx, y + 1, 8, 8, { fill: FARBE[s] }); doc.text(lx + 11, y + 8, Number.isFinite(+s) ? s + ' Jahre' : 'Option ' + s, { size: 8 }); lx += 70; });
      doc.text(R, y + 8, einheit, { size: 8, color: GRAU, align: 'right' });
      y += 16;
      const achse = () => { for (let i = 0; i <= 5; i++) { const x = x0 + (bw * i) / 5; doc.text(x, y + 6, fmt((max * i) / 5, 0), { size: 7, color: GRAU, align: 'center' }); } y += 10; };
      achse();
      zeilen.forEach((z) => {
        if (y + rowH > UNTEN) { neueSeite(); achse(); }
        doc.text(L + labelW, y + (serien.length * (barH + gap)) / 2 + 3, z.label, { size: 7.5, align: 'right', color: z.blass ? GRAU : undefined });
        serien.forEach((s, j) => {
          const v = z.werte[s]; if (!Number.isFinite(v)) return;
          const yy = y + j * (barH + gap), w = Math.max(0.5, (Math.max(0, v) / max) * bw);
          doc.rect(x0, yy, w, barH, { fill: z.blass ? '#c9ccd2' : FARBE[s] });
          doc.text(x0 + w + 3, yy + barH - 0.5, fmt(v, v >= 1000 ? 0 : 1), { size: 6.5 });
        });
        y += rowH;
      });
      y += 4;
    };

    const b = e.basis, T = D.ZEITRAEUME, Z = e.zeitraeume;
    neueSeite();
    doc.text(L, y + 16, 'LCA-Vergleich Fassadensanierung', { size: 18, bold: true });
    y += 24;
    doc.text(L, y + 10, `GWP-total (A1–A3 + B4 + C3 + C4) · Stand ${new Date().toLocaleDateString('de-DE')} · Prototyp Gruppe 2`, { size: 9, color: GRAU });
    y += 18;
    titel('Grundlagen');
    absatz(`Wandfläche netto: ${fmt(b.wandNetto)} m² · Fensterfläche: ${fmt(b.fensterFlaeche)} m² (${b.quelle === 'aufmass' ? 'aus dem Aufmaß' : 'Annahme'}) · Rahmenanteil ${fmt(b.rahmenanteil * 100, 0)} %`);
    absatz(b.wand
      ? `Dämmdicken aus der U-Wert-Berechnung (Modul Sanierung): alle Varianten U = 0,24 W/(m²K) nach GModG Anlage 7, ${e.dickeModus === 'platte' ? 'Plattendicke (auf 2 cm aufgerundet)' : 'exakte Dicke für gleiche Dämmwirkung'}. Bestandswand U = ${fmt(b.wand.u, 2)} W/(m²K), ${b.wand.klasse}; ${b.gkName || ''}.`
      : 'Dämmdicken: Startwerte der Excel (160 mm, Holzfaser 180 mm), da keine U-Wert-Berechnung vorlag.');
    absatz(`Daten: ${D.QUELLE.text}. ${D.QUELLE.norm}.`, { size: 8.5, color: GRAU });

    titel('Alle Fassadenvarianten · GWP-total je m² opake Wandfläche');
    balken(e.fv.map((v) => ({ label: v.name + (v.ok ? '' : ' (nicht zulässig)'), werte: { 30: v.r[30].total, 50: v.r[50].total }, blass: !v.ok })), Z, 'kg CO2-Äq./m²');
    const unz = e.fv.filter((v) => !v.ok);
    if (unz.length) absatz(`Grau = in ${b.gkName} brandschutztechnisch nicht zulässig (Modul Sanierung).`, { size: 8, color: GRAU });

    titel('Fenstervarianten · GWP-total je m² Fensterfläche');
    balken(e.fe.map((v) => ({ label: v.name.replace('Fenster ', '') + (v.uw && !v.uw.erfuellt ? ' (Uw > 1,3)' : ''), werte: { 30: v.r[30].total, 50: v.r[50].total }, blass: v.uw && !v.uw.erfuellt })), Z, 'kg CO2-Äq./m²', 170);

    titel('Gesamtfassade (Auswahl)');
    absatz(`${e.selF.name} + ${e.selW.name}`, { bold: true });
    tabelle([{ t: '', w: 3 }, ...T.map((t) => ({ t: `${t} a [kg CO2-Äq.]`, w: 1.4, r: true }))], [
      { z: [`Opake Fassade (${fmt(b.wandNetto)} m²)`, ...T.map((t) => fmt(e.g[t].opak, 0))] },
      { z: [`Fenster (${fmt(b.fensterFlaeche)} m²)`, ...T.map((t) => fmt(e.g[t].fenster, 0))] },
      { z: ['Summe Fassade', ...T.map((t) => fmt(e.g[t].summe, 0))], b: true },
    ]);

    titel('Vergleich zweier Konfigurationen');
    tabelle([{ t: '', w: 2.2 }, { t: 'Konfiguration', w: 4 }, ...T.map((t) => ({ t: `${t} a [kg]`, w: 1.2, r: true }))], [
      { z: ['Option A', e.a.name, ...T.map((t) => fmt(e.a.r[t].summe, 0))] },
      { z: ['Option B', e.b.name, ...T.map((t) => fmt(e.b.r[t].summe, 0))] },
    ]);
    balken(Z.map((t) => ({ label: `${t} Jahre`, werte: { A: e.a.r[t].summe, B: e.b.r[t].summe } })), ['A', 'B'], 'kg CO2-Äq. (ganze Fassade)', 60);
    [['Option A', e.a], ['Option B', e.b]].forEach(([n, o]) => {
      platz(40); absatz(`${n}: ${o.name}`, { bold: true });
      absatz('Vorteile', { size: 9, bold: true, color: '#1a7f45' }); liste(o.vn.plus, 8.5);
      absatz('Nachteile', { size: 9, bold: true, color: ROT }); liste(o.vn.minus, 8.5);
      y += 4;
    });
    absatz('* Textvorschlag – fachlich prüfen. Vor-/Nachteile von System und Dämmstoff aus den Projektfolien.', { size: 8, color: GRAU });

    titel('Annahmen: Nutzungsdauern und Datensätze');
    const zeilen = [];
    ['wdvs', 'vhf', 'fenster'].forEach((sys) => D.SCHICHTEN[sys].forEach((s) => {
      const ds = D.DATENSAETZE[s.ds];
      zeilen.push({ z: [sys.toUpperCase(), s.name, ds.name + (ds.proxy ? ' (Proxy)' : ''), ds.einheit, s.rsl + ' a', fmt(ds.a1a3, 2), ds.c3 == null ? 'n. d.' : fmt(ds.c3, 2), ds.c4 == null ? 'n. d.' : fmt(ds.c4, 2)] });
    }));
    tabelle([{ t: 'System', w: 1 }, { t: 'Schicht', w: 2.6 }, { t: 'ÖKOBAUDAT-Datensatz', w: 3.6 }, { t: 'Einh.', w: 0.7 }, { t: 'Nutzungsdauer', w: 1.3, r: true }, { t: 'A1–A3', w: 1, r: true }, { t: 'C3', w: 0.9, r: true }, { t: 'C4', w: 0.9, r: true }], zeilen, 7.5);
    absatz('Formel je Schicht: GWP = M · [(A1–A3) + n · (A1–A3 + C3 + C4) + (C3 + C4)], n = ABRUNDEN((T − 1) / Nutzungsdauer). Nutzungsdauern sind Annahmen in Anlehnung an die BBSR-Tabelle und bestimmen das 50-Jahres-Ergebnis. Modul D (Recyclingpotenzial) ist nicht enthalten; n. d. = nicht deklariert (zählt als 0).', { size: 8, color: GRAU });
    absatz(`Quelle: ${D.QUELLE.text}, abgerufen am ${D.QUELLE.abgerufen}. Grobe Abschätzung im Rahmen eines Studienprojekts.`, { size: 8, color: GRAU });

    // Seitenzahlen
    doc.pages.forEach((p, i) => { doc.cur = p; doc.text(R, doc.H - 30, `Seite ${i + 1} von ${doc.pages.length}`, { size: 8, color: GRAU, align: 'right' }); });
    return doc.output({ title: 'LCA-Vergleich Fassadensanierung' });
  }

  function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }

  const api = { erzeugen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LcaPdf = api;
})(typeof self !== 'undefined' ? self : this);
