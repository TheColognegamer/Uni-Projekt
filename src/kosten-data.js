/* Kostendaten, Qualitätskriterien und Annahmen für Kosten und Empfehlung.
 * Quelle der Preise: LCE_Projekt_Fassadenvergleich_LCC_Recherche.xlsx (Blätter LCC, WDVS, VHF), Preisstand 2026, Köln, netto.
 * ALLE WERTE SIND ÄNDERBARE ANNAHMEN. Bei jedem Wert steht die Fundstelle; „Annahme“ bedeutet: nicht in der Excel belegt. */
(function (root) {
  'use strict';

  const QUELLE = 'LCE_Projekt_Fassadenvergleich_LCC_Recherche.xlsx';
  const BEZUGSDICKE = 0.16; // m: Preise der Excel gelten für 160 mm Dämmung (VHF: 160–200 mm)

  // Investition je m² Fassadenfläche, netto, inkl. Gerüst, Untergrundvorbereitung, Anschlüsse. Blatt LCC, C5:C10.
  const INVEST = {
    wdvs: { eps: 190, mw: 215, holzfaser: 240 },
    vhf: { eps: 325, mw: 340, holzfaser: 370 },
  };

  // Mehrpreis je +20 mm Dämmdicke (€/m²). WDVS: Mittel der Preisspannen je Stufe, Blatt WDVS Z. 6–10 und 61–65
  // (EPS 145→155→165, Mineralwolle 185→197,5, Holzfaser 205→…→262,5, Mittel +14,4). VHF: Excel nennt einen Preis für 160–200 mm,
  // deshalb kein Zuschlag (Annahme).
  const ZUSCHLAG_20MM = {
    wdvs: { eps: 10, mw: 12.5, holzfaser: 14.4 },
    vhf: { eps: 0, mw: 0, holzfaser: 0 },
  };
  const GUELTIG = { wdvs: { von: 0.12, bis: 0.20 }, vhf: { von: 0.16, bis: 0.20 } }; // m, Dickenbereich der Preisangaben
  const MIN_ANTEIL = 0.6; // Annahme: auch bei sehr dünner Dämmung mindestens 60 % des Bezugspreises (Gerüst, Putz, Anschlüsse bleiben)

  // Preisspanne (Faktor auf den Mittelwert): Blatt WDVS Z. 7, 9, 63 und Blatt VHF Z. 6–8
  const SPANNE = {
    wdvs: { eps: [145 / 155, 165 / 155], mw: [170 / 185, 200 / 185], holzfaser: [215 / 232.5, 250 / 232.5] },
    vhf: { eps: [280 / 315, 350 / 315], mw: [290 / 330, 370 / 330], holzfaser: [320 / 360, 400 / 360] },
  };

  // Folgekosten (Barwert) je m²: Blatt LCC, D5:D10. Zeitraum steht in der Excel nicht; gilt hier für den gesamten Vergleich (Annahme).
  const FOLGEKOSTEN = { wdvs: 105.84, vhf: 78.6 };

  // Nicht enthalten (keine Preise in der Excel): Fenster, Unterkonstruktion/Bekleidung als Preisunterschied, Laibungen, Fensterbänke,
  // Sockel, Brandriegel, größere Bestandssanierungen, Umsatzsteuer.
  const NICHT_ENTHALTEN = [
    'Fenster (die Excel enthält keine Fensterpreise)',
    'Preisunterschiede zwischen Holz- und Aluminium-Unterkonstruktion bzw. Holz- und Metallbekleidung (Excel nennt nur „Faserzementbekleidung“)',
    'Laibungsdämmung, Fensterbänke, Sockel, Brandriegel (Einzelpositionen der Excel, nicht in den Budgetansätzen)',
    'Umsatzsteuer, größere Vorarbeiten am Bestand, Angebotspreise (es sind Budgetansätze)',
  ];

  // ---------- Qualität ----------
  // Bewertung 1–5 je Kriterium. Einschätzung auf Grundlage der Aussagen im Projektkonzept (Folien „Fassadensysteme“ und „Dämmstoffe“).
  // Kein Messwert: das Team sollte Gewichte und Noten prüfen. Gewichte sind in der Oberfläche änderbar.
  const KRITERIEN = [
    { id: 'dauer', name: 'Dauerhaftigkeit', gewicht: 20, quelle: 'Konzept: VHF hohe Dauerhaftigkeit, WDVS empfindlicher gegenüber Beschädigung' },
    { id: 'feuchte', name: 'Feuchteschutz', gewicht: 15, quelle: 'Konzept: VHF sehr guter Feuchteschutz, WDVS empfindlicher gegenüber Feuchtigkeit' },
    { id: 'brand', name: 'Brandschutz', gewicht: 20, quelle: 'Konzept: Mineralwolle nichtbrennbar; EPS und Holzfaser brennbar' },
    { id: 'schall', name: 'Schallschutz', gewicht: 10, quelle: 'Konzept: Mineralwolle guter Schallschutz' },
    { id: 'sommer', name: 'Sommerlicher Wärmeschutz', gewicht: 10, quelle: 'Konzept: Holzfaser gut, EPS geringer' },
    { id: 'rueckbau', name: 'Rückbau und Kreislauf', gewicht: 15, quelle: 'Konzept: VHF gute, WDVS eingeschränkte Rückbaubarkeit; EPS begrenzte Kreislauffähigkeit; Holzfaser nachwachsend' },
    { id: 'gewicht', name: 'Konstruktionsdicke und Gewicht', gewicht: 10, quelle: 'Konzept: VHF größere Konstruktionsdicke und Gewicht; EPS leicht, Mineralwolle schwerer' },
  ];
  // Note je Kriterium: System (WDVS/VHF) und Dämmstoff; bei zwei Anteilen wird der Mittelwert gebildet.
  const NOTEN = {
    system: {
      wdvs: { dauer: 3, feuchte: 3, rueckbau: 2, gewicht: 4 },
      vhf: { dauer: 5, feuchte: 5, rueckbau: 4, gewicht: 2 },
    },
    daemmstoff: {
      eps: { brand: 2, schall: 2, sommer: 2, rueckbau: 1, gewicht: 5 },
      mw: { brand: 5, schall: 5, sommer: 3, rueckbau: 3, gewicht: 3 },
      holzfaser: { brand: 2, schall: 4, sommer: 5, rueckbau: 4, gewicht: 3 },
    },
  };

  const NAMEN = {
    system: { wdvs: 'WDVS', vhf: 'Vorgehängte Fassade' },
    daemmstoff: { eps: 'EPS', mw: 'Mineralwolle', holzfaser: 'Holzfaser' },
  };

  const api = { QUELLE, BEZUGSDICKE, INVEST, ZUSCHLAG_20MM, GUELTIG, MIN_ANTEIL, SPANNE, FOLGEKOSTEN, NICHT_ENTHALTEN, KRITERIEN, NOTEN, NAMEN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KostenDaten = api;
})(typeof self !== 'undefined' ? self : this);
