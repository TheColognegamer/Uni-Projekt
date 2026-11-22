/* Reiter „LCA · CO₂-Vergleich“: GWP-total aller Fassadenvarianten (30/50 a), Gesamtfassade per Dropdown,
 * Vergleich zweier Konfigurationen mit Vor-/Nachteilen und Wandskizze, aufklappbare Annahmen, PDF-Export.
 *
 * EINGANG: Ereignis 'sanierung' bzw. window.SanierungUI.ergebnis() (Modul Sanierung, Moritz):
 *          Wandfläche netto, Fenster, Bestandswand, Gebäudeklasse -> Dämmdicken für gleiches U nach GModG.
 * RECHNUNG: src/lca.js mit Daten aus src/lca-data.js. */
(function () {
  'use strict';
  const D = window.LcaDaten, L = window.Lca, B = window.Bauphysik;
  const root = document.getElementById('tabLca');
  if (!root || !D || !L) return;

  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
  const T = D.ZEITRAEUME;                     // [30, 50]
  const FARBE = { 30: '#4472c4', 50: '#c0504d' }; // wie im Excel-Diagramm
  const NAME = L.NAME;

  // ---------- Zustand ----------
  const st = {
    zeit: 'beide',             // '30' | '50' | 'beide'
    dickeModus: 'exakt',       // 'exakt' = gleiche Dämmwirkung (U = 0,24), 'platte' = Ausführungsdicke
    fassade: 'wdvs-mw-mineralisch',
    fenster: 'fenster-holzalu-zweifach',
    a: { system: 'wdvs', daemmstoff: 'eps', putz: 'mineralisch', uk: 'holz', bekleidung: 'holz', rahmen: 'pvc', verglasung: 'dreifach' },
    b: { system: 'vhf', daemmstoff: 'mw', putz: 'mineralisch', uk: 'holz', bekleidung: 'holz', rahmen: 'holz', verglasung: 'dreifach' },
  };
  let basis = null;   // aufbereitete Eingangsdaten
  let letztes = null; // letztes Ergebnis (für PDF)

  const zeitraeume = () => (st.zeit === 'beide' ? T : [+st.zeit]);

  // ---------- Eingangsdaten aus dem Modul Sanierung ----------
  function basisAus(san) {
    const b = { hinweise: [], quelle: 'annahme', wandNetto: 250, fensterListe: [], rahmenanteil: D.FENSTER_STANDARD.rahmenanteil, wand: null, gk: null, gkName: null, dicken: {}, uw: {} };
    if (san && san.bezugsflaeche_m2 > 0) {
      b.wandNetto = san.bezugsflaeche_m2;
      b.quelle = san.flaechen ? san.flaechen.quelle : 'annahme';
      b.fensterListe = (san.flaechen && san.flaechen.fenster) || [];
      if (san.fenster && san.fenster.rahmenanteil >= 0) b.rahmenanteil = san.fenster.rahmenanteil;
      if (san.fenster) san.fenster.optionen.forEach((o) => { b.uw[o.rahmen + '-' + o.verglasung] = o; });
    } else {
      b.hinweise.push('Keine Flächen aus dem Modul Sanierung – Beispielwerte der Excel (250 m² Wand, Normfenster).');
    }
    b.fensterFlaeche = b.fensterListe.reduce((a, f) => a + f.b * f.h, 0);
    if (!b.fensterListe.length && !san) b.fensterFlaeche = 40;
    b.geo = L.fensterGeometrie(b.fensterListe, b.rahmenanteil);
    // Dämmdicken für gleiches U nach GModG (Modul Sanierung, src/bauphysik.js)
    try {
      if (!B || !san || !san.wand) throw new Error('Modul Sanierung nicht verfügbar');
      b.wand = B.bestandswand(san.wand.baujahr, san.wand.konstruktion, san.wand.gesamtDicke_m);
      b.gk = san.gebaeude ? san.gebaeude.gebaeudeklasse : null;
      b.gkName = b.gk ? B.GEBAEUDEKLASSEN[b.gk].kurz : null;
      for (const dk of ['mw', 'eps', 'holzfaser']) {
        b.dicken['wdvs|' + dk] = B.daemmdicke(b.wand, 'wdvs', dk, { gk: b.gk });
        for (const uk of ['holz', 'alu']) b.dicken['vhf|' + dk + '|' + uk] = B.daemmdicke(b.wand, 'vhf', dk, { gk: b.gk, uk });
      }
    } catch (e) {
      b.wand = null;
      b.hinweise.push('Dämmdicken: ' + e.message + ' – es gelten die Startwerte der Excel (160 mm, Holzfaser 180 mm).');
    }
    return b;
  }

  /** Dämm-Ergebnis aus bauphysik.js für eine Konfiguration (oder null). */
  function daemmInfo(system, k) {
    if (!basis || !basis.wand) return null;
    return basis.dicken[system === 'wdvs' ? 'wdvs|' + k.daemmstoff : 'vhf|' + k.daemmstoff + '|' + k.uk] || null;
  }

  /** Rechenkontext für eine Konfiguration: Dämmdicke aus U-Wert-Berechnung, Fenstergeometrie aus Aufmaß. */
  function ctxFuer(system, k) {
    const di = system === 'fenster' ? null : daemmInfo(system, k);
    return {
      fenster: basis.geo,
      dicke: (s) => (di ? (st.dickeModus === 'platte' ? di.d : di.dTheoretisch) : undefined),
    };
  }

  const zulaessig = (system, k) => { const di = daemmInfo(system, k); return !di || !di.brandschutz || di.brandschutz.zulaessig; };

  function fassadeRechnen(v) { return { ...v, r: L.jeZeitraum(v.system, v.konfig, ctxFuer(v.system, v.konfig)), ok: zulaessig(v.system, v.konfig), di: daemmInfo(v.system, v.konfig) }; }
  function fensterRechnen(v) { return { ...v, r: L.jeZeitraum('fenster', v.konfig, ctxFuer('fenster', v.konfig)), uw: basis.uw[v.konfig.rahmen + '-' + v.konfig.verglasung] || null }; }

  // ---------- Diagramm (SVG, ohne Bibliothek) ----------
  function balken(zeilen, o = {}) {
    const serien = o.serien || zeitraeume();
    const kompakt = root.clientWidth > 0 && root.clientWidth < 640;
    const W = kompakt ? 420 : 760, labelW = kompakt ? 0 : (o.labelW || 300), padR = kompakt ? 44 : 56, top = 28;
    const barH = 11, gap = 3, labelH = kompakt ? 16 : 0;
    const rowH = labelH + serien.length * (barH + gap) + 10;
    const H = top + zeilen.length * rowH + 8;
    const werte = zeilen.flatMap((z) => serien.map((s) => z.werte[s])).filter(Number.isFinite);
    const max = niceMax(Math.max(0, ...werte)), min = Math.min(0, ...werte);
    const x0 = labelW + 6, bw = W - x0 - padR;
    const X = (v) => x0 + ((v - min) / (max - min || 1)) * bw;
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.titel || 'Diagramm')}" style="max-width:100%;height:auto">`;
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const v = min + ((max - min) * i) / ticks, x = X(v);
      s += `<line x1="${x}" y1="${top - 4}" x2="${x}" y2="${H - 6}" stroke="currentColor" stroke-opacity=".15"/>`;
      s += `<text x="${x}" y="${top - 10}" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">${fmt(v, 0)}</text>`;
    }
    zeilen.forEach((z, i) => {
      const y = top + i * rowH;
      const op = z.gedimmt ? 0.35 : 1;
      if (kompakt) s += `<text x="0" y="${y + 11}" font-size="12" fill="currentColor" opacity="${z.gedimmt ? 0.6 : 1}">${esc(z.label)}</text>`;
      else s += `<text x="${labelW}" y="${y + (serien.length * (barH + gap)) / 2 + 4}" font-size="12" text-anchor="end" fill="currentColor" opacity="${z.gedimmt ? 0.6 : 1}">${esc(z.label)}</text>`;
      serien.forEach((sr, j) => {
        const v = z.werte[sr]; if (!Number.isFinite(v)) return;
        const yy = y + labelH + j * (barH + gap), xa = X(Math.min(0, v)), xb = X(Math.max(0, v));
        s += `<rect x="${xa}" y="${yy}" width="${Math.max(1, xb - xa)}" height="${barH}" fill="${(o.farben && o.farben[j]) || FARBE[sr] || '#888'}" opacity="${op}"><title>${esc(z.label)} · ${Number.isFinite(+sr) ? sr + ' a' : sr}: ${fmt(v)} ${o.einheit || ''}</title></rect>`;
        s += `<text x="${xb + 4}" y="${yy + barH - 2}" font-size="10.5" fill="currentColor" opacity=".85">${fmt(v, v >= 1000 ? 0 : 1)}</text>`;
      });
    });
    s += '</svg>';
    const leg = (o.legende || serien.map((sr, j) => ({ farbe: (o.farben && o.farben[j]) || FARBE[sr], text: sr + ' Jahre' })))
      .map((l) => `<span><i style="background:${l.farbe}"></i>${esc(l.text)}</span>`).join('');
    return `<div class="legende">${leg}${o.einheit ? `<span class="small">${esc(o.einheit)}</span>` : ''}</div>${s}`;
  }
  function niceMax(v) {
    if (!(v > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  // ---------- Wandskizze (Horizontalschnitt, innen links -> außen rechts) ----------
  const MAT = {
    bestand: { farbe: '#c46f4a', name: 'Bestandswand' },
    mw: { farbe: '#e9c84a' }, eps: { farbe: '#f4f4f4' }, holzfaser: { farbe: '#b8895a' },
    kleber: { farbe: '#bfbfbf' }, armierung: { farbe: '#d6d6d6' }, putz: { farbe: '#ece6da' },
    luft: { farbe: 'none' }, holz: { farbe: '#9b6a3a' }, alu: { farbe: '#a9b1bb' }, bahn: { farbe: '#3a6ea5' },
  };
  function skizze(k) {
    const di = daemmInfo(k.system, k);
    const dD = di ? (st.dickeModus === 'platte' ? di.d : di.dTheoretisch) : D.SCHICHTEN[k.system].find((s) => s.wahl === k.daemmstoff).d;
    const wandD = basis.wand ? basis.wand.gesamtDicke : 0.30;
    const L1 = [{ key: 'bestand', name: `Bestandswand ${fmt(wandD * 100, 0)} cm`, d: wandD }];
    if (k.system === 'wdvs') {
      L1.push({ key: 'kleber', name: 'Klebemörtel ≈ 5 mm', d: 0.005 });
      L1.push({ key: k.daemmstoff, name: `${NAME.daemmstoff[k.daemmstoff]} ${fmt(dD * 100, 1)} cm`, d: dD });
      L1.push({ key: 'armierung', name: 'Armierung + Gewebe 4 mm', d: 0.004 });
      L1.push({ key: 'putz', name: `${k.putz === 'silikat' ? 'Silikatputz 2 mm' : 'Mineralischer Oberputz 3 mm'}`, d: k.putz === 'silikat' ? 0.002 : 0.003 });
    } else {
      L1.push({ key: k.daemmstoff, name: `${NAME.daemmstoff[k.daemmstoff]} ${fmt(dD * 100, 1)} cm (zwischen ${NAME.uk[k.uk]})`, d: dD, uk: k.uk });
      L1.push({ key: 'bahn', name: 'Winddichtung (Fassadenbahn)', d: 0.002 });
      L1.push({ key: 'luft', name: `Hinterlüftung ≈ 4 cm (${NAME.uk[k.uk]})`, d: 0.04, uk: k.uk });
      L1.push({ key: k.bekleidung, name: k.bekleidung === 'holz' ? 'Holzbekleidung Lärche 24 mm' : 'Aluminiumblech 2 mm', d: k.bekleidung === 'holz' ? 0.024 : 0.002 });
    }
    const W = 360, H = 250, top = 14, wallH = 110, x0 = 12;
    const sum = L1.reduce((a, l) => a + l.d, 0);
    const sc = (W - 2 * x0 - L1.length * 2) / Math.max(sum, 0.45);
    let x = x0, s = `<svg class="skizze" viewBox="0 0 ${W} ${H}" role="img" aria-label="Skizze Wandaufbau" style="max-width:100%;height:auto">`;
    s += `<text x="${x0}" y="${top - 2}" font-size="10" fill="currentColor" opacity=".7">innen</text><text x="${W - x0}" y="${top - 2}" font-size="10" text-anchor="end" fill="currentColor" opacity=".7">außen</text>`;
    const mitten = [];
    L1.forEach((l) => {
      const w = Math.max(3, l.d * sc), m = MAT[l.key] || { farbe: '#ccc' };
      if (l.key === 'bestand') {
        s += `<defs><pattern id="ziegel" width="12" height="8" patternUnits="userSpaceOnUse"><rect width="12" height="8" fill="${m.farbe}"/><path d="M0 8H12M6 0V4M0 4H12M12 4V8M0 4V8" stroke="#8a4a2e" stroke-width=".6" fill="none"/></pattern></defs>`;
        s += `<rect x="${x}" y="${top}" width="${w}" height="${wallH}" fill="url(#ziegel)"/>`;
      } else if (l.key === 'luft') {
        s += `<rect x="${x}" y="${top}" width="${w}" height="${wallH}" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="2 3"/>`;
        s += `<path d="M${x + w / 2} ${top + wallH - 8}V${top + 10}" stroke="#4c9be8" stroke-width="1.4" marker-end="url(#pf)"/><defs><marker id="pf" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="#4c9be8"/></marker></defs>`;
      } else {
        s += `<rect x="${x}" y="${top}" width="${w}" height="${wallH}" fill="${m.farbe}" stroke="#666" stroke-width=".5"/>`;
        if (l.key === 'mw') for (let yy = top + 6; yy < top + wallH; yy += 9) s += `<path d="M${x + 1} ${yy} q ${w / 4} -5 ${w / 2} 0 t ${w / 2 - 1} 0" stroke="#a88a20" stroke-width=".6" fill="none"/>`;
        if (l.key === 'holzfaser') for (let yy = top + 4; yy < top + wallH; yy += 5) s += `<path d="M${x + 1} ${yy}H${x + w - 1}" stroke="#8a6238" stroke-width=".5"/>`;
      }
      // Unterkonstruktion als Querschnitte (Holzlatten bzw. Alu-Profile) in Dämm- und Luftebene
      if (l.uk) {
        for (const yy of [top + 18, top + wallH - 30]) {
          s += l.uk === 'holz'
            ? `<rect x="${x}" y="${yy}" width="${w}" height="12" fill="${MAT.holz.farbe}" opacity=".85"/>`
            : `<rect x="${x}" y="${yy + 4}" width="${w}" height="3" fill="${MAT.alu.farbe}" stroke="#555" stroke-width=".4"/>`;
        }
      }
      mitten.push({ x: x + w / 2, name: l.name });
      x += w + 2;
    });
    // Beschriftung mit Führungslinien
    mitten.forEach((m, i) => {
      const ty = top + wallH + 16 + i * 15;
      s += `<path d="M${m.x} ${top + wallH}V${ty - 4}H${x0 + 4}" stroke="currentColor" stroke-opacity=".35" fill="none"/>`;
      s += `<text x="${x0 + 8}" y="${ty - 6}" font-size="10.5" fill="currentColor">${esc(m.name)}</text>`;
    });
    s += '</svg>';
    return s;
  }

  // ---------- Vor- und Nachteile ----------
  function vorNach(k, r, andere, rAndere, label, labelAndere) {
    const O = D.OPTIONEN, teile = [O.system[k.system], O.daemmstoff[k.daemmstoff]];
    if (k.system === 'wdvs') teile.push(O.putz[k.putz]); else teile.push(O.uk[k.uk], O.bekleidung[k.bekleidung]);
    teile.push(O.rahmen[k.rahmen], O.verglasung[k.verglasung]);
    const plus = [], minus = [];
    teile.forEach((t) => {
      const tag = t.quelle === 'entwurf' ? ' *' : '';
      t.vorteile.forEach((v) => plus.push(`${t.name}: ${v}${tag}`));
      t.nachteile.forEach((v) => minus.push(`${t.name}: ${v}${tag}`));
    });
    // aus der Rechnung abgeleitet
    zeitraeume().slice().reverse().forEach((tt) => {
      const a = r[tt].summe, b = rAndere[tt].summe;
      if (!(a > 0 && b > 0)) return;
      const p = ((a - b) / b) * 100;
      if (Math.abs(p) < 1) return;
      (p < 0 ? plus : minus).unshift(`CO₂ über ${tt} a: ${fmt(Math.abs(p), 0)} % ${p < 0 ? 'weniger' : 'mehr'} als ${labelAndere} (${fmt(a, 0)} vs. ${fmt(b, 0)} kg)`);
    });
    const ers = r[T[T.length - 1]].wand.schichten.filter((s) => s.n > 0);
    if (ers.length) minus.push(`Austausch im Zeitraum ${T[T.length - 1]} a: ${[...new Set(ers.map((s) => s.name.replace(/^.*?: /, '')))].join(', ')} (Nutzungsdauer ${[...new Set(ers.map((s) => s.rsl))].join('/')} a)`);
    const di = daemmInfo(k.system, k);
    if (di && di.brandschutz && !di.brandschutz.zulaessig) minus.unshift(`✗ Brandschutz: ${di.brandschutz.grund}`);
    else if (di && di.brandschutz && di.brandschutz.auflage) minus.push(`Brandschutz-Auflage: ${di.brandschutz.auflage}`);
    const uw = basis.uw[k.rahmen + '-' + k.verglasung];
    if (uw && !uw.erfuellt) minus.unshift(`✗ Fenster: Uw ${fmt(uw.uwNeu, 2)} > 1,3 W/(m²K) (GModG)`);
    return { plus, minus };
  }

  // ---------- Bausteine ----------
  const opt = (obj, sel) => Object.entries(obj).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
  function konfigFormular(id, k) {
    return `<div class="konf" data-konf="${id}">
      <label>System <select data-f="system">${opt({ wdvs: 'WDVS', vhf: 'VHF (hinterlüftet)' }, k.system)}</select></label>
      <label>Dämmstoff <select data-f="daemmstoff">${opt(NAME.daemmstoff, k.daemmstoff)}</select></label>
      ${k.system === 'wdvs'
        ? `<label>Oberputz <select data-f="putz">${opt(NAME.putz, k.putz)}</select></label>`
        : `<label>Unterkonstruktion <select data-f="uk">${opt(NAME.uk, k.uk)}</select></label>
           <label>Bekleidung <select data-f="bekleidung">${opt(NAME.bekleidung, k.bekleidung)}</select></label>`}
      <label>Fensterrahmen <select data-f="rahmen">${opt(NAME.rahmen, k.rahmen)}</select></label>
      <label>Verglasung <select data-f="verglasung">${opt(NAME.verglasung, k.verglasung)}</select></label>
    </div>`;
  }
  const fassadeAusKonfig = (k) => (k.system === 'wdvs' ? { system: 'wdvs', konfig: { daemmstoff: k.daemmstoff, putz: k.putz } } : { system: 'vhf', konfig: { daemmstoff: k.daemmstoff, uk: k.uk, bekleidung: k.bekleidung } });
  const fensterAusKonfig = (k) => ({ konfig: { rahmen: k.rahmen, verglasung: k.verglasung } });
  function gesamtFuer(fas, fen) {
    const ctxW = ctxFuer(fas.system, fas.konfig), ctxF = ctxFuer('fenster', fen.konfig);
    const r = {};
    T.forEach((tt) => {
      const w = L.bilanz(fas.system, fas.konfig, tt, ctxW), f = L.bilanz('fenster', fen.konfig, tt, ctxF);
      const opak = w.total * basis.wandNetto, fe = f.total * basis.fensterFlaeche;
      r[tt] = { opakM2: w.total, fensterM2: f.total, opak, fenster: fe, summe: opak + fe, wand: w, fensterBilanz: f };
    });
    return r;
  }

  // ---------- Darstellung ----------
  function render() {
    const san = window.SanierungUI ? window.SanierungUI.ergebnis() : null;
    basis = basisAus(san);
    const fv = L.fassadenVarianten().map(fassadeRechnen);
    const fe = L.fensterVarianten().map(fensterRechnen);
    if (!fv.some((v) => v.id === st.fassade)) st.fassade = fv[0].id;
    const selF = fv.find((v) => v.id === st.fassade), selW = fe.find((v) => v.id === st.fenster);
    const g = gesamtFuer(selF, selW);
    const gA = gesamtFuer(fassadeAusKonfig(st.a), fensterAusKonfig(st.a));
    const gB = gesamtFuer(fassadeAusKonfig(st.b), fensterAusKonfig(st.b));
    const nameA = konfigName(st.a), nameB = konfigName(st.b);
    const vnA = vorNach(st.a, gA, st.b, gB, 'A', 'B'), vnB = vorNach(st.b, gB, st.a, gA, 'B', 'A');
    letztes = { basis, fv, fe, selF, selW, g, a: { k: { ...st.a }, name: nameA, r: gA, vn: vnA }, b: { k: { ...st.b }, name: nameB, r: gB, vn: vnB }, zeitraeume: zeitraeume(), dickeModus: st.dickeModus };

    const fl = basis.quelle === 'aufmass' ? 'aus Aufmaß' : 'Annahme';
    const unzul = fv.filter((v) => !v.ok);
    root.innerHTML = `
    <div class="card">
      <div class="kopf"><div><h2>LCA · CO₂-Vergleich der Fassadensanierung</h2>
        <div class="small">GWP-total nach DIN EN 15804+A2 / DIN EN 15978 · Module A1–A3 + B4 + C3 + C4 · ${esc(D.QUELLE.text)}</div></div>
        <div class="row inline"><button type="button" id="lcaPdf" class="primary">PDF herunterladen</button></div></div>
      <p class="small" id="lcaPdfInfo"></p>
      <div class="kpis">
        <div class="kpi"><span>Wand netto (${fl})</span><b>${fmt(basis.wandNetto, 1)} m²</b><span>opake Fläche</span></div>
        <div class="kpi"><span>Fenster (${fl})</span><b>${fmt(basis.fensterFlaeche, 1)} m²</b><span>${basis.fensterListe.length || '–'} Stück · Rahmenanteil ${fmt(basis.rahmenanteil * 100, 0)} %</span></div>
        <div class="kpi"><span>Dämmdicken</span><b>${basis.wand ? 'U = ' + fmt(B.ANFORDERUNG.aussenwand.uMax, 2) : 'Excel-Startwerte'}</b><span>${basis.wand ? 'alle Varianten gleiches U (GModG)' : 'Modul Sanierung fehlt'}</span></div>
        <div class="kpi"><span>Gebäudeklasse</span><b>${basis.gkName || '–'}</b><span>${unzul.length ? unzul.length + ' Varianten nicht zulässig' : 'alle Varianten zulässig'}</span></div>
      </div>
      <div class="row inline steuer">
        <span>Betrachtungszeitraum</span>
        <span class="seg">${['30', '50', 'beide'].map((z) => `<label><input type="radio" name="lcaZeit" value="${z}"${st.zeit === z ? ' checked' : ''}><span>${z === 'beide' ? '30 + 50 Jahre' : z + ' Jahre'}</span></label>`).join('')}</span>
        <span>Dämmdicke</span>
        <select id="lcaDicke">${opt({ exakt: 'exakt für U = 0,24 (gleiche Dämmwirkung)', platte: 'Plattendicke (auf 2 cm aufgerundet)' }, st.dickeModus)}</select>
      </div>
      ${basis.hinweise.map((h) => `<p class="small">ℹ ${esc(h)}</p>`).join('')}
      <p class="small">Werte und Dicken kommen aus den Reitern „Aufmaß“ und „Sanierung“. Änderungen dort werden hier sofort übernommen.</p>
    </div>

    <div class="card">
      <h3>Alle Fassadenvarianten · GWP-total je m² opake Wandfläche</h3>
      ${balken(fv.map((v) => ({ label: v.name + (v.ok ? '' : ' ✗'), werte: { 30: v.r[30].total, 50: v.r[50].total }, gedimmt: !v.ok })), { einheit: 'kg CO₂-Äq./m²', titel: 'GWP-total je m² opake Wandfläche' })}
      ${unzul.length ? `<p class="small">✗ blass = in ${esc(basis.gkName)} brandschutztechnisch nicht zulässig (Modul Sanierung): ${unzul.map((v) => esc(v.name)).join(', ')}.</p>` : ''}
      <details><summary>Dämmdicken je Variante (aus der U-Wert-Berechnung)</summary>${dickenTabelle()}</details>
      <h3>Fenstervarianten · GWP-total je m² Fensterfläche</h3>
      ${balken(fe.map((v) => ({ label: v.name.replace('Fenster ', '') + (v.uw && !v.uw.erfuellt ? ' ✗' : ''), werte: { 30: v.r[30].total, 50: v.r[50].total }, gedimmt: v.uw && !v.uw.erfuellt })), { einheit: 'kg CO₂-Äq./m²', titel: 'GWP-total je m² Fensterfläche', labelW: 230 })}
      <p class="small">${fensterHinweis(fe)}</p>
    </div>

    <div class="card">
      <h3>Gesamtfassade · Auswahl per Dropdown</h3>
      <div class="row inline">
        <label>Fassadenvariante <select id="lcaSelF">${fv.map((v) => `<option value="${v.id}"${v.id === st.fassade ? ' selected' : ''}>${esc(v.name)}${v.ok ? '' : ' (nicht zulässig)'}</option>`).join('')}</select></label>
        <label>Fenstervariante <select id="lcaSelW">${fe.map((v) => `<option value="${v.id}"${v.id === st.fenster ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
      </div>
      ${gesamtTabelle(g, selF)}
    </div>

    <div class="card">
      <h3>Vergleich zweier Konfigurationen</h3>
      <div class="ab">
        ${[['a', 'Option A', nameA, gA, vnA, st.a], ['b', 'Option B', nameB, gB, vnB, st.b]].map(([id, titel, nm, r, vn, k]) => `
        <div class="opt opt-${id}">
          <h4>${titel}</h4>
          ${konfigFormular(id, k)}
          <div class="small"><b>${esc(nm)}</b></div>
          ${skizze(k)}
          <table class="mini"><tr><td></td>${T.map((tt) => `<td><b>${tt} a</b></td>`).join('')}</tr>
            <tr><td>Opake Fassade</td>${T.map((tt) => `<td>${fmt(r[tt].opak, 0)} kg</td>`).join('')}</tr>
            <tr><td>Fenster</td>${T.map((tt) => `<td>${fmt(r[tt].fenster, 0)} kg</td>`).join('')}</tr>
            <tr><td><b>Summe</b></td>${T.map((tt) => `<td><b>${fmt(r[tt].summe, 0)} kg</b></td>`).join('')}</tr>
            <tr><td>je m² Wand</td>${T.map((tt) => `<td>${fmt(r[tt].opakM2, 1)}</td>`).join('')}</tr></table>
          <div class="vn"><div><b class="ok">Vorteile</b><ul>${vn.plus.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
            <div><b class="bad">Nachteile</b><ul>${vn.minus.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div></div>
        </div>`).join('')}
      </div>
      <h3>CO₂-Emissionen A gegenüber B · ganze Fassade</h3>
      ${balken(zeitraeume().map((tt) => ({ label: `${tt} Jahre`, werte: { A: gA[tt].summe, B: gB[tt].summe } })), { serien: ['A', 'B'], farben: ['#2f7d6d', '#d08c2b'], einheit: 'kg CO₂-Äq.', labelW: 90, legende: [{ farbe: '#2f7d6d', text: 'A: ' + nameA }, { farbe: '#d08c2b', text: 'B: ' + nameB }], titel: 'Vergleich A und B' })}
      <p class="small">* Textvorschlag – fachlich prüfen. Alle anderen Vor-/Nachteile von System und Dämmstoff stammen aus den Projektfolien; Prozentangaben sind aus der Rechnung abgeleitet.</p>
    </div>

    <details class="card annahmen"><summary><b>Annahmen und Datensätze</b> <span class="small">(Nutzungsdauern, Mengen, ÖKOBAUDAT-Werte)</span></summary>
      ${annahmenTabelle()}
    </details>`;
    verdrahten();
  }

  function konfigName(k) {
    const f = fassadeAusKonfig(k);
    return `${L.fassadenName(f.system, f.konfig)} + ${L.fensterName(fensterAusKonfig(k).konfig).replace('-Verglasung', '')}`;
  }

  function gesamtTabelle(g, selF) {
    return `<table class="mini gesamt"><tr><td></td>${T.map((tt) => `<td><b>${tt} a [kg CO₂-Äq.]</b></td>`).join('')}</tr>
      <tr><td>Opake Fassade (${fmt(basis.wandNetto, 1)} m² × ${T.map((tt) => fmt(g[tt].opakM2, 1)).join(' / ')} kg/m²)</td>${T.map((tt) => `<td>${fmt(g[tt].opak, 0)}</td>`).join('')}</tr>
      <tr><td>Fenster (${fmt(basis.fensterFlaeche, 1)} m² × ${T.map((tt) => fmt(g[tt].fensterM2, 1)).join(' / ')} kg/m²)</td>${T.map((tt) => `<td>${fmt(g[tt].fenster, 0)}</td>`).join('')}</tr>
      <tr class="summe"><td><b>Summe Fassade</b></td>${T.map((tt) => `<td><b>${fmt(g[tt].summe, 0)}</b></td>`).join('')}</tr></table>
      ${selF.ok ? '' : `<p class="small bad">✗ Diese Fassadenvariante ist in ${esc(basis.gkName)} nicht zulässig: ${esc(selF.di.brandschutz.grund)}</p>`}`;
  }

  function dickenTabelle() {
    if (!basis.wand) return '<p class="small">Keine U-Wert-Berechnung verfügbar – Startwerte der Excel.</p>';
    const z = [];
    for (const dk of ['mw', 'eps', 'holzfaser']) {
      const w = basis.dicken['wdvs|' + dk];
      z.push(['WDVS', NAME.daemmstoff[dk], w]);
      for (const uk of ['holz', 'alu']) z.push([`VHF ${NAME.uk[uk]}`, NAME.daemmstoff[dk], basis.dicken['vhf|' + dk + '|' + uk]]);
    }
    return `<table class="mini"><tr><td><b>System</b></td><td><b>Dämmstoff</b></td><td><b>λ</b></td><td><b>exakt</b></td><td><b>Platte</b></td><td><b>U neu</b></td><td><b>zulässig</b></td></tr>
      ${z.map(([s, d, r]) => `<tr><td>${s}</td><td>${d}</td><td>${fmt(r.lambda, 3)}</td><td>${fmt(r.dTheoretisch * 100, 1)} cm</td><td>${fmt(r.d * 100, 0)} cm</td><td>${fmt(r.uNeu, 3)}</td><td class="${r.brandschutz.zulaessig ? 'ok' : 'bad'}">${r.brandschutz.zulaessig ? '✓' : '✗'}</td></tr>`).join('')}</table>
      <p class="small">Bestandswand U = ${fmt(basis.wand.u, 2)} W/(m²K) (${esc(basis.wand.klasse)}). Ziel U ≤ 0,24 W/(m²K) nach GModG Anlage 7; Rechnung und Kennwerte: Modul Sanierung (src/bauphysik.js).</p>`;
  }

  function fensterHinweis(fe) {
    const t = [`Rahmenlängen und Glasanteil aus ${basis.geo.quelle === 'aufmass' ? basis.geo.anzahl + ' Fenstern des Aufmaßes' : 'dem Normfenster 1,23 × 1,48 m'} (Blendrahmen ${fmt(basis.geo.blendrahmen, 2)} m/m², Flügel ${fmt(basis.geo.fluegelrahmen, 2)} m/m², Glas ${fmt(basis.geo.glas * 100, 0)} %).`];
    const nicht = fe.filter((v) => v.uw && !v.uw.erfuellt);
    if (nicht.length) t.push(`✗ blass = Uw > 1,3 W/(m²K), nach GModG nicht zulässig: ${nicht.map((v) => v.name.replace('Fenster ', '')).join(', ')}.`);
    t.push('Holz-Alu: kein generischer ÖKOBAUDAT-Datensatz; angenähert als Holzrahmen + Alu-Deckschale (0,5 kg/m, Annahme).');
    return t.map(esc).join(' ');
  }

  function annahmenTabelle() {
    const blk = (titel, sys, bezug) => {
      const rows = D.SCHICHTEN[sys].map((s) => {
        const ds = D.DATENSAETZE[s.ds];
        const mg = L.menge(s, { fenster: basis.geo });
        return `<tr><td>${esc(s.name)}</td><td><a href="${ds.link}" target="_blank" rel="noopener">${esc(ds.name)}</a>${ds.proxy ? ' <span class="tag">Proxy</span>' : ''}</td>
          <td>${ds.einheit}</td><td>${s.daemmung ? '<i>aus U-Wert</i>' : fmt(mg.m, 3)}</td><td>${s.d && !s.daemmung && s.art !== 'direkt' ? fmt(s.d * 1000, 0) + ' mm' : s.daemmung ? '<i>variabel</i>' : ''}</td>
          <td>${fmt((s.verschnitt || 0) * 100, 0)} %</td><td><b>${s.rsl} a</b></td><td>${fmt(ds.a1a3, 3)}</td><td>${ds.c3 == null ? '<i>n. d.</i>' : fmt(ds.c3, 3)}</td><td>${ds.c4 == null ? '<i>n. d.</i>' : fmt(ds.c4, 3)}</td>
          <td class="small">${esc(s.hinweis)}</td></tr>`;
      }).join('');
      return `<h4>${titel} <span class="small">(je m² ${bezug})</span></h4><div class="scroll"><table class="mini annahme"><tr><td><b>Schicht</b></td><td><b>Datensatz ÖKOBAUDAT</b></td><td><b>Einheit</b></td><td><b>Menge/m²</b></td><td><b>Dicke</b></td><td><b>Verschnitt</b></td><td><b>Nutzungs&shy;dauer</b></td><td><b>A1–A3</b></td><td><b>C3</b></td><td><b>C4</b></td><td><b>Annahme / Hinweis</b></td></tr>${rows}</table></div>`;
    };
    return `<p class="small">Formel je Schicht: GWP = M · [(A1–A3) + n · (A1–A3 + C3 + C4) + (C3 + C4)] mit n = ABRUNDEN((T − 1) / Nutzungsdauer). GWP in kg CO₂-Äq. je Bezugseinheit; n. d. = Modul im Datensatz nicht deklariert (zählt als 0). Modul D ist nicht enthalten.</p>
      ${blk('WDVS', 'wdvs', 'Wand')}${blk('VHF', 'vhf', 'Wand')}${blk('Fenster', 'fenster', 'Fenster')}
      <p class="small"><b>Nutzungsdauern prüfen:</b> Die Werte sind Annahmen in Anlehnung an die BBSR-Tabelle „Nutzungsdauern von Bauteilen“ und bestimmen das 50-Jahres-Ergebnis. Ändern in <code>src/lca-data.js</code> (Feld <code>rsl</code>), danach <code>node tests/lca.test.js</code>.</p>
      <p class="small">Quelle: ${esc(D.QUELLE.text)}, abgerufen am ${esc(D.QUELLE.abgerufen)}. Generische Datensätze (Sphera) sind bis 2026 gültig – für das Paper ggf. auf den aktuellen Datenbestand aktualisieren.</p>`;
  }

  // ---------- Ereignisse ----------
  function verdrahten() {
    root.querySelectorAll('input[name=lcaZeit]').forEach((el) => el.addEventListener('change', () => { st.zeit = el.value; render(); }));
    $('lcaDicke').addEventListener('change', (e) => { st.dickeModus = e.target.value; render(); });
    $('lcaSelF').addEventListener('change', (e) => { st.fassade = e.target.value; render(); });
    $('lcaSelW').addEventListener('change', (e) => { st.fenster = e.target.value; render(); });
    root.querySelectorAll('[data-konf]').forEach((box) => {
      const k = st[box.dataset.konf];
      box.querySelectorAll('select').forEach((s) => s.addEventListener('change', () => { k[s.dataset.f] = s.value; render(); }));
    });
    $('lcaPdf').addEventListener('click', pdfSpeichern);
  }

  async function pdfSpeichern() {
    const info = $('lcaPdfInfo');
    try {
      const bytes = window.LcaPdf.erzeugen(letztes);
      const name = `LCA_Fassadenvergleich_${new Date().toISOString().slice(0, 10)}.pdf`;
      const dl = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads') : null;
      if (dl) {
        try { await dl.save({ filename: name, data: new Blob([bytes], { type: 'application/pdf' }) }); info.textContent = 'PDF gespeichert.'; }
        catch (e) { info.textContent = e && e.code === 'declined' ? 'Download abgebrochen.' : 'Download hier nicht möglich.'; }
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      info.textContent = 'PDF erstellt: ' + name;
    } catch (e) { info.textContent = '⚠ PDF konnte nicht erstellt werden: ' + e.message; }
  }

  // Reiter umschalten
  document.querySelectorAll('.tabs [data-tab]').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs [data-tab]').forEach((b) => { const on = b === btn; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    document.querySelectorAll('.tab').forEach((t) => { t.hidden = t.id !== btn.dataset.tab; });
    if (btn.dataset.tab === 'tabLca') render();
  }));

  // Neu rechnen, wenn das Modul Sanierung neue Werte liefert (nur wenn der Reiter sichtbar ist)
  window.addEventListener('sanierung', () => { if (!root.hidden) render(); });
  let breite = 0;
  window.addEventListener('resize', () => { const w = root.clientWidth; if (!root.hidden && (w < 640) !== (breite < 640)) render(); breite = w; });

  window.LcaUI = { render, ergebnis: () => letztes };
})();
