# Anleitung fürs Team: App ausprobieren

Stand: 22.11.2026. Zum Anschauen und Testen, ohne etwas zu verändern.

## Worum es geht
Eine Web-App: Kunde macht ein Foto seiner Hausfassade, beantwortet ein paar Fragen und bekommt drei Empfehlungen für die Dämmung: **beste Qualität**, **bestes Preis-Leistungs-Verhältnis**, **am umweltfreundlichsten**, jeweils mit Preis und CO₂.

## Was in diesem Branch passiert ist
Alle Bausteine sind jetzt **in einem Branch** zusammengeführt: `claude/relaxed-heisenberg-93x7ty`.

| Baustein | Herkunft |
|---|---|
| **Aufmaß** (Foto, KI-Erkennung, m²) | dieser Branch |
| **Sanierung** (U-Werte, Dämmdicken, Fenster, Brandschutz) | Branch `claude/arbeitsbereich` |
| **LCA** (CO₂-Vergleich) | Branch `LCA-Berechnung` |
| **Kosten und Empfehlung** (neu, aus der Kosten-Excel) | dieser Branch |

- Die Module Sanierung und LCA wurden **kopiert** (zusammengeführt), in den anderen Branches wurde **nichts verändert**.
- Wer in seinem Branch weiterarbeitet: Änderungen kommen **nicht automatisch** hierher. Dann in diesem Branch `git merge origin/<branchname>` ausführen (oder Bescheid sagen).
- Die Daten laufen so: Aufmaß → Sanierung → LCA und Kosten/Empfehlung. Details: `docs/schnittstelle-*.md`.

## Zwei Ansichten
- **Einfache Ansicht (Standard):** 1. Foto, 2. Angaben (Baujahr, Stockwerke, Wandart, optional Hauswandbreite), 3. Empfehlung. Wenig Text, für Kunden gedacht.
- **Expertenansicht:** oben rechts auf „Expertenansicht“ klicken (oder `?experte=1` an die Adresse hängen). Dann gibt es vier Reiter: Aufmaß, Sanierung, LCA, Empfehlung mit allen Zahlen, Annahmen und änderbaren Gewichten. Hier kann man alles nachprüfen.

## So starten (Mac, Windows, Linux)

**Einmal vorbereiten**
1. **Git** installieren (git-scm.com) und **Node.js** (nodejs.org, die LTS-Version, mindestens Version 20).
2. Ein Terminal öffnen (Mac: „Terminal“, Windows: „PowerShell“).

**Code holen und starten**
```bash
git clone https://github.com/TheColognegamer/Uni-Projekt.git
cd Uni-Projekt
git checkout claude/relaxed-heisenberg-93x7ty
npm install
npm start
```
Dann im Browser `http://localhost:8000` öffnen.

**Ohne API-Schlüssel: Demo-Modus.** Das ist der Normalfall für alle, die nur reinschauen wollen. Die App erkennt selbst, dass kein Schlüssel da ist, und zeigt „Demo-Modus“. Mit **„Beispielhaus ansehen“** läuft der ganze Ablauf durch: Angaben machen, drei Empfehlungen bekommen, Expertenansicht öffnen. Das Beispielhaus ist ein eingebautes Musterbild mit fest vorgegebenen Flächen, keine echte Erkennung. Eigene Fotos lassen sich ohne Schlüssel nicht automatisch auswerten, die App erklärt das verständlich. Man kann sie in der Expertenansicht von Hand vermessen.

Der Demo-Modus braucht nicht einmal den Server: `python3 -m http.server 8000` im Projektordner reicht auch zum Anschauen.

**Mit echter KI-Erkennung (optional, nur wenn ihr eigene Fotos auswerten wollt)**
1. Einen API-Schlüssel auf console.anthropic.com erstellen (kostet wenige Cent pro Foto).
2. Im Projektordner eine Datei `.env` anlegen mit dieser einen Zeile (Schlüssel einsetzen, keine Anführungszeichen, keine Leerzeichen). Windows: ohne `.txt`-Endung speichern, im Editor „Alle Dateien“ wählen:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. `npm start` (neu starten). Im Terminal steht dann `API-Key: gesetzt`, und eigene Fotos werden automatisch ausgewertet.

Der Schlüssel gehört nur in die `.env` auf dem eigenen Rechner. Nie weitergeben, nie ins Repo committen (die Datei ist schon ausgeschlossen).

**Am Handy:** Handy und Rechner im selben WLAN. Im Terminal steht beim Start eine Zeile „Am Handy (gleiches WLAN): http://192.168…“. Diese Adresse im Handy-Browser öffnen.

**Aktualisieren:** `git pull`, dann Server neu starten (Strg + C, dann wieder starten) und die Seite hart neu laden.

## Was ihr anschauen und prüfen könnt
1. Einfache Ansicht mit Handy oder Rechner durchspielen: Ist es verständlich? Fehlt eine Frage, ist etwas zu viel?
2. Expertenansicht, Reiter **Sanierung**: Stimmen U-Werte und Dämmdicken für ein Beispielhaus, das ihr kennt?
3. Reiter **LCA**: Passen die CO₂-Werte zu eurer Excel?
4. Reiter **Empfehlung**: Sind die **Qualitätsnoten und Gewichte** (unten unter „Annahmen“) sinnvoll? Das sind bisher geschätzte Annahmen aus dem Projektkonzept.

## Bekannte Lücken (bitte ergänzen oder entscheiden)
- **Fensterpreise** fehlen in der Kosten-Excel, die Empfehlung gilt nur für die Wand.
- **Zeitraum der Folgekosten** steht in der Excel nicht.
- **Holz oder Aluminium bei Unterkonstruktion und Bekleidung:** nur ein Preis (Faserzement) vorhanden.
- **Brandschutz** prüft nur den Dämmstoff, nicht die Bekleidung (Holz in Gebäudeklasse 4–5 wäre kritisch).
- Das **WDVS** wird im 50-Jahre-Vergleich einmal komplett erneuert (Nutzungsdauer 30 Jahre). Das bestimmt das Ergebnis stark.

## Tests (optional)
```bash
npm test
```
Das prüft Geometrie, Bauphysik, PDF, LCA und Kosten. Die Browser-Tests (`node tests/kunde.mjs <foto.png>` usw.) brauchen zusätzlich Playwright und sind für die Entwicklung gedacht.

## Bei Problemen
| Meldung | Lösung |
|---|---|
| `npm: command not found` | Node.js installieren, Terminal neu öffnen |
| `address already in use` | Alten Server mit Strg + C beenden oder Mac/Linux `PORT=8001 npm run start:mock`, Windows PowerShell `$env:PORT=8001; npm run start:mock` |
| Altes Design sichtbar | Seite hart neu laden (Cmd/Strg + Umschalt + R), Server neu gestartet? |
| `git pull` meldet Konflikte | Nichts überschreiben, Bescheid sagen |
