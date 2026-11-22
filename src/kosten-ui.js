/* Reiter „Empfehlung“: Kosten, Umwelt und Qualität der Dämmvarianten, drei Empfehlungen für den Kunden.
 * Eingang: Ereignis 'sanierung' bzw. window.SanierungUI.ergebnis() (Dämmdicken, Brandschutz, Fläche). Rechenkern: src/kosten.js. */
(function () {
  'use strict';
  const K = window.Kosten, KD = window.KostenDaten;
  const root = document.getElementById('tabEmpfehlung');
  if (!root || !K) return;

  const st = { zeitraum: 50, gewichte: {} };
  let letztes = null;

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = (x) => Math.round(x).toLocaleString('de-DE') + ' €';
  const num = (x, d = 0) => x.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const KRIT = Object.fromEntries(KD.KRITERIEN.map((k) => [k.id, k]));

  // Stärken und Schwächen aus den Noten (nur Kriterien mit Gewicht)
  function plus(k) {
    const g = (id) => (Number.isFinite(st.gewichte[id]) ? st.gewichte[id] : KRIT[id].gewicht);
    const liste = KD.KRITERIEN.filter((c) => g(c.id) > 0).map((c) => ({ c, n: k.qualitaet.noten[c.id] }));
    return {
      stark: liste.filter((x) => x.n >= 4.5).sort((a, b) => b.n - a.n || g(b.c.id) - g(a.c.id)).slice(0, 3).map((x) => x.c.name),
      schwach: liste.filter((x) => x.n <= 2.5).sort((a, b) => a.n - b.n || g(b.c.id) - g(a.c.id)).slice(0, 2).map((x) => x.c.name),
    };
  }

  function karte(art, k, e, alt) {
    const T = st.zeitraum;
    const meta = {
      premium: { label: 'Premium', sub: 'Höchste Qualität', farbe: 'var(--c-premium)' },
      preisLeistung: { label: 'Preis-Leistung', sub: 'Beste Qualität je Euro', farbe: 'var(--brand)' },
      umwelt: { label: 'Umweltfreundlichste', sub: `Geringste Treibhausgase über ${T} Jahre`, farbe: 'var(--ok)' },
    }[art];
    const mehr = (e.mehrfach[k.id] || []).filter((x) => x !== art).map((x) => ({ premium: 'Premium', preisLeistung: 'Preis-Leistung', umwelt: 'Umweltfreundlichste' }[x]));
    const p = plus(k);
    const bs = k.brandschutz;
    return `<article class="rec" style="--rec:${meta.farbe}">
      <div class="rec-head"><span class="eyebrow" style="color:var(--rec)">${meta.label}</span><span class="rec-sub">${meta.sub}</span></div>
      <h3>${esc(k.name)}</h3>
      ${mehr.length ? `<p class="rec-also">Gewinnt auch: ${mehr.join(', ')}</p>` : ''}
      <p class="rec-price">${eur(k.lcc.gesamt)}</p>
      <p class="rec-price-l">Lebenszykluskosten gesamt <span>(Spanne ${eur(k.lcc.gesamtLo)} bis ${eur(k.lcc.gesamtHi)})</span></p>
      <div class="rec-stats">
        <div><b>${eur(k.invest.gesamt)}</b><span>Investition</span></div>
        <div><b>${num(k.gwp[T].gesamt / 1000, 1)} t</b><span>CO₂-Äq. in ${T} Jahren</span></div>
        <div><b>${num(k.d * 100)} cm</b><span>Dämmung, U = ${num(k.uNeu, 2)}</span></div>
        <div><b>${num(k.qualitaet.punkte)} / 100</b><span>Qualität</span></div>
      </div>
      <ul class="rec-list">
        ${p.stark.length ? `<li class="plus">Stark bei: ${p.stark.map(esc).join(', ')}</li>` : ''}
        ${p.schwach.length ? `<li class="minus">Schwächer bei: ${p.schwach.map(esc).join(', ')}</li>` : ''}
        ${bs && bs.auflage ? `<li class="auflage">Auflage: ${esc(bs.auflage)}</li>` : ''}
      </ul>
      ${alt ? `<p class="rec-alt">Nächstbeste Alternative: <b>${esc(alt.name)}</b> mit ${num(alt.gwp[T].gesamt / 1000, 1)} t CO₂-Äq. und ${eur(alt.lcc.gesamt)}.</p>` : ''}
    </article>`;
  }

  function streu(kands, e) {
    const T = st.zeitraum, W = 760, H = 330, l = 54, r = 20, t = 18, b = 44;
    const xs = kands.map((k) => k.lcc.m2), ys = kands.map((k) => k.gwp[T].m2);
    const nice = (v, up) => { const s = Math.pow(10, Math.floor(Math.log10(v))); return (up ? Math.ceil(v / s * 2) : Math.floor(v / s * 2)) / 2 * s; };
    const x0 = nice(Math.min(...xs) * 0.9, false), x1 = nice(Math.max(...xs) * 1.05, true), y1 = nice(Math.max(...ys) * 1.15, true);
    const X = (v) => l + ((v - x0) / (x1 - x0 || 1)) * (W - l - r), Y = (v) => H - b - (v / (y1 || 1)) * (H - t - b);
    const farbe = (k) => (e.premium && k.id === e.premium.id ? 'var(--c-premium)' : e.preisLeistung && k.id === e.preisLeistung.id ? 'var(--brand)' : e.umwelt && k.id === e.umwelt.id ? 'var(--ok)' : 'var(--fg-3)');
    let s = `<svg class="chart scatter" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kosten gegen Treibhausgase" style="max-width:100%;height:auto">`;
    for (let i = 0; i <= 4; i++) { const v = (y1 * i) / 4, y = Y(v); s += `<line x1="${l}" y1="${y}" x2="${W - r}" y2="${y}" stroke="currentColor" stroke-opacity=".12"/><text x="${l - 8}" y="${y + 4}" font-size="11" text-anchor="end" fill="currentColor" opacity=".65">${num(v)}</text>`; }
    for (let i = 0; i <= 4; i++) { const v = x0 + ((x1 - x0) * i) / 4, x = X(v); s += `<text x="${x}" y="${H - b + 18}" font-size="11" text-anchor="middle" fill="currentColor" opacity=".65">${num(v)}</text>`; }
    s += `<text x="${(l + W - r) / 2}" y="${H - 6}" font-size="12" text-anchor="middle" fill="currentColor" opacity=".8">Lebenszykluskosten (€ je m² Wand)</text>`;
    s += `<text transform="translate(14 ${(t + H - b) / 2}) rotate(-90)" font-size="12" text-anchor="middle" fill="currentColor" opacity=".8">kg CO₂-Äq. je m² (${T} Jahre)</text>`;
    // Beschriftungen ohne Überlappung: rechts im Bild links vom Punkt, bei Kollision nach unten schieben
    const boxen = [];
    const punkte = kands.map((k) => ({ k, x: X(k.lcc.m2), y: Y(k.gwp[T].m2) })).sort((p, q) => p.y - q.y);
    punkte.forEach(({ k, x, y }) => {
      const pick = farbe(k) !== 'var(--fg-3)', ok = k.zulaessig, text = k.name.replace('Vorgehängte Fassade', 'VHF');
      const links = x > l + (W - l - r) * 0.6, breite = text.length * 6.3 + 6;
      let ty = y + 4, x0b = links ? x - 12 - breite : x + 12;
      while (boxen.some((q) => x0b < q.x1 && x0b + breite > q.x0 && Math.abs(ty - q.y) < 14)) ty += 14;
      boxen.push({ x0: x0b, x1: x0b + breite, y: ty });
      s += `<g opacity="${ok ? 1 : .55}"><circle cx="${x}" cy="${y}" r="${pick ? 8 : 6}" fill="${ok ? farbe(k) : 'none'}" stroke="${farbe(k)}" stroke-width="2"/>`;
      s += `<text x="${links ? x - 12 : x + 12}" y="${ty}" font-size="11.5" text-anchor="${links ? 'end' : 'start'}" fill="currentColor" opacity="${pick ? 1 : .8}"${pick ? ' font-weight="600"' : ''}>${esc(text)}</text></g>`;
    });
    return s + '</svg>'
      + '<p class="scatter-legend"><span><i style="background:var(--c-premium)"></i>Premium</span><span><i style="background:var(--brand)"></i>Preis-Leistung</span><span><i style="background:var(--ok)"></i>Umweltfreundlichste</span><span><i style="background:var(--fg-3)"></i>weitere zulässige</span><span><i style="border:2px solid var(--fg-3)"></i>nicht zulässig</span></p>';
  }

  function tabelle(kands, e) {
    const T = st.zeitraum, rang = [...kands].sort((a, b) => a.lcc.m2 - b.lcc.m2);
    const badge = (k) => (e.mehrfach[k.id] || []).map((x) => `<span class="mini-badge ${x}">${{ premium: 'Premium', preisLeistung: 'Preis-Leistung', umwelt: 'Umwelt' }[x]}</span>`).join(' ');
    return `<div class="scroll"><table class="vergleich"><thead><tr><th>Variante</th><th>Dämmung</th><th>Investition €/m²</th><th>LCC €/m²</th><th>LCC gesamt</th><th>kg CO₂-Äq./m² 30 a</th><th>50 a</th><th>Qualität</th><th></th></tr></thead><tbody>`
      + rang.map((k) => `<tr class="${k.zulaessig ? '' : 'unzul'}"><td><b>${esc(k.name)}</b></td><td>${num(k.d * 100)} cm</td>`
        + `<td>${num(k.invest.m2)} <small>(${num(k.invest.lo)}–${num(k.invest.hi)})</small></td><td>${num(k.lcc.m2)}</td><td>${eur(k.lcc.gesamt)}</td>`
        + `<td${T === 30 ? ' class="akt"' : ''}>${num(k.gwp[30].m2, 1)}</td><td${T === 50 ? ' class="akt"' : ''}>${num(k.gwp[50].m2, 1)}</td><td>${num(k.qualitaet.punkte)}</td>`
        + `<td>${k.zulaessig ? badge(k) : '<span class="mini-badge bad">nicht zulässig</span>'}</td></tr>`).join('')
      + '</tbody></table></div>';
  }

  function annahmen(san) {
    const quelleFl = san.flaechen && san.flaechen.quelle === 'aufmass' ? 'aus dem Aufmaß' : 'angenommen (noch kein Aufmaß)';
    return `<details class="disclosure"><summary><span><span class="card-title">Annahmen, Quellen und Gewichtung</span><span class="card-sub" style="display:block">So sind die Zahlen entstanden. Gewichte lassen sich ändern.</span></span></summary>
      <div class="ann">
        <h4>Kosten</h4>
        <ul>
          <li>Preise: ${esc(KD.QUELLE)}, Blatt LCC (Investition und Folgekosten je Variante), Blätter WDVS und VHF (Preisspannen, Dickenzuschläge). Netto, Preisstand 2026, Köln, Budgetansätze.</li>
          <li>Bezugsdicke 160 mm. WDVS: Zuschlag bzw. Abzug je 20 mm Dämmdicke (EPS 10 €, Mineralwolle 12,50 €, Holzfaser 14,40 € je m²). Vorgehängte Fassade: ein Preis für 160 bis 200 mm.</li>
          <li>Folgekosten (Barwert) je m²: WDVS ${num(KD.FOLGEKOSTEN.wdvs, 2)} €, vorgehängte Fassade ${num(KD.FOLGEKOSTEN.vhf, 2)} €. Der Zeitraum steht in der Excel nicht; er gilt hier für den ganzen Vergleich.</li>
          <li>Fläche: ${num(san.bezugsflaeche_m2, 1)} m² Wand netto, ${quelleFl}.</li>
        </ul>
        <h4>Nicht enthalten</h4>
        <ul>${KD.NICHT_ENTHALTEN.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <h4>Treibhausgase</h4>
        <ul><li>Aus dem LCA-Reiter (ÖKOBAUDAT 2024-II, A1–A3, B4, C3, C4), mit der Ausführungsdicke aus dem Sanierungsreiter. Vorgehängte Fassade mit Holz-Unterkonstruktion und Holzbekleidung. Das WDVS wird im 50-Jahre-Vergleich einmal komplett erneuert, die Holzfassade nicht.</li></ul>
        <h4>Qualität: Gewichte (Summe wird automatisch auf 100 % umgerechnet)</h4>
        <p class="small">Noten von 1 bis 5 sind eine Einschätzung auf Grundlage des Projektkonzepts, keine Messung. Das Team sollte sie prüfen.</p>
        <div class="gewichte">${KD.KRITERIEN.map((k) => `<label><span>${esc(k.name)}<small>${esc(k.quelle)}</small></span><span class="field"><input type="number" min="0" max="100" step="5" data-g="${k.id}" value="${Number.isFinite(st.gewichte[k.id]) ? st.gewichte[k.id] : k.gewicht}"><span class="unit">%</span></span></label>`).join('')}</div>
        <button type="button" class="btn btn-sm" id="gewichteReset">Standardgewichte</button>
      </div></details>`;
  }

  function render() {
    if (root.hidden && !render.erzwingen) return;
    const san = letztes || (window.SanierungUI && window.SanierungUI.ergebnis());
    const kopf = `<div class="page-head"><h2>Empfehlung</h2><p>Drei Varianten für Ihr Gebäude: die beste Qualität, das beste Preis-Leistungs-Verhältnis und die Variante mit den geringsten Treibhausgasen.</p></div>`;
    if (!san || !san.varianten || !(san.bezugsflaeche_m2 > 0)) { root.innerHTML = `<div class="page">${kopf}<section class="card"><p>Noch keine Berechnung. Bitte zuerst im Reiter „Aufmaß“ die Flächen bestimmen und im Reiter „Sanierung“ das Gebäude beschreiben.</p></section></div>`; return; }
    const kands = K.kandidaten(san, { gewichte: st.gewichte });
    const e = K.empfehlung(kands, { zeitraum: st.zeitraum });
    const quelle = san.flaechen && san.flaechen.quelle === 'aufmass' ? 'aus dem Aufmaß' : 'angenommen';
    const steuer = `<div class="rec-steuer"><div class="seg" role="group" aria-label="Zeitraum für die Treibhausgase">
        <button type="button" data-zr="30" class="${st.zeitraum === 30 ? 'active' : ''}">30 Jahre</button><button type="button" data-zr="50" class="${st.zeitraum === 50 ? 'active' : ''}">50 Jahre</button></div>
        <span class="small">Zeitraum für die Treibhausgase · Wand netto ${num(san.bezugsflaeche_m2, 1)} m² (${quelle}) · ohne Fenster</span></div>`;
    let body;
    if (!e.premium) body = `<section class="card"><p class="bad">Keine Variante ist für diese Gebäudeklasse zulässig. Bitte Geschosszahl und Gebäudeklasse im Reiter „Sanierung“ prüfen.</p></section>`;
    else body = `<div class="rec-grid">${karte('premium', e.premium, e)}${karte('preisLeistung', e.preisLeistung, e, e.alternative.preisLeistung)}${karte('umwelt', e.umwelt, e, e.alternative.umwelt)}</div>`;
    root.innerHTML = `<div class="page">${kopf}${steuer}${body}
      ${e.premium ? `<section class="card"><h2 class="card-title">Alle Varianten im Vergleich</h2><p class="card-sub">Links unten ist am besten: wenig Kosten und wenig Treibhausgase.</p>${streu(kands, e)}</section>` : ''}
      <section class="card"><h2 class="card-title">Zahlen im Detail</h2>${tabelle(kands, e)}</section>
      <section class="card">${annahmen(san)}</section></div>`;
  }

  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-zr]'); if (b) { st.zeitraum = +b.dataset.zr; render(); return; }
    if (ev.target.id === 'gewichteReset') { st.gewichte = {}; render(); }
  });
  root.addEventListener('change', (ev) => {
    const g = ev.target.dataset && ev.target.dataset.g;
    if (g) { const v = parseFloat(ev.target.value); if (Number.isFinite(v) && v >= 0) st.gewichte[g] = v; else delete st.gewichte[g]; render(); const el = root.querySelector('details'); if (el) el.open = true; }
  });
  window.addEventListener('sanierung', (e) => { letztes = e.detail; render(); });
  document.querySelectorAll('.tabs [data-tab=tabEmpfehlung]').forEach((b) => b.addEventListener('click', () => { render.erzwingen = true; setTimeout(() => { render.erzwingen = false; render(); }, 0); }));
  window.KostenUI = { ergebnis: () => { const san = letztes || (window.SanierungUI && window.SanierungUI.ergebnis()); if (!san) return null; const k = K.kandidaten(san, { gewichte: st.gewichte }); return { kandidaten: k, empfehlung: K.empfehlung(k, { zeitraum: st.zeitraum }) }; } };
})();
