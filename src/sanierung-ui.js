/* UI für Sanierung: Bestandswand -> Dämmdicken je System/Dämmstoff, Fenstertausch.
 * Bekommt die Flächen aus dem Aufmaß über das Ereignis 'flaechen' (siehe app.js). */
(function () {
  'use strict';
  const B = window.Bauphysik;
  const $ = (id) => document.getElementById(id);
  const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '–');
  const esc = (t) => String(t).replace(/"/g, '&quot;');
  const F = { aWand: NaN, aFenster: NaN, anzahl: 0, fenster: [] };
  let letztes = null;

  const fill = (sel, obj, def) => {
    sel.innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}"${k === def ? ' selected' : ''}>${v.name}</option>`).join('');
  };
  fill($('sWand'), B.WANDBAUSTOFFE, 'vollziegel');
  fill($('sUk'), B.UNTERKONSTRUKTION, 'holz');
  fill($('fAlt'), B.FENSTER_BESTAND, 'isolier');
  fill($('fRahmen'), B.RAHMEN, 'pvc');
  fill($('fGlas'), B.VERGLASUNG, 'dreifach');

  function renderWand(out) {
    const wand = B.bestandswand($('sWand').value, (+$('sDicke').value) / 100, $('sPutz').checked);
    out.wand = { baustoff: wand.baustoff, gesamtDicke_m: wand.gesamtDicke, mauerwerk_m: wand.dMauer, u: wand.u };
    const bs = B.WANDBAUSTOFFE[wand.baustoff];
    $('sBestand').textContent = `Bestand: Mauerwerk ${fmt(wand.dMauer * 100, 1)} cm, U = ${fmt(wand.u)} W/(m²K) (λ = ${fmt(bs.lambda)} · ${bs.quelle})`;
    const uk = $('sUk').value;
    const v = B.variantenWand(wand, { vhf: { uk } });
    const hatFl = Number.isFinite(F.aWand) && F.aWand > 0;
    out.unterkonstruktion_vhf = uk;
    out.bezugsflaeche_m2 = hatFl ? F.aWand : null;
    out.varianten = v.map((x) => ({ ...x, volumen_m3: hatFl ? F.aWand * x.d : null, volumen_gleicheWirkung_m3: hatFl ? F.aWand * x.dTheoretisch : null }));
    let html = '<tr><td><b>Dämmstoff</b></td><td><b>rechnerisch¹</b></td><td><b>Ausführung</b></td><td><b>U neu</b></td><td><b>Volumen²</b></td></tr>';
    let sysAlt = null;
    v.forEach((x) => {
      if (x.system !== sysAlt) {
        const zus = x.system === 'vhf' ? ` · ${B.UNTERKONSTRUKTION[uk].name}, ΔU ${fmt(x.deltaU)}` : '';
        html += `<tr><td colspan="5"><i>${B.SYSTEME[x.system].name}${zus}</i></td></tr>`; sysAlt = x.system;
      }
      const w = x.warnungen.length ? ` title="${esc(x.warnungen.join(' '))}"` : '';
      html += `<tr${w}><td>${B.DAEMMSTOFFE[x.daemmstoff].name} (λ ${fmt(x.lambda, 3)})${x.warnungen.length ? ' ⚠' : ''}</td>`
        + `<td>${fmt(x.dTheoretisch * 100, 1)} cm</td><td>${fmt(x.d * 100, 0)} cm</td>`
        + `<td class="${x.erfuellt ? 'ok' : 'bad'}">${fmt(x.uNeu, 3)}</td>`
        + `<td>${hatFl ? fmt(F.aWand * x.d, 1) + ' m³' : '–'}</td></tr>`;
    });
    $('sVarianten').innerHTML = html;
    const warn = [...new Set(v.flatMap((x) => x.warnungen.map((t) => `${B.DAEMMSTOFFE[x.daemmstoff].name} (${B.SYSTEME[x.system].name}): ${t}`)))];
    $('sHinweise').innerHTML = '¹ genau U = 0,24 – für den Vergleich „gleiche Dämmwirkung“ (Projektkonzept). '
      + 'Ausführung = auf 2-cm-Plattendicke aufgerundet.<br>'
      + (hatFl ? `² Bezugsfläche Wand netto aus dem Aufmaß: ${fmt(F.aWand)} m² (Ausführungsdicke).` : '² Für Mengen erst Fassade und Fenster aufmessen.')
      + '<br>' + Object.values(B.SYSTEME).map((s) => `<b>${s.name}:</b> ${s.hinweis}`).join('<br>')
      + (warn.length ? '<br>' + warn.map((t) => '⚠ ' + t).join('<br>') : '');
  }

  function renderFenster(out) {
    const anteil = (+$('fAnteil').value) / 100;
    if (!F.fenster.length) {
      $('fRes').innerHTML = '<tr><td>Erst Maßstab setzen und Fenster markieren.</td><td></td></tr>';
      out.fenster = null; return;
    }
    const f = B.fensterTausch(F.fenster, $('fAlt').value, $('fRahmen').value, $('fGlas').value, anteil);
    out.fenster = f;
    const zeilen = f.einzeln.map((x, i) => `<tr><td>Fenster ${i + 1}: ${fmt(x.b)} × ${fmt(x.h)} m</td>`
      + `<td class="${x.uw <= f.uMax ? 'ok' : 'bad'}">U<sub>w</sub> ${fmt(x.uw)}</td></tr>`).join('');
    $('fRes').innerHTML = zeilen
      + `<tr><td>Fensterfläche gesamt (inkl. Türen, ${f.anzahl})</td><td>${fmt(f.flaeche)} m²</td></tr>`
      + `<tr><td>U<sub>w</sub> Bestand → neu (flächengemittelt)</td><td>${fmt(f.uwAlt)} → ${fmt(f.uwNeu)}</td></tr>`
      + `<tr><td>GModG: jedes Fenster U<sub>w</sub> ≤ ${fmt(f.uMax, 1)}</td><td class="${f.erfuellt ? 'ok' : 'bad'}">${f.erfuellt ? 'erfüllt' : 'nicht erfüllt'}</td></tr>`
      + `<tr><td colspan="2" class="small">U<sub>w</sub> nach DIN EN ISO 10077-1 aus U<sub>g</sub> ${fmt(B.VERGLASUNG[f.verglasung].ug, 1)}, U<sub>f</sub> ${fmt(B.RAHMEN[f.rahmen].uf, 1)}, ψ ${fmt(B.VERGLASUNG[f.verglasung].psi)} (Richtwerte). Maße = umschließendes Rechteck der Markierung.</td></tr>`;
  }

  function render() {
    const out = { fehler: [] };
    try { renderWand(out); } catch (e) { out.fehler.push(e.message); $('sBestand').textContent = '⚠ ' + e.message; $('sVarianten').innerHTML = ''; $('sHinweise').textContent = ''; }
    try { renderFenster(out); } catch (e) { out.fehler.push(e.message); $('fRes').innerHTML = `<tr><td>⚠ ${e.message}</td><td></td></tr>`; }
    letztes = out;
  }

  window.addEventListener('flaechen', (e) => { Object.assign(F, e.detail); render(); });
  ['sWand', 'sDicke', 'sPutz', 'sUk', 'fAlt', 'fRahmen', 'fGlas', 'fAnteil'].forEach((id) => $(id).addEventListener('input', render));
  render();

  // für den JSON-Export und die Kosten-/LCA-Module
  window.SanierungUI = { ergebnis: () => letztes };
})();
