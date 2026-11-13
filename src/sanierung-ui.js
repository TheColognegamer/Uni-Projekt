/* UI für Sanierung: Bestandswand -> Dämmdicken je System/Dämmstoff, Fenstertausch.
 * Bekommt die Flächen aus dem Aufmaß über das Ereignis 'flaechen' (siehe app.js). */
(function () {
  'use strict';
  const B = window.Bauphysik;
  const $ = (id) => document.getElementById(id);
  const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '–');
  const F = { aWand: NaN, aFenster: NaN, anzahl: 0 };
  let letztes = null;

  const fill = (sel, obj, def) => {
    sel.innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}"${k === def ? ' selected' : ''}>${v.name}</option>`).join('');
  };
  fill($('sWand'), B.WANDBAUSTOFFE, 'vollziegel');
  fill($('fAlt'), B.FENSTER_BESTAND, 'isolier');
  fill($('fNeu'), B.FENSTER_NEU, 'kunststoff');

  function render() {
    const out = { wand: null, varianten: [], fenster: null, fehler: null };
    try {
      const wand = B.bestandswand($('sWand').value, (+$('sDicke').value) / 100, $('sPutz').checked);
      out.wand = { baustoff: wand.baustoff, gesamtDicke_m: wand.gesamtDicke, mauerwerk_m: wand.dMauer, u: wand.u };
      $('sBestand').textContent = `Bestand: Mauerwerk ${fmt(wand.dMauer * 100, 1)} cm, U = ${fmt(wand.u)} W/(m²K)`
        + ` (λ = ${fmt(B.WANDBAUSTOFFE[wand.baustoff].lambda)} · ${B.WANDBAUSTOFFE[wand.baustoff].quelle})`;
      const v = B.variantenWand(wand);
      const hatFl = Number.isFinite(F.aWand) && F.aWand > 0;
      out.varianten = v.map((x) => ({ ...x, flaeche_m2: hatFl ? F.aWand : null, volumen_m3: hatFl ? F.aWand * x.d : null }));
      let html = `<tr><td><b>System · Dämmstoff</b></td><td><b>Dicke</b></td><td><b>U neu</b></td><td><b>${hatFl ? 'Volumen' : ''}</b></td></tr>`;
      let sysAlt = null;
      v.forEach((x) => {
        if (x.system !== sysAlt) { html += `<tr><td colspan="4"><i>${B.SYSTEME[x.system].name}</i></td></tr>`; sysAlt = x.system; }
        const warn = x.warnungen.length ? ` title="${x.warnungen.join(' ')}"` : '';
        html += `<tr${warn}><td>${B.DAEMMSTOFFE[x.daemmstoff].name}</td><td>${fmt(x.d * 100, 0)} cm</td>`
          + `<td class="${x.erfuellt ? 'ok' : 'bad'}">${fmt(x.uNeu, 3)}${x.warnungen.length ? ' ⚠' : ''}</td>`
          + `<td>${hatFl ? fmt(F.aWand * x.d, 1) + ' m³' : ''}</td></tr>`;
      });
      $('sVarianten').innerHTML = html;
      $('sHinweise').innerHTML = Object.values(B.SYSTEME).map((s) => `<b>${s.name}:</b> ${s.hinweis}`).join('<br>')
        + '<br>Dicken auf 2-cm-Schritte aufgerundet. Dämmstoffe und λ-Werte sind Platzhalter, bis das Team die drei Materialien je System festlegt.'
        + (hatFl ? `<br>Bezugsfläche: Wand netto aus dem Aufmaß, ${fmt(F.aWand)} m².` : '<br>Für Mengen erst Fassade und Fenster aufmessen.');
    } catch (e) {
      out.fehler = e.message;
      $('sBestand').textContent = '⚠ ' + e.message; $('sVarianten').innerHTML = ''; $('sHinweise').textContent = '';
    }

    const f = B.fensterTausch(F.aFenster, F.anzahl, $('fAlt').value, $('fNeu').value);
    out.fenster = f;
    $('fRes').innerHTML = `<tr><td>Fensterfläche (Aufmaß, inkl. Türen)</td><td>${Number.isFinite(f.flaeche) && F.anzahl ? fmt(f.flaeche) + ' m² (' + f.anzahl + ')' : '–'}</td></tr>`
      + `<tr><td>U<sub>w</sub> Bestand → neu</td><td>${fmt(f.uwAlt)} → ${fmt(f.uwNeu)} W/(m²K)</td></tr>`
      + `<tr><td>GModG U<sub>w</sub> ≤ ${fmt(f.uMax, 1)}</td><td class="${f.erfuellt ? 'ok' : 'bad'}">${f.erfuellt ? 'erfüllt' : 'nicht erfüllt'}</td></tr>`;
    letztes = out;
  }

  window.addEventListener('flaechen', (e) => { Object.assign(F, e.detail); render(); });
  ['sWand', 'sDicke', 'sPutz', 'fAlt', 'fNeu'].forEach((id) => $(id).addEventListener('input', render));
  render();

  // für den JSON-Export und spätere Kosten-/LCA-Module
  window.SanierungUI = { ergebnis: () => letztes };
})();
