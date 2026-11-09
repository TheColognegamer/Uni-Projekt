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
