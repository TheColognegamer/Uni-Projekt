# Prompt-Log (Vibecoding-Dokumentation)

Zweck: systematische Dokumentation des KI-gestützten Entwicklungsprozesses gemäß Aufgabenstellung §3.3
(Tools, Modelle, repräsentative Prompts, Iterationsschritte, KI-Fehler, Prüfung/Korrektur).
Es müssen **nicht alle** Prompts erfasst werden – nur repräsentative und für die Entwicklung relevante.

**Pflege:** Nach jeder relevanten Iteration einen Eintrag am Ende ergänzen (Vorlage unten). Jedes Teammitglied trägt eigene Sitzungen ein.

## Eingesetzte Tools

| Tool | Modell / Version | Zeitraum | Nutzung |
|---|---|---|---|
| Claude Code (Web/Cloud-Sitzung) | *bitte aus der Sitzung eintragen (Modellname/Version)* | ab 09.11.2026 | Prototyp-Entwicklung |

## Eintragsvorlage

```
### P-NN · Kurztitel · Datum · Name
- Ziel:
- Prompt (Kurzfassung/Zitat):
- KI-Ergebnis (was wurde erzeugt/verändert):
- Fachliche/technische Fehler oder Auffälligkeiten:
- Prüfung/Korrektur (wie verifiziert?):
- Mehrwert der KI vs. menschliche Kontrolle nötig:
- Betroffene Dateien/Commit:
```

## Einträge

### P-01 · Projektstart, Aufgabenverständnis · 09.11.2026 · Nicolai
- **Ziel:** Prüfen, ob die KI Aufgabenstellung (PDF) und Projektkonzept (PPTX) korrekt erfasst hat.
- **Prompt:** Aufgabenstellung und Projektkonzept als Anhang, „gib wieder ob du die Aufgabe verstehst“.
- **KI-Ergebnis:** Zusammenfassung von Aufgabe, Terminen, Bewertungsmatrix und Gruppenkonzept; dazu Hinweise auf Schwachstellen (H3 schwer überprüfbar, Foto-Erkennung als Hauptrisiko, Validierung noch offen).
- **Auffälligkeiten:** Beim ersten Einlesen lieferte der PDF-Aufruf nur eine Dateibestätigung ohne Inhalt; die KI musste die Seiten explizit rendern lassen und das PPTX per Skript extrahieren, bevor sie antworten konnte.
- **Prüfung:** Zusammenfassung vom Team gegen die Originaldokumente gelesen *(bitte bestätigen)*.
- **Mehrwert / Kontrolle:** Schnelle Strukturierung; die fachliche Bewertung der Hinweise liegt beim Team.

### P-02 · Erster Prototyp: Web-App mit Fokus Foto-Aufmaß · 09.11.2026 · Nicolai
- **Ziel:** Lauffähiger Web-Prototyp, Schwerpunkt Foto-Erkennung/Aufmaß (Hypothesen H1, H2). Zusätzlich dieses Prompt-Log.
- **Prompt:** „prompt log erstmal und ersten prototypen als web app bauen, erstmal fokus auf die fotoerkennung legen“.
- **Entscheidung der KI (ohne Rückfrage getroffen):** Statt automatischer Bilderkennung ein **assistiertes Aufmaß**: Nutzer:in kalibriert über ein Referenzrechteck bekannter Größe (Homographie/Entzerrung), markiert Fassade und Fenster als Polygone, die App berechnet Flächen in m². Begründung: In einer reinen Browser-App ohne Backend ist zuverlässige automatische Fenstererkennung nicht ohne ML-Modell möglich und im Rahmen eines ersten Prototyps nicht prüfbar. Automatische Vorschläge sind als nächster Schritt vorgesehen. **Das Team sollte entscheiden, ob dies zur Forschungsfrage passt** (Konzept sagt „Software erkennt Wand- und Fensterbereiche“).
- **KI-Ergebnis:** `src/geometry.js` (Homographie, Polygonfläche, Selbstüberschneidungs-Check), `src/app.js` (UI), `index.html`, `src/style.css`; Demo-Fassade mit bekannter Wahrheit (10 × 6 m Wand, 4 Fenster à 1,2 × 1,4 m); Zeitmessung (H1), Referenzvergleich mit Toleranz (H2), JSON-Export; Tests in `tests/`.
- **Aufgetretene Fehler:**
  1. *UX-Fehler (vom End-to-End-Test aufgedeckt):* Klick auf einen bereits vorhandenen Punkt startete immer ein Ziehen, sodass Fassadenecken auf Kalibrierecken nicht gesetzt werden konnten (Fassade = NaN). Fix: Ziehen erst bei Mausbewegung > 4 px.
  2. *Nummerierung:* Liste nummerierte über alle Flächen statt je Art („Fenster 2“ für das erste Fenster). Fix per `nr()`-Hilfsfunktion.
- **Prüfung/Korrektur:** (a) Unit-Tests der Geometrie gegen analytisch bekannte Werte inkl. perspektivischer Projektion; (b) Headless-Browser-Test, der die Bedienung simuliert und Flächen gegen die Wahrheit prüft; (c) Sichtprüfung per Screenshot.
- **Wichtige Beobachtung (für Paper):** Monte-Carlo-Test mit ±2 px Klickrauschen: Kalibrierung über ganze Wand → ~0,3 % mittlerer Flächenfehler, über eine Tür (1 × 2 m) → ~13,7 %. Kleine Referenzobjekte sind stark fehleranfällig.
- **Einschränkung der Prüfung:** Nur synthetische Daten; **noch kein reales Foto, kein unabhängiges Referenzaufmaß** – diese Validierung steht aus.
- **Dateien:** siehe Repository-Wurzel, `tests/`.

### P-03 · KI-Vorschläge per Vision-Modell (Backend + Button) · 09.11.2026 · Nicolai
- **Ziel:** Erkennung von Wand, Fenstern und Türen ohne Anklicken; Mensch korrigiert nur noch (H1/H2 prüfbar).
- **Prompt (sinngemäß):** Fragen, ob automatische Erkennung ohne Anklicken geht und wie man das mit Vision macht; danach „weg zwei“ (echter Test mit Schlüssel).
- **KI-Ergebnis:** `server.mjs` (Node, Claude-API-Aufruf mit Bild und strukturierter JSON-Ausgabe über ein Zod-Schema), Button „Automatisch erkennen (KI)“, Umrechnung der Koordinaten vom verkleinerten Bild, Export des ursprünglichen Vorschlags, Attrappe-Modus (`MOCK=1`), Test `tests/auto-mock.mjs`.
- **Auffälligkeiten:**
  1. Die KI-Sitzung konnte die API aus ihrer Umgebung nicht aufrufen (401, Schlüsselformular für Anthropic-Hosts nicht möglich). Der echte Modellaufruf wurde deshalb **nicht ausgeführt**; getestet ist nur die Strecke Frontend ↔ Server mit einer Attrappe, die feste Werte für das Beispielfoto liefert.
  2. Die Attrappe liefert exakt die vorher von der KI selbst geschätzten Klickpunkte. Sie sagt nichts über die Erkennungsqualität.
  3. Server ohne Schlüssel gibt eine verständliche Fehlermeldung (geprüft).
- **Noch offen / Prüfung durch das Team:** Mit eigenem Schlüssel echte Vorschläge erzeugen und messen: Flächenabweichung Vorschlag vs. manuelles Referenzaufmaß, Anzahl Korrekturen, Zeit. Refusal-Fallback der API wurde nicht eingebaut (bei Ablehnung erscheint eine Fehlermeldung).
- **Dateien:** `server.mjs`, `package.json`, `src/app.js`, `index.html`, `tests/auto-mock.mjs`.

### P-04 · Handy-Ablauf: Kamera → Auswertung · 09.11.2026 · Nicolai
- **Ziel:** Am Handy ein Foto aufnehmen und ohne Klicken ein Ergebnis bekommen.
- **Prompt (sinngemäß):** „Ich muss es per Handy öffnen können, mit der Handykamera das Bild machen und dann soll der mir das automatisch ausrechnen.“
- **KI-Ergebnis:** Button „Foto aufnehmen & auswerten“ (Kamera über Datei-Eingabe mit `capture`), Verkleinerung großer Handyfotos, Auto-Maßstab aus erkannter Tür (angenommene Höhe 2,01 m) oder eingegebener Fassadenbreite, Kurzzusammenfassung unter dem Bild, Anzeige der WLAN-Adresse im Server, optionaler Zugangscode und Stundenlimit.
- **Fachliche Auffälligkeiten:** Der Auto-Maßstab nutzt eine Referenzstrecke ohne Perspektivkorrektur und bei der Tür eine **Annahme**; die App warnt dazu. In der Attrappe ergibt das 57,7 m² statt der 61,6 m² mit Referenzrechteck (Differenz ~6 %), also genau der Effekt, den die Annahme erwarten lässt.
- **Prüfung:** Test im emulierten Handy-Format (390 px, Touch) mit der Attrappe, Zugangscode (401/401/200) geprüft. **Nicht getestet:** echte Handykamera, echter Modellaufruf, Hosting.
- **Dateien:** `index.html`, `src/app.js`, `server.mjs`, `tests/auto-mock.mjs`.

### P-05 · Dämmdicken nach GModG und Fenstertausch · 13.11.2026 · Moritz
- **Ziel:** Aus Wandstärke und Baumaterial der Bestandswand (Köln, 1950–1970) die nötige Dämmdicke für WDVS und hinterlüftete Vorhangfassade berechnen, sodass die U-Werte nach GModG/GEG eingehalten werden; dazu Fenstertausch.
- **Prompt (Kurzfassung):** Tool soll anhand einer Wandstärke und eines Baumaterials die Dicke der Dämmmaterialien berechnen, U-Werte nach GEG bzw. GModG berücksichtigen, Fenstertausch ebenfalls; je System 3 Dämmstoffe.
- **Tool/Modell:** Claude (Opus 5.5) mit GitHub-Anbindung, Arbeit im eigenen Branch `claude/arbeitsbereich`.
- **KI-Ergebnis:** `src/bauphysik.js` (Kennwerte + Rechnung), `src/sanierung-ui.js` (Panel 4/5), Anbindung an das Aufmaß über das Ereignis `flaechen`, JSON-Export `sanierung`, Test `tests/bauphysik.test.js`.
- **Recherche der KI:** Das GEG heißt seit 29.07.2026 GModG (BGBl. 2026 I Nr. 226); Höchstwerte Anlage 7 unverändert: Außenwand 0,24, Fenster Uw 1,3 W/(m²K).
- **Annahmen, die das Team prüfen muss:** λ-Werte der Bestandsbaustoffe (Bims- und Trümmerbeton sind Schätzwerte), ΔU = 0,03 für die VHF-Unterkonstruktion, Uw der neuen Fenster (Marktrichtwerte), Putzdicken 1,5 + 2 cm. **Dämmstoffe sind Platzhalter** (EPS/MW/Holzfaser bzw. MW/Holzfaser/Hanf), bis die Gruppe ihre Auswahl liefert.
- **Prüfung:** Unit-Test gegen Handrechnung (Vollziegel 36,5 cm: U = 1,51; EPS 035 → 12,3 cm → 14 cm, U = 0,214); Browser-Test mit Demo-Fassade (Wand netto 53,28 m² korrekt übernommen).
- **Grenzen:** Vereinfachtes Verfahren für LPh 2, keine Feuchte-/Tauwasserprüfung, keine Laibungs- und Sockeldetails, Dübel im WDVS vernachlässigt.
