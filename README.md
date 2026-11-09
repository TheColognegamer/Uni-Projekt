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

## Tests
```bash
node tests/geometry.test.js   # Geometrie-Kern
node tests/e2e.mjs            # Browser-Smoke-Test (benötigt Playwright)
```

## Dokumentation
`docs/prompt-log.md` – Vibecoding-Log (Pflicht laut Aufgabenstellung).
