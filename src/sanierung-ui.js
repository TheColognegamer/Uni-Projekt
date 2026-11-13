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

  const GRUPPEN = { massiv: 'Gemauert / Beton', holz: 'Holz / Fachwerk' };
  $('sKonstr').innerHTML = Object.entries(GRUPPEN).map(([g, titel]) => `<div class="small"><b>${titel}</b></div>`
    + Object.entries(B.WANDKONSTRUKTIONEN).filter(([, v]) => v.gruppe === g).map(([k, v]) =>
      `<label><input type="radio" name="sKonstr" value="${k}"${k === 'lochstein' ? ' checked' : ''}><span>${v.name}<small>${v.laie}</small></span></label>`).join('')).join('');
  $('sUk').innerHTML = Object.entries(B.UNTERKONSTRUKTION).map(([k, v]) => `<option value="${k}"${k === 'holz' ? ' selected' : ''}>${v.name.replace('-Unterkonstruktion', '')}</option>`).join('');
  $('sGk').innerHTML += Object.entries(B.GEBAEUDEKLASSEN).map(([k, v]) => `<option value="${k}">${v.name} (${v.text})</option>`).join('');
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
    $('sKlasse').textContent = 'Baualtersklasse ' + wand.klasse;
    out.wand = { baujahr: wand.baujahr, baualtersklasse: wand.klasse, konstruktion: wand.konstruktion, gesamtDicke_m: wand.gesamtDicke, u: wand.u, quelle: wand.quelle };
    $('sBestand').innerHTML = `Heutiger U-Wert der Wand: <b>${fmt(wand.u, 1)} W/(m²K)</b> (Baualtersklasse ${wand.klasse}, „${esc(wand.zeile)}“). `
      + `Quelle: ${esc(wand.quelle)}.` + wand.hinweise.map((t) => '<br>ℹ ' + esc(t)).join('');
    const gkAuto = B.gebaeudeklasse(Math.round(+$('sGeschosse').value));
    const gkKey = $('sGk').value === 'auto' ? gkAuto.key : $('sGk').value;
    const gk = { ...B.GEBAEUDEKLASSEN[gkKey], key: gkKey, geschosse: gkAuto.geschosse, hoehe: gkAuto.hoehe, manuell: $('sGk').value !== 'auto' };
    out.gebaeude = { geschosse: gk.geschosse, hoeheOberstesGeschoss_m: gk.hoehe, gebaeudeklasse: gkKey, manuell: gk.manuell };
    $('sGkInfo').innerHTML = gk.manuell ? `Gebäudeklasse manuell gewählt: <b>${gk.name}</b>.`
      : `Fußboden oberstes Geschoss ca. ${fmt(gk.hoehe, 1)} m (Annahme ${fmt(B.EG_HOEHE, 1)} m + ${fmt(B.GESCHOSSHOEHE, 1)} m je Geschoss) → <b>${gk.name}</b>. Die genaue Einstufung (auch Zahl/Größe der Wohnungen) prüft der Fachplaner.`;
    const uk = $('sUk').value;
    const v = B.variantenWand(wand, { gk: gkKey, vhf: { uk } });
    out._gk = gk; out._wandtext = wand;
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
      const bs = x.brandschutz, tip = [bs.grund, bs.auflage, ...x.warnungen].filter(Boolean).join(' · ');
      const mark = !bs.zulaessig ? ' ✗' : (bs.auflage || x.warnungen.length) ? ' ⚠' : '';
      html += `<tr class="${bs.zulaessig ? '' : 'unzul'}" title="${esc(tip)}"><td>${B.DAEMMSTOFFE[x.daemmstoff].name}${mark}</td>`
        + `<td>${fmt(x.dTheoretisch * 100, 1)} cm</td><td>${fmt(x.d * 100, 0)} cm</td>`
        + `<td class="${x.erfuellt ? 'ok' : 'bad'}">${fmt(x.uNeu, 3)}</td><td>${fmt(fl.aWand * x.d, 1)}</td></tr>`;
    });
    $('sVarianten').innerHTML = html;
    const warn = [...new Set(v.flatMap((x) => [
      ...(x.brandschutz.zulaessig ? [] : [`✗ nicht zulässig: ${x.brandschutz.grund}`]),
      ...(x.brandschutz.zulaessig && x.brandschutz.auflage ? [`Auflage: ${x.brandschutz.auflage}`] : []),
      ...x.warnungen].map((t) => `${B.DAEMMSTOFFE[x.daemmstoff].name} (${B.SYSTEME[x.system].name}): ${t}`)))];
    $('sHinweise').innerHTML = `Ziel: U ≤ ${fmt(B.ANFORDERUNG.aussenwand.uMax)} W/(m²K) nach ${B.ANFORDERUNG.quelle}.<br>`
      + '¹ Dicke für genau U = 0,24 – für den Vergleich „gleiche Dämmwirkung“. Platte = auf 2 cm aufgerundete Ausführungsdicke.<br>'
      + `² Dämmstoffvolumen = Wand netto ${fmt(fl.aWand)} m² × Plattendicke.<br>`
      + Object.values(B.SYSTEME).map((s) => `<b>${s.name}:</b> ${s.hinweis}`).join('<br>')
      + (warn.length ? '<br>' + warn.map((t) => (/✗/.test(t) ? '' : '⚠ ') + esc(t)).join('<br>') : '');
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

  // ---------- Zusammenfassung ----------
  function textZusammenfassung(o) {
    const L = [];
    L.push('FASSADENSANIERUNG – ZUSAMMENFASSUNG (Leistungsphase 2, Grobabschätzung)');
    const w = o._wandtext, g = o._gk;
    L.push(`Gebäude: Baujahr ${w.baujahr} (${w.klasse}), ${B.WANDKONSTRUKTIONEN[w.konstruktion].name}, ${fmt(w.gesamtDicke * 100, 0)} cm, ${g.geschosse} Geschosse → ${g.name}`);
    L.push(`Wand heute U = ${fmt(w.u, 1)} → Ziel U ≤ ${fmt(B.ANFORDERUNG.aussenwand.uMax)} W/(m²K) (GModG Anlage 7)`);
    L.push(`Flächen (${o.flaechen.quelle === 'annahme' ? 'Annahme' : 'Aufmaß'}): Wand netto ${fmt(o.bezugsflaeche_m2)} m², ${o.fenster ? o.fenster.anzahl : 0} Fenster ${o.fenster ? fmt(o.fenster.flaeche) : '0'} m²`);
    L.push('', 'ZULÄSSIGE DÄMMVARIANTEN');
    o.varianten.filter((x) => x.brandschutz.zulaessig).forEach((x) => L.push(`- ${B.SYSTEME[x.system].name}, ${B.DAEMMSTOFFE[x.daemmstoff].name}: ${fmt(x.d * 100, 0)} cm, U = ${fmt(x.uNeu, 2)}, ${fmt(x.volumen_m3, 1)} m³${x.brandschutz.auflage ? ' – ' + x.brandschutz.auflage : ''}`));
    const nz = o.varianten.filter((x) => !x.brandschutz.zulaessig);
    if (nz.length) L.push('Nicht zulässig: ' + nz.map((x) => `${B.SYSTEME[x.system].name} ${B.DAEMMSTOFFE[x.daemmstoff].name}`).join(', '));
    if (o.fenster) {
      L.push('', 'ZULÄSSIGE FENSTER (Uw ≤ 1,3)');
      o.fenster.optionen.filter((f) => f.erfuellt).sort((a, b) => a.uwNeu - b.uwNeu).forEach((f) => L.push(`- ${B.RAHMEN[f.rahmen].name}, ${B.VERGLASUNG[f.verglasung].name}: Uw = ${fmt(f.uwNeu)}`));
    }
    L.push('', 'Quellen: GModG Anlage 7; Bekanntmachung Datenaufnahme Wohngebäudebestand 2020, Tab. 2; DIN EN ISO 6946/10077-1; MBO § 28, MVV TB Anh. 6.');
    L.push('Grobe Abschätzung, ersetzt keine Fachplanung (Statik, Brand- und Feuchteschutz).');
    return L.join('\n');
  }

  function renderZusammenfassung(o) {
    const el = $('zusammenfassung');
    if (!o.varianten || !o._gk) { el.innerHTML = ''; return; }
    const w = o._wandtext, g = o._gk;
    const zul = o.varianten.filter((x) => x.brandschutz.zulaessig).sort((a, b) => a.d - b.d || a.uNeu - b.uNeu);
    const nz = o.varianten.filter((x) => !x.brandschutz.zulaessig);
    const fz = o.fenster ? o.fenster.optionen.filter((f) => f.erfuellt).sort((a, b) => a.uwNeu - b.uwNeu) : [];
    const fnz = o.fenster ? o.fenster.optionen.filter((f) => !f.erfuellt) : [];
    const hinweise = [...new Set([...w.hinweise, ...o.varianten.flatMap((x) => x.warnungen)])];
    el.innerHTML = `<div class="card">
      <div class="kopf"><div><h2>Zusammenfassung Fassadensanierung</h2>
        <div class="small">Grobabschätzung für Leistungsphase 2 · Kosten und CO₂ ergänzt das Kostenmodul</div></div>
        <button type="button" id="zfKopieren">Als Text kopieren</button></div>
      <div class="kpis">
        <div class="kpi"><span>Baujahr / Baualtersklasse</span><b>${w.baujahr}</b><span>${w.klasse}</span></div>
        <div class="kpi"><span>U-Wert Wand heute → Ziel</span><b>${fmt(w.u, 1)} → ≤ ${fmt(B.ANFORDERUNG.aussenwand.uMax)}</b><span>W/(m²K), GModG Anlage 7</span></div>
        <div class="kpi"><span>Gebäudeklasse</span><b>${g.kurz}</b><span>${g.geschosse} Geschosse${g.manuell ? ' (manuell)' : ', ca. ' + fmt(g.hoehe, 1) + ' m'}</span></div>
        <div class="kpi"><span>Wand netto ${o.flaechen.quelle === 'annahme' ? '(Annahme)' : '(Aufmaß)'}</span><b>${fmt(o.bezugsflaeche_m2, 0)} m²</b><span>Bezugsfläche Dämmung</span></div>
        <div class="kpi"><span>Fenster</span><b>${o.fenster ? o.fenster.anzahl + ' Stk.' : '–'}</b><span>${o.fenster ? fmt(o.fenster.flaeche, 1) + ' m²' : ''}</span></div>
      </div>
      <div class="small">Wand: ${esc(B.WANDKONSTRUKTIONEN[w.konstruktion].name)}, ${fmt(w.gesamtDicke * 100, 0)} cm</div>
      <div class="grid2">
        <div><h3>Zulässige Dämmvarianten (${zul.length} von ${o.varianten.length})</h3>
          <table><tr><td><b>System</b></td><td><b>Dämmstoff</b></td><td><b>Dicke</b></td><td><b>U neu</b></td><td><b>Menge</b></td></tr>
          ${zul.map((x) => `<tr><td>${B.SYSTEME[x.system].name.replace(', hinterlüftet', '')}${x.system === 'vhf' ? ' (' + (x.unterkonstruktion === 'holz' ? 'Holz-UK' : 'Alu-UK') + ')' : ''}</td>
            <td>${B.DAEMMSTOFFE[x.daemmstoff].name}${x.brandschutz.auflage ? ' ⚠' : ''}</td><td>${fmt(x.d * 100, 0)} cm</td><td>${fmt(x.uNeu, 2)}</td><td>${fmt(x.volumen_m3, 1)} m³</td></tr>`).join('')}
          </table>
          ${nz.length ? `<p class="small">Nicht zulässig in ${g.kurz}: ${nz.map((x) => `${B.SYSTEME[x.system].name.replace(', hinterlüftet', '')} mit ${B.DAEMMSTOFFE[x.daemmstoff].name}`).join(', ')}.</p>` : ''}
        </div>
        <div><h3>Zulässige Fenster (U<sub>w</sub> ≤ 1,3)</h3>
          ${o.fenster ? `<table><tr><td><b>Rahmen</b></td><td><b>Verglasung</b></td><td><b>U<sub>w</sub></b></td></tr>
          ${fz.map((f) => `<tr><td>${B.RAHMEN[f.rahmen].name}</td><td>${B.VERGLASUNG[f.verglasung].name}</td><td>${fmt(f.uwNeu)}</td></tr>`).join('')}</table>
          ${fnz.length ? `<p class="small">Nicht zulässig: ${fnz.map((f) => `${B.RAHMEN[f.rahmen].name} ${B.VERGLASUNG[f.verglasung].name}`).join(', ')}.</p>` : ''}` : '<p class="small">Keine Fenster angegeben.</p>'}
        </div>
      </div>
      ${(zul.some((x) => x.brandschutz.auflage) || hinweise.length) ? `<h3>Wichtige Hinweise</h3><ul>
        ${[...new Set(zul.filter((x) => x.brandschutz.auflage).map((x) => `${B.DAEMMSTOFFE[x.daemmstoff].name} (${B.SYSTEME[x.system].name}): ${x.brandschutz.auflage}`))].map((t) => `<li>${esc(t)}</li>`).join('')}
        ${hinweise.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      <div class="fuss">Quellen: GModG Anlage 7 · Bekanntmachung Datenaufnahme Wohngebäudebestand 2020, Tab. 2 · DIN EN ISO 6946 / 10077-1 · MBO § 28, MVV TB Anhang 6.
        Grobe Abschätzung, ersetzt keine Fachplanung (Statik, Brand- und Feuchteschutz).</div>
    </div>`;
    $('zfKopieren').onclick = async () => {
      try { await navigator.clipboard.writeText(textZusammenfassung(o)); $('zfKopieren').textContent = 'Kopiert ✓'; }
      catch (e) { $('zfKopieren').textContent = 'Kopieren nicht möglich'; }
      setTimeout(() => { $('zfKopieren').textContent = 'Als Text kopieren'; }, 2000);
    };
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
    try { renderZusammenfassung(out); } catch (e) { out.fehler.push(e.message); $('zusammenfassung').innerHTML = ''; }
    const fertig = out.varianten && out._gk;
    if (out.wand && out._wandtext) out.wand.hinweise = out._wandtext.hinweise;
    out.zusammenfassungText = fertig ? textZusammenfassung(out) : null;
    delete out._gk; delete out._wandtext; // interne Hilfsfelder nicht nach außen geben
    letztes = out;
    // Ausgang für Kosten- und CO2-Modul (Schnittstelle siehe docs/schnittstelle-sanierung.md)
    window.dispatchEvent(new CustomEvent('sanierung', { detail: letztes }));
  }

  window.addEventListener('flaechen', (e) => { aufmass = e.detail; render(); });
  ['sBaujahr', 'sDicke', 'sGeschosse', 'sGk', 'sUk', 'aFassade', 'aAnz', 'aB', 'aH', 'fAnteil'].forEach((id) => $(id).addEventListener('input', render));
  $('sKonstr').addEventListener('change', render);
  render();

  window.SanierungUI = { ergebnis: () => letztes };
})();
