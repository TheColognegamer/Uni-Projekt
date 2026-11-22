/* UI-Logik: Foto laden, Maßstab setzen, Flächen markieren, Auswertung. Koordinaten stets in Bildpixeln. */
(function () {
  'use strict';
  const G = window.Geometry;
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const COLORS = { calib: '#d9730d', facade: '#0b6bcb', window: '#1a8f4a', door: '#8b5a2b' };
  const LABEL = { calib: 'Maßstab', facade: 'Fassade', window: 'Fenster', door: 'Tür' };

  const S = {
    img: null, name: '', tool: null,
    calib: { type: 'rect', pts: [], H: null },
    shapes: [],            // {kind:'facade'|'window'|'door', pts}
    active: null,          // {kind, pts} im Entstehen
    drag: null, t0: null, t1: null, tick: null,
    auto: null,            // KI-Vorschlag (Original, für den Vergleich vor/nach Korrektur)
  };

  const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '–');
  const calibNeeded = () => (S.calib.type === 'rect' ? 4 : 2);
  const calibDone = () => S.calib.pts.length === calibNeeded();

  function setHint(t) { $('hint').textContent = t; }

  const MAX_EDGE = 2400; // Handyfotos (12 MP+) für Anzeige und Speicher verkleinern
  function loadImage(src, name, then) {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, MAX_EDGE / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      S.img = c; S.name = name; S.iw = c.width; S.ih = c.height;
      cv.width = c.width; cv.height = c.height;
      S.calib.pts = []; S.calib.H = null; S.shapes = []; S.active = null; S.auto = null; S.autoScale = null; S.det = null;
      S.t0 = Date.now(); S.t1 = null;
      clearInterval(S.tick); S.tick = setInterval(updateTimer, 500);
      setTool('calib'); recompute(); draw(); updateTimer();
      if (then) then();
    };
    im.src = src;
  }

  function setTool(t) {
    S.tool = t; S.active = null;
    document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
    if (!S.img) return;
    if (t === 'calib') {
      S.calib.pts = []; S.calib.H = null; S.autoScale = null;
      setHint(S.calib.type === 'rect'
        ? 'Maßstab: 4 Ecken des Referenzrechtecks im Uhrzeigersinn ab links oben anklicken. Punkte lassen sich ziehen.'
        : 'Maßstab: 2 Endpunkte der Referenzstrecke anklicken.');
    } else {
      setHint(t === 'facade'
        ? 'Fassade: Eckpunkte der Außenwand anklicken, mit Klick auf den ersten Punkt oder „Fläche schließen“ beenden.'
        : t === 'door' ? 'Tür/Tor: Eckpunkte anklicken und schließen. Wird von der Wand abgezogen, zählt aber nicht als Fenster.'
        : 'Fenster: Eckpunkte anklicken und schließen. Mehrere möglich.');
    }
    recompute(); draw();
  }

  function recompute() {
    S.calib.H = null;
    try {
      if (calibDone()) {
        if (S.calib.type === 'rect') {
          const c = G.calibrationFromRect(S.calib.pts, +$('calW').value, +$('calH').value);
          S.calib.H = c.H;
        } else {
          S.calib.H = G.calibrationFromLine(S.calib.pts[0], S.calib.pts[1], +$('calL').value).H;
        }
      }
    } catch (e) { S.calib.H = null; }
    updateResults();
  }

  const areaOf = (pts) => (S.calib.H ? G.areaMetric({ H: S.calib.H }, pts) : NaN);

  const nr = (i) => S.shapes.slice(0, i + 1).filter((x) => x.kind === S.shapes[i].kind).length;

  function updateResults() {
    const warn = [];
    const facades = S.shapes.filter((s) => s.kind === 'facade');
    const windows = S.shapes.filter((s) => s.kind === 'window');
    const doors = S.shapes.filter((s) => s.kind === 'door');
    const wins = [...windows, ...doors];   // alle Öffnungen (werden von der Wand abgezogen)
    const aF = facades.reduce((a, s) => a + areaOf(s.pts), 0);
    const aW = wins.reduce((a, s) => a + areaOf(s.pts), 0);
    const ready = !!S.calib.H;
    $('rFacade').textContent = ready && facades.length ? fmt(aF) + ' m²' : '–';
    $('rWin').textContent = ready && wins.length ? fmt(aW) + ' m²' : '–';
    $('rCount').textContent = wins.length;
    $('rNet').innerHTML = ready && facades.length ? '<b>' + fmt(aF - aW) + ' m²</b>' : '–';
    const net = aF - aW, rg = S.autoScale === 'est' && S.scaleRange && ready && facades.length ? S.scaleRange : null;
    $('rowRange').hidden = !rg;
    if (rg) $('rRange').textContent = fmt(net * rg.lo * rg.lo, 1) + ' – ' + fmt(net * rg.hi * rg.hi, 1) + ' m²';
    $('rRatio').textContent = ready && facades.length && aF > 0 ? fmt((aW / aF) * 100, 1) + ' %' : '–';

    $('sum').textContent = ready && facades.length ? `Wand netto ${fmt(aF - aW)} m²${S.autoScale === 'est' && S.scaleRange ? ' (≈ ' + fmt((aF - aW) * S.scaleRange.lo ** 2, 0) + '–' + fmt((aF - aW) * S.scaleRange.hi ** 2, 0) + ')' : ''} · Fassade ${fmt(aF)} m² · Öffnungen ${fmt(aW)} m² (${wins.length}) · Fensteranteil ${fmt(aF > 0 ? (aW / aF) * 100 : NaN, 1)} %` : '';
    if (S.img && !ready) warn.push('Noch kein Maßstab gesetzt – es werden keine Flächen berechnet.');
    if (ready && S.autoScale === 'est') warn.push('Maßstab von der KI aus Referenzobjekten geschätzt (Spanne siehe oben). Mit gemessener Fassadenbreite genauer.');
    if (ready && S.autoScale === 'door') warn.push('Maßstab aus angenommener Türhöhe – Ergebnis ist nur eine Größenordnung. Mit gemessener Fassadenbreite genauer.');
    if (ready && S.calib.type === 'line') warn.push('Referenzstrecke ohne Perspektivkorrektur: nur bei frontaler Aufnahme belastbar.');
    if (ready && S.calib.type === 'rect' && G.selfIntersects(S.calib.pts)) warn.push('Referenzrechteck: Punkte nicht in Umlaufreihenfolge.');
    S.shapes.forEach((s, i) => { if (G.selfIntersects(s.pts)) warn.push(`${LABEL[s.kind]} ${nr(i)}: Polygon überschneidet sich selbst.`); });
    if (facades.length > 1) warn.push('Mehrere Fassadenflächen – es wird die Summe verwendet.');
    if (ready && aW > aF && facades.length) warn.push('Fensterfläche größer als Fassade – Eingabe prüfen.');
    $('warnings').innerHTML = warn.map((w) => `<li>⚠ ${w}</li>`).join('');

    $('shapes').innerHTML = S.shapes.map((s, i) =>
      `<li><span style="color:${COLORS[s.kind]}">■</span> ${LABEL[s.kind]} ${nr(i)}: ${fmt(areaOf(s.pts))} m²
       <button type="button" data-del="${i}" title="Löschen">✕</button></li>`).join('');

    // Abweichung zur Referenz (H2)
    const tol = +$('tol').value;
    const dev = (m, refId, outId, has) => {
      const ref = parseFloat($(refId).value), el = $(outId);
      if (!ready || !has || !(ref > 0)) { el.textContent = '–'; el.className = ''; return; }
      const d = ((m - ref) / ref) * 100;
      el.textContent = (d > 0 ? '+' : '') + fmt(d, 1) + ' %';
      el.className = Math.abs(d) <= tol ? 'ok' : 'bad';
    };
    dev(aF, 'refFacade', 'dFacade', facades.length > 0);
    dev(aW, 'refWin', 'dWin', wins.length > 0);
    // Schnittstelle zum Sanierungsmodul (docs/schnittstelle-sanierung.md, Eingang 'flaechen').
    // Pflichtfelder wie dort beschrieben; Türen stehen NICHT in 'fenster' (sonst würden sie als Fenster getauscht/bewertet).
    const dims = (list) => (ready ? list.map((sh) => {
      const m = sh.pts.map((q) => G.applyH(S.calib.H, q)), xs = m.map((q) => q[0]), ys = m.map((q) => q[1]);
      return { b: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };   // Außenmaße (entzerrt, umschließendes Rechteck)
    }) : []);
    const haveWall = ready && facades.length > 0;
    window.dispatchEvent(new CustomEvent('flaechen', { detail: {
      aWand: haveWall ? aF - aW : NaN,
      aFenster: ready && wins.length ? aW : NaN,       // Summe aller Öffnungen (inkl. Türen), wie in der Schnittstelle beschrieben
      anzahl: wins.length,
      fenster: dims(windows),
      // Erweiterung (optional, ältere Empfänger ignorieren die Felder):
      tueren: dims(doors), aTueren: ready ? doors.reduce((a, sh) => a + areaOf(sh.pts), 0) : NaN,
      aFassadeBrutto: haveWall ? aF : NaN,
      quelle: 'foto',
      massstab: { art: S.autoScale || S.calib.type, spanneWand_m2: rg && haveWall ? [net * rg.lo * rg.lo, net * rg.hi * rg.hi] : null },
    } }));
    return { aF, aW, ready, facades, wins };
  }

  function updateTimer() {
    if (!S.t0) { $('timer').textContent = '–'; return; }
    const s = ((S.t1 || Date.now()) - S.t0) / 1000;
    $('timer').textContent = Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') + (S.t1 ? ' (beendet)' : '');
  }

  // ---------- Zeichnen ----------
  function drawPoly(pts, color, closed, fill) {
    if (!pts.length) return;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (closed) ctx.closePath();
    if (fill && closed) { ctx.fillStyle = color + '33'; ctx.fill(); }
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, cv.width / 450); ctx.stroke();
    const r = Math.max(5, cv.width / 220);
    pts.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fillStyle = color; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `${r * 1.6}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), p[0], p[1] - r * 1.4);
    });
  }
  function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!S.img) { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, cv.width, cv.height); return; }
    ctx.drawImage(S.img, 0, 0);
    drawPoly(S.calib.pts, COLORS.calib, calibDone() && S.calib.type === 'rect', true);
    S.shapes.forEach((s, i) => {
      drawPoly(s.pts, COLORS[s.kind], true, true);
      if (S.calib.H) {
        const c = s.pts.reduce((a, p) => [a[0] + p[0] / s.pts.length, a[1] + p[1] / s.pts.length], [0, 0]);
        ctx.font = `bold ${Math.max(14, cv.width / 60)}px sans-serif`; ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(fmt(areaOf(s.pts)) + ' m²', c[0], c[1]);
        ctx.fillStyle = '#fff'; ctx.fillText(fmt(areaOf(s.pts)) + ' m²', c[0], c[1]);
      }
    });
    if (S.active) drawPoly(S.active.pts, COLORS[S.active.kind], false, false);
  }

  // ---------- Eingabe ----------
  function toImg(e) {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height];
  }
  function allPointLists() {
    const l = [S.calib.pts]; S.shapes.forEach((s) => l.push(s.pts)); if (S.active) l.push(S.active.pts); return l;
  }
  function hit(p) {
    const r = cv.getBoundingClientRect(), rad = 12 * cv.width / r.width;
    for (const list of allPointLists()) for (let i = 0; i < list.length; i++)
      if (Math.hypot(list[i][0] - p[0], list[i][1] - p[1]) <= rad) return { list, i };
    return null;
  }
  function closeActive() {
    const a = S.active;
    if (!a || a.pts.length < 3) return;
    S.shapes.push({ kind: a.kind, pts: a.pts }); S.active = null;
    recompute(); draw();
  }

  function addPoint(p) {
    if (S.tool === 'calib') {
      if (calibDone()) return;
      S.calib.pts.push(p); recompute(); draw();
      if (calibDone()) setHint('Maßstab gesetzt. Weiter mit „2 · Fassade“.');
    } else if (S.tool === 'facade' || S.tool === 'window' || S.tool === 'door') {
      if (!S.active) S.active = { kind: S.tool, pts: [] };
      S.active.pts.push(p); draw();
    }
  }

  // Klick auf vorhandenen Punkt: erst bei Mausbewegung (>4 px) wird gezogen, sonst zählt es als normaler Klick.
  cv.addEventListener('pointerdown', (e) => {
    if (!S.img) return;
    const p = toImg(e), h = hit(p);
    if (S.active && S.active.pts.length >= 3 && h && h.list === S.active.pts && h.i === 0) { closeActive(); return; }
    if (h) { S.drag = { ...h, start: [e.clientX, e.clientY], p, moved: false }; cv.setPointerCapture(e.pointerId); return; }
    addPoint(p);
  });
  cv.addEventListener('pointermove', (e) => {
    const d = S.drag; if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.start[0], e.clientY - d.start[1]) > 4) d.moved = true;
    if (d.moved) { d.list[d.i] = toImg(e); recompute(); draw(); }
  });
  const endDrag = () => { const d = S.drag; S.drag = null; if (d && !d.moved) addPoint(d.p); };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

  document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $('finish').addEventListener('click', closeActive);
  $('undo').addEventListener('click', () => {
    if (S.active && S.active.pts.length) S.active.pts.pop();
    else if (S.tool === 'calib' && S.calib.pts.length) S.calib.pts.pop();
    else if (S.shapes.length) S.shapes.pop();
    if (S.active && !S.active.pts.length) S.active = null;
    recompute(); draw();
  });
  $('shapes').addEventListener('click', (e) => {
    const i = e.target.dataset && e.target.dataset.del;
    if (i !== undefined) { S.shapes.splice(+i, 1); recompute(); draw(); }
  });
  document.querySelectorAll('input[name=ctype]').forEach((r) => r.addEventListener('change', () => {
    S.calib.type = r.value; $('rectInputs').style.opacity = r.value === 'rect' ? 1 : .4; $('lineInputs').style.opacity = r.value === 'line' ? 1 : .4;
    setTool('calib');
  }));
  ['calW', 'calH', 'calL', 'refFacade', 'refWin', 'tol'].forEach((id) => $(id).addEventListener('input', () => { recompute(); draw(); }));
  $('stop').addEventListener('click', () => { if (S.t0 && !S.t1) { S.t1 = Date.now(); updateTimer(); } });
  $('file').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f); loadImage(url, f.name);
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Enter') closeActive(); if (e.key === 'Escape') { S.active = null; draw(); } });


  // ---------- KI-Vorschlag (benötigt server.js) ----------
  function downscaleToJpeg(maxEdge = 1568) {
    const k = Math.min(1, maxEdge / Math.max(S.iw, S.ih));
    const c = document.createElement('canvas');
    c.width = Math.round(S.iw * k); c.height = Math.round(S.ih * k);
    c.getContext('2d').drawImage(S.img, 0, 0, c.width, c.height);
    return { k, w: c.width, h: c.height, data: c.toDataURL('image/jpeg', 0.9).split(',')[1] };
  }
  // Referenzstrecke aus erkannten Umrissen: Oberkante der Fassade (Breite) bzw. Mittellinie der Tür (Höhe)
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  // Fassadenbreite = waagerechte Ausdehnung des Umrisses (auch bei Giebel mit 5 Punkten), als Linie an der Unterkante
  function widthLine(pts) { const xs = pts.map((q) => q[0]), y = Math.max(...pts.map((q) => q[1])); return [[Math.min(...xs), y], [Math.max(...xs), y]]; }
  function verticalMid(pts) {
    const byY = [...pts].sort((p, q) => p[1] - q[1]), n = Math.floor(byY.length / 2);
    const top = byY.slice(0, Math.max(2, n)).slice(0, 2), bot = byY.slice(-2);
    return [mid(top[0], top[1]), mid(bot[0], bot[1])];
  }
  const median = (a) => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  // Maßstab aus den von der KI genannten Referenzstrecken: Median der Einzelmaßstäbe, Spanne aus den min/max-Angaben
  function estimateScale(refs) {
    const R = (refs || []).map((r) => { const d = Math.hypot(r.p2[0] - r.p1[0], r.p2[1] - r.p1[1]); return { ...r, d, s: r.typ / d, smin: r.min / d, smax: r.max / d }; })
      .filter((r) => r.d >= 20 && r.typ > 0 && r.min > 0 && r.max >= r.min);
    if (!R.length) return null;
    let use = R.filter((r) => r.conf !== 'niedrig'), warn = null;
    if (!use.length) { use = R; warn = 'Nur unsichere Referenzen – Ergebnis mit Vorsicht verwenden.'; }
    const s = median(use.map((r) => r.s));
    const lo = Math.min(median(use.map((r) => r.smin)), s), hi = Math.max(median(use.map((r) => r.smax)), s);
    const ratio = Math.max(...use.map((r) => r.s)) / Math.min(...use.map((r) => r.s));
    if (ratio > 1.25) warn = 'Die Referenzen der KI widersprechen sich (Maßstab weicht um ' + Math.round((ratio - 1) * 100) + ' % ab).';
    const rep = use.reduce((a, b) => (Math.abs(Math.log(b.s / s)) < Math.abs(Math.log(a.s / s)) ? b : a));
    return { s, lo: lo / s, hi: hi / s, rep, used: use, all: R, warn };
  }
  function renderRefs(est) {
    $('refs').innerHTML = est ? est.all.map((r) => `<li>${est.used.includes(r) ? '✓' : '·'} ${r.label}: ${fmt(r.typ)} m (${fmt(r.min)}–${fmt(r.max)}), ${r.conf}${est.used.includes(r) ? '' : ' – nicht verwendet'}</li>`).join('') : '';
  }
  function applyAutoScale(facade, door, refs) {
    S.scaleRange = null; renderRefs(null);
    const mode = document.querySelector('input[name=amode]:checked').value;
    if (mode === 'none') return null;
    let p, len, note = null;
    if (mode === 'est') {
      const est = estimateScale(refs);
      if (est) {
        S.calib.type = 'line'; S.calib.pts = [est.rep.p1, est.rep.p2]; $('calL').value = (est.rep.d * est.s).toFixed(3);
        document.querySelector('input[name=ctype][value=line]').checked = true;
        S.scaleRange = { lo: est.lo, hi: est.hi }; S.autoScale = 'est'; renderRefs(est);
        return est.warn;
      }
      if (door) { p = verticalMid(door.pts); len = +$('autoD').value; note = 'KI fand keine verlässliche Referenz, angenommene Türhöhe verwendet.'; S.autoScale = 'door'; }
      else return 'KI fand keine verlässliche Referenz. Wähle „Fassadenbreite“ und trage die Breite ein oder setze den Maßstab selbst.';
    } else if (mode === 'width' && facade) { p = widthLine(facade.pts); len = +$('autoW').value; S.autoScale = 'width'; }
    else if (mode === 'door' && door) { p = verticalMid(door.pts); len = +$('autoD').value; S.autoScale = 'door'; }
    else return mode === 'door' ? 'Keine Tür erkannt. Wähle „KI schätzt“ oder „Fassadenbreite“.' : 'Keine Fassade erkannt – bitte Maßstab manuell setzen.';
    if (!(len > 0)) return 'Auto-Maßstab: ungültige Länge.';
    S.calib.type = 'line'; S.calib.pts = [p[0], p[1]]; $('calL').value = len;
    document.querySelector('input[name=ctype][value=line]').checked = true;
    return note;
  }

  async function runDetect() {
    if (!S.img) { setHint('Erst ein Foto laden.'); return; }
    const btns = [$('auto'), $('snapBtn')]; btns.forEach((b) => (b.disabled = true)); setHint('KI analysiert das Foto …');
    const t = Date.now();
    try {
      const im = downscaleToJpeg();
      const r = await fetch('/api/detect', { method: 'POST', headers: { 'content-type': 'application/json', 'x-access-code': $('code').value },
        body: JSON.stringify({ image: im.data, mediaType: 'image/jpeg', width: im.w, height: im.h }) });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error || ('HTTP ' + r.status));
      const toImg = (poly, kind) => ({ kind, pts: poly.points.map((p) => [p.x / im.k, p.y / im.k]) });
      const facades = out.facades.map((p) => toImg(p, 'facade')), doors = out.doors.map((p) => toImg(p, 'door'));
      const shapes = [...facades, ...out.windows.map((p) => toImg(p, 'window')), ...doors].filter((s) => s.pts.length >= 3);
      setTool('facade'); // Werkzeug wählen, ohne den Maßstab zurückzusetzen
      S.shapes = shapes; S.active = null;
      S.auto = { shapes: JSON.parse(JSON.stringify(shapes)), mock: !!out.mock, model: out.model || null, dauer_s: (Date.now() - t) / 1000, notes: out.notes };
      const refs = (out.scale_refs || []).map((q) => ({ label: q.label, p1: [q.p1.x / im.k, q.p1.y / im.k], p2: [q.p2.x / im.k, q.p2.y / im.k],
        min: q.length_min_m, typ: q.length_typ_m, max: q.length_max_m, conf: q.confidence }));
      S.det = { facade: facades[0], door: doors[0], refs };
      const scaleMsg = applyAutoScale(facades[0], doors[0], refs);
      setHint((out.mock ? '[ATTRAPPE] ' : 'KI-Vorschlag: ') + shapes.length + ' Flächen. Bitte prüfen und korrigieren. ' + (scaleMsg || '') + ' ' + (out.notes || ''));
      recompute(); draw();
    } catch (e) {
      setHint('Automatische Erkennung nicht möglich: ' + e.message);
    } finally { btns.forEach((b) => (b.disabled = false)); }
  }
  // Auto-Maßstab nachträglich ändern (Modus oder Länge), ohne die KI erneut zu fragen
  function reapplyScale() {
    if (!S.det) return;
    const f = S.shapes.includes(S.det.facade) ? S.det.facade : null, d = S.shapes.includes(S.det.door) ? S.det.door : null;
    const msg = applyAutoScale(f, d, S.det.refs);
    setHint(msg || 'Maßstab neu gesetzt.'); recompute(); draw();
  }
  document.querySelectorAll('input[name=amode]').forEach((r) => r.addEventListener('change', reapplyScale));
  ['autoW', 'autoD'].forEach((id) => $(id).addEventListener('input', reapplyScale));
  $('auto').addEventListener('click', runDetect);
  $('snap').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    loadImage(URL.createObjectURL(f), f.name, runDetect); e.target.value = '';
  });

  // ---------- Export ----------
  $('export').addEventListener('click', () => {
    const r = updateResults();
    const out = {
      erstellt: new Date().toISOString(), bild: S.name,
      bildgroesse_px: S.img ? [S.iw, S.ih] : null,
      massstab: { typ: S.calib.type, punkte_px: S.calib.pts, breite_m: +$('calW').value, hoehe_m: +$('calH').value, laenge_m: +$('calL').value },
      flaechen: S.shapes.map((s) => ({ art: s.kind, punkte_px: s.pts, flaeche_m2: areaOf(s.pts) })),
      ergebnis_m2: { fassade_brutto: r.aF, fenster: r.aW, wand_netto: r.aF - r.aW },
      referenz_m2: { fassade_brutto: parseFloat($('refFacade').value) || null, fenster: parseFloat($('refWin').value) || null },
      toleranz_prozent: +$('tol').value,
      ki_vorschlag: S.auto,
      dauer_s: S.t0 ? ((S.t1 || Date.now()) - S.t0) / 1000 : null,
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    a.download = 'messung_' + (S.name || 'foto').replace(/\.[^.]+$/, '') + '.json'; a.click();
  });

  // ---------- Demo: synthetische, perspektivisch verzerrte Fassade mit bekannter Wahrheit ----------
  $('demo').addEventListener('click', () => {
    const W = 1200, H = 800, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#9ec5e8'); sky.addColorStop(1, '#dbe8f2');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const wallImg = [[160, 120], [1020, 190], [1000, 700], [180, 640]]; // TL,TR,BR,BL im Bild
    const m2i = G.homography([[0, 0], [10, 0], [10, 6], [0, 6]], wallImg); // 10 m x 6 m Wand
    const P = (poly) => poly.map((p) => G.applyH(m2i, p));
    const fillPoly = (pts, col) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillStyle = col; g.fill(); };
    fillPoly(P([[0, 0], [10, 0], [10, 6], [0, 6]]), '#d8c3a5');
    const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    [[1, 1.2], [3.2, 1.2], [5.8, 1.2], [8, 1.2]].forEach(([x, y]) => fillPoly(P(rect(x, y, 1.2, 1.4)), '#3b5b78'));
    fillPoly(P(rect(4.5, 4, 1, 2)), '#6b4a2f'); // Tür 1,0 x 2,0 m
    window.__demo = { wallImg, wallM: [10, 6], windowsM2: 4 * 1.2 * 1.4, facadeM2: 60 };
    loadImage(c.toDataURL('image/png'), 'demo-fassade.png');
    $('calW').value = 10; $('calH').value = 6;
    $('refFacade').value = 60; $('refWin').value = (4 * 1.2 * 1.4).toFixed(2);
  });

  draw();
})();
