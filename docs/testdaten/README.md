# Testdaten für die Validierung (H2)

## Testgebäude A
Referenzmaße aus Bestandsansichten (`testgebaeude-a/ground_truth.json`). **Nicht** im Repo: die Pläne selbst, Fotos mit Personen, Adresse und Kontaktdaten (Rechte der Planverfasser klären, bevor etwas veröffentlicht wird).

Besonderheit: Das Gebäude hat **54 baugleiche Fenster** (24 an der Nordseite, 30 an der Südseite, jeweils etwa 1,35 × 1,40 m). Die Streuung der gemessenen Flächen über viele Fenster desselben Fotos zeigt direkt Zufallsfehler und systematischen Fehler.

### Zuordnung Foto ↔ Plan
- **Nord** = Gartenseite: Hintereingang mit Glasvordach, im Treppenhaus je drei Streifenfenster nebeneinander.
- **Süd** = Eingangs-/Straßenseite: Haupteingang mit Vordach, im Treppenhaus je zwei Fenster.
- **West/Ost** = Giebelseiten mit je drei Fenstern und einem Dachfenster.

### Auswertung
Nach der Messung in der App exportieren (JSON) und:
```bash
node tests/compare_ground_truth.mjs messung.json --fassade nord
node tests/compare_ground_truth.mjs messung.json --fassade nord --vollstaendig   # nur wenn die ganze Fassade im Bild ist
```
Das Skript ordnet jedes Fenster dem Typ mit der nächsten Fläche zu und zeigt Abweichung pro Fenster, systematischen Fehler (Median), mittleren Betrag und Anteil innerhalb ±5 / ±10 / ±20 %.

### Grenzen der Referenz
Fensterflächen ±1 cm (CAD-Geometrie); Wandhöhen und damit Bruttoflächen ±2–3 % (Traufe und Gelände aus Höhenkoten gelesen). Fehler der Auswertung unter etwa 3 % lassen sich damit nicht mehr sinnvoll auflösen.

### Wichtig für die Aufnahme
Die bisherigen Fotos sind schräg und mit Ultraweitwinkel aufgenommen. Die Referenzstrecke der App geht von frontaler Aufnahme aus; bei schrägem Blick sind waagerechte Maße verkürzt. Für den Test besser: **abschnittsweise frontal** fotografieren (jeweils etwa vier Fensterachsen im Bild, Handy gerade, Normalobjektiv/1×).
