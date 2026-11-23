/* Einfacher Ablauf für Kunden: Foto -> ein paar Angaben -> Empfehlung.
 * Steuert die vorhandenen Module (Aufmaß, Sanierung, Kosten) über deren Eingabefelder und Ereignisse.
 * Die Expertenansicht (Reiter) bleibt erhalten und wird über den Schalter in der Kopfzeile erreicht. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const root = $('kunde');
  if (!root) return;
  const K = window.Kosten;

  // ---------- Modus ----------
  const lese = () => { try { return localStorage.getItem('experte') === '1'; } catch { return false; } };
  const merke = (on) => { try { localStorage.setItem('experte', on ? '1' : '0'); } catch { /* ohne Speicher ok */ } };
  function modus(experte) {
    document.body.classList.toggle('experte', experte);
    $('modeBtn').textContent = experte ? 'Einfache Ansicht' : 'Expertenansicht';
    merke(experte);
  }
  modus(new URLSearchParams(location.search).has('experte') || lese());
  $('modeBtn').addEventListener('click', () => modus(!document.body.classList.contains('experte')));

  // ---------- Zustand ----------
  const Q = { baujahr: 1960, geschosse: 3, wand: 'mauerwerk', breite: null, fenster: null };
  let schritt = 'start', gesehenBusy = false, breitePflicht = false, ki = true;

  // Ohne KI-Schlüssel (oder ohne Server) läuft die App im Demo-Modus: nur das Beispielhaus lässt sich auswerten.
  fetch('/api/status').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => {
    ki = !!(j && j.ki);
    $('kDemoHinweis').hidden = ki; root.classList.toggle('k-demo-modus', !ki);
    $('kBeispiel').className = ki ? 'btn btn-quiet btn-lg' : 'btn btn-primary btn-lg';
    $('kSnap').className = ki ? 'btn btn-primary btn-lg' : 'btn btn-lg';
    if (!ki) $('kSnap').lastChild.textContent = 'Eigenes Foto aufnehmen';
  });

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = (x) => Math.round(x / 10) * 10 >= 1000 ? (Math.round(x / 100) * 100).toLocaleString('de-DE') + ' €' : Math.round(x).toLocaleString('de-DE') + ' €';
  const num = (x, d = 0) => x.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

  function zeige(s) {
    schritt = s;
    root.querySelectorAll('.k-step').forEach((el) => { el.hidden = el.dataset.step !== s; });
    const n = { start: 1, analyse: 1, fehler: 1, fragen: 2, ergebnis: 3 }[s];
    root.querySelectorAll('.k-dots li').forEach((li) => { const i = +li.dataset.n; li.classList.toggle('is-active', i === n); li.classList.toggle('is-done', i < n); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Schritt 1: Foto ----------
  $('kSnap').addEventListener('click', () => $('snap').click());
  $('kPick').addEventListener('click', () => $('file').click());
  const beispiel = () => { zeige('analyse'); window.AufmassUI.beispielhaus().then(() => nachAnalyse()); };
  $('kBeispiel').addEventListener('click', beispiel);
  $('kFehlerBeispiel').addEventListener('click', beispiel);
  // Aufnahmephase: läuft vor dem Handler in app.js, der das Dateifeld direkt nach dem Laden leert
  document.addEventListener('change', (e) => {
    if ((e.target.id === 'snap' || e.target.id === 'file') && e.target.files.length && !document.body.classList.contains('experte')) { gesehenBusy = false; zeige('analyse'); }
  }, true);
  new MutationObserver(() => {
    const busy = document.body.classList.contains('busy');
    if (busy) { gesehenBusy = true; return; }
    if (gesehenBusy && schritt === 'analyse') { gesehenBusy = false; nachAnalyse(); }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  function nachAnalyse() {
    const st = window.AufmassUI.status();
    if (st.fehler || !st.fassade) { fehler(st.fehler); return; }
    breitePflicht = !st.massstabOk;
    $('kBreitePflicht').hidden = !breitePflicht;
    $('kMock').hidden = !st.mock; $('kMock').textContent = st.demo ? 'Beispielhaus: Flächen sind vorgegeben' : 'Testmodus: Beispielwerte';
    pruefeFormular();
    zeige('fragen');
    vorschau();
  }

  function fehler(grund) {
    const g = (grund || '').toLowerCase();
    $('kFehlerText').textContent = !ki ? 'Für eigene Fotos braucht die App einen KI-Schlüssel. Sie können das Beispielhaus ansehen oder in der Expertenansicht von Hand vermessen.'
      : !grund ? 'Auf dem Foto konnten wir keine Hauswand erkennen. Bitte ein Foto machen, auf dem die ganze Wand zu sehen ist.'
      : /key|schl|authent|401|503|server|fetch|network|load failed|nicht erreichbar/.test(g) ? 'Die automatische Erkennung ist gerade nicht erreichbar. Sie können das Foto in der Expertenansicht von Hand vermessen.'
        : 'Das Foto konnte nicht ausgewertet werden. Bitte versuchen Sie ein anderes Foto.';
    zeige('fehler');
  }
  $('kNochmal').addEventListener('click', () => { $('snap').value = ''; $('file').value = ''; zeige('start'); });
  $('kFehlerExperte').addEventListener('click', () => { modus(true); });

  // ---------- Schritt 2: Angaben ----------
  const kopie = $('kPreview'), kctx = kopie.getContext('2d');
  function vorschau() {
    const cv = $('cv');
    if (schritt !== 'fragen' || !cv.width) return;
    const w = Math.min(cv.width, 1000), h = Math.round(cv.height * (w / cv.width));
    if (kopie.width !== w || kopie.height !== h) { kopie.width = w; kopie.height = h; }
    kctx.drawImage(cv, 0, 0, w, h);
  }
  window.KundeUI = { vorschau };

  function pruefeFormular() {
    const ok = Q.baujahr >= 1800 && Q.baujahr <= 2030 && Q.geschosse >= 1 && (!breitePflicht || Q.breite > 0 || Q.fenster > 0);
    $('kWeiter').disabled = !ok;
  }
  $('kBaujahr').addEventListener('input', () => { Q.baujahr = parseInt($('kBaujahr').value, 10) || 0; pruefeFormular(); });
  $('kBreite').addEventListener('input', () => { const v = parseFloat($('kBreite').value.replace(',', '.')); Q.breite = v > 0 ? v : null; pruefeFormular(); });
  $('kFenster').addEventListener('input', () => { const v = parseFloat($('kFenster').value.replace(',', '.')); Q.fenster = v > 0 ? v : null; pruefeFormular(); });
  root.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => {
    Q.geschosse = Math.max(1, Math.min(12, Q.geschosse + (+b.dataset.g))); $('kGeschosse').textContent = Q.geschosse; pruefeFormular();
  }));
  root.querySelectorAll('input[name=kWand]').forEach((r) => r.addEventListener('change', () => { Q.wand = r.value; }));

  // Wandart in einfachen Worten -> Eingaben des Sanierungsmoduls
  function wandEingabe() {
    const alt = Q.baujahr < 1950;
    switch (Q.wand) {
      case 'zweischalig': return { key: Q.baujahr >= 1984 ? 'zweischaligDaemm' : 'zweischalig', cm: 36 };
      case 'holz': return { key: alt ? 'fachwerkZiegel' : 'holzGedaemmt', cm: 24 };
      default: return { key: alt ? 'vollstein' : 'lochstein', cm: 36.5 };
    }
  }
  const feld = (id, wert) => { const el = $(id); el.value = String(wert); el.dispatchEvent(new Event('input', { bubbles: true })); };

  function berechnen() {
    // Maßstab: gemessene Breite, sonst KI-Schätzung
    const modus2 = Q.breite ? 'width' : Q.fenster ? 'window' : 'est';
    if (Q.breite) feld('autoW', Q.breite); else if (Q.fenster) feld('autoF', Q.fenster);
    const r = document.querySelector(`input[name=amode][value=${modus2}]`);
    r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true }));
    // Gebäude
    const w = wandEingabe();
    feld('sBaujahr', Q.baujahr); feld('sDicke', w.cm); feld('sGeschosse', Q.geschosse);
    const k = document.querySelector(`input[name=sKonstr][value=${w.key}]`);
    k.checked = true; k.dispatchEvent(new Event('change', { bubbles: true }));
    return window.KostenUI.ergebnis();
  }

  $('kWeiter').addEventListener('click', () => {
    const erg = berechnen();
    if (!erg || !erg.empfehlung.premium) { $('kErgebnis').innerHTML = '<p class="k-hinweis">Für dieses Gebäude konnten wir keine passende Variante berechnen. Bitte die Angaben prüfen.</p>'; zeige('ergebnis'); return; }
    ergebnis(erg);
  });

  // ---------- Schritt 3: Ergebnis ----------
  const BESCHREIBUNG = {
    wdvs: 'Dämmplatten werden auf die Wand geklebt und verputzt.',
    vhf: 'Dämmung mit einer belüfteten Holzverkleidung davor.',
  };
  const NAME = { 'wdvs-eps': 'Wärmedämmverbundsystem mit EPS', 'wdvs-mw': 'Wärmedämmverbundsystem mit Mineralwolle', 'wdvs-holzfaser': 'Wärmedämmverbundsystem mit Holzfaser',
    'vhf-eps': 'Vorgehängte Fassade mit EPS', 'vhf-mw': 'Vorgehängte Fassade mit Mineralwolle', 'vhf-holzfaser': 'Vorgehängte Fassade mit Holzfaser' };
  const STAERKEN = { dauer: 'langlebig', feuchte: 'feuchtigkeitsgeschützt', brand: 'nichtbrennbar', schall: 'gut gegen Lärm', sommer: 'gut gegen Sommerhitze', rueckbau: 'gut recycelbar', gewicht: 'leicht' };
  const TITEL = { premium: 'Beste Qualität', preisLeistung: 'Bestes Preis-Leistungs-Verhältnis', umwelt: 'Am umweltfreundlichsten' };
  const FARBE = { premium: 'var(--c-premium)', preisLeistung: 'var(--brand)', umwelt: 'var(--ok)' };

  function warum(k) {
    const top = Object.entries(k.qualitaet.noten).filter(([, n]) => n >= 4.5).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => STAERKEN[id]);
    return top.length ? top.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.' : 'Ausgewogene Lösung.';
  }

  // Eine Karte je Variante: gewinnt sie mehrere Kategorien, trägt sie alle Titel; die dritte Karte ist dann die nächstbeste Alternative.
  function karte(titel, k, T) {
    const hinw = k.brandschutz && k.brandschutz.auflage ? '<p class="k-auflage">Mit Brandschutzauflage (Brandriegel).</p>' : '';
    const labels = titel.map((t) => `<span class="k-label" style="--c:${t.farbe}">${t.text}</span>`).join('');
    return `<article class="k-card" style="--c:${titel[0].farbe}">
      <div class="k-labels">${labels}</div>
      <h3>${esc(NAME[k.id] || k.name)}</h3>
      <p class="k-was">${BESCHREIBUNG[k.system]}</p>
      <p class="k-preis">ca. ${eur(k.invest.gesamt)}</p>
      <p class="k-preis-l">Kosten heute. Mit Pflege und Wartung ca. ${eur(k.lcc.gesamt)}.</p>
      <p class="k-co2"><b>${num(k.gwp[T].gesamt / 1000, 1)} t</b> CO₂ über ${T} Jahre</p>
      <p class="k-warum">${warum(k)}</p>
      ${hinw}
    </article>`;
  }

  function karten(e) {
    const T = e.zeitraum, liste = [];
    const add = (art, k, text) => {
      const vorhanden = liste.find((x) => x.k.id === k.id), t = { text: text || TITEL[art], farbe: FARBE[art] };
      if (vorhanden) vorhanden.titel.push(t); else liste.push({ k, titel: [t] });
    };
    add('premium', e.premium, null); add('preisLeistung', e.preisLeistung, null); add('umwelt', e.umwelt, null);
    // Doppelsieger: nächstbeste Alternative ergänzen, ehrlich benannt
    if (liste.length < 3 && e.alternative.umwelt) add('umwelt', e.alternative.umwelt, 'Alternative mit wenig CO₂');
    if (liste.length < 3 && e.alternative.preisLeistung) add('preisLeistung', e.alternative.preisLeistung, 'Alternative zum guten Preis');
    return liste.map((x) => karte(x.titel, x.k, T)).join('');
  }

  function ergebnis(erg) {
    const e = erg.empfehlung, st = window.AufmassUI.status(), san = window.SanierungUI.ergebnis();
    const genau = st.art === 'width' ? 'ca. ±5 %' : st.art === 'window' ? 'ca. ±8 %' : 'ca. ±15 %';
    const fuss = st.demo ? 'Beispielrechnung für ein Musterhaus mit vorgegebenen Flächen, kein echtes Foto. Für Ihr Haus brauchen Sie ein eigenes Foto.' : `Richtwerte, netto, Preisstand 2026 für Köln. Die Genauigkeit der Flächen liegt bei ${genau}. Für einen verbindlichen Preis brauchen Sie ein Angebot.`;
    const wand = { mauerwerk: 'Mauerwerk', zweischalig: 'zweischaliges Mauerwerk', holz: 'Holz oder Fachwerk' }[Q.wand] || 'Mauerwerk';
    $('kErgebnis').innerHTML = `
      <div class="k-kopf"><h2>Unsere Empfehlung für Ihr Haus</h2>
        <p>Für ${num(san.bezugsflaeche_m2)} m² Außenwand, Baujahr ${Q.baujahr}, ${Q.geschosse} Geschosse, ${wand}. Fenster sind nicht enthalten.</p></div>
      <div class="k-cards">${karten(e)}</div>
      <p class="k-fuss">${fuss}</p>
      <div class="k-aktionen"><button type="button" class="btn" id="kAendern">Angaben ändern</button><button type="button" class="btn" id="kNeu">Neues Foto</button><button type="button" class="btn btn-quiet" id="kDetails">Alle Zahlen ansehen</button></div>`;
    $('kAendern').addEventListener('click', () => zeige('fragen'));
    $('kNeu').addEventListener('click', () => { $('snap').value = ''; $('file').value = ''; zeige('start'); });
    $('kDetails').addEventListener('click', () => { modus(true); const t = document.querySelector('.tabs [data-tab=tabEmpfehlung]'); if (t) t.click(); });
    zeige('ergebnis');
  }
})();
