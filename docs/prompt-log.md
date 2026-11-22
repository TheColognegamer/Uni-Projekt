# Prompt-Log (Vibecoding-Dokumentation)

Zweck: systematische Dokumentation des KI-gestützten Entwicklungsprozesses gemäß Aufgabenstellung §3.3
(Tools, Modelle, repräsentative Prompts, Iterationsschritte, KI-Fehler, Prüfung/Korrektur).
Es müssen **nicht alle** Prompts erfasst werden – nur repräsentative und für die Entwicklung relevante.

**Pflege:** Nach jeder relevanten Iteration einen Eintrag am Ende ergänzen (Vorlage unten). Jedes Teammitglied trägt eigene Sitzungen ein.

## Eingesetzte Tools

| Tool | Modell / Version | Zeitraum | Nutzung |
|---|---|---|---|
| Claude Code (Web/Cloud-Sitzung) | *bitte aus der Sitzung eintragen (Modellname/Version)* | ab 09.11.2026 | Prototyp-Entwicklung |
| Claude (claude.ai, Projekt „Life Cycle Engineering“) | Claude Sonnet 5.5 | 15.11.2026 | LCA-Datengrundlage als Excel (Iris) |
| Claude Code (Desktop-App, lokal) | Claude Opus 5.5 | ab 16.11.2026 | LCA-Modul im Branch `LCA-Berechnung` (Iris) |

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

### P-11 · Einheitliches Design im Apple-Stil · 22.11.2026 · Nicolai
- **Prompt (sinngemäß):** Die App soll ein einheitliches Corporate-Design im Apple-Stil bekommen, sehr hochwertig und nutzerfreundlich.
- **KI-Ergebnis:** Gemeinsames Designsystem `src/design.css` (Tokens, Bausteine, Hell/Dunkel), neue Oberfläche mit Fortschrittsanzeige, großem Ergebnis, Maßstabsauswahl als Liste, Leer- und Ladezustand, Badge zur Maßstabsqualität, mobiler Ansicht; Doku `docs/design-system.md`. Alle Element-IDs bleiben erhalten, Tests laufen weiter.
- **Auffälligkeiten (per Screenshot gefunden und behoben):** Handy-Kopfzeile mit falsch platzierter Schaltfläche, abgeschnittener Leerzustand, unsichtbare Schaltflächen auf hellem Grund, doppelte Hinweise.
- **Nicht geprüft:** echte Geräte (nur Headless-Chromium bei 390 und 1360 px, hell und dunkel), Bedienbarkeit durch Testpersonen.

---

## Einträge aus den Sanierungs- und LCA-Sitzungen
Übernommen aus den Branches `claude/arbeitsbereich` und `LCA-Berechnung`. Eigene Nummerierung (P-xx), die von der Nummerierung oben unabhängig ist.

### P-05 · Dämmdicken nach GModG und Fenstertausch · 13.11.2026 · Moritz
- **Ziel:** Aus Wandstärke und Baumaterial der Bestandswand (Köln, 1950–1970) die nötige Dämmdicke für WDVS und hinterlüftete Vorhangfassade berechnen, sodass die U-Werte nach GModG/GEG eingehalten werden; dazu Fenstertausch.
- **Prompt (Kurzfassung):** Tool soll anhand einer Wandstärke und eines Baumaterials die Dicke der Dämmmaterialien berechnen, U-Werte nach GEG bzw. GModG berücksichtigen, Fenstertausch ebenfalls; je System 3 Dämmstoffe.
- **Tool/Modell:** Claude (Opus 5.5) mit GitHub-Anbindung, Arbeit im eigenen Branch `claude/arbeitsbereich`.
- **KI-Ergebnis:** `src/bauphysik.js` (Kennwerte + Rechnung), `src/sanierung-ui.js` (Panel 4/5), Anbindung an das Aufmaß über das Ereignis `flaechen`, JSON-Export `sanierung`, Test `tests/bauphysik.test.js`.
- **Recherche der KI:** Das GEG heißt seit 29.07.2026 GModG (BGBl. 2026 I Nr. 226); Höchstwerte Anlage 7 unverändert: Außenwand 0,24, Fenster Uw 1,3 W/(m²K).
- **Annahmen, die das Team prüfen muss:** λ-Werte der Bestandsbaustoffe (Bims- und Trümmerbeton sind Schätzwerte), ΔU = 0,03 für die VHF-Unterkonstruktion, Uw der neuen Fenster (Marktrichtwerte), Putzdicken 1,5 + 2 cm. Dämmstoffe zunächst Platzhalter (siehe P-06).
- **Prüfung:** Unit-Test gegen Handrechnung (Vollziegel 36,5 cm: U = 1,51; EPS 035 → 12,3 cm → 14 cm, U = 0,214); Browser-Test mit Demo-Fassade (Wand netto 53,28 m² korrekt übernommen).
- **Grenzen:** Vereinfachtes Verfahren für LPh 2, keine Feuchte-/Tauwasserprüfung, keine Laibungs- und Sockeldetails, Dübel im WDVS vernachlässigt.

### P-06 · Abgleich mit dem Projektkonzept · 13.11.2026 · Moritz
- **Ziel:** Rechenmodul an die Festlegungen im Projektkonzept (PDF) anpassen.
- **Prompt:** Projektkonzept als Anhang (vorher: „Dämmstoffe haben wir schon festgelegt“, LCC „guck im Anhang“).
- **KI-Ergebnis:** Dämmstoffe in beiden Systemen Mineralwolle/EPS/Holzfaser (λ 0,035/0,035/0,040 laut Konzept); VHF-Unterkonstruktion Holz oder Alu als Auswahl; Spalte „rechnerische Dicke“ für den Vergleich bei gleicher Dämmwirkung; Fenster Uw nach DIN EN ISO 10077-1 aus Rahmen (PVC/Holz/Holz-Alu), 2-/3-fach-Verglasung und Rahmenanteil, je Fenster mit Maßen aus dem Aufmaß.
- **Fachliche Hinweise der KI:** EPS und Holzfaser in hinterlüfteten Fassaden sind brennbar; ab Gebäudeklasse 4 fordert die Bauordnung nichtbrennbare Dämmstoffe – vom Team zu prüfen. 2-fach-Verglasung liegt bei kleinen Fenstern über Uw 1,3 (z. B. 0,6 × 0,8 m Holz: 1,37).
- **Nicht umgesetzt (anderer Teil):** LCC über 20/30/50 Jahre und THG (Module A1–A5, B4, C1–C4, D); das Konzept enthält dafür noch keine Zahlen. Die Mengen werden für diese Module bereitgestellt.
- **Prüfung:** Unit-Tests gegen Handrechnung (u. a. Uw PVC 3-fach 1,2 × 1,4 m = 0,88), Browser-Test mit Demo-Fassade (Fenstermaße 1,20 × 1,40 m korrekt erkannt).
- **Unsicher/Annahmen:** ΔU der Unterkonstruktionen, Ug/Uf/ψ-Richtwerte, Glasumfang vereinfacht (ein Flügel).

### P-07 · Schnittstellen zu Aufmaß und Kosten/CO₂ · 13.11.2026 · Moritz
- **Ziel:** Aufgabenteilung abbilden: Flächen kommen aus dem Aufmaß (andere Person), Kosten und CO₂ (andere Person) greifen auf Dämmdicken und Fenster zu.
- **Prompt (Kurzfassung):** „Die Fläche kommt von jemand anders, du musst daran anknüpfen … Kosten und CO₂ macht jemand anders und muss auf meine Dämmdicken und Fenster abgreifen.“
- **KI-Ergebnis:** Ausgangsereignis `sanierung`, Beschreibung beider Schnittstellen mit Feldern und Einheiten in `docs/schnittstelle-sanierung.md`.
- **Prüfung:** Browser-Test mit simuliertem Aufmaß-Ereignis (100 m² Wand, 3 Fenster 1,5 × 2 m) → 6 Varianten, Volumen EPS-WDVS 14 m³, Uw 0,85.

### P-08 · Amtliche Wandkonstruktionen, Laien-Eingabe, Flächen-Annahme · 13.11.2026 · Moritz
- **Prompt (Kurzfassung):** „Wandbaustoff mit den Materialien der Jahre hinterlegen, die es offiziell gibt. Ein Investor ist kein Fachmann. Bei den Fenstern den Bestand weglassen. Als Flächen und Fenster einfach mal was annehmen.“
- **KI-Ergebnis:** Bestandswand jetzt über Baujahr + Wandart + Wandstärke mit amtlichen Pauschal-U-Werten aus der *Bekanntmachung der Regeln zur Datenaufnahme und Datenverwendung im Wohngebäudebestand* vom 08.10.2020 (BAnz AT 04.12.2020 B1), Tab. 2; die vorher von der KI geschätzten λ-Werte (z. B. Bims, Trümmerbeton) sind entfernt. Wandarten mit kurzer Erkennungshilfe für Laien. Fensterbestand entfernt; stattdessen Tabelle aller 6 möglichen Fenster mit Uw und Zulässigkeit. Angenommene Flächen (250 m² Fassade, 16 Fenster 1,20 × 1,40 m), die automatisch durch das Aufmaß ersetzt werden.
- **Auffälligkeit:** Tabelle 2 nennt für Vollstein-Wände ab 1958 „keine Angabe“; das Tool nimmt dann ersatzweise „Sonstige massive Wandaufbauten“ und weist darauf hin.
- **Prüfung:** Unit-Tests gegen Tabellenwerte und Handrechnung; Browser-Test mit Annahme und mit simuliertem Aufmaß.
- **Vom Team zu prüfen:** Werte gegen das Original im Bundesanzeiger abgleichen (von der KI über eine Textfassung gelesen); Beispielflächen.

### P-09 · Vollständige Tabelle 2 bis „ab 2002“ · 13.11.2026 · Moritz
- **Prompt:** „Baue die komplette Tabelle bis 2002 mit ein.“
- **KI-Ergebnis:** Alle 9 Baualtersklassen (bis 1918, 1919–48, 1949–57, 1958–68, 1969–78, 1979–83, 1984–94, 1995–2001, ab 2002) und alle Außenwandzeilen (5 massiv, 4 Holz/Fachwerk) der Tab. 2. Ersatzregeln bei „keine Angabe“ (Vollstein → sonstige massiv, zweischalig mit Dämmung → ohne, Fachwerk → sonstige Holzkonstruktion). Zusatzhinweise: Ausnahme GModG Anlage 7 Nr. 1b für Wände, die nach 1983 unter Wärmeschutzvorschriften errichtet wurden; Feuchteschutz bei Holz/Fachwerk.
- **Prüfung:** Unit-Test über alle Klassengrenzen (z. B. 1918/1919, 1957/1958, 2001/2002) und Holzzeilen; Browser-Test mit vier Beispielen.
- **Vom Team zu prüfen:** Tabellenwerte gegen das Bundesanzeiger-Original (die KI hat eine Textauswertung des PDFs genutzt).

### P-10 · Brandschutz nach Gebäudeklasse und Zusammenfassung · 13.11.2026 · Moritz
- **Prompt:** „Welche Stoffe sind brandresistent und zugelassen?“ → „Ja, pflege das mit ein. Ich möchte am Ende auch eine übersichtliche Ausgabe haben, in der alles kompakt zusammengefasst ist.“
- **KI-Ergebnis:** Eingabe Geschosszahl → Gebäudeklasse (Annahme: EG-Fußboden 0,6 m + 2,8 m je Geschoss; manuell überschreibbar). Regeln: GK 1–3 alle Dämmstoffe; GK 4–5 WDVS mindestens schwerentflammbar (MBO § 28 Abs. 3), EPS nur mit Brandriegeln, Holzfaser-WDVS nur mit Zulassung als schwerentflammbar, hinterlüftet nur nichtbrennbar (MVV TB Anhang 6 Nr. 3.1); Hochhaus nur nichtbrennbar. Unzulässige Varianten werden ausgegraut. Zusammenfassung mit Kennzahlen, zulässigen Varianten und Fenstern, Hinweisen; als Text kopierbar und im Ausgang `zusammenfassungText`.
- **Prüfung:** Unit-Tests (3/4/8/9 Geschosse, zulässige Kombinationen je Klasse); Browser-Test mit 3, 4 und 10 Geschossen sowie manueller Klasse.
- **Grenzen / vom Team zu prüfen:** Gebäudeklasse vereinfacht nur über die Höhe (Zahl und Größe der Nutzungseinheiten nicht berücksichtigt); Landesbauordnung NRW; Systemzulassungen (z. B. schwerentflammbare Holzfaser-WDVS) im Einzelfall.

### P-11 · PDF-Ausgabe · 13.11.2026 · Moritz
- **Prompt:** „Ich möchte eine Ausgabe als PDF.“
- **KI-Ergebnis:** Button „PDF herunterladen“ in der Zusammenfassung. Eigener, abhängigkeitsfreier PDF-Erzeuger (`src/pdf.js`: Helvetica/WinAnsi, Text, Linien, Flächen, Zeilenumbruch) und Berichtsaufbau (`src/pdf-bericht.js`): Kennzahlen, Gebäude/Bestand, Anforderungen, alle 6 Dämmvarianten mit Brandschutz-Status, Fenster, Hinweise, Grundlagen/Annahmen, Fußzeile mit Seitenzahlen. Auf claude.ai über die Download-Funktion der Plattform, sonst normaler Browser-Download.
- **Entscheidung der KI:** keine externe Bibliothek (z. B. jsPDF), damit das Tool weiter ohne Build und offline läuft. Folge: Sonderzeichen außerhalb WinAnsi werden ersetzt (≤ → <=, λ → Lambda, CO₂ → CO2).
- **Prüfung:** Unit-Test (Zeichensatz, xref-Offsets, Inhalte), `qpdf --check`, Browser-Download-Test, Sichtprüfung mit PDFium (Chrome/Edge-Engine). Auffälligkeit: Die Vorschau mit Poppler zeigte „²“ nicht an (Ersatzschrift); in PDFium korrekt.

### P-12 · LCA-Datengrundlage als Excel · 15.11.2026 · Iris
- **Ziel:** Schichtaufbauten WDVS, VHF und Fenster mit ÖKOBAUDAT-Werten (EN 15804+A2) und Formeln für GWP-total über 30 und 50 Jahre als Grundlage für die Programmierung.
- **Prompt (Kurzfassung):** „Erstelle eine Exceltabelle, wo die Materialien aus der Folie (Fassadenpaket) mit offiziellen Werten aus der ÖKOBAUDAT ausgefüllt sind … Auswertung GWP-total nach DIN EN 15978 / DIN EN 15804+A2 (A1–A3 + B4 + C3 + C4) … Dicke variierbar … alle Schichten auf 1 m² Wandfläche umrechnen … für 30 und 50 Jahre … Formeln in Excel hinterlegen.“
- **KI-Ergebnis:** `LCA_Fassadensanierung_WDVS_VHF.xlsx` mit 24 Datensätzen (ÖKOBAUDAT 2024-II, UUID + Link), Umrechnung auf 1 m², Austauschzyklen, 18 Fassaden- und 6 Fenstervarianten, Dropdown für die Gesamtfassade, Diagramm, Plausibilisierung gegen Systemdatensätze.
- **Auffälligkeiten (von der KI selbst gemeldet):** Silikatputz und WDVS-Dübel nur als Proxy-Datensätze; Nutzungsdauern aus dem Gedächtnis „in Anlehnung an BBSR“, nicht nachgeschlagen; Mengen der Nebenschichten sind Annahmen; Silikat-Aufbau +42 % gegenüber dem Systemdatensatz.
- **Vom Team zu prüfen:** Nutzungsdauern gegen die BBSR-Tabelle, Mengenannahmen, Gültigkeit der generischen Datensätze (bis 2026).

### P-13 · LCA-Reiter in der Web-App · 16.11.2026 · Iris
- **Ziel:** Die Excel-Rechnung in die Web-App übertragen (Branch `LCA-Berechnung`), mit den Dämmdicken aus dem Modul Sanierung, damit alle Varianten denselben U-Wert nach GModG haben.
- **Prompt (Kurzfassung):** „LCA soll ein eigener Reiter sein. Das Balkendiagramm aus der Excel behalten … Dropdown, das die kg CO₂-Äq. in 30 und 50 Jahren ausgibt … zwei Fassadensysteme konfigurieren und vergleichen inkl. Balkengraph und Vor-/Nachteile … aufklappbare Tabelle Annahmen … Skizze für den Wandaufbau … Dicken aus dem Branch claude/arbeitsbereich, alle Konfigurationen mit gleichem U-Wert (GModG) … Export als PDF.“
- **KI-Ergebnis:** `src/lca-data.js` (alle Werte und Annahmen aus der Excel an einer Stelle), `src/lca.js` (Rechenkern), `src/lca-ui.js` (Reiter mit Diagramm aller 18 Varianten, Fensterdiagramm, Dropdown Gesamtfassade, Vergleich A/B mit Wandskizze und Vor-/Nachteilen, Umschalter 30/50/beide Jahre, aufklappbare Annahmen), `src/lca-pdf.js` (PDF-Bericht mit MiniPDF aus P-11), `tests/lca.test.js`. Der Branch von Moritz (`claude/arbeitsbereich`) wurde dafür in `LCA-Berechnung` übernommen; Dicken kommen aus `bauphysik.js` (exakte Dicke für U = 0,24, wahlweise Plattendicke), unzulässige Varianten (Brandschutz) werden blass dargestellt.
- **Prüfung:** Unit-Test: 22 Varianten je m² (18 Fassaden, Holz- und PVC-Fenster) stimmen mit der Excel überein (Startdicken 160/180 mm); die 2 Holz-Alu-Fenster (nicht in der Excel) werden gegen eine Handrechnung geprüft; bei der Gesamtfassade wird die opake Wand gegen die Excel geprüft (7.320 kg bei 30 a), der Fensteranteil jetzt mit Holz-Alu statt Alu; Test, dass die Dicken aus `bauphysik.js` genau U = 0,24 ergeben. Browser-Test: Reiterwechsel, Dropdowns, A/B-Konfiguration, Gebäudeklasse 1–3 vs. 4–5, Handy-Breite ohne horizontales Scrollen, PDF wird erzeugt (4 Seiten).
- **Unsicher / vom Team zu prüfen:** Vor-/Nachteile für Putz, Unterkonstruktion, Bekleidung und Fenster sind Textvorschläge der KI (in der App mit * markiert). Fensterrahmen wie im Modul Sanierung (Holz, Holz-Alu, PVC) statt Aluminium aus der Excel; Holz-Alu hat keinen generischen ÖKOBAUDAT-Datensatz und ist als Holzrahmen + Alu-Deckschale (0,5 kg/m, Nutzungsdauer 50 a) angenähert. Wandskizze ist schematisch (Klebemörtel, Luftschicht, Bekleidungsdicken als Annahme).

### P-12 · Sanierung und LCA in diesen Branch übernommen · 22.11.2026 · Nicolai
- **Prompt (sinngemäß):** Die Ergebnisse der U-Wert-Berechnung und der LCA sollen auch im eigenen Branch liegen, alles in einer App, aber in den anderen Branches nichts ändern.
- **Vorgehen der KI:** Branches nur gelesen (`git fetch`), `LCA-Berechnung` (enthält `arbeitsbereich`) per Merge ohne Commit in diesen Branch geholt, Konflikte einzeln gelöst: `app.js` (eigenes Ereignis `flaechen` behalten, Export der Sanierung übernommen), `index.html` und `style.css` (neue Oberfläche mit drei Reitern, Module im Designsystem), Prompt-Log (beide Teile behalten, Herkunft gekennzeichnet), README.
- **Fehler der KI bei der Arbeit:** Ein Befehl (`git checkout --theirs`) hat versehentlich die eigene `style.css` durch die fremde ersetzt; aus dem letzten Commit wiederhergestellt, danach alles neu angewendet.
- **Prüfung:** Unit-Tests beider Seiten (Bauphysik, PDF, LCA gegen Excel), Browser-Tests, neuer Gesamttest `tests/integration.mjs` (Foto → Aufmaß 43,49 m² → Sanierung übernimmt die Wand und zählt die Tür nicht als Fenster → LCA zeigt Diagramme, keine Konsolenfehler).
- **Nicht geprüft:** fachliche Richtigkeit der U-Wert- und LCA-Rechnung (liegt bei den jeweiligen Autoren; deren Tests laufen). Die anderen Branches wurden nicht verändert.
