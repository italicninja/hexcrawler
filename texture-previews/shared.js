/* Shared helpers for the texture previews: noise, hex geometry, the sample map. */
/* global window */
(function () {
  const SQ3 = Math.sqrt(3);

  // ── Hashing / noise (deterministic, world-space) ─────────────────────────
  function hash2(x, y, s = 0) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s = 0) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct = 4, s = 0) {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * vnoise(x * f, y * f, s + i * 17);
      norm += amp; amp *= 0.5; f *= 2.03;
    }
    return sum / norm;
  }
  function ridged(x, y, oct = 5, s = 0) {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      const n = 1 - Math.abs(vnoise(x * f, y * f, s + i * 31) * 2 - 1);
      sum += amp * n * n;
      norm += amp; amp *= 0.5; f *= 2.1;
    }
    return sum / norm;
  }
  function worley(x, y, s = 0) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let f1 = 9, f2 = 9, id = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx, cy = yi + dy;
      const d = Math.hypot(cx + hash2(cx, cy, s) - x, cy + hash2(cx, cy, s + 1) - y);
      if (d < f1) { f2 = f1; f1 = d; id = hash2(cx, cy, s + 2); } else if (d < f2) f2 = d;
    }
    return { f1, f2, id };
  }
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  // ── Color ────────────────────────────────────────────────────────────────
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const scale = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  /** stops: [[t, '#hex'], ...] ascending */
  function ramp(stops, t) {
    const s = stops.map(([p, c]) => [p, typeof c === 'string' ? rgb(c) : c]);
    if (t <= s[0][0]) return s[0][1];
    for (let i = 1; i < s.length; i++) {
      if (t <= s[i][0]) return mix(s[i - 1][1], s[i][1], (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0]));
    }
    return s[s.length - 1][1];
  }
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  // ── Hex geometry (pointy-top, odd-row offset — matches utils/hexRenderer) ─
  function hexPath(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  const NEIGHBORS = [
    [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]], // even row
    [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]], // odd row
  ];

  // ── Sample map ───────────────────────────────────────────────────────────
  const MAP = [
    'TTTMMMHGGFF',
    'TTMMMHGGFFF',
    'THHMHGRGFFS',
    'GGHHGRGGFSS',
    'GGGGGRGFFSW',
    'DDGGRGGFSWW',
    'DDDHRGGGWWW',
    'DDDWWWGWWWW',
  ];
  const KEYS = { W: 'water', R: 'river', G: 'grassland', F: 'forest', H: 'hills', M: 'mountains', D: 'desert', S: 'swamp', T: 'tundra' };
  const COLORS = { water: '#4a698c', river: '#5a7da3', swamp: '#4c5a36', grassland: '#56793f', forest: '#3d5930', hills: '#6e7045', mountains: '#6b675e', desert: '#c9b385', tundra: '#c7cdd1' };
  const TERRAIN_ORDER = ['grassland', 'forest', 'hills', 'mountains', 'water', 'river', 'desert', 'swamp', 'tundra'];

  /**
   * Build a hex board. `grid` is an array of strings of terrain letters.
   * Returns { hexes, at(col,row), nearest(x,y), riverSegs, r, width, height }.
   */
  function buildBoard(grid, r, pad) {
    const hexes = [];
    const byKey = new Map();
    grid.forEach((line, row) => [...line].forEach((ch, col) => {
      const key = KEYS[ch] || ch;
      const h = {
        col, row, key, color: COLORS[key] || '#777',
        x: pad + r * SQ3 / 2 + col * r * SQ3 + (row % 2) * r * SQ3 / 2,
        y: pad + r + row * r * 1.5,
        seed: hash2(col, row, 99),
      };
      hexes.push(h); byKey.set(col + ',' + row, h);
    }));
    const at = (c, rr) => byKey.get(c + ',' + rr);
    hexes.forEach(h => { h.neighbors = NEIGHBORS[h.row % 2].map(([dc, dr]) => at(h.col + dc, h.row + dr) || null); });

    // River course: centre -> shared edge midpoint for every river/water neighbour.
    const riverSegs = [];
    hexes.forEach(h => {
      if (h.key !== 'river') return;
      h.riverSegs = [];
      h.neighbors.forEach(n => {
        if (n && (n.key === 'river' || n.key === 'water')) {
          const seg = [h.x, h.y, (h.x + n.x) / 2, (h.y + n.y) / 2];
          h.riverSegs.push(seg); riverSegs.push(seg);
        }
      });
      // Isolated / dead-end river hex: run the channel straight across.
      const out = (dx, dy) => { const seg = [h.x, h.y, h.x + dx, h.y + dy]; h.riverSegs.push(seg); riverSegs.push(seg); };
      if (h.riverSegs.length === 0) { out(-r * SQ3 / 2, 0); out(r * SQ3 / 2, 0); } else if (h.riverSegs.length === 1) {
        const [, , mx, my] = h.riverSegs[0]; out(h.x - mx, h.y - my);
      }
    });

    function nearest(x, y) {
      const row0 = Math.round((y - pad - r) / (r * 1.5));
      let best = null, bd = Infinity;
      for (let rr = row0 - 1; rr <= row0 + 1; rr++) {
        const col0 = Math.round((x - pad - r * SQ3 / 2 - (((rr % 2) + 2) % 2) * r * SQ3 / 2) / (r * SQ3));
        for (let c = col0 - 1; c <= col0 + 1; c++) {
          const h = at(c, rr); if (!h) continue;
          const d = (h.x - x) ** 2 + (h.y - y) ** 2;
          if (d < bd) { bd = d; best = h; }
        }
      }
      // Outside the board: nothing (keeps the ragged hex border crisp).
      return best && insideHex(best, x, y, r) ? best : null;
    }
    function insideHex(h, x, y, rad) {
      const dx = Math.abs(x - h.x), dy = Math.abs(y - h.y);
      return dx <= rad * SQ3 / 2 && dy <= rad - dx / SQ3;
    }
    const cols = Math.max(...grid.map(l => l.length));
    return {
      hexes, at, nearest, riverSegs, r,
      width: Math.ceil(pad * 2 + cols * r * SQ3 + r * SQ3 / 2),
      height: Math.ceil(pad * 2 + r * 2 + (grid.length - 1) * r * 1.5),
    };
  }

  function segDist(px, py, [ax, ay, bx, by]) {
    const dx = bx - ax, dy = by - ay;
    const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
    return Math.hypot(px - ax - dx * t, py - ay - dy * t);
  }
  const riverDist = (segs, x, y) => segs.reduce((m, s) => Math.min(m, segDist(x, y, s)), Infinity);

  /**
   * Low-res distance field to the water/land boundary. Positive = pixels to the
   * nearest land (for water pixels), or to the nearest water (for land pixels).
   * `isWater(x, y)` classifies a full-res point.
   */
  function shoreField(w, h, isWater, cell = 3, radius = 14) {
    const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
    const mask = new Uint8Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) mask[j * gw + i] = isWater(i * cell + cell / 2, j * cell + cell / 2) ? 1 : 0;
    const dist = new Float32Array(gw * gh).fill(radius);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const m = mask[j * gw + i]; let best = radius;
      for (let dj = -radius; dj <= radius; dj++) {
        const jj = j + dj; if (jj < 0 || jj >= gh) continue;
        for (let di = -radius; di <= radius; di++) {
          const ii = i + di; if (ii < 0 || ii >= gw) continue;
          if (mask[jj * gw + ii] !== m) { const d = Math.hypot(di, dj); if (d < best) best = d; }
        }
      }
      dist[j * gw + i] = best;
    }
    return (x, y) => { // bilinear, in full-res pixels
      const fx = x / cell - 0.5, fy = y / cell - 0.5;
      const i = Math.max(0, Math.min(gw - 2, Math.floor(fx))), j = Math.max(0, Math.min(gh - 2, Math.floor(fy)));
      const tx = clamp01(fx - i), ty = clamp01(fy - j);
      const a = dist[j * gw + i], b = dist[j * gw + i + 1], c = dist[(j + 1) * gw + i], d = dist[(j + 1) * gw + i + 1];
      return (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty) * cell;
    };
  }

  window.TX = {
    SQ3, hash2, vnoise, fbm, ridged, worley, smooth, clamp01,
    rgb, mix, scale, ramp, css, hexPath, buildBoard, riverDist, segDist, shoreField,
    MAP, KEYS, COLORS, TERRAIN_ORDER,
  };
})();
