# Lebenszyklusvergleich von Fassadensystemen – Prototyp (Gruppe 2)

Web-App (reines HTML/JS, kein Build, keine Abhängigkeiten) für das **Fassadenaufmaß per Foto**.
Aktueller Stand: assistiertes Aufmaß (Foto → Maßstab/Entzerrung → Fassade/Fenster markieren → m²).
LCA-/LCC-Vergleich folgt in späteren Iterationen.

## Starten
```bash
python3 -m http.server 8000   # dann http://localhost:8000 öffnen
```
Oder `index.html` direkt im Browser öffnen. „Demo-Fassade“ lädt ein synthetisches Testbild mit bekannter Wahrheit.

## Bedienung
1. Foto laden. 2. **Maßstab:** 4 Ecken eines Referenzrechtecks bekannter Größe (links oben, im Uhrzeigersinn) klicken und Maße eingeben – möglichst große Referenz (ganze Wand). 3. **Fassade** und 4. **Fenster/Öffnungen** als Polygone markieren (Schließen: ersten Punkt anklicken, Enter oder Button). Punkte sind verschiebbar.
Rechts erscheinen Brutto-/Netto-Fläche und Fensteranteil; unter „Evaluation“ Zeit (H1) und Abweichung zu einem Referenzaufmaß (H2). Export als JSON.

## KI-Vorschläge (optional, lokal)
Der Button „Automatisch erkennen (KI)“ schickt das Foto an einen kleinen Server (`server.mjs`), der ein Vision-Modell der Claude API aufruft und Umrisse für Wand, Fenster und Türen zurückgibt. Der Schlüssel bleibt serverseitig.
```bash
npm install
export ANTHROPIC_API_KEY="sk-ant-..."   # nie ins Repo committen
npm start                               # http://localhost:8000
npm run start:mock                      # nur Oberfläche testen, feste Beispielwerte, KEINE echte Erkennung
```
Der Maßstab bleibt Handarbeit (Schritt 1). Der Export enthält den ursprünglichen KI-Vorschlag (`ki_vorschlag`) neben der korrigierten Fassung, um die Korrekturen auswerten zu können.
### Am Handy nutzen
Die Seite „Foto aufnehmen & auswerten“ öffnet am Handy direkt die Kamera, schickt das Foto an den Server und berechnet mit Auto-Maßstab (angenommene Türhöhe oder eingegebene Fassadenbreite) die Flächen. Dazu muss das Handy den Server erreichen:
1. **Gleiches WLAN (einfachster Weg):** `npm start` am Rechner; im Terminal erscheint `Am Handy (gleiches WLAN): http://192.168.x.x:8000`. Diese Adresse im Handy-Browser öffnen.
2. **Gehostet (ohne eigenen Rechner):** siehe unten „Hosting auf Render“. Allgemein: Das Repo bei einem Node-Hoster (z. B. Render, Railway, Fly.io) als Web-Dienst starten mit `npm install` und `npm start`; Umgebungsvariablen `ANTHROPIC_API_KEY` und `ACCESS_CODE` setzen. Der Zugangscode wird in der App eingetragen. `MAX_PER_HOUR` (Standard 60) begrenzt die Kosten. Dieser Weg ist hier nicht getestet.

**Stand:** Der Server-Aufruf an das Modell ist noch nicht gegen die echte API getestet.

## Sanierung nach GModG: Dämmdicken und Fenstertausch
Panel „4 · Sanierung“ und „5 · Fenstertausch“ (Code: `src/bauphysik.js`, Oberfläche: `src/sanierung-ui.js`).
- **Eingabe (laienverständlich):** Baujahr, Wandart (Auswahl mit Erkennungshilfe) und Wandstärke.
- **Bestand:** amtlicher Pauschal-U-Wert nach *Bekanntmachung der Regeln zur Datenaufnahme im Wohngebäudebestand* (2020), vollständige Tabelle 2: alle 9 Baualtersklassen (bis 1918 … ab 2002), massive Wände und Holz-/Fachwerkwände. Bei „keine Angabe“ wird die passende Ersatzzeile verwendet und angezeigt.
- **Flächen:** aus dem Aufmaß-Modul; solange keins vorliegt, angenommene Flächen (Beispiel 250 m² Fassade, 16 Fenster).
- **Rechnung:** R der Bestandswand = 1/U − Rsi − Rse → erforderliche Dämmdicke, damit U ≤ 0,24 W/(m²K) nach **GModG Anlage 7** (bis 28.07.2026 GEG). WDVS mit Rse = 0,04; hinterlüftete Vorhangfassade mit Rse = Rsi = 0,13 und ΔU für die Unterkonstruktion (Holz 0,02 / Alu 0,04).
- **Dämmstoffe (laut Projektkonzept):** Mineralwolle, EPS, Holzfaser in beiden Systemen. Ausgegeben werden die rechnerische Dicke (genau U = 0,24, für den Vergleich „gleiche Dämmwirkung“) und die Ausführungsdicke (auf 2 cm aufgerundet). Hinweise zu Brandschutz (brennbare Dämmung in VHF, Brandriegel bei EPS-WDVS).
- **Brandschutz:** Gebäudeklasse aus der Geschosszahl (oder manuell); unzulässige Dämmvarianten werden ausgegraut (GK 4–5: hinterlüftet nur nichtbrennbar, WDVS mind. schwerentflammbar, EPS mit Brandriegeln; Hochhaus: nur nichtbrennbar).
- **Zusammenfassung:** kompakte Übersicht unter dem Tool (Kennzahlen, zulässige Dämmvarianten und Fenster, Hinweise), als Text kopierbar.
- **PDF-Bericht:** Button „PDF herunterladen“ erzeugt einen A4-Bericht (Gebäude, Anforderungen, alle Dämmvarianten mit Brandschutz, Fenster, Hinweise, Grundlagen) direkt im Browser, ohne Bibliothek (`src/pdf.js`, `src/pdf-bericht.js`).
- **Mögliche Fenster:** alle 6 Optionen (PVC/Holz/Holz-Alu × 2-/3-fach) mit Uw nach DIN EN ISO 10077-1 aus den Fenstermaßen und dem Rahmenanteil, geprüft gegen Uw ≤ 1,3.
- **Schnittstellen:** Eingang Ereignis `flaechen` (vom Aufmaß), Ausgang Ereignis `sanierung` bzw. `window.SanierungUI.ergebnis()` (für Kosten/CO₂). Felder und Einheiten: `docs/schnittstelle-sanierung.md`.
- **Annahmen:** Alle λ-, Ug-, Uf-, ψ- und ΔU-Werte stehen mit Quelle in `src/bauphysik.js` und sind dort änderbar.

## Tests
```bash
node tests/bauphysik.test.js  # U-Werte und Dämmdicken gegen Handrechnung
node tests/pdf.test.js        # PDF-Bericht (Aufbau, Zeichensatz, Querverweise)
node tests/geometry.test.js   # Geometrie-Kern
node tests/e2e.mjs            # Browser-Smoke-Test (benötigt Playwright)
node tests/auto-mock.mjs <foto.png>   # KI-Vorschlags-Strecke mit Attrappe
```

## Dokumentation
`docs/prompt-log.md` – Vibecoding-Log (Pflicht laut Aufgabenstellung).

## Hosting auf Render (ohne eigenen Rechner)
Ungetestet; Stand der Dienste bitte selbst prüfen (Preise, Free-Stufe).
1. Konto auf render.com anlegen und GitHub verbinden (Zugriff auf `uni-projekt` erlauben).
2. **New → Blueprint** (liest `render.yaml`) oder **New → Web Service** mit Build `npm install`, Start `npm start`.
3. Umgebungsvariablen setzen: `ANTHROPIC_API_KEY` (Schlüssel aus console.anthropic.com) und `ACCESS_CODE` (selbst gewähltes Passwort für das Team).
4. Nach dem Deploy erscheint eine `https://…onrender.com`-Adresse. Am Handy öffnen, Zugangscode in der App eintragen.
Der Server startet auf gehosteten Diensten nicht ohne `ACCESS_CODE`. `MAX_PER_HOUR` begrenzt die Kosten. Kostenlose Stufen schlafen meist nach Inaktivität ein; der erste Aufruf dauert dann länger.
