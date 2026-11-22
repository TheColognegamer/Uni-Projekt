// Vergleicht eine exportierte Messung (JSON aus der App) mit den Planmaßen des Testgebäudes.
// Aufruf: node tests/compare_ground_truth.mjs messung.json --fassade nord|sued|west|ost [--vollstaendig] [--gt pfad/ground_truth.json]
// Jedes erkannte Fenster wird dem Fenstertyp mit der nächstgelegenen Fläche zugeordnet (Typen sind hier sehr verschieden groß).
// Mit --vollstaendig (ganze Fassade im Bild) werden zusätzlich Anzahl, Bruttofläche und Fensteranteil verglichen.
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const file = args.find((a) => !a.startsWith('--') && a.endsWith('.json'));
const fassade = opt('--fassade'), voll = args.includes('--vollstaendig');
const gtPath = opt('--gt', new URL('../docs/testdaten/testgebaeude-a/ground_truth.json', import.meta.url).pathname);
if (!file || !fassade) { console.error('Aufruf: node tests/compare_ground_truth.mjs messung.json --fassade nord|sued|west|ost [--vollstaendig]'); process.exit(2); }

const gt = JSON.parse(fs.readFileSync(gtPath, 'utf8')).fassaden[fassade];
if (!gt) { console.error('Unbekannte Fassade:', fassade); process.exit(2); }
const m = JSON.parse(fs.readFileSync(file, 'utf8'));
const pct = (x) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + ' %';
const median = (a) => { const b = [...a].sort((x, y) => x - y), i = b.length >> 1; return b.length % 2 ? b[i] : (b[i - 1] + b[i]) / 2; };

const types = gt.oeffnungen.filter((t) => t.typ !== 'kellerfenster'); // Kellerfenster zu klein für den Foto-Test
const wins = m.flaechen.filter((f) => f.art === 'window' && f.flaeche_m2 > 0);
console.log(`Fassade ${fassade} | Maßstab: ${m.massstab?.typ}, Länge ${m.massstab?.laenge_m} m | ${wins.length} erkannte Öffnungen\n`);

const rows = wins.map((w, i) => {
  const t = types.reduce((a, b) => (Math.abs(Math.log(w.flaeche_m2 / b.flaeche_m2)) < Math.abs(Math.log(w.flaeche_m2 / a.flaeche_m2)) ? b : a));
  return { i: i + 1, typ: t.typ, ist: w.flaeche_m2, soll: t.flaeche_m2, dev: (w.flaeche_m2 - t.flaeche_m2) / t.flaeche_m2 };
});
console.log('Nr  Typ                       Ist m²   Soll m²   Abweichung');
for (const r of rows) console.log(String(r.i).padStart(2), ' ', r.typ.padEnd(24), r.ist.toFixed(2).padStart(7), r.soll.toFixed(2).padStart(9), pct(r.dev).padStart(11));
if (rows.length) {
  const d = rows.map((r) => r.dev), ad = d.map(Math.abs);
  const share = (t) => (ad.filter((x) => x <= t).length / ad.length * 100).toFixed(0) + ' %';
  console.log(`\nFenster: Median ${pct(median(d))} (systematisch), mittlere |Abw.| ${(ad.reduce((a, b) => a + b, 0) / ad.length * 100).toFixed(1)} %, ` +
    `max |Abw.| ${(Math.max(...ad) * 100).toFixed(1)} %`);
  console.log(`Anteil innerhalb ±5 %: ${share(0.05)} | ±10 %: ${share(0.10)} | ±20 %: ${share(0.20)}`);
  console.log('Hinweis: Eine Zuordnung zum nächstgelegenen Typ unterschätzt große Fehler. Bei Verdacht Fenster einzeln prüfen.');
}
if (voll) {
  const fa = m.flaechen.filter((f) => f.art === 'facade').reduce((a, f) => a + f.flaeche_m2, 0);
  const soll = types.reduce((a, t) => a + t.anzahl, 0);
  const istFenster = wins.reduce((a, w) => a + w.flaeche_m2, 0);
  console.log(`\nGanze Fassade: Fenster erkannt ${wins.length} / Plan ${soll} (ohne Keller, Haustür/Eingang zählt als Öffnung)`);
  console.log(`Bruttofläche ${fa.toFixed(1)} m² / Plan ${gt.brutto_m2} m² -> ${pct((fa - gt.brutto_m2) / gt.brutto_m2)}`);
  console.log(`Öffnungsfläche ${istFenster.toFixed(1)} m² / Plan ${gt.oeffnungsflaeche_ohne_keller_m2} m² -> ${pct((istFenster - gt.oeffnungsflaeche_ohne_keller_m2) / gt.oeffnungsflaeche_ohne_keller_m2)}`);
}
