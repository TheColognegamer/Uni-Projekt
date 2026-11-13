/* Bauphysik-Kern: U-Wert Bestandswand, erforderliche Dämmdicke nach GModG Anlage 7, Fenstertausch.
 * Rein funktional, ohne DOM -> in Node testbar (wie geometry.js).
 * Rechenweg nach DIN EN ISO 6946 (vereinfacht, homogene Schichten), Leistungsphase 2 = Grobabschätzung.
 *
 * ALLE KENNWERTE SIND ÄNDERBARE ANNAHMEN. Quelle steht jeweils dabei; vor Verwendung im Bericht prüfen.
 */
(function (root) {
  'use strict';

  // ---------- Anforderungen ----------
  // GModG (bis 28.07.2026: GEG) Anlage 7, Wohngebäude, Raum-Solltemperatur >= 19 °C.
  // Werte durch die Novelle vom 23.07.2026 (BGBl. 2026 I Nr. 226) unverändert.
  const ANFORDERUNG = {
    quelle: 'GModG Anlage 7 (zu § 36), Wohngebäude',
    aussenwand: { uMax: 0.24, nr: '1a/1b' },
    fenster: { uMax: 1.3, nr: '2a' },
  };

  // Wärmeübergangswiderstände nach DIN EN ISO 6946 (horizontaler Wärmestrom)
  const RSI = 0.13;
  const RSE = 0.04;              // direkt an Außenluft (WDVS)
  const RSE_HINTERLUEFTET = 0.13; // stark belüftete Luftschicht: Rse = Rsi, Bekleidung zählt nicht

  // ---------- Bestand: amtliche Pauschalwerte nach Baualtersklasse ----------
  // Quelle: Bekanntmachung der Regeln zur Datenaufnahme und Datenverwendung im Wohngebäudebestand
  // vom 8. Oktober 2020 (BAnz AT 04.12.2020 B1), Tabelle 2: Außenwand, nicht nachträglich gedämmt.
  // Werte gelten inkl. Rsi/Rse. null = „keine Angabe“ in der Tabelle.
  const QUELLE_BESTAND = 'Bekanntmachung Datenaufnahme Wohngebäudebestand 2020 (BAnz AT 04.12.2020 B1), Tab. 2';
  const BAUALTERSKLASSEN = [
    { von: -Infinity, bis: 1918, text: 'bis 1918' },
    { von: 1919, bis: 1948, text: '1919–1948' },
    { von: 1949, bis: 1957, text: '1949–1957' },
    { von: 1958, bis: 1968, text: '1958–1968' },
    { von: 1969, bis: 1978, text: '1969–1978' },
    { von: 1979, bis: 1983, text: '1979–1983' },
    { von: 1984, bis: 1994, text: '1984–1994' },
    { von: 1995, bis: 2001, text: '1995–2001' },
    { von: 2002, bis: Infinity, text: 'ab 2002' },
  ];
  const X = null; // „keine Angabe“
  // Vollständige Tabelle 2 (Außenwand). u: Werte je Baualtersklasse in obiger Reihenfolge.
  // baender: dickenabhängige Zeilen (Wandstärke in m, obere Grenze). ersatz: Zeile, wenn „keine Angabe“.
  const WANDKONSTRUKTIONEN = {
    lochstein: {
      gruppe: 'massiv', name: 'Steine mit Hohlräumen: Hochlochziegel oder Bims-Hohlblocksteine',
      laie: 'Häufigste Bauweise ab 1950. Beim Bohren fällt man in Hohlräume; Bims-Steine sind grau und leicht.',
      zeile: 'Massivwand Hochlochziegel, Bimsbeton-Hohlsteine o. ä.', u: [1.4, 1.4, 1.4, 1.4, 1.0, 0.80, 0.60, 0.50, 0.40],
    },
    vollstein: {
      gruppe: 'massiv', name: 'Massive Vollsteine: Vollziegel, Kalksandstein, Bims-Vollstein, Naturstein',
      laie: 'Schwere Wand ohne Hohlräume; Bohrstaub rot (Ziegel) oder weiß (Kalksandstein). Typisch bis 1957.',
      zeile: 'Massivwand Vollziegel, wenig poröser Naturstein, KS o. ä.',
      baender: [
        { bis: 0.20, text: 'bis 20 cm', u: [2.8, 2.8, 2.8, X, X, X, X, X, X] },
        { bis: 0.30, text: '20–30 cm', u: [1.8, 1.8, 1.8, X, X, X, X, X, X] },
        { bis: Infinity, text: 'über 30 cm', u: [1.5, 1.5, 1.5, X, X, X, X, X, X] },
      ],
      ersatz: 'sonstige',
    },
    zweischalig: {
      gruppe: 'massiv', name: 'Zweischalig mit Klinker außen, ohne Dämmung',
      laie: 'Außen sichtbare Klinker-/Verblendsteine, dahinter Luftschicht und Innenwand.',
      zeile: 'Zweischalig ohne Dämmschicht', u: [1.3, 1.3, 1.3, 1.4, 1.0, 0.80, 0.60, 0.50, 0.40],
    },
    zweischaligDaemm: {
      gruppe: 'massiv', name: 'Zweischalig mit Klinker außen, mit Dämmschicht',
      laie: 'Wie oben, zwischen den Schalen liegt bereits eine Dämmung.',
      zeile: 'Zweischalig mit Dämmschicht', u: [X, X, 1.0, 0.90, 0.90, 0.70, 0.50, 0.50, 0.40],
      ersatz: 'zweischalig',
    },
    sonstige: {
      gruppe: 'massiv', name: 'Sonstige massive Wand / weiß nicht',
      laie: 'Wenn unklar: Wert für sonstige massive Wände (z. B. Beton, Trümmerschutt, Porenbeton).',
      zeile: 'Sonstige massive Wandaufbauten',
      baender: [
        { bis: 0.20, text: 'bis 20 cm', u: [3.0, 3.0, 3.0, 1.4, 1.0, 0.80, 0.70, 0.70, 0.40] },
        { bis: Infinity, text: 'über 20 cm', u: [2.2, 2.2, 2.2, 1.4, 1.0, 0.80, 0.60, 0.50, 0.40] },
      ],
    },
    holzGedaemmt: {
      gruppe: 'holz', name: 'Holzbau: Massivholz, Holzrahmen oder Fertighaus mit Dämmung',
      laie: 'Wand klingt beim Klopfen hohl; Holzständer mit Dämmung dazwischen.',
      zeile: 'Massivholzwand, Holzrahmen oder Holztafel mit dämmender Füllung', u: [0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.40, 0.40, 0.30],
    },
    fachwerkLehm: {
      gruppe: 'holz', name: 'Fachwerk mit Lehm-Ausfachung',
      laie: 'Sichtbares Holzfachwerk, Felder aus Lehm oder Lehmziegeln. Typisch vor 1950.',
      zeile: 'Fachwerkwand mit Lehm-/Lehmziegelausfachung bis 25 cm', u: [1.5, 1.5, 1.5, X, X, X, X, X, X], ersatz: 'holzSonstige',
    },
    fachwerkZiegel: {
      gruppe: 'holz', name: 'Fachwerk mit Ziegel- oder Natursteinausfachung',
      laie: 'Sichtbares Holzfachwerk, Felder aus Ziegeln oder Naturstein. Typisch vor 1950.',
      zeile: 'Fachwerkwand mit Vollziegel oder massiver Natursteinausfachung bis 25 cm', u: [2.0, 2.0, 2.0, X, X, X, X, X, X], ersatz: 'holzSonstige',
    },
    holzSonstige: {
      gruppe: 'holz', name: 'Sonstige Holzkonstruktion',
      laie: 'Holzwand, die zu keiner der obigen Arten passt.',
      zeile: 'Sonstige Holzkonstruktion', u: [2.0, 2.0, 1.5, 1.4, 0.60, 0.50, 0.40, 0.40, 0.30],
    },
  };

  // ---------- Sanierung: Fassadensysteme und Dämmstoffe (laut Projektkonzept Gruppe 2) ----------
  // deltaU: pauschaler Zuschlag für Wärmebrücken der Befestigung (Dübel bzw. Unterkonstruktion).
  const UNTERKONSTRUKTION = {
    holz: { name: 'Holz-Unterkonstruktion', deltaU: 0.02, quelle: 'Annahme (Lattung durchdringt Dämmebene)' },
    alu: { name: 'Aluminium-Unterkonstruktion', deltaU: 0.04, quelle: 'Annahme (Alu-Konsolen mit Thermostopp)' },
  };
  const SYSTEME = {
    wdvs: { name: 'WDVS', rse: RSE, deltaU: 0.0, stufe: 0.02, maxDicke: 0.30,
      hinweis: 'Dübel bei LPh 2 vernachlässigt. Putzsystem (mineralisch/Silikat) beeinflusst U nicht.' },
    vhf: { name: 'Vorhangfassade, hinterlüftet', rse: RSE_HINTERLUEFTET, deltaU: UNTERKONSTRUKTION.alu.deltaU, stufe: 0.02, maxDicke: 0.30,
      hinweis: 'ΔU je nach Unterkonstruktion (Holz 0,02 / Alu 0,04 W/(m²K), Annahmen). Bekleidung (Holz/Metall) und Luftschicht zählen nicht.' },
  };

  // Projektkonzept Folie 7/8: in beiden Systemen Mineralwolle, EPS, Holzfaser.
  // λ = Richtwerte aus der Konzeptskizze; maßgeblich ist das konkrete Produktdatenblatt.
  const DAEMMSTOFFE = {
    mw: { name: 'Mineralwolle', lambda: 0.035, brennbar: false, systeme: ['wdvs', 'vhf'], quelle: 'Projektkonzept, Richtwert' },
    eps: { name: 'EPS', lambda: 0.035, brennbar: true, systeme: ['wdvs', 'vhf'], quelle: 'Projektkonzept, Richtwert' },
    holzfaser: { name: 'Holzfaser', lambda: 0.040, brennbar: true, systeme: ['wdvs', 'vhf'], quelle: 'Projektkonzept, Richtwert' },
  };

  // ---------- Fenster (DIN EN ISO 10077-1, vereinfacht) ----------
  // Uf = Rahmen, Richtwerte aktueller Profile (Spanne ca. 0,9–1,4 W/(m²K))
  const RAHMEN = {
    pvc: { name: 'PVC (Kunststoff)', uf: 1.1, quelle: 'Richtwert Marktprodukte' },
    holz: { name: 'Holz', uf: 1.2, quelle: 'Richtwert Marktprodukte (z. B. IV 78)' },
    holzalu: { name: 'Holz-Alu', uf: 1.2, quelle: 'Richtwert Marktprodukte' },
  };
  // Ug = Verglasung, psi = Randverbund (warme Kante)
  const VERGLASUNG = {
    zweifach: { name: '2-fach', ug: 1.1, psi: 0.05, quelle: 'Ug Richtwert; ψ warme Kante nach DIN EN ISO 10077-1 Anh. G (Größenordnung)' },
    dreifach: { name: '3-fach', ug: 0.6, psi: 0.05, quelle: 'Ug Richtwert; ψ warme Kante nach DIN EN ISO 10077-1 Anh. G (Größenordnung)' },
  };

  // ---------- Brandschutz (Orientierung LPh 2, ersetzt keine Fachplanung) ----------
  // Gebäudeklasse nach MBO § 2 vereinfacht über die Fußbodenhöhe des obersten Geschosses.
  // GK 1–3 und GK 4–5 werden zusammengefasst, weil die Anforderungen an die Fassade jeweils gleich sind.
  const GEBAEUDEKLASSEN = {
    gk13: { name: 'Gebäudeklasse 1–3', kurz: 'GK 1–3', text: 'oberstes Geschoss bis 7 m' },
    gk45: { name: 'Gebäudeklasse 4–5', kurz: 'GK 4–5', text: 'oberstes Geschoss 7–22 m' },
    hochhaus: { name: 'Hochhaus', kurz: 'Hochhaus', text: 'oberstes Geschoss über 22 m' },
  };
  const GESCHOSSHOEHE = 2.8; // m, Annahme Wohnungsbau 1950–1970
  const EG_HOEHE = 0.6;      // m, Fußboden Erdgeschoss über Gelände (Annahme)

  /** Gebäudeklasse aus der Zahl der oberirdischen Geschosse (inkl. EG). */
  function gebaeudeklasse(geschosse) {
    if (!(Number.isInteger(geschosse) && geschosse >= 1 && geschosse <= 40)) throw new Error('Bitte die Anzahl der Geschosse (1–40) angeben.');
    const h = EG_HOEHE + (geschosse - 1) * GESCHOSSHOEHE;
    const key = h <= 7 ? 'gk13' : h <= 22 ? 'gk45' : 'hochhaus';
    return { geschosse, hoehe: h, key, ...GEBAEUDEKLASSEN[key] };
  }

  /** Ist die Kombination System × Dämmstoff in der Gebäudeklasse zulässig? */
  function brandschutz(systemKey, daemmKey, gkKey) {
    const dm = DAEMMSTOFFE[daemmKey];
    if (!GEBAEUDEKLASSEN[gkKey]) throw new Error('Unbekannte Gebäudeklasse: ' + gkKey);
    const r = (zulaessig, grund, auflage = null) => ({ zulaessig, grund, auflage });
    if (!dm.brennbar) return r(true, 'nichtbrennbar (A1/A2)');
    if (gkKey === 'hochhaus') return r(false, 'Hochhaus: nur nichtbrennbare Dämmstoffe zulässig');
    if (gkKey === 'gk13') {
      return r(true, 'GK 1–3: normalentflammbare Dämmung zulässig (MBO § 28)', daemmKey === 'eps' ? 'Vorgaben der Systemzulassung beachten' : null);
    }
    if (systemKey === 'vhf') return r(false, 'Hinterlüftete Fassade ab GK 4: Dämmung muss nichtbrennbar sein (MVV TB Anhang 6, Nr. 3.1)');
    if (daemmKey === 'eps') return r(true, 'schwerentflammbares EPS-WDVS mit Zulassung', 'Brandriegel aus Mineralwolle (Sockel und mind. jedes 2. Geschoss) oder Sturzschutz nach Zulassung');
    return r(false, 'ab GK 4 schwerentflammbar gefordert (MBO § 28 Abs. 3); Holzfaser ist normalentflammbar – nur mit Systemzulassung als schwerentflammbar');
  }

  // ---------- Rechnung ----------
  const sumR = (schichten) => schichten.reduce((a, s) => {
    if (!(s.d >= 0) || !(s.lambda > 0)) throw new Error('Ungültige Schicht: ' + (s.name || JSON.stringify(s)));
    return a + s.d / s.lambda;
  }, 0);

  /** U-Wert aus Schichten (d in m, λ in W/mK). */
  function uWert(schichten, rsi = RSI, rse = RSE) {
    return 1 / (rsi + sumR(schichten) + rse);
  }

  function baualtersklasse(baujahr) {
    if (!Number.isInteger(baujahr) || baujahr < 1500 || baujahr > 2100) throw new Error('Bitte ein gültiges Baujahr eingeben.');
    const i = BAUALTERSKLASSEN.findIndex((k) => baujahr >= k.von && baujahr <= k.bis);
    return { index: i, ...BAUALTERSKLASSEN[i] };
  }

  /**
   * Bestandswand aus Baujahr, Wandart und Wandstärke (m) mit amtlichem Pauschal-U-Wert.
   * R der Wand (ohne Übergänge) = 1/U − Rsi − Rse; damit wird die Dämmdicke berechnet.
   */
  function bestandswand(baujahr, konstruktionKey, dicke) {
    const kl = baualtersklasse(baujahr);
    let k = WANDKONSTRUKTIONEN[konstruktionKey], key = konstruktionKey;
    if (!k) throw new Error('Unbekannte Wandart: ' + konstruktionKey);
    if (!(dicke >= 0.10 && dicke <= 1.0)) throw new Error('Wandstärke bitte zwischen 10 und 100 cm angeben.');
    const hinweise = [];
    const wert = (kk) => {
      if (!kk.baender) return { u: kk.u[kl.index], zeile: kk.zeile };
      const band = kk.baender.find((x) => dicke <= x.bis + 1e-9);
      return { u: band.u[kl.index], zeile: `${kk.zeile}, ${band.text}` };
    };
    let w = wert(k);
    while (w.u == null && k.ersatz) {
      const neu = WANDKONSTRUKTIONEN[k.ersatz];
      hinweise.push(`Für „${k.name}“ enthält die Tabelle in der Baualtersklasse ${kl.text} keinen Wert; ersatzweise „${neu.name}“.`);
      key = k.ersatz; k = neu; w = wert(k);
    }
    if (w.u == null) throw new Error('Für diese Wandart und Baualtersklasse gibt es keinen Pauschalwert.');
    if (/^fachwerk/.test(key) && dicke > 0.25 + 1e-9) hinweise.push('Tabellenwert gilt für Fachwerk bis 25 cm.');
    if (baujahr >= 1984) hinweise.push('Wand nach 1983 unter Wärmeschutzvorschriften errichtet: Beim nachträglichen Dämmen muss der Höchstwert nach GModG Anlage 7 Nr. 1b nicht eingehalten werden. Das Tool rechnet trotzdem auf U ≤ 0,24.');
    if (/^(fachwerk|holz)/.test(key)) hinweise.push('Holz-/Fachwerkwand: Feuchteschutz und Eignung des Dämmsystems (diffusionsoffen) fachlich prüfen lassen.');
    const R = 1 / w.u - RSI - RSE;
    return {
      baujahr, klasse: kl.text, konstruktion: key, gesamtDicke: dicke,
      u: w.u, R, zeile: w.zeile, quelle: QUELLE_BESTAND, hinweise,
    };
  }

  const aufrunden = (x, stufe) => Math.ceil(x / stufe - 1e-9) * stufe;

  /**
   * Erforderliche Dämmdicke, damit U_neu <= uMax.
   * U_neu = 1 / (Rsi + R_bestand + d/λ + Rse) + ΔU
   */
  function daemmdicke(wand, systemKey, daemmKey, opts = {}) {
    const sys = SYSTEME[systemKey], dm = DAEMMSTOFFE[daemmKey];
    if (!sys) throw new Error('Unbekanntes System: ' + systemKey);
    if (!dm) throw new Error('Unbekannter Dämmstoff: ' + daemmKey);
    const uMax = opts.uMax ?? ANFORDERUNG.aussenwand.uMax;
    const uk = systemKey === 'vhf' ? (opts.uk || 'alu') : null;
    if (uk && !UNTERKONSTRUKTION[uk]) throw new Error('Unbekannte Unterkonstruktion: ' + uk);
    const deltaU = opts.deltaU ?? (uk ? UNTERKONSTRUKTION[uk].deltaU : sys.deltaU);
    const stufe = opts.stufe ?? sys.stufe;
    const lambda = opts.lambda ?? dm.lambda;
    const uZiel = uMax - deltaU;
    if (!(uZiel > 0)) throw new Error('ΔU ist größer als der Höchstwert');
    const rFehlt = 1 / uZiel - RSI - sys.rse - wand.R;
    const dTheo = Math.max(0, rFehlt * lambda);
    const d = aufrunden(dTheo, stufe);
    const uNeu = 1 / (RSI + wand.R + d / lambda + sys.rse) + deltaU;
    const warnungen = [];
    if (d > sys.maxDicke) warnungen.push(`Dicke ${(d * 100).toFixed(0)} cm über üblichem Maximum (${sys.maxDicke * 100} cm) – Zulassung/Machbarkeit prüfen.`);
    if (dTheo === 0) warnungen.push('Bestandswand erfüllt den Höchstwert bereits ohne Dämmung.');
    if (wand.konstruktion && wand.konstruktion.startsWith('zweischalig')) warnungen.push('Zweischalige Wand: Kerndämmung der Luftschicht als günstige Alternative prüfen; Außendämmung auf Klinker nur mit Zulassung.');
    return {
      system: systemKey, daemmstoff: daemmKey, unterkonstruktion: uk, lambda, deltaU, uMax,
      brandschutz: opts.gk ? brandschutz(systemKey, daemmKey, opts.gk) : null,
      dTheoretisch: dTheo, d, uNeu, uTheoretisch: dTheo > 0 ? uMax : 1 / (RSI + wand.R + sys.rse) + deltaU, erfuellt: uNeu <= uMax + 1e-9, warnungen,
    };
  }

  /** Alle Kombinationen System × zugelassener Dämmstoff. */
  function variantenWand(wand, opts = {}) {
    const out = [];
    for (const sk of Object.keys(SYSTEME)) {
      for (const [dk, dm] of Object.entries(DAEMMSTOFFE)) {
        if (dm.systeme.includes(sk)) out.push(daemmdicke(wand, sk, dk, { gk: opts.gk, ...(opts[sk] || {}) }));
      }
    }
    return out;
  }

  /**
   * Uw eines Fensters (DIN EN ISO 10077-1): Uw = (Ag·Ug + Af·Uf + lg·ψ) / Aw.
   * b, h = Außenmaß in m (aus dem Aufmaß), rahmenanteil = Af/Aw.
   * Glasumfang lg vereinfacht: Glasfeld mit gleichem Seitenverhältnis, Seiten mit √(1−f) skaliert (ein Flügel).
   */
  function uwFenster(b, h, rahmenanteil, rahmenKey, verglasungKey) {
    const r = RAHMEN[rahmenKey], g = VERGLASUNG[verglasungKey];
    if (!r || !g) throw new Error('Unbekannter Rahmen oder Verglasung');
    if (!(b > 0 && h > 0)) throw new Error('Fenstermaße ungültig');
    if (!(rahmenanteil >= 0 && rahmenanteil < 1)) throw new Error('Rahmenanteil muss zwischen 0 und 1 liegen');
    const aw = b * h, af = aw * rahmenanteil, ag = aw - af;
    const k = Math.sqrt(1 - rahmenanteil), lg = 2 * (b * k + h * k);
    return { aw, ag, af, lg, uw: (ag * g.ug + af * r.uf + lg * g.psi) / aw };
  }

  /** Fenstertausch für alle Fenster; neue Fenster müssen Uw <= 1,3 einhalten. */
  function fensterTausch(fenster, rahmenKey, verglasungKey, rahmenanteil = 0.30) {
    const uMax = ANFORDERUNG.fenster.uMax;
    const einzeln = fenster.map((f) => ({ ...f, ...uwFenster(f.b, f.h, rahmenanteil, rahmenKey, verglasungKey) }));
    const aw = einzeln.reduce((a, f) => a + f.aw, 0);
    const uwMittel = aw > 0 ? einzeln.reduce((a, f) => a + f.uw * f.aw, 0) / aw : NaN;
    return {
      rahmen: rahmenKey, verglasung: verglasungKey, rahmenanteil,
      anzahl: einzeln.length, flaeche: aw, uwNeu: uwMittel, uMax,
      flaecheGlas: einzeln.reduce((a, f) => a + f.ag, 0), flaecheRahmen: einzeln.reduce((a, f) => a + f.af, 0),
      erfuellt: einzeln.length > 0 && einzeln.every((f) => f.uw <= uMax + 1e-9), einzeln,
    };
  }

  /** Alle 6 Fensteroptionen (3 Rahmen × 2 Verglasungen) zum Vergleich. */
  function fensterOptionen(fenster, rahmenanteil = 0.30) {
    const out = [];
    for (const r of Object.keys(RAHMEN)) for (const g of Object.keys(VERGLASUNG)) out.push(fensterTausch(fenster, r, g, rahmenanteil));
    return out;
  }

  const api = {
    ANFORDERUNG, RSI, RSE, RSE_HINTERLUEFTET, QUELLE_BESTAND, BAUALTERSKLASSEN, WANDKONSTRUKTIONEN,
    UNTERKONSTRUKTION, SYSTEME, DAEMMSTOFFE, RAHMEN, VERGLASUNG, GEBAEUDEKLASSEN, GESCHOSSHOEHE, EG_HOEHE,
    gebaeudeklasse, brandschutz, uWert, baualtersklasse, bestandswand, daemmdicke, variantenWand, uwFenster, fensterTausch, fensterOptionen, aufrunden,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Bauphysik = api;
})(typeof self !== 'undefined' ? self : this);
