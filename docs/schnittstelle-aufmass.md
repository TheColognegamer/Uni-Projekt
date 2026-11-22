# Schnittstelle Modul „Aufmaß“ (Foto → Flächen)

```
Aufmaß (dieses Modul)  ──'flaechen'──▶  Sanierung (U-Werte, Dämmdicken)  ──'sanierung'──▶  LCA  ──▶  Kosten
```

Code: `src/app.js` (`updateResults()` sendet das Ereignis bei **jeder** Änderung), Rechnung in `src/geometry.js`.
Die Felder 1–4 entsprechen exakt dem Eingang in `docs/schnittstelle-sanierung.md` (Branch `claude/arbeitsbereich`).

## Ereignis `flaechen` auf `window`

```js
window.addEventListener('flaechen', (e) => {
  const d = e.detail;
  d.aWand      // 1  m², Wandfläche NETTO (Fassade minus ALLE Öffnungen inkl. Türen); NaN, solange nichts gemessen/kein Maßstab
  d.aFenster   // 2  m², Summe aller Öffnungen (Fenster + Türen), NaN wie oben
  d.anzahl     // 3  Anzahl Öffnungen (Fenster + Türen)
  d.fenster    // 4  [{ b, h }, …] Außenmaße je FENSTER in m (entzerrt, umschließendes Rechteck); Türen sind NICHT enthalten
  // Erweiterung, optional (ältere Empfänger ignorieren sie):
  d.tueren     //    [{ b, h }, …] Außenmaße je Tür/Tor in m
  d.aTueren    //    m², Summe der Türflächen
  d.aFassadeBrutto // m², Fassade brutto
  d.quelle     //    'foto'
  d.massstab   //    { art: 'est'|'door'|'width'|'rect'|'line', spanneWand_m2: [min, max] | null }
});
```

### Wichtige Unterschiede zur älteren Kopie von `app.js` im Sanierungs-Branch
- **Türen** werden jetzt als eigene Art erfasst (Werkzeug „4 · Tür“). Sie mindern die Wandfläche, stehen aber **nicht** in `fenster`, damit sie nicht als Fenster getauscht oder mit Uw bewertet werden. Dadurch ist `fenster.length` ≤ `anzahl`.
- Neue Zusatzfelder (`tueren`, `aTueren`, `aFassadeBrutto`, `quelle`, `massstab`).

### Unsicherheit weiterreichen
`massstab.spanneWand_m2` ist nur gesetzt, wenn der Maßstab von der KI aus Referenzobjekten geschätzt wurde. Das Kosten- und LCA-Modul kann damit Ergebnisbereiche statt Einzelwerten anzeigen. Faustwerte zur Genauigkeit: siehe `docs/prompt-log.md` (P-07, P-09) und `docs/testdaten/README.md`.

## Alternative ohne gemeinsame Seite: JSON-Export
Der Button „Messung als JSON exportieren“ liefert `messung_*.json` mit `flaechen[]` (Art, Punkte, m²) und `ergebnis_m2`. Für einen Import in andere Module bei Bedarf dasselbe Feldschema wie oben verwenden.

## Test
`node tests/auto-mock.mjs <foto.png>` prüft das Ereignis (Felder, Anzahl, Werte) in einem Headless-Browser mit der Attrappe.
