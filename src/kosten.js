/* Kosten- und Empfehlungs-Kern: Investition, Lebenszykluskosten (LCC), Qualitätsnote, GWP und die drei Empfehlungen.
 * Rein funktional, ohne DOM -> in Node testbar. Daten und Annahmen: src/kosten-data.js
 *
 * Eingang: Ergebnis des Sanierungsmoduls (window.SanierungUI.ergebnis(), Ereignis 'sanierung'):
 *   varianten[] { system, daemmstoff, unterkonstruktion, d, dTheoretisch, uNeu, erfuellt, brandschutz, warnungen }, bezugsflaeche_m2
 * Rechenweg:
 *   Investition [€/m²]  = Preis(System, Dämmstoff) + Zuschlag je 20 mm Abweichung von 160 mm   (nur WDVS; Preisspanne aus der Excel)
 *   LCC [€/m²]          = Investition + Folgekosten (Barwert, je System)
 *   GWP [kg CO₂-Äq./m²] = LCA-Kern (src/lca.js) mit der Ausführungsdicke aus dem Sanierungsmodul
 *   Qualität [0–100]    = gewichtete Noten 1–5 (Kriterien in kosten-data.js)
 * Empfehlungen (nur zulässige Varianten):
 *   Premium             = höchste Qualitätsnote (bei Gleichstand die teurere)
 *   Preis-Leistung      = höchste Qualität je 100 € LCC
 *   Umweltfreundlichste = kleinstes GWP im gewählten Zeitraum (bei Gleichstand die günstigere)
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const K = isNode ? require('./kosten-data.js') : root.KostenDaten;
  const L = isNode ? require('./lca.js') : root.Lca;

  /** Investition je m² mit Preisspanne. */
  function investition(system, dk, d) {
    const base = K.INVEST[system] && K.INVEST[system][dk];
    if (!(base > 0)) throw new Error(`Kein Preis für ${system}/${dk}`);
    const hinweise = [];
    const zuschlag = K.ZUSCHLAG_20MM[system][dk] * ((d - K.BEZUGSDICKE) / 0.02);
    const mid = Math.max(base * K.MIN_ANTEIL, base + zuschlag);
    const g = K.GUELTIG[system];
    if (d < g.von - 1e-9 || d > g.bis + 1e-9) hinweise.push(`Dämmdicke ${(d * 100).toFixed(0)} cm liegt außerhalb der Preisbasis (${g.von * 100}–${g.bis * 100} cm): Preis hochgerechnet.`);
    const [f0, f1] = K.SPANNE[system][dk];
    return { mid, lo: mid * f0, hi: mid * f1, hinweise };
  }

  /** Qualitätsnote 0–100 aus den gewichteten Kriterien. gewichte = { id: Gewicht } (optional). */
  function qualitaet(system, dk, gewichte) {
    const w = (k) => (gewichte && Number.isFinite(gewichte[k.id]) ? gewichte[k.id] : k.gewicht);
    const noten = {}; let sum = 0, wsum = 0;
    for (const k of K.KRITERIEN) {
      const teile = [K.NOTEN.system[system][k.id], K.NOTEN.daemmstoff[dk][k.id]].filter(Number.isFinite);
      const note = teile.reduce((a, b) => a + b, 0) / teile.length;
      noten[k.id] = note; sum += w(k) * note; wsum += w(k);
    }
    return { punkte: wsum > 0 ? (sum / (5 * wsum)) * 100 : 0, noten };
  }

  /** Alle bewertbaren Varianten (System × Dämmstoff) mit Kosten, GWP und Qualität. */
  function kandidaten(san, opts = {}) {
    if (!san || !san.varianten || !(san.bezugsflaeche_m2 > 0)) return [];
    const area = san.bezugsflaeche_m2, out = [];
    for (const v of san.varianten) {
      if (!K.INVEST[v.system] || !K.INVEST[v.system][v.daemmstoff]) continue;
      const konfig = v.system === 'wdvs'
        ? { daemmstoff: v.daemmstoff, putz: opts.putz || 'mineralisch' }
        : { daemmstoff: v.daemmstoff, uk: v.unterkonstruktion || 'holz', bekleidung: opts.bekleidung || 'holz' };
      const ctx = { dicke: () => v.d };
      const gwp = {};
      for (const T of [30, 50]) { const b = L.bilanz(v.system, konfig, T, ctx); gwp[T] = { m2: b.total, gesamt: b.total * area, herstellung: b.herstellung, ersatz: b.ersatz, entsorgung: b.entsorgung }; }
      const inv = investition(v.system, v.daemmstoff, v.d), folge = K.FOLGEKOSTEN[v.system];
      const q = qualitaet(v.system, v.daemmstoff, opts.gewichte);
      const bs = v.brandschutz || null;
      const hinweise = [...inv.hinweise, ...(v.warnungen || [])];
      if (bs && bs.auflage) hinweise.push('Brandschutzauflage: ' + bs.auflage);
      if (bs && !bs.zulaessig) hinweise.push('Nicht zulässig: ' + bs.grund);
      if (v.system === 'vhf') hinweise.push('Preis gilt für Faserzementbekleidung (Excel); das GWP rechnet mit Holzbekleidung.');
      out.push({
        id: `${v.system}-${v.daemmstoff}`, system: v.system, daemmstoff: v.daemmstoff, konfig,
        name: `${v.system === 'wdvs' ? 'WDVS' : 'Vorgehängte Fassade'} ${K.NAMEN.daemmstoff[v.daemmstoff]}`,
        d: v.d, dTheoretisch: v.dTheoretisch, uNeu: v.uNeu, erfuellt: v.erfuellt !== false,
        zulaessig: !bs || bs.zulaessig, brandschutz: bs,
        invest: { m2: inv.mid, lo: inv.lo, hi: inv.hi, gesamt: inv.mid * area, gesamtLo: inv.lo * area, gesamtHi: inv.hi * area },
        folge: { m2: folge, gesamt: folge * area },
        lcc: { m2: inv.mid + folge, lo: inv.lo + folge, hi: inv.hi + folge, gesamt: (inv.mid + folge) * area, gesamtLo: (inv.lo + folge) * area, gesamtHi: (inv.hi + folge) * area },
        gwp, qualitaet: q, hinweise,
      });
    }
    return out;
  }

  /** Drei Empfehlungen aus den zulässigen Varianten. zeitraum = 30 oder 50 (für das GWP). */
  function empfehlung(kands, opts = {}) {
    const T = opts.zeitraum === 30 ? 30 : 50;
    const ok = kands.filter((k) => k.zulaessig && k.erfuellt);
    if (!ok.length) return { zeitraum: T, premium: null, preisLeistung: null, umwelt: null, teuerste: null, guenstigste: null, mehrfach: {} };
    const beste = (liste, score, tie) => liste.reduce((a, b) => { const sa = score(a), sb = score(b); return sb > sa + 1e-12 || (Math.abs(sb - sa) <= 1e-12 && tie(b) > tie(a)) ? b : a; });
    const premium = beste(ok, (k) => k.qualitaet.punkte, (k) => k.lcc.m2);
    const preisLeistung = beste(ok, (k) => k.qualitaet.punkte / k.lcc.m2, (k) => k.qualitaet.punkte);
    const umwelt = beste(ok, (k) => -k.gwp[T].m2, (k) => -k.lcc.m2);
    const teuerste = beste(ok, (k) => k.lcc.m2, () => 0), guenstigste = beste(ok, (k) => -k.lcc.m2, () => 0);
    const mehrfach = {};
    [['premium', premium], ['preisLeistung', preisLeistung], ['umwelt', umwelt]].forEach(([n, k]) => { (mehrfach[k.id] = mehrfach[k.id] || []).push(n); });
    // Gewinnt eine Variante mehrere Kategorien, gibt es für die späteren Kategorien zusätzlich die nächstbeste Alternative.
    const alternative = {}, ohne = (ids) => ok.filter((k) => !ids.includes(k.id));
    if (preisLeistung.id === premium.id) { const r = ohne([premium.id]); if (r.length) alternative.preisLeistung = beste(r, (k) => k.qualitaet.punkte / k.lcc.m2, (k) => k.qualitaet.punkte); }
    if (umwelt.id === premium.id || umwelt.id === preisLeistung.id) { const r = ohne([premium.id, preisLeistung.id]); if (r.length) alternative.umwelt = beste(r, (k) => -k.gwp[T].m2, (k) => -k.lcc.m2); }
    return { zeitraum: T, premium, preisLeistung, umwelt, teuerste, guenstigste, mehrfach, alternative };
  }

  const api = { investition, qualitaet, kandidaten, empfehlung };
  if (isNode) module.exports = api; else root.Kosten = api;
})(typeof self !== 'undefined' ? self : this);
