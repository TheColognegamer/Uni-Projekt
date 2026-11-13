# Schnittstelle Modul „Sanierung“ (U-Werte, Dämmdicken, Fenster)

Verantwortlich: Moritz · Code: `src/bauphysik.js` (Rechnung), `src/sanierung-ui.js` (Oberfläche)

```
Aufmaß-Modul  ──'flaechen'──▶  Sanierung (dieses Modul)  ──'sanierung'──▶  Kosten- / CO₂-Modul
```

## 1 · Eingang: was ich vom Aufmaß-Modul brauche

Ereignis `flaechen` auf `window`, wird bei jeder Änderung des Aufmaßes gesendet (aktuell aus `src/app.js`, `updateResults()`):

```js
window.dispatchEvent(new CustomEvent('flaechen', { detail: {
  aWand:    53.28,          // m², Wandfläche NETTO (Fassade minus Öffnungen); NaN, solange nichts gemessen ist
  aFenster: 6.72,           // m², Summe aller Öffnungen
  anzahl:   4,              // Anzahl Öffnungen
  fenster:  [{ b: 1.2, h: 1.4 }, ...]   // Außenmaße je Fenster in m (für Uw nach DIN EN ISO 10077-1)
}}));
```

Wenn sich das Aufmaß-Modul ändert, muss nur dieses Ereignis mit diesen Feldern erhalten bleiben.
**Solange kein Aufmaß kommt** (oder `aWand` nicht > 0 ist), rechnet das Modul mit **angenommenen Flächen** aus Abschnitt 5 der Oberfläche (Beispiel: 250 m² Fassade, 16 Fenster 1,20 × 1,40 m). Im Ergebnis steht dann `flaechen.quelle = 'annahme'`.

## 2 · Ausgang: was das Kosten- / CO₂-Modul von mir bekommt

Ereignis `sanierung` auf `window` (bei jeder Änderung) **oder** jederzeit abrufbar mit `window.SanierungUI.ergebnis()`:

```js
window.addEventListener('sanierung', (e) => {
  const r = e.detail;
  r.flaechen                    // { quelle: 'aufmass' | 'annahme', wandNetto_m2, fenster:[{b,h}] }
  r.bezugsflaeche_m2            // Wand netto in m²
  r.wand                        // { baujahr, baualtersklasse ('bis 1918' … 'ab 2002'), konstruktion, gesamtDicke_m, u, quelle }  U-Wert Bestand (amtl. Pauschalwert)
  r.unterkonstruktion_vhf       // 'holz' | 'alu'
  r.varianten                   // 6 Einträge: 2 Systeme × 3 Dämmstoffe, siehe unten
  r.fenster                     // mögliche Fenster, siehe unten (null, wenn keine Fenster)
  r.fehler                      // Liste von Fehlermeldungen (leer = alles gültig)
});
```

### `varianten[i]`, eine Variante der Wanddämmung

| Feld | Einheit | Bedeutung |
|---|---|---|
| `system` | – | `'wdvs'` oder `'vhf'` |
| `daemmstoff` | – | `'mw'` (Mineralwolle), `'eps'`, `'holzfaser'` |
| `unterkonstruktion` | – | nur VHF: `'holz'` / `'alu'`, sonst `null` |
| `lambda` | W/(m·K) | verwendeter Bemessungswert |
| `d` | m | **Ausführungsdicke** (auf 2 cm aufgerundet) → für Kosten |
| `dTheoretisch` | m | Dicke für genau U = 0,24 → für den CO₂-Vergleich bei **gleicher Dämmwirkung** |
| `volumen_m3` | m³ | Bezugsfläche × `d` |
| `volumen_gleicheWirkung_m3` | m³ | Bezugsfläche × `dTheoretisch` |
| `uNeu` | W/(m²K) | U-Wert nach Sanierung (Ausführungsdicke) |
| `uMax`, `erfuellt` | – | Höchstwert GModG Anlage 7 (0,24) und ob eingehalten |
| `deltaU` | W/(m²K) | Wärmebrückenzuschlag (WDVS 0, VHF Holz 0,02 / Alu 0,04) |
| `warnungen` | – | Texte, z. B. Brandschutz |

### `fenster`, die möglichen Fenster

`fenster = { anzahl, flaeche, rahmenanteil, optionen: [...] }`, darin 6 Optionen (3 Rahmen × 2 Verglasungen):

| Feld je Option | Einheit | Bedeutung |
|---|---|---|
| `rahmen` | – | `'pvc'`, `'holz'`, `'holzalu'` |
| `verglasung` | – | `'zweifach'`, `'dreifach'` |
| `anzahl`, `flaeche` | –, m² | Anzahl und Summe der Fensterflächen |
| `flaecheGlas`, `flaecheRahmen` | m² | getrennte Mengen für Glas und Rahmen (z. B. für ÖKOBAUDAT-Datensätze) |
| `uwNeu` | W/(m²K) | Uw neu, flächengewichtet |
| `erfuellt` | – | jedes Fenster Uw ≤ 1,3 (GModG Anlage 7) → nur diese Optionen anbieten |
| `einzeln[]` | m, m², W/(m²K) | je Fenster: `b`, `h`, `aw`, `ag`, `af`, `lg`, `uw` |

## 3 · Direkt rechnen ohne Oberfläche

`src/bauphysik.js` funktioniert im Browser (`window.Bauphysik`) und in Node (`require`):

```js
const B = require('./src/bauphysik.js');
const wand = B.bestandswand(1960, 'lochstein', 0.36);           // Baujahr, Wandart, Wandstärke in m
const alle = B.variantenWand(wand, { vhf: { uk: 'holz' } });     // 6 Dämmvarianten
const fen  = B.fensterOptionen([{ b: 1.2, h: 1.4 }], 0.30);       // 6 Fensteroptionen
```

Schlüssel und Kennwerte: `B.WANDKONSTRUKTIONEN`, `B.BAUALTERSKLASSEN`, `B.DAEMMSTOFFE`, `B.SYSTEME`, `B.UNTERKONSTRUKTION`, `B.RAHMEN`, `B.VERGLASUNG`.
