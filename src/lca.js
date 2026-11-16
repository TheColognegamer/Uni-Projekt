/* LCA-Rechenkern: GWP-total je m² und für die ganze Fassade (WDVS, VHF, Fenster) für 30 und 50 Jahre.
 * Rein funktional, ohne DOM -> in Node testbar. Daten: src/lca-data.js
 *
 * Rechenweg (wie Excel LCA_Fassadensanierung_WDVS_VHF.xlsx):
 *   Schritt 2  Menge je m²:   M = Grundmenge · (1 + Verschnitt)   (Grundmenge je nach Bezugseinheit, siehe lca-data.js)
 *   Schritt 3  Austausch:     n = ABRUNDEN((T − 1) / Nutzungsdauer)
 *   Schritt 4  Ergebnis:      GWP = M · [ (A1–A3) + n · (A1–A3 + C3 + C4) + (C3 + C4) ]
 *              = Herstellung A1–A3 + Ersatz B4 + Entsorgung C3+C4.  Modul D ist nicht enthalten.
 */
(function (root) {
  'use strict';
  const D = typeof module !== 'undefined' && module.exports ? require('./lca-data.js') : root.LcaDaten;

  /** Anzahl Austausche im Betrachtungszeitraum T (Jahre) bei Nutzungsdauer rsl (Jahre). */
  function austausch(T, rsl) {
    if (!(T > 0)) throw new Error('Betrachtungszeitraum muss > 0 sein');
    if (!(rsl > 0)) throw new Error('Nutzungsdauer muss > 0 sein');
    return Math.floor((T - 1) / rsl);
  }

  /**
   * Fenstergeometrie je m² Fensterfläche aus den Fenstermaßen (Aufmaß) oder dem Normfenster.
   * fenster = [{ b, h }] in m; rahmenanteil 0..1; fluegelAbzug in m je Richtung.
   */
  function fensterGeometrie(fenster, rahmenanteil = D.FENSTER_STANDARD.rahmenanteil, fluegelAbzug = D.FENSTER_STANDARD.fluegelAbzug) {
    const liste = (fenster || []).filter((f) => f && f.b > 0 && f.h > 0);
    const quelle = liste.length ? 'aufmass' : 'annahme';
    const fs = liste.length ? liste : [{ b: D.FENSTER_STANDARD.b, h: D.FENSTER_STANDARD.h }];
    if (!(rahmenanteil >= 0 && rahmenanteil < 1)) throw new Error('Rahmenanteil muss zwischen 0 und 1 liegen');
    const flaeche = fs.reduce((a, f) => a + f.b * f.h, 0);
    const blend = fs.reduce((a, f) => a + 2 * (f.b + f.h), 0);
    const fluegel = fs.reduce((a, f) => a + 2 * (Math.max(0, f.b - fluegelAbzug) + Math.max(0, f.h - fluegelAbzug)), 0);
    return {
      quelle, anzahl: fs.length, flaeche, rahmenanteil, fluegelAbzug,
      blendrahmen: blend / flaeche,      // m Blendrahmen je m² Fenster
      fluegelrahmen: fluegel / flaeche,  // m Flügelrahmen je m² Fenster
      glas: 1 - rahmenanteil,            // m² Glas je m² Fenster
      beschlag: fs.length / flaeche,     // Stück je m² Fenster
    };
  }

  /** Datensatz einer Schicht (mit Prüfung). */
  function datensatz(s) {
    const ds = D.DATENSAETZE[s.ds];
    if (!ds) throw new Error('Unbekannter Datensatz ' + s.ds + ' in Schicht ' + s.code);
    return ds;
  }

  /**
   * Menge je m² (in der Bezugseinheit des Datensatzes) inkl. Verschnitt.
   * ctx.dicke(schicht) -> Dicke in m für Dämmschichten (aus U-Wert-Berechnung) oder undefined (Startwert).
   * ctx.fenster -> Ergebnis von fensterGeometrie().
   */
  function menge(s, ctx = {}) {
    const ds = datensatz(s);
    const dIn = s.daemmung && ctx.dicke ? ctx.dicke(s) : undefined;
    const d = Number.isFinite(dIn) ? dIn : s.d;
    const fg = ctx.fenster || fensterGeometrie();
    let grund;
    switch (s.art) {
      case 'volumen': grund = d; break;
      case 'masse': grund = d * ds.kennwert; break;
      case 'direkt': grund = s.menge; break;
      case 'flaeche': grund = 1; break;
      case 'blendrahmen': grund = fg.blendrahmen; break;
      case 'fluegelrahmen': grund = fg.fluegelrahmen; break;
      case 'glas': grund = fg.glas; break;
      case 'beschlag': grund = fg.beschlag; break;
      default: throw new Error('Unbekannte Mengenart ' + s.art);
    }
    if (!Number.isFinite(grund) || grund < 0) throw new Error('Ungültige Menge in Schicht ' + s.code);
    return { d: s.art === 'volumen' || s.art === 'masse' ? d : null, grund, m: grund * (1 + (s.verschnitt || 0)) };
  }

  /** GWP einer Schicht je m² für T Jahre. */
  function schichtGwp(s, T, ctx = {}) {
    const ds = datensatz(s);
    const mg = menge(s, ctx);
    const rsl = (ctx.rsl && ctx.rsl[s.code]) || s.rsl;
    const n = austausch(T, rsl);
    const herstellung = mg.m * ds.a1a3;
    const entsorgung = mg.m * ((ds.c3 || 0) + (ds.c4 || 0));
    const ersatz = n * (herstellung + entsorgung);
    return { code: s.code, name: s.name, ds: ds.id, einheit: ds.einheit, d: mg.d, menge: mg.m, rsl, n, herstellung, ersatz, entsorgung, total: herstellung + ersatz + entsorgung };
  }

  /** Wahlschlüssel der Schichten zu einer Konfiguration. */
  function wahlen(system, k) {
    if (system === 'wdvs') return [k.daemmstoff, k.putz];
    if (system === 'vhf') return [k.daemmstoff, 'uk-' + k.uk, 'b-' + k.bekleidung];
    if (system === 'fenster') return [k.rahmen, k.verglasung];
    throw new Error('Unbekanntes System ' + system);
  }

  /** Schichten einer Konfiguration, z. B. aufbau('vhf', { daemmstoff:'mw', uk:'holz', bekleidung:'holz' }). */
  function aufbau(system, k) {
    const liste = D.SCHICHTEN[system];
    if (!liste) throw new Error('Unbekanntes System ' + system);
    const w = wahlen(system, k);
    w.forEach((x) => { if (!liste.some((s) => s.wahl === x)) throw new Error(`Auswahl „${x}“ gibt es für ${system} nicht`); });
    return liste.filter((s) => s.wahl === 'FIX' || w.includes(s.wahl));
  }

  /** Bilanz je m² (Wand bzw. Fenster) für T Jahre: Summen und Schichten. */
  function bilanz(system, k, T, ctx = {}) {
    const schichten = aufbau(system, k).map((s) => schichtGwp(s, T, ctx));
    const sum = (f) => schichten.reduce((a, s) => a + s[f], 0);
    return { system, konfig: k, T, schichten, herstellung: sum('herstellung'), ersatz: sum('ersatz'), entsorgung: sum('entsorgung'), total: sum('total') };
  }

  // ---------- Varianten wie im Excel-Blatt „Variantenvergleich“ ----------
  const NAME = {
    daemmstoff: { mw: 'Mineralwolle', eps: 'EPS', holzfaser: 'Holzfaser' },
    putz: { mineralisch: 'mineralischer Putz', silikat: 'Silikatputz' },
    uk: { holz: 'Holz-UK', alu: 'Alu-UK' },
    bekleidung: { holz: 'Holzbekleidung', alu: 'Metallbekleidung' },
    rahmen: { holz: 'Holz', alu: 'Aluminium', pvc: 'PVC' },
    verglasung: { zweifach: '2-fach', dreifach: '3-fach' },
  };

  function fassadenName(system, k) {
    if (system === 'wdvs') return `WDVS ${NAME.daemmstoff[k.daemmstoff]} / ${NAME.putz[k.putz]}`;
    return `VHF ${NAME.daemmstoff[k.daemmstoff]} / ${NAME.uk[k.uk]} / ${NAME.bekleidung[k.bekleidung]}`;
  }
  function fensterName(k) { return `Fenster ${NAME.rahmen[k.rahmen]} / ${NAME.verglasung[k.verglasung]}-Verglasung`; }
  const fassadenId = (system, k) => system === 'wdvs' ? `wdvs-${k.daemmstoff}-${k.putz}` : `vhf-${k.daemmstoff}-${k.uk}-${k.bekleidung}`;
  const fensterId = (k) => `fenster-${k.rahmen}-${k.verglasung}`;

  /** Alle 18 Fassadenvarianten (6 WDVS, 12 VHF) in der Reihenfolge der Excel. */
  function fassadenVarianten() {
    const out = [];
    for (const daemmstoff of ['mw', 'eps', 'holzfaser']) for (const putz of ['mineralisch', 'silikat']) {
      const k = { daemmstoff, putz }; out.push({ id: fassadenId('wdvs', k), system: 'wdvs', konfig: k, name: fassadenName('wdvs', k) });
    }
    for (const daemmstoff of ['mw', 'eps', 'holzfaser']) for (const uk of ['holz', 'alu']) for (const bekleidung of ['holz', 'alu']) {
      const k = { daemmstoff, uk, bekleidung }; out.push({ id: fassadenId('vhf', k), system: 'vhf', konfig: k, name: fassadenName('vhf', k) });
    }
    return out;
  }

  /** Alle 6 Fenstervarianten (3 Rahmen × 2 Verglasungen). */
  function fensterVarianten() {
    const out = [];
    for (const rahmen of ['holz', 'alu', 'pvc']) for (const verglasung of ['zweifach', 'dreifach']) {
      const k = { rahmen, verglasung }; out.push({ id: fensterId(k), system: 'fenster', konfig: k, name: fensterName(k) });
    }
    return out;
  }

  /** GWP je m² für alle Zeiträume: { 30: bilanz, 50: bilanz }. */
  function jeZeitraum(system, k, ctx = {}, zeitraeume = D.ZEITRAEUME) {
    const o = {};
    zeitraeume.forEach((T) => { o[T] = bilanz(system, k, T, ctx); });
    return o;
  }

  /**
   * Gesamtfassade: opake Wand (wandNetto m²) + Fenster (fensterFlaeche m²) für alle Zeiträume, in kg CO₂-Äq.
   * fassade = { system, konfig }, fenster = { konfig } oder null.
   */
  function gesamt(fassade, fenster, flaechen, ctx = {}, zeitraeume = D.ZEITRAEUME) {
    const aW = flaechen.wandNetto, aF = flaechen.fenster || 0;
    if (!(aW > 0)) throw new Error('Wandfläche netto fehlt');
    const out = {};
    zeitraeume.forEach((T) => {
      const w = bilanz(fassade.system, fassade.konfig, T, ctx);
      const f = fenster && aF > 0 ? bilanz('fenster', fenster.konfig, T, ctx) : null;
      const opak = w.total * aW, fen = f ? f.total * aF : 0;
      out[T] = { opakM2: w.total, fensterM2: f ? f.total : 0, opak, fenster: fen, summe: opak + fen, wand: w, fensterBilanz: f };
    });
    return out;
  }

  const api = { austausch, fensterGeometrie, menge, schichtGwp, aufbau, bilanz, fassadenVarianten, fensterVarianten, fassadenName, fensterName, jeZeitraum, gesamt, NAME };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Lca = api;
})(typeof self !== 'undefined' ? self : this);
