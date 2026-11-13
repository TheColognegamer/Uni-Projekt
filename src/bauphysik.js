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

  // ---------- Bestand: typische Wandbaustoffe Köln 1950–1970 ----------
  // λ = Bemessungswert Wärmeleitfähigkeit in W/(m·K)
  const WANDBAUSTOFFE = {
    vollziegel: { name: 'Vollziegel (ρ ≈ 1800 kg/m³)', lambda: 0.81, quelle: 'DIN 4108-4, Tab. 1' },
    hlz: { name: 'Hochlochziegel (ρ ≈ 1200 kg/m³)', lambda: 0.50, quelle: 'DIN 4108-4, Richtwert (Spanne 0,50–0,60)' },
    bims: { name: 'Bims-/Leichtbeton-Hohlblock (ρ ≈ 1000 kg/m³)', lambda: 0.46, quelle: 'Annahme, Spanne DIN 4108-4 ca. 0,36–0,55; im Rheinland häufig' },
    ks: { name: 'Kalksandstein (ρ ≈ 1800 kg/m³)', lambda: 0.99, quelle: 'DIN 4108-4, Tab. 1' },
    truemmer: { name: 'Trümmerschutt-/Splittbeton', lambda: 0.75, quelle: 'Annahme (Nachkriegsbau, stark schwankend)' },
    beton: { name: 'Stahlbeton', lambda: 2.3, quelle: 'DIN EN ISO 10456' },
  };
  const PUTZ = {
    innen: { name: 'Innenputz (Kalkgips)', d: 0.015, lambda: 0.70, quelle: 'DIN 4108-4' },
    aussen: { name: 'Außenputz (Kalkzement)', d: 0.020, lambda: 1.00, quelle: 'DIN 4108-4' },
  };

  // ---------- Sanierung: Fassadensysteme und Dämmstoffe (laut Projektkonzept Gruppe 2) ----------
  // deltaU: pauschaler Zuschlag für Wärmebrücken der Befestigung (Dübel bzw. Unterkonstruktion).
  const UNTERKONSTRUKTION = {
    holz: { name: 'Holz-Unterkonstruktion', deltaU: 0.02, quelle: 'Annahme (Lattung durchdringt Dämmebene)' },
    alu: { name: 'Aluminium-Unterkonstruktion', deltaU: 0.04, quelle: 'Annahme (Alu-Konsolen mit Thermostopp)' },
  };
  const SYSTEME = {
    wdvs: { name: 'WDVS', rse: RSE, deltaU: 0.0, stufe: 0.02, maxDicke: 0.30,
      hinweis: 'Dübel bei LPh 2 vernachlässigt. Alter Außenputz bleibt als Untergrund und zählt mit. Putzsystem (mineralisch/Silikat) beeinflusst U nicht.' },
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
  const FENSTER_BESTAND = {
    einfach: { name: 'Einfachverglasung (Original)', uw: 5.0 },
    verbund: { name: 'Verbund-/Kastenfenster (Original)', uw: 2.7 },
    isolier: { name: 'Isolierglas 2-fach (1970–1995)', uw: 2.8 },
  };
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

  // ---------- Rechnung ----------
  const sumR = (schichten) => schichten.reduce((a, s) => {
    if (!(s.d >= 0) || !(s.lambda > 0)) throw new Error('Ungültige Schicht: ' + (s.name || JSON.stringify(s)));
    return a + s.d / s.lambda;
  }, 0);

  /** U-Wert aus Schichten (d in m, λ in W/mK). */
  function uWert(schichten, rsi = RSI, rse = RSE) {
    return 1 / (rsi + sumR(schichten) + rse);
  }

  /** Bestandswand aus Gesamtstärke (inkl. Putz) und Baustoff. dicke in m. */
  function bestandswand(baustoffKey, gesamtDicke, mitPutz = true) {
    const b = WANDBAUSTOFFE[baustoffKey];
    if (!b) throw new Error('Unbekannter Wandbaustoff: ' + baustoffKey);
    const putz = mitPutz ? [PUTZ.innen, PUTZ.aussen] : [];
    const dMauer = gesamtDicke - putz.reduce((a, p) => a + p.d, 0);
    if (!(dMauer > 0.05)) throw new Error('Wandstärke zu gering (Mauerwerk < 5 cm)');
    const schichten = [...(mitPutz ? [PUTZ.innen] : []), { name: b.name, d: dMauer, lambda: b.lambda }, ...(mitPutz ? [PUTZ.aussen] : [])];
    return { baustoff: baustoffKey, gesamtDicke, dMauer, schichten, R: sumR(schichten), u: uWert(schichten) };
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
    if (systemKey === 'vhf' && dm.brennbar) warnungen.push('Brennbarer Dämmstoff in hinterlüfteter Fassade: ab Gebäudeklasse 4 sind nach Bauordnung nichtbrennbare Dämmstoffe gefordert – prüfen.');
    if (systemKey === 'wdvs' && daemmKey === 'eps' && d >= 0.10) warnungen.push('EPS-WDVS ≥ 10 cm: Brandriegel nach Zulassung einplanen.');
    return {
      system: systemKey, daemmstoff: daemmKey, unterkonstruktion: uk, lambda, deltaU, uMax,
      dTheoretisch: dTheo, d, uNeu, uTheoretisch: dTheo > 0 ? uMax : 1 / (RSI + wand.R + sys.rse) + deltaU, erfuellt: uNeu <= uMax + 1e-9, warnungen,
    };
  }

  /** Alle Kombinationen System × zugelassener Dämmstoff. */
  function variantenWand(wand, opts = {}) {
    const out = [];
    for (const sk of Object.keys(SYSTEME)) {
      for (const [dk, dm] of Object.entries(DAEMMSTOFFE)) {
        if (dm.systeme.includes(sk)) out.push(daemmdicke(wand, sk, dk, (opts[sk] || {})));
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

  /** Fenstertausch für alle Fenster aus dem Aufmaß; neue Fenster müssen Uw <= 1,3 einhalten. */
  function fensterTausch(fenster, bestandKey, rahmenKey, verglasungKey, rahmenanteil = 0.30) {
    const alt = FENSTER_BESTAND[bestandKey];
    if (!alt) throw new Error('Unbekannter Bestandsfenstertyp');
    const uMax = ANFORDERUNG.fenster.uMax;
    const einzeln = fenster.map((f) => ({ ...f, ...uwFenster(f.b, f.h, rahmenanteil, rahmenKey, verglasungKey) }));
    const aw = einzeln.reduce((a, f) => a + f.aw, 0);
    const uwMittel = aw > 0 ? einzeln.reduce((a, f) => a + f.uw * f.aw, 0) / aw : NaN;
    return {
      bestand: bestandKey, rahmen: rahmenKey, verglasung: verglasungKey, rahmenanteil,
      anzahl: einzeln.length, flaeche: aw, uwAlt: alt.uw, uwNeu: uwMittel, uMax,
      erfuellt: einzeln.length > 0 && einzeln.every((f) => f.uw <= uMax + 1e-9), einzeln,
    };
  }

  const api = {
    ANFORDERUNG, RSI, RSE, RSE_HINTERLUEFTET, WANDBAUSTOFFE, PUTZ, UNTERKONSTRUKTION, SYSTEME, DAEMMSTOFFE,
    FENSTER_BESTAND, RAHMEN, VERGLASUNG,
    uWert, bestandswand, daemmdicke, variantenWand, uwFenster, fensterTausch, aufrunden,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Bauphysik = api;
})(typeof self !== 'undefined' ? self : this);
