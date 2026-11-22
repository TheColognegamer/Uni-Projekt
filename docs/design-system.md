# Designsystem „Fassade“ (gemeinsam für alle Module)

Eine Datei: `src/design.css`. Tokens (Farben, Radien, Schatten, Schrift) und Bausteine. Hell/Dunkel folgt dem System, keine externen Schriften oder Bibliotheken. Seitenlayout des Aufmaß-Moduls steht getrennt in `src/style.css` und wird von anderen Modulen **nicht** gebraucht.

## Einbinden
```html
<link rel="stylesheet" href="src/design.css">
```

## Bausteine
| Klasse | Zweck |
|---|---|
| `.card`, `.card-title`, `.card-sub`, `.eyebrow` | Karte mit Titel, Untertitel, kleiner Überschrift |
| `.btn`, `.btn-primary`, `.btn-quiet`, `.btn-glass`, `.btn-lg`, `.btn-sm` | Schaltflächen (Pillenform) |
| `.seg` (mit `button.active`) | segmentiertes Steuerelement, z. B. Werkzeuge oder Varianten |
| `.field` (+ `.unit`) | Zahlenfeld mit Einheit |
| `.group` > `.item` | gruppierte Liste mit Radio/Auswahl (iOS-Stil) |
| `.badge` mit `.ok` / `.warn` / `.bad` | Status-Pille |
| `.stat` (`.v`, `.l`) | Kennzahl mit Beschriftung |
| `details.disclosure` | Aufklappbereich |

## Tokens
`--brand` (Akzent), `--bg`, `--surface`, `--surface-2`, `--fg`, `--fg-2`, `--fg-3`, `--line`, `--ok`, `--warn`, `--bad`, `--r-s/m/l/xl` (Radien), `--shadow-1/2`, `--font`.
Diagrammfarben im Bild: `--c-calib`, `--c-facade`, `--c-window`, `--c-door`.

## Regeln
- Keine eigenen Farben als feste Hexwerte in Modulen, sondern Tokens verwenden. Dann stimmen Hell und Dunkel automatisch.
- Zahlen mit Einheit in `font-variant-numeric: tabular-nums` setzen (ist in `.stat` und `.field` schon so).
- Eine Hauptaktion pro Ansicht als `.btn-primary`, alles andere ohne Akzent.
- Karten im rechten Seitenbereich, Hauptinhalt links; unter 1020 px einspaltig.
