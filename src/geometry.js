/* Geometrie-Kern: Homographie (Entzerrung) und Flächenberechnung.
 * Rein funktional, ohne DOM -> in Node testbar. Einheit nach der Entzerrung: Meter. */
(function (root) {
  'use strict';

  function solveLinear(A, b) {
    const n = b.length;
    const M = A.map((row, i) => row.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) throw new Error('Singuläres Gleichungssystem (Punkte kollinear?)');
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < n; r++) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
      let s = M[r][n];
      for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
      x[r] = s / M[r][r];
    }
    return x;
  }

  /** Homographie H (3x3, h22 = 1) mit dst ~ H * src aus 4 Punktpaaren. */
  function homography(src, dst) {
    if (src.length !== 4 || dst.length !== 4) throw new Error('Genau 4 Punktpaare nötig');
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = solveLinear(A, b);
    return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
  }

  function applyH(H, p) {
    const w = H[2][0] * p[0] + H[2][1] * p[1] + H[2][2];
    return [
      (H[0][0] * p[0] + H[0][1] * p[1] + H[0][2]) / w,
      (H[1][0] * p[0] + H[1][1] * p[1] + H[1][2]) / w,
    ];
  }

  /** Fläche eines Polygons (Gauß'sche Trapezformel), vorzeichenlos. */
  function polygonArea(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      s += x1 * y2 - x2 * y1;
    }
    return Math.abs(s) / 2;
  }

  function ccw(a, b, c) { return (c[1] - a[1]) * (b[0] - a[0]) - (b[1] - a[1]) * (c[0] - a[0]); }

  /** true, wenn sich nicht benachbarte Kanten schneiden (ungültiges Polygon). */
  function selfIntersects(pts) {
    const n = pts.length;
    if (n < 4) return false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (j === i + 1 || (i === 0 && j === n - 1)) continue;
        const a = pts[i], b = pts[(i + 1) % n], c = pts[j], d = pts[(j + 1) % n];
        if (ccw(a, b, c) * ccw(a, b, d) < 0 && ccw(c, d, a) * ccw(c, d, b) < 0) return true;
      }
    }
    return false;
  }

  /** Kalibrierung aus Referenzrechteck (TL,TR,BR,BL im Bild) mit Breite/Höhe in m. */
  function calibrationFromRect(imgPts, widthM, heightM) {
    const metric = [[0, 0], [widthM, 0], [widthM, heightM], [0, heightM]];
    return { type: 'rect', H: homography(imgPts, metric) };
  }

  /** Fallback ohne Perspektivkorrektur: Maßstab aus einer Strecke (nur bei frontaler Aufnahme). */
  function calibrationFromLine(p1, p2, lengthM) {
    const px = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    if (px < 1e-9) throw new Error('Referenzstrecke hat Länge 0');
    const s = lengthM / px;
    return { type: 'line', H: [[s, 0, 0], [0, s, 0], [0, 0, 1]] };
  }

  function areaMetric(calib, imgPts) {
    return polygonArea(imgPts.map((p) => applyH(calib.H, p)));
  }

  const api = { solveLinear, homography, applyH, polygonArea, selfIntersects, calibrationFromRect, calibrationFromLine, areaMetric };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Geometry = api;
})(typeof self !== 'undefined' ? self : this);
