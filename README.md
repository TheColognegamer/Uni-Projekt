# Lebenszyklusvergleich von Fassadensystemen – Prototyp (Gruppe 2)

Web-App (reines HTML/JS, kein Build) für das **Fassadenaufmaß per Foto** mit anschließender Sanierungs- und CO₂-Bewertung.
**Zwei Ansichten.** Standard ist der **einfache Ablauf für Kunden**: Foto aufnehmen, drei Angaben (Baujahr, Stockwerke, Wandart; optional die Breite der Hauswand), dann drei Empfehlungen (beste Qualität, bestes Preis-Leistungs-Verhältnis, am umweltfreundlichsten) mit Preis und CO₂. Oben rechts schaltet **„Expertenansicht“** auf die Reiter um (auch per Adresse: `http://localhost:8000/?experte=1`). Die Wahl wird im Browser gemerkt.

Die Expertenansicht enthält alle Module, vier Reiter:

| Reiter | Inhalt | Code |
|---|---|---|
| **Aufmaß** | Foto → Maßstab/Entzerrung → Fassade, Fenster, Türen → m² (mit KI-Vorschlag) | `src/app.js`, `src/geometry.js`, `server.mjs` |
| **Sanierung** | Bestandswand (U-Wert), Dämmdicke nach GModG, Fenster, Brandschutz, Zusammenfassung/PDF | `src/bauphysik.js`, `src/sanierung-ui.js`, `src/pdf*.js` |
| **LCA** | GWP-Vergleich WDVS/VHF/Fenster für 30 und 50 Jahre (ÖKOBAUDAT) | `src/lca*.js` |
| **Empfehlung** | Kosten (Excel), Qualität, Treibhausgase; drei Empfehlungen: Premium, Preis-Leistung, Umweltfreundlichste | `src/kosten*.js` |

Datenfluss: Aufmaß ─`flaechen`→ Sanierung ─`sanierung`→ LCA und Kosten/Empfehlung. Schnittstellen: `docs/schnittstelle-aufmass.md`, `docs/schnittstelle-sanierung.md`, `docs/schnittstelle-kosten.md`. Gemeinsames Aussehen: `src/design.css` (`docs/design-system.md`).
Hinweis: Die Module Sanierung und LCA wurden aus den Branches `claude/arbeitsbereich` und `LCA-Berechnung` **kopiert** (nur gelesen, dort wurde nichts verändert). Weiterentwicklung dort muss hier nachgezogen werden.

**Für das Team:** Schritt-für-Schritt-Anleitung zum Ausprobieren in `docs/anleitung-team.md`.

## Starten
```bash
npm install && npm start      # http://localhost:8000 (mit KI-Erkennung, siehe unten)
python3 -m http.server 8000   # alternativ ohne KI-Erkennung, nur statische Seiten
``` „Demo-Fassade“ lädt ein synthetisches Testbild mit bekannter Wahrheit.

## Bedienung
1. Foto laden. 2. **Maßstab:** 4 Ecken eines Referenzrechtecks bekannter Größe (links oben, im Uhrzeigersinn) klicken und Maße eingeben – möglichst große Referenz (ganze Wand). 3. **Fassade** und 4. **Fenster/Öffnungen** als Polygone markieren (Schließen: ersten Punkt anklicken, Enter oder Button). Punkte sind verschiebbar.
Rechts erscheinen Brutto-/Netto-Fläche und Fensteranteil; unter „Evaluation“ Zeit (H1) und Abweichung zu einem Referenzaufmaß (H2). Export als JSON.

## KI-Vorschläge (optional, lokal)
Der Button „Automatisch erkennen (KI)“ schickt das Foto an einen kleinen Server (`server.mjs`), der ein Vision-Modell der Claude API aufruft und Umrisse für Wand, Fenster und Türen zurückgibt. Der Schlüssel bleibt serverseitig.
```bash
npm install
cp .env.example .env                    # dann in .env den Key eintragen (wird nie committet)
npm start                               # http://localhost:8000
npm start                               # ohne Schlüssel: Demo-Modus (Beispielhaus), mit Schlüssel in .env: echte Erkennung
npm run start:mock                      # Entwicklung/Tests: feste Beispielwerte für ein bestimmtes Foto, KEINE echte Erkennung
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

## LCA · CO₂-Vergleich (Reiter „LCA“)
GWP-total (A1–A3 + B4 + C3 + C4, DIN EN 15804+A2 / DIN EN 15978) aller Fassadenvarianten (6 WDVS, 12 VHF) und Fenster (6: Holz, Holz-Alu, PVC × 2-/3-fach, wie im Modul Sanierung) für 30 und 50 Jahre, mit ÖKOBAUDAT-2024-II-Daten. Holz-Alu ist mangels generischem Datensatz als Holzrahmen + Alu-Deckschale angenähert.
Flächen und Dämmdicken (gleiches U = 0,24 nach GModG) kommen aus dem Modul Sanierung (Ereignis `sanierung`).
Diagramm aller Varianten, Gesamtfassade per Dropdown, Vergleich zweier Konfigurationen mit Wandskizze und Vor-/Nachteilen, aufklappbare Annahmen, PDF-Export.
**Annahmen ändern** (z. B. Nutzungsdauern nach BBSR): nur in `src/lca-data.js`, danach `node tests/lca.test.js`. Grundlage: `docs/LCA_Fassadensanierung_WDVS_VHF.xlsx` (Iris). Die App liest die Excel nicht ein; Werte sind in `src/lca-data.js` übertragen, der Test vergleicht gegen die Excel-Ergebnisse. Änderungen daher in beiden nachziehen.

## Tests
```bash
node tests/bauphysik.test.js  # U-Werte und Dämmdicken gegen Handrechnung
node tests/pdf.test.js        # PDF-Bericht (Aufbau, Zeichensatz, Querverweise)
node tests/lca.test.js        # LCA-Rechnung gegen die Excel (22 Varianten) + Holz-Alu-Fenster gegen Handrechnung, 30/50 Jahre
node tests/kunde.mjs <foto.png> [bildordner]   # einfacher Kundenablauf, Fehlerfall, Umschalter (Attrappe)
node tests/kosten.test.js     # Kosten und Empfehlung gegen die Excel (Blatt LCC) und Invarianten
node tests/szenarien.test.js  # fünf erfundene Gebäude: Handrechnung, Invarianten, Größenordnungen (Kette U-Wert → LCA)
node tests/szenarien-ui.mjs   # dieselben Szenarien durch die Oberfläche, Abgleich mit dem Rechenkern
node tests/geometry.test.js   # Geometrie-Kern
node tests/e2e.mjs            # Browser-Smoke-Test der Expertenansicht (benötigt Playwright)
node tests/integration.mjs <foto.png> [bildordner]   # Gesamtweg Aufmaß → Sanierung → LCA im Browser (Attrappe)
node tests/compare_ground_truth.mjs <messung.json> --fassade nord   # Abweichung gegen Planmaße
node tests/auto-mock.mjs <foto.png>   # KI-Vorschlags-Strecke mit Attrappe
```

## Dokumentation
`docs/prompt-log.md` – Vibecoding-Log (Pflicht laut Aufgabenstellung), `docs/schnittstelle-aufmass.md`, `docs/schnittstelle-sanierung.md`, `docs/design-system.md`, `docs/testdaten/README.md` (Validierung gegen Planmaße).

## Hosting auf Render (ohne eigenen Rechner)
Ungetestet; Stand der Dienste bitte selbst prüfen (Preise, Free-Stufe).
1. Konto auf render.com anlegen und GitHub verbinden (Zugriff auf `uni-projekt` erlauben).
2. **New → Blueprint** (liest `render.yaml`) oder **New → Web Service** mit Build `npm install`, Start `npm start`.
3. Umgebungsvariablen setzen: `ANTHROPIC_API_KEY` (Schlüssel aus console.anthropic.com) und `ACCESS_CODE` (selbst gewähltes Passwort für das Team).
4. Nach dem Deploy erscheint eine `https://…onrender.com`-Adresse. Am Handy öffnen, Zugangscode in der App eintragen.
Der Server startet auf gehosteten Diensten nicht ohne `ACCESS_CODE`. `MAX_PER_HOUR` begrenzt die Kosten. Kostenlose Stufen schlafen meist nach Inaktivität ein; der erste Aufruf dauert dann länger.
