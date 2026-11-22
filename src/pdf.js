/* Minimaler PDF-Erzeuger ohne Abhängigkeiten (Text, Linien, Rechtecke; Helvetica, WinAnsi).
 * Läuft im Browser (window.MiniPDF) und in Node (require). Koordinaten in pt, Ursprung oben links. */
(function (root) {
  'use strict';
  // Zeichenbreiten Helvetica / Helvetica-Bold je WinAnsi-Code (1/1000 em), aus den Adobe-AFM-Daten
  const W = { n: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 761, 556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667, 278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500], b: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 761, 556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667, 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556] };
  // Unicode -> WinAnsi (cp1252) für Zeichen außerhalb Latin-1
  const CP = { '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135, 'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142,
    '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159 };
  // nicht darstellbare Zeichen ersetzen
  const ERSATZ = { '≤': '<=', '≥': '>=', '→': '->', '←': '<-', '≈': 'ca. ', 'Δ': 'Delta ', 'λ': 'Lambda ', 'ψ': 'Psi ', '₂': '2', '✓': 'ja', '✗': 'nein', '✕': 'x', '⚠': '!', 'ℹ': 'i', ' ': ' ', ' ': ' ' };

  function winAnsi(str) {
    let out = '';
    for (const ch of String(str)) {
      if (ERSATZ[ch] !== undefined) { out += winAnsi(ERSATZ[ch]); continue; }
      const c = ch.codePointAt(0);
      if (c >= 32 && c <= 126) out += ch;
      else if (c >= 160 && c <= 255) out += String.fromCharCode(c);
      else if (CP[ch]) out += String.fromCharCode(CP[ch]);
      else out += '?';
    }
    return out;
  }
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const num = (v) => (Math.round(v * 100) / 100).toString();
  const rgb = (hex) => { const h = (hex || '#000000').replace('#', ''); return [0, 2, 4].map((i) => num(parseInt(h.substr(i, 2), 16) / 255)).join(' '); };

  class MiniPDF {
    constructor() { this.W = 595.28; this.H = 841.89; this.pages = []; this.cur = null; }
    addPage() { this.cur = []; this.pages.push(this.cur); return this; }
    /** Breite eines Textes in pt */
    width(str, size = 10, bold = false) {
      const t = winAnsi(str), tab = bold ? W.b : W.n; let w = 0;
      for (let i = 0; i < t.length; i++) w += tab[t.charCodeAt(i)] || 500;
      return (w * size) / 1000;
    }
    /** Text in Zeilen umbrechen, die höchstens maxW breit sind */
    wrap(str, maxW, size = 10, bold = false) {
      const out = [];
      String(str).split('\n').forEach((absatz) => {
        let zeile = '';
        absatz.split(' ').forEach((wort) => {
          const probe = zeile ? zeile + ' ' + wort : wort;
          if (this.width(probe, size, bold) <= maxW || !zeile) zeile = probe;
          else { out.push(zeile); zeile = wort; }
        });
        out.push(zeile);
      });
      return out;
    }
    text(x, y, str, o = {}) {
      const size = o.size || 10, f = o.bold ? 'F2' : 'F1';
      let xx = x;
      if (o.align === 'right') xx = x - this.width(str, size, o.bold);
      else if (o.align === 'center') xx = x - this.width(str, size, o.bold) / 2;
      this.cur.push(`BT ${rgb(o.color)} rg /${f} ${num(size)} Tf ${num(xx)} ${num(this.H - y)} Td (${esc(winAnsi(str))}) Tj ET`);
      return this;
    }
    line(x1, y1, x2, y2, o = {}) {
      this.cur.push(`${rgb(o.color || '#999999')} RG ${num(o.w || 0.5)} w ${num(x1)} ${num(this.H - y1)} m ${num(x2)} ${num(this.H - y2)} l S`);
      return this;
    }
    rect(x, y, w, h, o = {}) {
      this.cur.push(`${rgb(o.fill || '#eeeeee')} rg ${num(x)} ${num(this.H - y - h)} ${num(w)} ${num(h)} re f`);
      return this;
    }
    /** PDF als Uint8Array */
    output(meta = {}) {
      const objs = [];
      const add = (s) => { objs.push(s); return objs.length; };
      const cat = add(''), pages = add('');
      const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      const kids = this.pages.map((ops) => {
        const body = ops.join('\n');
        const c = add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
        return add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${num(this.W)} ${num(this.H)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R >>`);
      });
      objs[cat - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
      objs[pages - 1] = `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
      const info = add(`<< /Title (${esc(winAnsi(meta.title || ''))}) /Producer (Uni-Projekt Gruppe 2) >>`);
      let s = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
      const off = [];
      objs.forEach((o, i) => { off.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
      const xref = s.length;
      s += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
      s += `trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
      const bytes = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 255;
      return bytes;
    }
  }

  const api = { MiniPDF, winAnsi };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MiniPDF = MiniPDF;
})(typeof self !== 'undefined' ? self : this);
