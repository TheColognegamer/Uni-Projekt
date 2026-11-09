/* Lokaler Server: liefert die App aus und bietet POST /api/detect (KI-Vorschlag für Wand/Fenster/Tür).
 * Der API-Schlüssel (ANTHROPIC_API_KEY) bleibt serverseitig. MOCK=1 liefert feste Beispielwerte (KEINE echte Erkennung). */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8000);
const MOCK = process.env.MOCK === '1';
const MODEL = process.env.DETECT_MODEL || 'claude-opus-5-5';
const MAX_BODY = 12 * 1024 * 1024;
const ACCESS_CODE = process.env.ACCESS_CODE || '';            // optional: schützt /api/detect auf gehosteten Servern
const MAX_PER_HOUR = Number(process.env.MAX_PER_HOUR || 60);  // einfache Kostenbremse (pro Serverprozess)
let hits = [];

const Pt = z.object({ x: z.number(), y: z.number() });
const Poly = z.object({ label: z.string(), points: z.array(Pt) });
const Detection = z.object({
  facades: z.array(Poly),
  windows: z.array(Poly),
  doors: z.array(Poly),
  notes: z.string(),
});

const SYSTEM = `Du unterstützt ein Aufmaß-Werkzeug für Fassaden. Du bekommst ein Foto eines Gebäudes und markierst Flächen als Polygone.
Koordinaten sind Pixel des gelieferten Bildes, Ursprung oben links, x nach rechts, y nach unten.
- facades: die zu messende Außenwandfläche der dem Betrachter zugewandten Gebäudeseite (nur Wand, ohne Dach, ohne Anbauten wie Garage, ohne Vorgarten). Normalerweise genau ein Polygon.
- windows: jedes sichtbare Fenster, Umriss am äußeren Rand des Rahmens (Fensterbänke, Läden und Vorhänge nicht eingerechnet).
- doors: jede Tür oder jedes Tor in der Wandfläche.
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
    output_config: { effort: 'high', format: zodOutputFormat(Detection) },
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
  if (!ACCESS_CODE) console.log('Hinweis: ohne ACCESS_CODE kann jeder im Netz die KI-Funktion nutzen (Kosten!).');
});
