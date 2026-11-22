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

### P-05 · Fehler beim ersten echten Lauf: zod-Version · 16.11.2026 · Nicolai
- **Symptom (vom Nutzer gemeldet):** Beim Klick auf „Automatisch erkennen (KI)“ erschien „Cannot read properties of undefined (reading 'def')“.
- **Ursache:** Der Helfer `zodOutputFormat` des Anthropic-SDK erwartet Zod-4-Schemas. `import { z } from 'zod'` liefert bei zod 3.25 die alte Version, der Fehler trat im Server auf, noch vor dem Modellaufruf. Reproduziert mit einem Minimalbeispiel.
- **Warum die Tests es übersahen:** Die Attrappe (`MOCK=1`) umgeht den Modellpfad komplett. Das war im Log (P-03) als „nicht getestet“ vermerkt.
- **Korrektur:** Import auf `zod/v4`; das Schema wird jetzt beim Serverstart gebaut, damit solche Fehler sofort auftreten.
- **Prüfung:** Schema-Erzeugung nach der Korrektur ohne Fehler; bestehende Tests grün. Der Modellaufruf selbst ist weiterhin **nicht** von der KI getestet, der Nutzer prüft ihn mit eigenem Schlüssel.
- **Lehre für die Reflexion:** Tests mit Attrappen decken die Integrationsstelle zum externen Dienst nicht ab; echte Läufe finden solche Fehler.

### P-06 · Erster echter Fassadenlauf (Giebelhaus) · 16.11.2026 · Nicolai
- **Beobachtung (Screenshot des Nutzers):** Bei einem echten Foto (Giebelseite, unten Klinker, oben Holzverkleidung, Zaun und Bepflanzung vor der Wand) lieferte das Modell einen fünfeckigen Fassadenumriss (inkl. Giebel), fünf Fenster, ließ die Garage rechts weg und vermerkte, dass die Unterkante durch Zaun/Pfeiler/Bepflanzung verdeckt und geschätzt ist. Es erkannte keine Tür (auf dieser Seite keine vorhanden).
- **Auffälligkeit der App:** Der Auto-Maßstab wurde nur direkt bei der Erkennung angewendet. Ohne Tür blieb das Ergebnis leer, und die Eingabe einer gemessenen Fassadenbreite wirkte erst bei einem neuen, kostenpflichtigen Erkennungsaufruf.
- **Korrektur:** Der Maßstab lässt sich jetzt nachträglich ändern (Modus oder Länge), ohne neuen Aufruf. Die Fassadenbreite wird als waagerechte Ausdehnung des Umrisses bestimmt, damit sie auch bei Giebelfassaden stimmt (vorher: oberste zwei Punkte, bei Giebel falsch).
- **Prüfung:** Test mit Attrappe (Wechsel auf „Fassadenbreite“ 10 m ergibt 53,9 m² für 798 × 430 px); bestehende Tests grün. Nicht geprüft: Genauigkeit am echten Foto, da keine gemessene Referenz vorliegt.
- **Noch offen:** Prompt-Konvention (Maueröffnung statt Rahmenkante) und Vergleich mit gemessenen Referenzen.

### P-07 · Maßstab ohne Messen: KI schätzt aus Referenzobjekten · 16.11.2026 · Nicolai
- **Ziel / Prompt (sinngemäß):** „Ich hätte es möglichst gerne ohne Messen, dass es direkt am Bild erkannt wird.“
- **Fachliche Einordnung:** Ein einzelnes Foto enthält keinen absoluten Maßstab. Er lässt sich nur aus Objekten mit bekannter, eng streuender Größe schätzen (Türhöhe, Garagentor, Mauerwerksschichten, Stufen). Das Ergebnis ist deshalb eine **Schätzung mit Spanne**, kein Messwert.
- **KI-Ergebnis:** Das Erkennungsschema liefert zusätzlich `scale_refs` (Strecke in Pixeln, Länge als min/typ/max, Konfidenz). Die App bildet den Median der Einzelmaßstäbe, schließt unsichere Referenzen aus, warnt bei widersprüchlichen Referenzen (> 25 %), zeigt die verwendeten Referenzen und eine Spanne der Nettofläche (Maßstab geht quadratisch ein). Rückfall: angenommene Türhöhe, dann gemessene Fassadenbreite.
- **Annahmen im Prompt (zu prüfen):** Türhöhe 2,0–2,15 m, Garagentorhöhe 2,0–2,25 m, 3 NF- bzw. 4 DF-Schichten ≈ 25 cm, Stufenhöhe 0,15–0,19 m. Diese Werte stammen aus dem Modellwissen der KI und sind **nicht** gegen Normen oder Herstellerangaben geprüft; vor Verwendung im Paper mit Quellen belegen.
- **Prüfung:** Test mit Attrappe (Schätzung, Spanne, Referenzliste, Wechsel zu Breite/Tür) grün. **Nicht geprüft:** wie gut die echte KI Referenzstrecken setzt und wie nah die Schätzung an gemessenen Maßen liegt.
- **Hypothese für das Paper:** Der Fehler der Maßstabsschätzung (nicht der Flächenerkennung) dominiert die Gesamtunsicherheit; mit gemessener Referenz vergleichen.

### P-08 · Validierung gegen Bestandspläne (Testgebäude A) · 22.11.2026 · Nicolai
- **Ziel / Prompt (sinngemäß):** Fotos eines echten Hauses und vier Ansichtspläne (Nord, Süd, Ost, West) bereitgestellt; „check die Abweichung zwischen Bild und Bauplänen, damit man die Fehlertoleranz bestimmen kann“.
- **Was die KI getan hat:** Plangeometrie aus den PDF-Vektordaten ausgelesen (Fensterrechtecke, Text war in Linien gewandelt), Zahlen mit den gerenderten Plänen abgeglichen, Foto-Seiten den Ansichten zugeordnet, Referenzdatei und Auswertungsskript erstellt.
- **Was die KI nicht getan hat:** Die Fotos wurden **nicht** von der App/dem Modell ausgewertet (kein API-Zugriff in der KI-Umgebung). Eine Abweichung Foto ↔ Plan wurde daher **nicht** berechnet.
- **Fehler/Korrekturen:** (1) Die Vektor-Rechtecke ergaben zu wenige Fenster (Nord 22 statt 24 große, 7 statt 9 Streifenfenster); Zählung deshalb am gerenderten Plan geprüft. (2) In der Referenztabelle fehlte bei Süd die Haustür in der Öffnungssumme (Konsistenz mit dem Skript), korrigiert.
- **Annahmen mit Unsicherheit:** Traufhöhe +8,27 m über EG (Plan-Kote; im Plan wirkt die Wandoberkante teils bei etwa +7,9 bis +8,0 m), Geländehöhen aus Kotenangaben; Bruttoflächen deshalb ±2–3 %.
- **Auffälligkeit der Fotos:** durchgehend schräg und weitwinklig (keine frontale Aufnahme); die Referenzstrecke der App setzt frontal voraus.
- **Dateien:** `docs/testdaten/…`, `tests/compare_ground_truth.mjs`, `tests/fixtures/…`.

### P-09 · Nordseite rechts vom Fallrohr gegen Plan · 22.11.2026 · Nicolai
- **Prompt (sinngemäß):** Foto der Gartenseite nehmen, nur den Teil ab dem Fallrohr nach rechts (9 Fenster), mit den Plänen vergleichen.
- **Vorgehen der KI:** Fensterlagen aus der Plan-Geometrie, Ecken im Foto von Hand abgelesen, Perspektivkorrektur über die Lagen der vier äußeren OG-Fenster, Vergleich der Fenstermaße. Skript: `docs/testdaten/testgebaeude-a/nord_rechts_perspektive.py`.
- **Ergebnis (orientierend):** Mit Perspektivkorrektur liegt der OG-Mittelwert bei 1,88 m² (Plan 1,88 m²), einzelne Fenster −5 % bis +6 %, Ablesefehler ±3 %. Ohne Korrektur (Frontalannahme) unterscheiden sich die Pixelflächen gleicher Fenster um den Faktor 1,68 (±17 %); ein Maßstab aus einem Fenster ergibt −41 % bis +49 % bei den anderen.
- **Grenzen:** Das prüft die Geometrie, **nicht** die KI-Erkennung der App. Eckpunkte von der KI nach Augenmaß gesetzt (±2 px), Linsenverzeichnung nicht korrigiert, Plan-Raster als Maßstab (die App hätte ihn nicht), ein Foto, neun Fenster. Breite (−3 bis −7 %) und Höhe (+2 bis +8 %) weichen entgegengesetzt ab (Außenkante der Fensterfaschen bzw. Fensterbank), die Fläche gleicht das aus.

### P-10 · Schnittstelle zur Sanierung (`flaechen`) · 22.11.2026 · Nicolai
- **Prompt (sinngemäß):** Die Arbeit ist aufgeteilt: Aufmaß übergibt Flächen/Maße an das Modul mit den U-Werten, danach LCA, danach Kosten.
- **KI-Ergebnis:** Schnittstellendoku des Sanierungsmoduls gelesen (`docs/schnittstelle-sanierung.md` auf `claude/arbeitsbereich`), das Ereignis `flaechen` in `updateResults()` ergänzt (Felder wie dort), Türen als eigene Art eingeführt, Zusatzfelder (Türen, brutto, Maßstabsart, Spanne), Doku `docs/schnittstelle-aufmass.md`, Test des Ereignisses in `tests/auto-mock.mjs`.
- **Auffälligkeit:** In der älteren Kopie von `app.js` im anderen Branch wurden Türen (von der KI als „window“ gesetzt) mit in `fenster` übergeben; sie würden dort als Fenster bewertet. Abweichung ist in der Doku vermerkt und muss mit dem Sanierungsmodul abgestimmt werden.
- **Nicht geprüft:** Zusammenspiel mit dem echten Sanierungsmodul (anderer Branch, nicht ausgeführt).
