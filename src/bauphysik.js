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

  // ---------- Sanierung: Fassadensysteme und Dämmstoffe ----------
  // deltaU: pauschaler Zuschlag für Wärmebrücken der Befestigung (Dübel bzw. Unterkonstruktion).
  const SYSTEME = {
    wdvs: { name: 'WDVS', rse: RSE, deltaU: 0.0, stufe: 0.02, maxDicke: 0.30,
      hinweis: 'Dübel bei LPh 2 vernachlässigt. Alter Außenputz bleibt als Untergrund und zählt mit.' },
    vhf: { name: 'Vorhangfassade, hinterlüftet', rse: RSE_HINTERLUEFTET, deltaU: 0.03, stufe: 0.02, maxDicke: 0.30,
      hinweis: 'ΔU = 0,03 W/(m²K) für die Unterkonstruktion (Annahme, Alu-Konsolen mit Thermostopp). Bekleidung und Luftschicht zählen nicht.' },
  };

  // PLATZHALTER: Die drei Dämmstoffe je System legt das Team fest. Hier nur Liste und λ eintragen.
  // λ = Bemessungswert (Herstellerangabe / allgemeine bauaufsichtliche Zulassung prüfen).
  const DAEMMSTOFFE = {
    eps: { name: 'EPS (WLS 035)', lambda: 0.035, systeme: ['wdvs'], quelle: 'typischer Bemessungswert, Platzhalter' },
    mw: { name: 'Mineralwolle (WLS 035)', lambda: 0.035, systeme: ['wdvs', 'vhf'], quelle: 'typischer Bemessungswert, Platzhalter' },
    holzfaser: { name: 'Holzfaser (WLS 042)', lambda: 0.042, systeme: ['wdvs', 'vhf'], quelle: 'typischer Bemessungswert, Platzhalter' },
    hanf: { name: 'Hanf (WLS 040)', lambda: 0.040, systeme: ['vhf'], quelle: 'typischer Bemessungswert, Platzhalter' },
  };

  // ---------- Fenster ----------
  const FENSTER_BESTAND = {
    einfach: { name: 'Einfachverglasung (Original)', uw: 5.0 },
    verbund: { name: 'Verbund-/Kastenfenster (Original)', uw: 2.7 },
    isolier: { name: 'Isolierglas 2-fach (1970–1995)', uw: 2.8 },
  };
  const FENSTER_NEU = {
    kunststoff: { name: 'Kunststoff, 3-fach', uw: 0.95, quelle: 'Richtwert Marktprodukte (Spanne 0,8–1,0)' },
    holz: { name: 'Holz, 3-fach', uw: 0.95, quelle: 'Richtwert Marktprodukte (Spanne 0,8–1,0)' },
    holzalu: { name: 'Holz-Alu, 3-fach', uw: 0.90, quelle: 'Richtwert Marktprodukte (Spanne 0,8–1,0)' },
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
    const deltaU = opts.deltaU ?? sys.deltaU;
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
    return {
      system: systemKey, daemmstoff: daemmKey, lambda, deltaU, uMax,
      dTheoretisch: dTheo, d, uNeu, erfuellt: uNeu <= uMax + 1e-9, warnungen,
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

  /** Fenstertausch: Fläche aus dem Foto, neue Fenster müssen Uw <= 1,3 einhalten. */
  function fensterTausch(flaeche, anzahl, bestandKey, neuKey, opts = {}) {
    const alt = FENSTER_BESTAND[bestandKey], neu = FENSTER_NEU[neuKey];
    if (!alt || !neu) throw new Error('Unbekannter Fenstertyp');
    const uwNeu = opts.uw ?? neu.uw;
    const uMax = ANFORDERUNG.fenster.uMax;
    return {
      bestand: bestandKey, neu: neuKey, flaeche, anzahl,
      uwAlt: opts.uwAlt ?? alt.uw, uwNeu, uMax, erfuellt: uwNeu <= uMax + 1e-9,
    };
  }

  const api = {
    ANFORDERUNG, RSI, RSE, RSE_HINTERLUEFTET, WANDBAUSTOFFE, PUTZ, SYSTEME, DAEMMSTOFFE, FENSTER_BESTAND, FENSTER_NEU,
    uWert, bestandswand, daemmdicke, variantenWand, fensterTausch, aufrunden,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Bauphysik = api;
})(typeof self !== 'undefined' ? self : this);
