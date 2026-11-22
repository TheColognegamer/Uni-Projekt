/* Lokaler Server: liefert die App aus und bietet POST /api/detect (KI-Vorschlag für Wand/Fenster/Tür).
 * Der API-Schlüssel (ANTHROPIC_API_KEY) bleibt serverseitig. MOCK=1 liefert feste Beispielwerte (KEINE echte Erkennung). */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';

const root = path.dirname(fileURLToPath(import.meta.url));
// Optional: Werte aus einer lokalen .env-Datei laden (nicht im Repo, siehe .gitignore). Bereits gesetzte Umgebungsvariablen haben Vorrang.
try {
  for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
} catch { /* keine .env vorhanden: ok */ }
const PORT = Number(process.env.PORT || 8000);
const MOCK = process.env.MOCK === '1' || process.argv.includes('--mock'); // --mock funktioniert auch unter Windows
const MODEL = process.env.DETECT_MODEL || 'claude-opus-5-5';
const MAX_BODY = 12 * 1024 * 1024;
const ACCESS_CODE = process.env.ACCESS_CODE || '';            // optional: schützt /api/detect auf gehosteten Servern
const MAX_PER_HOUR = Number(process.env.MAX_PER_HOUR || 60);  // einfache Kostenbremse (pro Serverprozess)
let hits = [];
// Auf gehosteten Servern (REQUIRE_ACCESS_CODE=1 bzw. Render) nie ohne Zugangscode starten: sonst kann jeder den API-Schlüssel verbrauchen.
if ((process.env.REQUIRE_ACCESS_CODE === '1' || process.env.RENDER) && !ACCESS_CODE && !MOCK) {
  console.error('ACCESS_CODE fehlt. Auf einem gehosteten Server muss ein Zugangscode gesetzt sein.'); process.exit(1);
}

const Pt = z.object({ x: z.number(), y: z.number() });
const Poly = z.object({ label: z.string(), points: z.array(Pt) });
const Ref = z.object({
  label: z.string(),
  p1: Pt, p2: Pt,
  length_min_m: z.number(), length_typ_m: z.number(), length_max_m: z.number(),
  confidence: z.enum(['hoch', 'mittel', 'niedrig']),
});
const Detection = z.object({
  facades: z.array(Poly),
  windows: z.array(Poly),
  doors: z.array(Poly),
  scale_refs: z.array(Ref),
  notes: z.string(),
});

// Schema beim Start bauen: Fehler (z. B. falsche zod-Version) fallen sofort auf, nicht erst beim ersten Foto.
const DETECTION_FORMAT = zodOutputFormat(Detection);

const SYSTEM = `Du unterstützt ein Aufmaß-Werkzeug für Fassaden. Du bekommst ein Foto eines Gebäudes und markierst Flächen als Polygone.
Koordinaten sind Pixel des gelieferten Bildes, Ursprung oben links, x nach rechts, y nach unten.
- facades: die zu messende Außenwandfläche der dem Betrachter zugewandten Gebäudeseite (nur Wand, ohne Dach, ohne Anbauten wie Garage, ohne Vorgarten). Normalerweise genau ein Polygon.
- windows: jedes sichtbare Fenster, Umriss am äußeren Rand des Rahmens (Fensterbänke, Läden und Vorhänge nicht eingerechnet).
- doors: jede Tür oder jedes Tor in der Wandfläche.
- scale_refs: 2 bis 4 Strecken im Bild, deren reale Länge sich aus allgemein bekannten Maßen schätzen lässt, damit daraus der Maßstab folgt. Gib die Endpunkte p1 und p2 in Bildpixeln an (genau entlang der Strecke, waagerecht oder senkrecht in der Ebene der Fassade, nicht schräg in die Tiefe) und die reale Länge als Bereich length_min_m / length_typ_m / length_max_m in Metern.
  Geeignet: Höhe von Haus- oder Terrassentüren (typisch 2,0 bis 2,15 m), Höhe eines Garagentors (typisch 2,0 bis 2,25 m), Mauerwerk mit sichtbaren Schichten über eine gezählte Anzahl Schichten (bei Ziegel/Klinker ergeben 3 Schichten im NF-Format bzw. 4 Schichten im DF-Format etwa 25 cm), Stufenhöhen (0,15 bis 0,19 m).
  Nicht geeignet: Fassadenbreite, Gebäudehöhe, Fenstergrößen ohne erkennbaren Typ, alles, was stark streut. Schätze die Spanne ehrlich; setze confidence auf niedrig, wenn die Referenz unsicher ist. Wenn nichts Brauchbares erkennbar ist, gib eine leere Liste zurück. Erfinde nichts.
Rechteckige Elemente als 4 Eckpunkte angeben, im Uhrzeigersinn ab links oben. Nichts erfinden: verdeckte oder unklare Teile nur markieren, wenn die Kante erkennbar ist, und das in notes erwähnen. Schreibe notes kurz auf Deutsch.`;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('Bild zu groß'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const rectPts = (x1, y1, x2, y2, w, h) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(([x, y]) => ({ x: (x / 1344) * w, y: (y / 768) * h }));
function mockDetection(w, h) {
  return {
    facades: [{ label: 'Wand', points: rectPts(297, 170, 1095, 600, w, h) }],
    windows: [[378, 202, 512, 303], [619, 202, 687, 303], [853, 202, 992, 303], [378, 418, 512, 523], [853, 418, 992, 523]]
      .map((r, i) => ({ label: 'Fenster ' + (i + 1), points: rectPts(...r, w, h) })),
    doors: [{ label: 'Tür', points: rectPts(616, 428, 689, 583, w, h) }],
    scale_refs: [
      { label: 'Haustür (Höhe)', p1: { x: (652 / 1344) * w, y: (425 / 768) * h }, p2: { x: (652 / 1344) * w, y: (583 / 768) * h }, length_min_m: 1.985, length_typ_m: 2.01, length_max_m: 2.135, confidence: 'mittel' },
      { label: 'Garagentor (Höhe)', p1: { x: (195 / 1344) * w, y: (447 / 768) * h }, p2: { x: (195 / 1344) * w, y: (601 / 768) * h }, length_min_m: 1.9, length_typ_m: 2.0, length_max_m: 2.25, confidence: 'niedrig' },
    ],
    notes: 'ATTRAPPE: feste Beispielwerte für das Foto "hausfassade-nachher", keine echte Erkennung.',
    mock: true,
  };
}

let client = null;
async function detect({ image, mediaType, width, height }) {
  if (MOCK) return mockDetection(width, height);
  if (!process.env.ANTHROPIC_API_KEY) throw Object.assign(new Error('Kein ANTHROPIC_API_KEY gesetzt. Für einen Test der Oberfläche ohne KI: npm run start:mock'), { status: 503 });
  client ??= new Anthropic();
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
        { type: 'text', text: `Das Bild ist ${width} x ${height} Pixel groß. Markiere Wandfläche, Fenster und Türen.` },
      ],
    }],
    output_config: { effort: 'high', format: DETECTION_FORMAT },
  });
  if (response.stop_reason === 'refusal') throw Object.assign(new Error('Das Modell hat die Anfrage abgelehnt.'), { status: 422 });
  if (!response.parsed_output) throw Object.assign(new Error('Antwort des Modells nicht lesbar (stop_reason: ' + response.stop_reason + ').'), { status: 502 });
  return { ...response.parsed_output, mock: false, model: MODEL, usage: response.usage };
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const json = (res, status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/api/detect') {
      if (ACCESS_CODE && req.headers['x-access-code'] !== ACCESS_CODE) return json(res, 401, { error: 'Zugangscode fehlt oder falsch.' });
      const now = Date.now(); hits = hits.filter((t) => now - t < 3600e3);
      if (hits.length >= MAX_PER_HOUR) return json(res, 429, { error: 'Stundenlimit erreicht (' + MAX_PER_HOUR + ' Fotos). Später erneut versuchen.' });
      hits.push(now);
      const b = JSON.parse(await readBody(req));
      if (!b.image || !/^image\/(jpeg|png|webp|gif)$/.test(b.mediaType) || !(b.width > 0) || !(b.height > 0)) return json(res, 400, { error: 'Ungültige Anfrage' });
      return json(res, 200, await detect(b));
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html' || /^\/src\/[\w.-]+$/.test(url.pathname))) {
      const f = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
      const d = await fs.promises.readFile(f);
      res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); return res.end(d);
    }
    res.writeHead(404); res.end('Nicht gefunden');
  } catch (e) {
    const status = e.status || (e instanceof Anthropic.APIError ? 502 : 500);
    console.error('[detect]', e.message);
    json(res, status, { error: e.message });
  }
}).listen(PORT, () => {
  console.log(`App: http://localhost:${PORT}  (${MOCK ? 'ATTRAPPE' : 'Modell ' + MODEL})`);
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) console.log(`Am Handy (gleiches WLAN): http://${i.address}:${PORT}`);
  if (!MOCK) {
    const k = process.env.ANTHROPIC_API_KEY || '';
    if (!k) console.log('API-Key: FEHLT (siehe README: .env anlegen)');
    else {
      console.log(`API-Key: gesetzt, beginnt mit "${k.slice(0, 7)}", Länge ${k.length}`);
      if (!k.startsWith('sk-ant-')) console.log('  WARNUNG: Ein Anthropic-Key beginnt mit "sk-ant-". Das hier sieht nicht danach aus.');
      if (/\s|["']/.test(k)) console.log('  WARNUNG: Der Key enthält Leerzeichen oder Anführungszeichen.');
      if (k.length < 40) console.log('  WARNUNG: Der Key wirkt zu kurz, vermutlich unvollständig kopiert.');
    }
    if (process.env.ANTHROPIC_BASE_URL) console.log('  Hinweis: ANTHROPIC_BASE_URL ist gesetzt und leitet die Anfragen um.');
    if (process.env.ANTHROPIC_AUTH_TOKEN) console.log('  Hinweis: ANTHROPIC_AUTH_TOKEN ist gesetzt.');
  }
  if (!ACCESS_CODE) console.log('Hinweis: ohne ACCESS_CODE kann jeder im Netz die KI-Funktion nutzen (Kosten!).');
});
