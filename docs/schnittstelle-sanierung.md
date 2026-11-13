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

## 2 · Ausgang: was das Kosten- / CO₂-Modul von mir bekommt

Ereignis `sanierung` auf `window` (bei jeder Änderung) **oder** jederzeit abrufbar mit `window.SanierungUI.ergebnis()`:

```js
window.addEventListener('sanierung', (e) => {
  const r = e.detail;
  r.bezugsflaeche_m2            // Wand netto in m² (aus dem Aufmaß)
  r.wand                        // { baustoff, gesamtDicke_m, mauerwerk_m, u }  U-Wert Bestand
  r.unterkonstruktion_vhf       // 'holz' | 'alu'
  r.varianten                   // 6 Einträge: 2 Systeme × 3 Dämmstoffe, siehe unten
  r.fenster                     // Fenstertausch, siehe unten (null, solange keine Fenster gemessen)
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

### `fenster`, der Fenstertausch

| Feld | Einheit | Bedeutung |
|---|---|---|
| `rahmen` | – | `'pvc'`, `'holz'`, `'holzalu'` |
| `verglasung` | – | `'zweifach'`, `'dreifach'` |
| `rahmenanteil` | – | Anteil Rahmen an der Fensterfläche (0–1) |
| `anzahl`, `flaeche` | –, m² | Anzahl und Summe der Fensterflächen |
| `uwAlt`, `uwNeu` | W/(m²K) | Bestand und neu (flächengewichtet) |
| `erfuellt` | – | jedes Fenster Uw ≤ 1,3 (GModG Anlage 7) |
| `einzeln[]` | m, m², W/(m²K) | je Fenster: `b`, `h`, `aw`, `ag` (Glas), `af` (Rahmen), `lg`, `uw` |

`ag` und `af` erlauben getrennte Mengen für Glas und Rahmen (z. B. für ÖKOBAUDAT-Datensätze je m² Verglasung bzw. Rahmen).

## 3 · Direkt rechnen ohne Oberfläche

`src/bauphysik.js` funktioniert im Browser (`window.Bauphysik`) und in Node (`require`):

```js
const B = require('./src/bauphysik.js');
const wand = B.bestandswand('vollziegel', 0.40);                 // Baustoff, Wandstärke gesamt in m
const alle = B.variantenWand(wand, { vhf: { uk: 'holz' } });     // 6 Varianten
const fen  = B.fensterTausch([{ b: 1.2, h: 1.4 }], 'isolier', 'pvc', 'dreifach', 0.30);
```

Schlüssel und Kennwerte: `B.WANDBAUSTOFFE`, `B.DAEMMSTOFFE`, `B.SYSTEME`, `B.UNTERKONSTRUKTION`, `B.RAHMEN`, `B.VERGLASUNG`.
