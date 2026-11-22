# Modul „Kosten und Empfehlung“

```
Aufmaß ─'flaechen'→ Sanierung ─'sanierung'→ LCA (Treibhausgase)
                                   └──────→ Kosten & Empfehlung  ← Preise aus der Excel
```

Code: `src/kosten-data.js` (Preise, Qualitätskriterien, Annahmen mit Fundstelle), `src/kosten.js` (Rechenkern, in Node testbar), `src/kosten-ui.js` (Reiter „Empfehlung“).
Preisquelle: `docs/LCE_Projekt_Fassadenvergleich_LCC_Recherche.xlsx` (Blätter LCC, WDVS, VHF), Preisstand 2026, Köln, netto, Budgetansätze.

## Eingang
`window.SanierungUI.ergebnis()` bzw. Ereignis `sanierung`: je Variante `system`, `daemmstoff`, `unterkonstruktion`, `d` (Ausführungsdicke), `dTheoretisch`, `uNeu`, `brandschutz { zulaessig, auflage, grund }`, `warnungen`; dazu `bezugsflaeche_m2` (Wand netto) und `flaechen.quelle`.

## Rechenweg je Variante (System × Dämmstoff, 6 Varianten)
| Größe | Rechnung |
|---|---|
| Investition [€/m²] | Preis bei 160 mm (Blatt LCC) ± Zuschlag je 20 mm (nur WDVS), Untergrenze 60 % |
| Preisspanne | Faktoren aus den EP-Spannen der Blätter WDVS und VHF |
| Folgekosten [€/m²] | Barwert je System (Blatt LCC): WDVS 105,84, VHF 78,60 |
| LCC | Investition + Folgekosten; für die Wand netto mal Fläche |
| GWP [kg CO₂-Äq./m²] | LCA-Kern `src/lca.js` mit der Ausführungsdicke; VHF mit Holz-UK und Holzbekleidung |
| Qualität [0–100] | gewichtete Noten 1–5 (7 Kriterien, Gewichte in der Oberfläche änderbar) |

## Die drei Empfehlungen (nur zulässige Varianten, U ≤ 0,24)
- **Premium:** höchste Qualitätsnote (bei Gleichstand die teurere). Nicht automatisch die teuerste Variante.
- **Preis-Leistung:** höchste Qualitätsnote je Euro LCC.
- **Umweltfreundlichste:** kleinstes GWP im gewählten Zeitraum (30 oder 50 Jahre).
Gewinnt eine Variante mehrere Kategorien, steht für die spätere Kategorie die nächstbeste Alternative dabei (`alternative` im Ergebnis).

## Ausgang
`window.KostenUI.ergebnis()` → `{ kandidaten[], empfehlung { premium, preisLeistung, umwelt, teuerste, guenstigste, mehrfach, alternative, zeitraum } }`.

## Lücken der Datengrundlage (bitte ergänzen)
1. **Fenster:** In der Excel stehen keine Fensterpreise; die Empfehlung gilt nur für die Wand.
2. **Zeitraum der Folgekosten:** im Blatt LCC nicht angegeben, es wird derselbe Wert für den ganzen Vergleich verwendet. Blatt „Tabelle1“ (20/30/50 Jahre, Lebensdauer, Ersatzzyklen, Abzinsung) ist nur ein leeres Raster.
3. **Unterkonstruktion und Bekleidung:** Preise gibt es nur für „Faserzementbekleidung“; Holz/Aluminium bzw. Holz/Metall haben keinen Preisunterschied. Das GWP rechnet dagegen mit Holzbekleidung.
4. **Qualitätsnoten** sind eine Einschätzung aus dem Projektkonzept, keine Messung.
5. Nicht enthalten: Laibungen, Fensterbänke, Sockel, Brandriegel, Umsatzsteuer.

## Tests
`node tests/kosten.test.js` (Blatt LCC für 1.000 m² exakt, Dickenzuschläge, Spannen, Rangfolge, Invarianten, fünf Gebäude), `node tests/szenarien-ui.mjs` (Oberfläche gleich Rechenkern).
