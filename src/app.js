/* UI-Logik: Foto laden, Maßstab setzen, Flächen markieren, Auswertung. Koordinaten stets in Bildpixeln. */
(function () {
  'use strict';
  const G = window.Geometry;
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const COLORS = { calib: '#d9730d', facade: '#0b6bcb', window: '#1a8f4a' };
  const LABEL = { calib: 'Maßstab', facade: 'Fassade', window: 'Fenster' };

  const S = {
    img: null, name: '', tool: null,
    calib: { type: 'rect', pts: [], H: null },
    shapes: [],            // {kind:'facade'|'window', pts}
    active: null,          // {kind, pts} im Entstehen
    drag: null, t0: null, t1: null, tick: null,
    auto: null,            // KI-Vorschlag (Original, für den Vergleich vor/nach Korrektur)
  };

  const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '–');
  const calibNeeded = () => (S.calib.type === 'rect' ? 4 : 2);
  const calibDone = () => S.calib.pts.length === calibNeeded();

  function setHint(t) { $('hint').textContent = t; }

  function loadImage(src, name) {
    const im = new Image();
    im.onload = () => {
      S.img = im; S.name = name;
      cv.width = im.naturalWidth; cv.height = im.naturalHeight;
      S.calib.pts = []; S.calib.H = null; S.shapes = []; S.active = null; S.auto = null;
      S.t0 = Date.now(); S.t1 = null;
      clearInterval(S.tick); S.tick = setInterval(updateTimer, 500);
      setTool('calib'); recompute(); draw(); updateTimer();
    };
    im.src = src;
  }

  function setTool(t) {
    S.tool = t; S.active = null;
    document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
    if (!S.img) return;
    if (t === 'calib') {
      S.calib.pts = []; S.calib.H = null;
      setHint(S.calib.type === 'rect'
        ? 'Maßstab: 4 Ecken des Referenzrechtecks im Uhrzeigersinn ab links oben anklicken. Punkte lassen sich ziehen.'
        : 'Maßstab: 2 Endpunkte der Referenzstrecke anklicken.');
    } else {
      setHint(t === 'facade'
        ? 'Fassade: Eckpunkte der Außenwand anklicken, mit Klick auf den ersten Punkt oder „Fläche schließen“ beenden.'
        : 'Fenster/Öffnung: Eckpunkte anklicken und schließen. Mehrere möglich.');
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
    const wins = S.shapes.filter((s) => s.kind === 'window');
    const aF = facades.reduce((a, s) => a + areaOf(s.pts), 0);
    const aW = wins.reduce((a, s) => a + areaOf(s.pts), 0);
    const ready = !!S.calib.H;
    $('rFacade').textContent = ready && facades.length ? fmt(aF) + ' m²' : '–';
    $('rWin').textContent = ready && wins.length ? fmt(aW) + ' m²' : '–';
    $('rCount').textContent = wins.length;
    $('rNet').innerHTML = ready && facades.length ? '<b>' + fmt(aF - aW) + ' m²</b>' : '–';
    $('rRatio').textContent = ready && facades.length && aF > 0 ? fmt((aW / aF) * 100, 1) + ' %' : '–';

    if (S.img && !ready) warn.push('Noch kein Maßstab gesetzt – es werden keine Flächen berechnet.');
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
    } else if (S.tool === 'facade' || S.tool === 'window') {
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
    const k = Math.min(1, maxEdge / Math.max(S.img.naturalWidth, S.img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(S.img.naturalWidth * k); c.height = Math.round(S.img.naturalHeight * k);
    c.getContext('2d').drawImage(S.img, 0, 0, c.width, c.height);
    return { k, w: c.width, h: c.height, data: c.toDataURL('image/jpeg', 0.9).split(',')[1] };
  }
  $('auto').addEventListener('click', async () => {
    if (!S.img) { setHint('Erst ein Foto laden.'); return; }
    const btn = $('auto'); btn.disabled = true; setHint('KI analysiert das Foto …');
    const t = Date.now();
    try {
      const im = downscaleToJpeg();
      const r = await fetch('/api/detect', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: im.data, mediaType: 'image/jpeg', width: im.w, height: im.h }) });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error || ('HTTP ' + r.status));
      const toImg = (poly, kind) => ({ kind, pts: poly.points.map((p) => [p.x / im.k, p.y / im.k]) });
      const shapes = [
        ...out.facades.map((p) => toImg(p, 'facade')),
        ...out.windows.map((p) => toImg(p, 'window')),
        ...out.doors.map((p) => toImg(p, 'window')),
      ].filter((s) => s.pts.length >= 3);
      S.shapes = shapes; S.active = null;
      S.auto = { shapes: JSON.parse(JSON.stringify(shapes)), mock: !!out.mock, model: out.model || null, dauer_s: (Date.now() - t) / 1000, notes: out.notes };
      setHint((out.mock ? '[ATTRAPPE] ' : 'KI-Vorschlag: ') + shapes.length + ' Flächen. Bitte prüfen, Punkte verschieben, falsche löschen. ' + (out.notes || ''));
      recompute(); draw();
    } catch (e) {
      setHint('Automatische Erkennung nicht möglich: ' + e.message + ' (Server mit „npm start“ gestartet?)');
    } finally { btn.disabled = false; }
  });

  // ---------- Export ----------
  $('export').addEventListener('click', () => {
    const r = updateResults();
    const out = {
      erstellt: new Date().toISOString(), bild: S.name,
      bildgroesse_px: S.img ? [S.img.naturalWidth, S.img.naturalHeight] : null,
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
