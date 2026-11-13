/* UI für Sanierung: Bestandswand (amtliche Pauschalwerte) -> Dämmdicken je System/Dämmstoff, mögliche Fenster.
 * EINGANG:  Ereignis 'flaechen' vom Aufmaß-Modul  { aWand, aFenster, anzahl, fenster:[{b,h}] }
 *           Solange keins kommt, gelten die angenommenen Flächen aus Abschnitt 5.
 * AUSGANG:  Ereignis 'sanierung' an Kosten/CO2-Modul, zusätzlich window.SanierungUI.ergebnis()
 * Details: docs/schnittstelle-sanierung.md */
(function () {
  'use strict';
  const B = window.Bauphysik;
  const $ = (id) => document.getElementById(id);
  const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '–');
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  let aufmass = null; // letzte Werte vom Aufmaß-Modul
  let letztes = null;

  $('sKonstr').innerHTML = Object.entries(B.WANDKONSTRUKTIONEN).map(([k, v]) =>
    `<label><input type="radio" name="sKonstr" value="${k}"${k === 'lochstein' ? ' checked' : ''}><span>${v.name}<small>${v.laie}</small></span></label>`).join('');
  $('sUk').innerHTML = Object.entries(B.UNTERKONSTRUKTION).map(([k, v]) => `<option value="${k}"${k === 'holz' ? ' selected' : ''}>${v.name.replace('-Unterkonstruktion', '')}</option>`).join('');
  const konstr = () => document.querySelector('input[name=sKonstr]:checked').value;

  /** Flächen: aus dem Aufmaß, sonst Annahme aus den Eingabefeldern. */
  function flaechen() {
    if (aufmass && Number.isFinite(aufmass.aWand) && aufmass.aWand > 0) {
      return { quelle: 'aufmass', aWand: aufmass.aWand, fenster: aufmass.fenster || [] };
    }
    const n = Math.max(0, Math.round(+$('aAnz').value || 0)), b = +$('aB').value, h = +$('aH').value;
    const fenster = b > 0 && h > 0 ? Array.from({ length: n }, () => ({ b, h })) : [];
    const aF = +$('aFassade').value, aW = fenster.reduce((a, f) => a + f.b * f.h, 0);
    return { quelle: 'annahme', aFassade: aF, aWand: aF - aW, fenster };
  }

  function renderFlaechen(fl) {
    const ann = fl.quelle === 'annahme';
    $('flQuelle').textContent = ann ? 'Annahme' : 'aus Aufmaß';
    ['aFassade', 'aAnz', 'aB', 'aH'].forEach((id) => { $(id).disabled = !ann; });
    const aW = fl.fenster.reduce((a, f) => a + f.b * f.h, 0);
    $('flInfo').innerHTML = ann
      ? `Angenommen: Wand netto <b>${fmt(fl.aWand)} m²</b>, Fenster ${fmt(aW)} m². Wird automatisch ersetzt, sobald das Aufmaß Flächen liefert.`
      : `Aus dem Aufmaß: Wand netto <b>${fmt(fl.aWand)} m²</b>, ${fl.fenster.length} Fenster mit ${fmt(aW)} m².`;
    if (ann && !(fl.aWand > 0)) throw new Error('Fensterfläche ist größer als die Fassade – Annahme prüfen.');
  }

  function renderWand(out, fl) {
    const wand = B.bestandswand(Math.round(+$('sBaujahr').value), konstr(), (+$('sDicke').value) / 100);
    out.wand = { baujahr: wand.baujahr, baualtersklasse: wand.klasse, konstruktion: wand.konstruktion, gesamtDicke_m: wand.gesamtDicke, u: wand.u, quelle: wand.quelle };
    $('sBestand').innerHTML = `Heutiger U-Wert der Wand: <b>${fmt(wand.u, 1)} W/(m²K)</b> (Baualtersklasse ${wand.klasse}, „${esc(wand.zeile)}“). `
      + `Quelle: ${esc(wand.quelle)}.` + wand.hinweise.map((t) => '<br>ℹ ' + esc(t)).join('');
    const uk = $('sUk').value;
    const v = B.variantenWand(wand, { vhf: { uk } });
    out.unterkonstruktion_vhf = uk;
    out.bezugsflaeche_m2 = fl.aWand;
    out.varianten = v.map((x) => ({ ...x, volumen_m3: fl.aWand * x.d, volumen_gleicheWirkung_m3: fl.aWand * x.dTheoretisch }));
    let html = '<tr><td><b>Dämmstoff</b></td><td><b>exakt¹</b></td><td><b>Platte</b></td><td><b>U neu</b></td><td><b>m³²</b></td></tr>';
    let sysAlt = null;
    v.forEach((x) => {
      if (x.system !== sysAlt) {
        const zus = x.system === 'vhf' ? ` · ${B.UNTERKONSTRUKTION[uk].name}` : '';
        html += `<tr><td colspan="5"><i>${B.SYSTEME[x.system].name}${zus}</i></td></tr>`; sysAlt = x.system;
      }
      const w = x.warnungen.length ? ` title="${esc(x.warnungen.join(' '))}"` : '';
      html += `<tr${w}><td>${B.DAEMMSTOFFE[x.daemmstoff].name}${x.warnungen.length ? ' ⚠' : ''}</td>`
        + `<td>${fmt(x.dTheoretisch * 100, 1)} cm</td><td>${fmt(x.d * 100, 0)} cm</td>`
        + `<td class="${x.erfuellt ? 'ok' : 'bad'}">${fmt(x.uNeu, 3)}</td><td>${fmt(fl.aWand * x.d, 1)}</td></tr>`;
    });
    $('sVarianten').innerHTML = html;
    const warn = [...new Set(v.flatMap((x) => x.warnungen.map((t) => `${B.DAEMMSTOFFE[x.daemmstoff].name} (${B.SYSTEME[x.system].name}): ${t}`)))];
    $('sHinweise').innerHTML = `Ziel: U ≤ ${fmt(B.ANFORDERUNG.aussenwand.uMax)} W/(m²K) nach ${B.ANFORDERUNG.quelle}.<br>`
      + '¹ Dicke für genau U = 0,24 – für den Vergleich „gleiche Dämmwirkung“. Platte = auf 2 cm aufgerundete Ausführungsdicke.<br>'
      + `² Dämmstoffvolumen = Wand netto ${fmt(fl.aWand)} m² × Plattendicke.<br>`
      + Object.values(B.SYSTEME).map((s) => `<b>${s.name}:</b> ${s.hinweis}`).join('<br>')
      + (warn.length ? '<br>' + warn.map((t) => '⚠ ' + esc(t)).join('<br>') : '');
  }

  function renderFenster(out, fl) {
    const anteil = (+$('fAnteil').value) / 100;
    if (!fl.fenster.length) { $('fRes').innerHTML = '<tr><td>Keine Fenster angegeben.</td></tr>'; $('fInfo').textContent = ''; out.fenster = null; return; }
    const opts = B.fensterOptionen(fl.fenster, anteil);
    out.fenster = { anzahl: opts[0].anzahl, flaeche: opts[0].flaeche, rahmenanteil: anteil, optionen: opts };
    $('fRes').innerHTML = '<tr><td><b>Rahmen</b></td><td><b>Verglasung</b></td><td><b>U<sub>w</sub></b></td><td><b>GModG</b></td></tr>'
      + opts.map((o) => `<tr><td>${B.RAHMEN[o.rahmen].name}</td><td>${B.VERGLASUNG[o.verglasung].name}</td>`
        + `<td>${fmt(o.uwNeu)}${o.anzahl > 1 && new Set(o.einzeln.map((e) => e.uw.toFixed(2))).size > 1 ? ' Ø' : ''}</td>`
        + `<td class="${o.erfuellt ? 'ok' : 'bad'}">${o.erfuellt ? '✓ zulässig' : '✗ über 1,3'}</td></tr>`).join('');
    $('fInfo').innerHTML = `${opts[0].anzahl} Fenster, ${fmt(opts[0].flaeche)} m² (Glas ${fmt(opts[0].flaecheGlas)} m², Rahmen ${fmt(opts[0].flaecheRahmen)} m²). `
      + `Zulässig ist nur, wenn <i>jedes</i> Fenster U<sub>w</sub> ≤ ${fmt(B.ANFORDERUNG.fenster.uMax, 1)} einhält (${B.ANFORDERUNG.quelle}). `
      + 'U<sub>w</sub> nach DIN EN ISO 10077-1 aus Richtwerten für Rahmen, Glas und Randverbund (warme Kante).';
  }

  function render() {
    const out = { fehler: [] };
    let fl;
    try { fl = flaechen(); renderFlaechen(fl); out.flaechen = { quelle: fl.quelle, wandNetto_m2: fl.aWand, fenster: fl.fenster }; }
    catch (e) { out.fehler.push(e.message); $('flInfo').textContent = '⚠ ' + e.message; }
    if (fl && fl.aWand > 0) {
      try { renderWand(out, fl); } catch (e) { out.fehler.push(e.message); $('sBestand').textContent = '⚠ ' + e.message; $('sVarianten').innerHTML = ''; $('sHinweise').textContent = ''; }
      try { renderFenster(out, fl); } catch (e) { out.fehler.push(e.message); $('fRes').innerHTML = `<tr><td>⚠ ${esc(e.message)}</td></tr>`; }
    }
    letztes = out;
    window.dispatchEvent(new CustomEvent('sanierung', { detail: out }));
  }

  window.addEventListener('flaechen', (e) => { aufmass = e.detail; render(); });
  ['sBaujahr', 'sDicke', 'sUk', 'aFassade', 'aAnz', 'aB', 'aH', 'fAnteil'].forEach((id) => $(id).addEventListener('input', render));
  $('sKonstr').addEventListener('change', render);
  render();

  window.SanierungUI = { ergebnis: () => letztes };
})();
