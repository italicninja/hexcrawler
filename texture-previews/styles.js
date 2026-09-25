/* Candidate terrain texture styles. Each style renders a whole board onto a canvas. */
/* global window, TX, Baseline */
(function () {
  const { SQ3, hash2, vnoise, fbm, ridged, worley, smooth, clamp01, rgb, mix, scale, ramp, css, hexPath, riverDist, shoreField } = TX;

  function rng(seed) { // mulberry32
    let a = Math.floor(seed * 4294967296) >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** Deterministic, roughly even points inside a hex (rejection sampling). */
  function scatterInHex(h, r, n, minDist, margin, rand) {
    const pts = [];
    for (let tries = 0; pts.length < n && tries < n * 40; tries++) {
      const x = h.x + (rand() * 2 - 1) * r * SQ3 / 2, y = h.y + (rand() * 2 - 1) * r;
      const dx = Math.abs(x - h.x), dy = Math.abs(y - h.y);
      const rr = r - margin;
      if (dx > rr * SQ3 / 2 || dy > rr - dx / SQ3) continue;
      if (pts.some(p => Math.hypot(p.x - x, p.y - y) < minDist)) continue;
      pts.push({ x, y, k: rand() });
    }
    return pts.sort((a, b) => a.y - b.y);
  }
  const put = (d, i, c, a = 255) => { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a; };
  const warpClassifier = (board, amt) => (x, y) => {
    const r = board.r, u = x / r, v = y / r;
    const wx = x + (fbm(u * 1.1, v * 1.1, 3, 11) - 0.5) * 2 * amt * r;
    const wy = y + (fbm(u * 1.1 + 7.3, v * 1.1 - 3.1, 3, 13) - 0.5) * 2 * amt * r;
    return board.nearest(wx, wy) || board.nearest(x, y);
  };
  const wobbleRiver = (board, x, y) => {
    const r = board.r, u = x / r, v = y / r;
    // Displacement gradient must stay well under 1 or the distance field folds (smeared banks).
    return riverDist(board.riverSegs, x + (vnoise(u * 1.8, v * 1.8, 7) - 0.5) * r * 0.16, y + (vnoise(u * 1.8 + 9, v * 1.8, 8) - 0.5) * r * 0.16);
  };

  // ════════════════════════════════════════════════════════════════════════
  // 0. CURRENT — the real in-game HexTextureGenerator, bundled verbatim.
  // ════════════════════════════════════════════════════════════════════════
  const current = {
    id: 'current',
    title: 'Current (baseline)',
    blurb: 'The live HexTextureGenerator: one 32-40px repeating OSRS-style dither tile per terrain, anchored to the canvas origin. Decorations get cut off at hex edges, water has no shoreline, and rivers are just blue hexes.',
    render(canvas, board) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0b0a08'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const gen = new Baseline.HexTextureGenerator(new Baseline.PerlinNoise(12345));
      for (const h of board.hexes) {
        hexPath(ctx, h.x, h.y, board.r);
        ctx.fillStyle = gen.getPattern(ctx, { key: h.key, color: h.color }, board.r, h.col, h.row) || h.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(15, 12, 6, 0.25)'; ctx.lineWidth = 1; ctx.stroke();
      }
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // A. PAINTED RELIEF — per-pixel heightfields with hillshade lighting.
  // ════════════════════════════════════════════════════════════════════════
  const HEIGHT = {
    grassland: (u, v) => fbm(u * 1.5, v * 1.5, 4, 21) * 0.35,
    forest: (u, v) => { const w = worley(u * 3.2, v * 3.2, 31); return (1 - smooth(0, 0.62, w.f1)) * 0.55 + fbm(u * 6, v * 6, 2, 33) * 0.05; },
    hills: (u, v) => fbm(u * 0.9, v * 0.9, 5, 41) * 1.1,
    mountains: (u, v) => ridged(u * 0.9, v * 0.9, 5, 51) * 1.25 + fbm(u * 0.5, v * 0.5, 2, 52) * 0.45,
    desert: (u, v) => {
      const ph = u * 1.2 + v * 0.45 + fbm(u * 0.6, v * 0.6, 3, 61) * 2.6;
      const f = ph - Math.floor(ph);
      return (f < 0.7 ? f / 0.7 : (1 - f) / 0.3) * 0.16 + fbm(u * 3, v * 3, 2, 63) * 0.03;
    },
    swamp: (u, v) => fbm(u * 2.2, v * 2.2, 4, 71) * 0.18,
    tundra: (u, v) => fbm(u * 1.4, v * 1.4, 5, 81) * 0.5,
    water: () => 0,
  };
  HEIGHT.river = HEIGHT.grassland;
  const LIGHT = (() => { const l = [-0.55, -0.65, 0.55]; const n = Math.hypot(...l); return l.map(c => c / n); })();

  const relief = {
    id: 'painted-relief',
    title: 'A. Painted Relief',
    blurb: 'Per-pixel heightfields lit from the top-left (hillshade). Forest canopies are cellular noise, mountains are ridged noise with snowlines, dunes have steep lee faces. Coastlines get depth gradients, foam and beaches; hex borders are domain-warped so biomes blend organically. Rivers are real channels connecting hex edges.',
    render(canvas, board) {
      const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, r = board.r;
      const img = ctx.createImageData(W, H), d = img.data;
      const classify = warpClassifier(board, 0.22);
      const shore = shoreField(W, H, (x, y) => { const h = classify(x, y); return !!h && h.key === 'water'; });
      const du = 1 / r;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (!board.nearest(x, y)) { put(d, i, [0, 0, 0], 0); continue; }
        const h = classify(x, y), key = h.key, u = x / r, v = y / r;
        const hf = HEIGHT[key] || HEIGHT.grassland;
        const h0 = hf(u, v), gx = (hf(u + du, v) - h0) / du, gy = (hf(u, v + du) - h0) / du;
        const k = key === 'mountains' ? 0.45 : 0.6;
        let nx = -gx * k, ny = -gy * k, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        const lit = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / LIGHT[2]; // 1 on flat ground
        const shadeK = Math.max(0.45, Math.min(1.35, 0.3 + 0.7 * lit));
        const grain = (hash2(x, y, 3) - 0.5) * 8;
        const sd = shore(x, y);
        let c;
        switch (key) {
          case 'forest': {
            const w = worley(u * 3.2, v * 3.2, 31), crown = 1 - smooth(0, 0.62, w.f1);
            const crownCol = rgb(['#2f5424', '#3a632b', '#467232'][Math.floor(w.id * 3)]);
            c = scale(mix(rgb('#1a2b16'), crownCol, smooth(0.05, 0.4, crown)), shadeK);
            break;
          }
          case 'hills': {
            c = ramp([[0, '#6f7d3e'], [0.5, '#86884b'], [1, '#9b9460']], h0);
            c = mix(c, rgb('#8a7552'), smooth(1.0, 2.2, Math.hypot(gx, gy)) * 0.6);
            c = scale(c, shadeK);
            break;
          }
          case 'mountains': {
            c = ramp([[0, '#5d5a4c'], [0.45, '#6f6a60'], [0.8, '#8f887c']], h0);
            c = mix(c, rgb('#66703f'), smooth(0.55, 0.3, h0) * 0.5);
            c = scale(c, shadeK);
            const snow = smooth(1.2, 1.32, h0 + (fbm(u * 4, v * 4, 2, 53) - 0.5) * 0.25);
            c = mix(c, mix(rgb('#9aabc2'), rgb('#f3f6f8'), clamp01((lit - 0.4) / 0.8)), snow);
            break;
          }
          case 'desert':
            c = scale(ramp([[0, '#c9a66a'], [0.6, '#d8bc86'], [1, '#e6cf9c']], h0 / 0.16), 0.5 + 0.5 * shadeK);
            break;
          case 'swamp': {
            const p = h0 / 0.18;
            if (p < 0.44) c = mix(rgb('#26332d'), rgb('#3c4d41'), fbm(u * 5, v * 5, 2, 72));
            else if (p < 0.47) c = rgb('#3a3c26');
            else c = scale(ramp([[0.47, '#4d5a31'], [0.65, '#5f6b38'], [1, '#737a45']], p), shadeK);
            break;
          }
          case 'tundra': {
            c = mix(rgb('#a9b8cb'), rgb('#eef2f5'), clamp01((lit - 0.35) / 0.8));
            const rock = fbm(u * 2.5, v * 2.5, 4, 85);
            if (rock > 0.64) c = scale(mix(rgb('#9c9a74'), rgb('#7f7c70'), smooth(0.64, 0.72, rock)), shadeK);
            break;
          }
          case 'water': {
            const depth = clamp01(sd / (r * 0.9));
            c = ramp([[0, '#6aa3a8'], [0.25, '#4b86a0'], [1, '#2d5878']], depth);
            c = scale(c, 0.94 + fbm(u * 2, v * 2, 3, 90) * 0.12);
            const wave = Math.sin(v * 9 + fbm(u * 1.5, v * 1.5, 3, 91) * 6);
            if (wave > 0.93 && fbm(u * 3, v * 3, 2, 93) > 0.55) c = mix(c, rgb('#a9cfe0'), 0.45);
            if (sd < 2.2 + vnoise(u * 10, v * 10, 94) * 2.5) c = mix(c, rgb('#e2efe9'), 0.85);
            else if (Math.abs(sd - 7 - vnoise(u * 6, v * 6, 95) * 3) < 0.8) c = mix(c, rgb('#9cc6cf'), 0.35);
            break;
          }
          default: { // grassland + river banks
            c = ramp([[0, '#56793a'], [0.5, '#6a8c42'], [1, '#8a9a52']], fbm(u * 0.8 + 3, v * 0.8, 3, 23));
            c = scale(c, shadeK);
          }
        }
        // Beaches and wet banks along the coast
        if (key !== 'water' && sd < 5 + vnoise(u * 5, v * 5, 96) * 4) {
          c = ['grassland', 'hills', 'desert', 'river'].includes(key)
            ? mix(rgb('#d8c690'), rgb('#b3a06e'), smooth(3, 0, sd))
            : scale(c, 0.8);
        }
        // Rivers
        if (board.riverSegs.length) {
          const rd = wobbleRiver(board, x, y), wR = r * 0.12;
          if (rd < wR) c = ramp([[0, '#3f7896'], [0.7, '#5a93ae'], [1, '#8fb9bf']], rd / wR);
          else if (rd < wR + 2.5) c = mix(c, rgb('#4f4a30'), 0.55);
        }
        put(d, i, [c[0] + grain, c[1] + grain, c[2] + grain]);
      }
      ctx.putImageData(img, 0, 0);
      ctx.strokeStyle = 'rgba(20, 20, 10, 0.18)'; ctx.lineWidth = 1;
      for (const h of board.hexes) { hexPath(ctx, h.x, h.y, r); ctx.stroke(); }
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // B. INK & PARCHMENT ATLAS — watercolour washes + hand-drawn map symbols.
  // ════════════════════════════════════════════════════════════════════════
  const INK = '#3b2f22';
  const WASH = { grassland: '#a9b77a', forest: '#7f9a62', hills: '#bcae76', mountains: '#a79d8c', water: '#86a9b8', desert: '#e6c98a', swamp: '#8e9a6c', tundra: '#e3e9e8', river: '#a9b77a' };

  const inkSym = {
    tuft(ctx, x, y, s) {
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.15, y); ctx.quadraticCurveTo(x - s * 0.3, y - s * 0.4, x - s * 0.6, y - s * 0.6);
      ctx.moveTo(x, y); ctx.quadraticCurveTo(x - s * 0.05, y - s * 0.5, x + s * 0.05, y - s);
      ctx.moveTo(x + s * 0.15, y); ctx.quadraticCurveTo(x + s * 0.3, y - s * 0.4, x + s * 0.55, y - s * 0.7);
      ctx.moveTo(x - s * 0.7, y + 0.5); ctx.lineTo(x + s * 0.7, y + 0.5);
      ctx.stroke();
      ctx.lineWidth = 1.1;
    },
    tree(ctx, x, y, s, k) {
      const cx = x, cy = y - s * 0.95, R = s * 0.55;
      const crown = () => {
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 24) {
          const rr = R * (1 + 0.1 * Math.sin(a * 7 + k * 6));
          const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.95;
          if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
      };
      ctx.beginPath(); ctx.moveTo(x, cy + R * 0.9); ctx.lineTo(x, y); ctx.moveTo(x - s * 0.2, y); ctx.lineTo(x + s * 0.35, y); ctx.stroke();
      crown(); ctx.fillStyle = '#c4cd9c'; ctx.fill();
      ctx.save(); ctx.clip(); ctx.lineWidth = 0.7; // shadow hatching, right side
      for (let i = 0; i < 4; i++) { const hx = cx + R * 0.15 + i * R * 0.24; ctx.beginPath(); ctx.moveTo(hx, cy + R); ctx.lineTo(hx + R * 0.5, cy - R * 0.1); ctx.stroke(); }
      ctx.restore();
      crown(); ctx.stroke();
    },
    conifer(ctx, x, y, s) {
      ctx.beginPath();
      ctx.moveTo(x, y - s * 1.3);
      ctx.lineTo(x + s * 0.28, y - s * 0.75); ctx.lineTo(x + s * 0.14, y - s * 0.75);
      ctx.lineTo(x + s * 0.4, y - s * 0.25); ctx.lineTo(x - s * 0.4, y - s * 0.25);
      ctx.lineTo(x - s * 0.14, y - s * 0.75); ctx.lineTo(x - s * 0.28, y - s * 0.75);
      ctx.closePath();
      ctx.fillStyle = '#c9d2c4'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - s * 0.25); ctx.lineTo(x, y); ctx.stroke();
    },
    hill(ctx, x, y, w) {
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y); ctx.quadraticCurveTo(x - w * 0.1, y - w * 0.6, x + w / 2, y);
      ctx.fillStyle = '#e1d2a4'; ctx.fill(); ctx.stroke();
      ctx.lineWidth = 0.8;
      for (let t = 0.58; t < 0.95; t += 0.09) { // hatch the shadow flank
        const px = (1 - t) ** 2 * (x - w / 2) + 2 * (1 - t) * t * (x - w * 0.1) + t * t * (x + w / 2);
        const py = (1 - t) ** 2 * y + 2 * (1 - t) * t * (y - w * 0.6) + t * t * y;
        ctx.beginPath(); ctx.moveTo(px, py + 1); ctx.lineTo(px + w * 0.05, py + w * 0.12 * (1 - t) * 3); ctx.stroke();
      }
      ctx.lineWidth = 1.1;
    },
    mountain(ctx, x, y, w, ht, k) {
      const px = x + (k - 0.5) * w * 0.2, py = y - ht;
      const lx = x - w / 2, rx = x + w / 2;
      const jx = px - w * 0.22, jy = py + ht * 0.3; // shoulder notch on the lit side
      ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(jx, jy); ctx.lineTo(jx + w * 0.06, jy - ht * 0.05); ctx.lineTo(px, py); ctx.lineTo(rx, y); ctx.closePath();
      ctx.fillStyle = '#efe4c6'; ctx.fill();
      // Shadow face with hatching
      ctx.save();
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(rx, y); ctx.lineTo(px + w * 0.08, y); ctx.lineTo(px + w * 0.02, py + ht * 0.45); ctx.closePath();
      ctx.fillStyle = 'rgba(120, 104, 80, 0.35)'; ctx.fill(); ctx.clip();
      ctx.lineWidth = 0.75;
      for (let hx = px - ht; hx < rx + ht; hx += 2.4) { ctx.beginPath(); ctx.moveTo(hx, py); ctx.lineTo(hx - ht * 0.6, y); ctx.stroke(); }
      ctx.restore();
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(jx, jy); ctx.lineTo(jx + w * 0.06, jy - ht * 0.05); ctx.lineTo(px, py); ctx.lineTo(rx, y); ctx.stroke();
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + w * 0.02, py + ht * 0.45); ctx.lineTo(px + w * 0.08, y); ctx.stroke();
      ctx.lineWidth = 1.1;
    },
    wave(ctx, x, y, s) {
      ctx.beginPath(); ctx.moveTo(x - s, y);
      ctx.quadraticCurveTo(x - s / 2, y - s * 0.55, x, y); ctx.quadraticCurveTo(x + s / 2, y - s * 0.55, x + s, y);
      ctx.stroke();
    },
    dune(ctx, x, y, w) {
      ctx.beginPath(); ctx.moveTo(x - w / 2, y + w * 0.05); ctx.quadraticCurveTo(x, y - w * 0.3, x + w / 2, y + w * 0.08); ctx.stroke();
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 4; i++) { const hx = x + w * (0.02 + i * 0.09); ctx.beginPath(); ctx.moveTo(hx, y - w * 0.1 + i * w * 0.03); ctx.lineTo(hx + 1, y + w * 0.06); ctx.stroke(); }
      ctx.lineWidth = 1.1;
    },
    marsh(ctx, x, y, s, k) {
      ctx.beginPath();
      ctx.moveTo(x - s / 2, y); ctx.lineTo(x + s / 2, y);
      for (let i = 0; i < 4; i++) { const hx = x - s * 0.35 + i * s * 0.23; ctx.moveTo(hx, y - 1); ctx.lineTo(hx + (i - 1.5) * 0.6, y - s * (0.35 + hash2(i, 3, k * 999) * 0.35)); }
      ctx.moveTo(x - s * 0.2, y + 2.5); ctx.lineTo(x + s * 0.6, y + 2.5);
      ctx.stroke();
    },
  };

  const atlas = {
    id: 'ink-atlas',
    title: 'B. Ink & Parchment Atlas',
    blurb: 'An old-school hexcrawl map: parchment paper, watercolour washes with pigment pooling at biome edges, and hand-inked symbols (hatched mountains, lollipop trees, marsh tufts, dune crests). Coasts get the classic inked shoreline with echo ripples. Best thematic fit for a D&D hexcrawl.',
    render(canvas, board) {
      const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, r = board.r;
      const img = ctx.createImageData(W, H), d = img.data;
      const classify = warpClassifier(board, 0.18);
      const shore = shoreField(W, H, (x, y) => { const h = classify(x, y); return !!h && h.key === 'water'; });
      const ink = rgb(INK);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (!board.nearest(x, y)) { put(d, i, [0, 0, 0], 0); continue; }
        const u = x / r, v = y / r, h = classify(x, y);
        let c = ramp([[0, '#d9c69c'], [0.5, '#e8d9b5'], [1, '#f3e8cc']], fbm(u * 2, v * 2, 5, 3));
        const fiber = (hash2(x, y >> 1, 4) - 0.5) * 7;
        c = [c[0] + fiber, c[1] + fiber, c[2] + fiber];
        // Watercolour wash, pooled darker where the biome changes
        let a = 0.5 * (0.8 + (fbm(u * 3, v * 3, 3, 5) - 0.5) * 0.9);
        const edge = [[3, 0], [-3, 0], [0, 3], [0, -3]].some(([ox, oy]) => { const n = classify(x + ox, y + oy); return n && n.key !== h.key; });
        let wash = rgb(WASH[h.key] || '#bbbbbb');
        if (edge) { a += 0.22; wash = scale(wash, 0.88); }
        c = mix(c, wash, clamp01(a));
        // Inked coastline with echo ripples
        const sd = shore(x, y);
        if (h.key === 'water') {
          if (sd < 1.4) c = ink;
          else for (const kk of [5, 10, 16]) if (Math.abs(sd - kk) < 0.55) c = mix(c, ink, 0.5 - kk * 0.018);
        } else if (sd < 0.7) c = ink;
        // River: blue wash between two inked banks
        if (board.riverSegs.length) {
          const rd = wobbleRiver(board, x, y), wR = r * 0.085;
          if (rd < wR) c = mix(c, rgb('#8fb0bc'), 0.75);
          if (Math.abs(rd - wR) < 0.75) c = ink;
        }
        put(d, i, c);
      }
      ctx.putImageData(img, 0, 0);

      // Hex grid: faint dashed survey lines
      ctx.save(); ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(59, 47, 34, 0.35)'; ctx.lineWidth = 1;
      for (const h of board.hexes) { hexPath(ctx, h.x, h.y, r); ctx.stroke(); }
      ctx.restore();

      // Ink symbols, painter's order (top rows first so lower symbols overlap)
      ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const hexes = [...board.hexes].sort((a, b) => a.y - b.y || a.x - b.x);
      for (const h of hexes) {
        const rand = rng(h.seed);
        switch (h.key) {
          case 'grassland':
            for (const p of scatterInHex(h, r, 4, r * 0.42, r * 0.2, rand)) inkSym.tuft(ctx, p.x, p.y, r * 0.18);
            if (rand() < 0.35) inkSym.tree(ctx, h.x + (rand() - 0.5) * r * 0.6, h.y + r * 0.2, r * 0.3, rand());
            break;
          case 'forest':
            for (const p of scatterInHex(h, r, 8, r * 0.34, r * 0.3, rand)) inkSym.tree(ctx, p.x, p.y + r * 0.22, r * (0.3 + p.k * 0.1), p.k);
            break;
          case 'hills': {
            const pts = scatterInHex(h, r, 3, r * 0.45, r * 0.3, rand);
            for (const p of pts) inkSym.hill(ctx, p.x, p.y + r * 0.1, r * (0.55 + p.k * 0.25));
            break;
          }
          case 'mountains': {
            const side = rand() < 0.5 ? -1 : 1;
            inkSym.mountain(ctx, h.x + side * r * 0.42, h.y + r * 0.05, r * 0.6, r * 0.5, rand());
            inkSym.mountain(ctx, h.x - side * r * 0.08, h.y + r * 0.45, r * 1.05, r * 0.9, rand());
            break;
          }
          case 'water':
            for (const p of scatterInHex(h, r, 3, r * 0.6, r * 0.2, rand)) {
              if (shore(p.x, p.y) > 14) { ctx.lineWidth = 0.9; inkSym.wave(ctx, p.x, p.y, r * 0.13); ctx.lineWidth = 1.1; }
            }
            break;
          case 'desert':
            for (const p of scatterInHex(h, r, 2, r * 0.6, r * 0.3, rand)) inkSym.dune(ctx, p.x, p.y, r * 0.7);
            ctx.globalAlpha = 0.6;
            for (const p of scatterInHex(h, r, 28, 3, 2, rand)) { ctx.beginPath(); ctx.arc(p.x, p.y, 0.6, 0, Math.PI * 2); ctx.fill(); }
            ctx.globalAlpha = 1;
            break;
          case 'swamp':
            for (const p of scatterInHex(h, r, 6, r * 0.38, r * 0.18, rand)) inkSym.marsh(ctx, p.x, p.y, r * 0.3, p.k);
            break;
          case 'tundra':
            for (const p of scatterInHex(h, r, 2, r * 0.5, r * 0.3, rand)) inkSym.conifer(ctx, p.x, p.y + r * 0.2, r * 0.3);
            ctx.globalAlpha = 0.55;
            for (const p of scatterInHex(h, r, 5, r * 0.3, r * 0.15, rand)) { ctx.beginPath(); ctx.moveTo(p.x - 2.5, p.y); ctx.lineTo(p.x + 2.5, p.y); ctx.moveTo(p.x + 4, p.y + 2); ctx.lineTo(p.x + 7, p.y + 2); ctx.stroke(); }
            ctx.globalAlpha = 1;
            break;
          default:
        }
      }
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // C. 16-BIT PIXEL ART — ordered dithering, 4-tone ramps, lit sprites.
  // ════════════════════════════════════════════════════════════════════════
  const PX = 3; // screen pixels per art pixel
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const PAL = {
    grassland: ['#3f6b2f', '#4f8337', '#62993f', '#7cae4e'],
    forest: ['#1f3b22', '#2c5230', '#3b6a3a', '#4f8446'],
    hills: ['#566a32', '#6d803b', '#879449', '#a2a45d'],
    mountains: ['#4a4744', '#625e59', '#7d7870', '#9d978c'],
    water: ['#27507a', '#2f6090', '#3b74a6', '#4f8cbd'],
    desert: ['#b58d58', '#caa56b', '#dcbc82', '#ead29c'],
    swamp: ['#3a4a2c', '#4b5d34', '#5d6f3c', '#72824a'],
    tundra: ['#9fb0bf', '#bccad6', '#d7e1e9', '#eef3f7'],
    pool: ['#1f3432', '#27433e', '#34574d', '#4a735f'],
    river: ['#2f6090', '#3b74a6', '#5a9ccb', '#8cc3e3'],
  };
  PAL.river_ground = PAL.grassland;
  const SPR_PAL = {
    tree: { o: '#122012', d: '#23411f', m: '#2f5a2a', l: '#437a36', h: '#62a047', t: '#4a3421' },
    pine: { o: '#0f1d15', d: '#1b3524', m: '#27482f', l: '#36613c', h: '#4c7d4b', t: '#3f2c1c' },
    snowpine: { o: '#1a2a2a', d: '#2a4638', m: '#365a45', l: '#dfe8ee', h: '#ffffff', t: '#3f2c1c' },
    mountain: { o: '#2a2724', d: '#4a4640', m: '#6b665e', l: '#8e887d', h: '#aaa396', s: '#f2f5f7', b: '#b3c2d2' },
    hill: { o: '#3f4a22', d: '#5b6b30', m: '#728339', l: '#8e9a4b', h: '#aab260' },
    rock: { o: '#2e2f33', d: '#5a5c63', m: '#7d8088', l: '#a4a7ad' },
  };
  const spriteCache = new Map();
  function sprite(kind, size) {
    const key = kind + size;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const px = []; // [x, y, char] with (0,0) = bottom centre anchor
    const lvl = (lit, x, y) => { const t = lit + (BAYER[y & 3][x & 3] / 16 - 0.5) * 0.35; return t > 0.5 ? 'h' : t > 0.1 ? 'l' : t > -0.35 ? 'm' : 'd'; };
    if (kind === 'tree') {
      const R = size, cy = -R - 2, cells = new Set();
      for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) if (x * x + y * y <= R * R + R * 0.6) cells.add(x + ',' + y);
      for (const s of cells) {
        const [x, y] = s.split(',').map(Number);
        const edge = ![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => cells.has(x + a + ',' + (y + b)));
        px.push([x, cy + y, edge ? 'o' : lvl(-(x * 0.6 + y * 0.8) / R, x, y)]);
      }
      px.push([0, -1, 't'], [0, 0, 't'], [-1, 0, 'o'], [1, 0, 'o']);
    } else if (kind === 'pine' || kind === 'snowpine') {
      const Hh = size;
      for (let y = 0; y < Hh; y++) {
        const tier = Math.floor(y / 3), within = y % 3, hw = Math.round(tier * 0.7 + within * 0.8);
        for (let x = -hw; x <= hw; x++) {
          const edge = Math.abs(x) === hw || (within === 2 && Math.abs(x) >= hw - 1);
          px.push([x, -Hh - 1 + y, edge ? 'o' : x < 0 ? (y % 3 === 0 ? 'h' : 'l') : x === 0 ? 'm' : 'd']);
        }
      }
      px.push([0, -1, 't'], [0, 0, 't']);
    } else if (kind === 'mountain') {
      const Hh = size, snowRows = Math.floor(Hh * 0.35);
      for (let y = 0; y < Hh; y++) {
        const hw = Math.round(y * 1.05), ridge = Math.round(y * 0.3);
        for (let x = -hw; x <= hw; x++) {
          let c;
          if (Math.abs(x) === hw || y === 0) c = 'o';
          else if (y < snowRows + ((x * 7 + y) % 3 === 0 ? 1 : 0)) c = x <= ridge ? 's' : 'b';
          else c = x < ridge - 1 ? lvl(0.6 - (y / Hh) * 0.5, x, y) : x <= ridge ? 'm' : 'd';
          px.push([x, -Hh + y + 1, c]);
        }
      }
    } else if (kind === 'hill') {
      const W = size * 2, Hh = size;
      for (let x = -W; x <= W; x++) {
        const top = Math.round(Hh * Math.sqrt(Math.max(0, 1 - (x / (W + 0.5)) ** 2)));
        for (let y = 0; y < top; y++) {
          const c = y === top - 1 ? 'o' : lvl((-x / W) * 0.7 + (y / Hh) * 0.4, x, y);
          px.push([x, -y, c]);
        }
      }
    } else if (kind === 'rock') {
      [[-1, -2, 'o'], [0, -2, 'o'], [-2, -1, 'o'], [-1, -1, 'l'], [0, -1, 'm'], [1, -1, 'o'], [-2, 0, 'o'], [-1, 0, 'm'], [0, 0, 'd'], [1, 0, 'o']].forEach(p => px.push(p));
    }
    const out = { px, pal: SPR_PAL[kind] || SPR_PAL.tree };
    spriteCache.set(key, out);
    return out;
  }
  const RAW = { // tiny hand-placed sprites: rows top->bottom, anchored bottom-centre
    tuft: { rows: ['h.h', 'lhl'], pal: { h: '#8fc25c', l: '#4a7f33' } },
    glint: { rows: ['hh..', '..hh'], pal: { h: '#a8d4ee' } },
    cactus: { rows: ['..o..', '.olo.', 'oolo.', 'olmoo', 'oomlo', '.omo.', '.omo.'], pal: { o: '#1f3a1c', l: '#78a651', m: '#4f7d3a' } },
    reed: { rows: ['r', 'r', 'm', 'm', 'm'], pal: { r: '#6b4424', m: '#6f8a3c' } },
    flower: { rows: ['y'], pal: { y: '#f0e07a' } },
    stone: { rows: ['ll', 'dd'], pal: { l: '#c6b48d', d: '#8d7a55' } },
  };
  function drawSprite(ctx, s, ax, ay) {
    for (const [x, y, ch] of s.px) { const col = s.pal[ch]; if (!col) continue; ctx.fillStyle = col; ctx.fillRect((ax + x) * PX, (ay + y) * PX, PX, PX); }
  }
  function drawRaw(ctx, name, ax, ay) {
    const { rows, pal } = RAW[name], w = rows[0].length;
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (!pal[ch]) return; ctx.fillStyle = pal[ch];
      ctx.fillRect((ax + i - (w >> 1)) * PX, (ay - rows.length + 1 + j) * PX, PX, PX);
    }));
  }

  const pixel = {
    id: 'pixel-16bit',
    title: 'C. 16-bit Pixel Art',
    blurb: 'A cleaner successor to the current look: true low-res pixels (3x), 4-tone ramps per biome with Bayer ordered dithering (flat areas, dithered transitions) instead of random grain, and lit sprites (round trees, pines, snow-capped peaks, hills, cacti, reeds). Pixel foam lines coasts; hex borders are a one-step darker tone.',
    render(canvas, board) {
      const ctx = canvas.getContext('2d'), r = board.r;
      const GW = Math.ceil(canvas.width / PX), GH = Math.ceil(canvas.height / PX);
      const grid = new Array(GW * GH).fill(null);
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) grid[j * GW + i] = board.nearest(i * PX + PX / 2, j * PX + PX / 2);
      const g = (i, j) => (i < 0 || j < 0 || i >= GW || j >= GH ? null : grid[j * GW + i]);
      const isWater = (h) => h && h.key === 'water';
      const img = ctx.createImageData(canvas.width, canvas.height), d = img.data;
      const riverR = r * 0.11;
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
        const h = g(i, j); if (!h) continue;
        const cx = i * PX + PX / 2, cy = j * PX + PX / 2, u = cx / r, v = cy / r;
        const thr = BAYER[j & 3][i & 3] / 16;
        let pal = PAL[h.key === 'river' ? 'river_ground' : h.key] || PAL.grassland;
        let val = clamp01((fbm(u * 1.2, v * 1.2, 3, 7) - 0.28) / 0.44);
        if (h.key === 'desert') val = clamp01(val * 0.6 + 0.35 * (0.5 + 0.5 * Math.sin(u * 6 + v * 2 + fbm(u, v, 2, 8) * 4)));
        if (h.key === 'water') val = clamp01(val * 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(v * 7 + fbm(u * 2, v * 2, 2, 9) * 3)));
        if (h.key === 'swamp' && fbm(u * 2.4, v * 2.4, 4, 71) < 0.44) pal = PAL.pool;
        let idx = 1 + Math.min(2, Math.floor(val * 2 + thr));
        let col = rgb(pal[idx]);
        // Hex border: one step darker
        const border = g(i + 1, j) !== h || g(i, j + 1) !== h;
        if (border) col = rgb(pal[Math.max(0, idx - 1)]);
        // Coast: foam on the water side, sand / dark lip on the land side
        const n4 = [g(i + 1, j), g(i - 1, j), g(i, j + 1), g(i, j - 1)];
        if (isWater(h)) {
          if (n4.some(n => n && !isWater(n))) col = rgb('#d6ecf4');
          else if ([g(i + 2, j), g(i - 2, j), g(i, j + 2), g(i, j - 2)].some(n => n && !isWater(n))) col = rgb(PAL.water[3]);
        } else if (n4.some(isWater)) {
          col = ['grassland', 'hills', 'desert', 'river'].includes(h.key) ? rgb(thr > 0.5 ? '#d8c38a' : '#c4ad74') : rgb(pal[0]);
        }
        if (board.riverSegs.length) {
          const rd = wobbleRiver(board, cx, cy);
          if (rd < riverR) { const t = rd / riverR; col = rgb(PAL.river[t < 0.45 ? 1 : t < 0.85 ? 2 : 3]); } else if (rd < riverR + PX * 1.2) col = rgb('#34521f');
        }
        for (let yy = 0; yy < PX; yy++) for (let xx = 0; xx < PX; xx++) {
          const X = i * PX + xx, Y = j * PX + yy;
          if (X < canvas.width && Y < canvas.height) put(d, (Y * canvas.width + X) * 4, col);
        }
      }
      ctx.putImageData(img, 0, 0);

      // Sprites in painter's order
      const hexes = [...board.hexes].sort((a, b) => a.y - b.y || a.x - b.x);
      const lr = r / PX;
      for (const h of hexes) {
        const rand = rng(h.seed), cx = Math.round(h.x / PX), cy = Math.round(h.y / PX);
        const spots = (n, md, margin) => scatterInHex({ x: cx, y: cy }, lr, n, md, margin, rand).map(p => [Math.round(p.x), Math.round(p.y), p.k]);
        switch (h.key) {
          case 'grassland':
            for (const [x, y, k] of spots(6, 3, 2)) drawRaw(ctx, k < 0.25 ? 'flower' : 'tuft', x, y);
            if (rand() < 0.4) for (const [x, y] of spots(1, 0, 5)) drawSprite(ctx, sprite('tree', 3), x, y);
            break;
          case 'forest':
            for (const [x, y, k] of spots(8, 4.2, 2.5)) drawSprite(ctx, k < 0.3 ? sprite('pine', 8) : sprite('tree', k < 0.65 ? 3 : 4), x, y);
            break;
          case 'hills':
            for (const [x, y, k] of spots(2, 7, 4)) drawSprite(ctx, sprite('hill', k < 0.5 ? 3 : 4), x, y);
            for (const [x, y] of spots(2, 3, 2)) drawRaw(ctx, 'tuft', x, y);
            break;
          case 'mountains': {
            const side = rand() < 0.5 ? -1 : 1;
            drawSprite(ctx, sprite('mountain', 6), cx + side * 4, cy);
            drawSprite(ctx, sprite('mountain', 9), cx - side * 1, cy + 5);
            drawSprite(ctx, sprite('rock', 0), cx + side * 6, cy + 6);
            break;
          }
          case 'water':
            for (const [x, y] of spots(2, 5, 4)) drawRaw(ctx, 'glint', x, y);
            break;
          case 'desert':
            for (const [x, y, k] of spots(3, 4, 3)) drawRaw(ctx, k < 0.4 ? 'cactus' : 'stone', x, y);
            break;
          case 'swamp':
            for (const [x, y] of spots(7, 2.5, 2)) drawRaw(ctx, 'reed', x, y);
            break;
          case 'tundra':
            for (const [x, y, k] of spots(3, 5, 3)) drawSprite(ctx, k < 0.6 ? sprite('snowpine', 7) : sprite('rock', 0), x, y);
            break;
          default:
        }
      }
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // D. TABLETOP TILES — flat vector board-game tiles with bold icons.
  // ════════════════════════════════════════════════════════════════════════
  const TILE = {
    grassland: '#8fb35a', forest: '#5d8a4c', hills: '#a9a266', mountains: '#9b9a8e', water: '#4d8fc4',
    river: '#8fb35a', desert: '#e2c27c', swamp: '#6f7d4f', tundra: '#dfe7ee',
  };
  const icon = {
    grass(ctx, s) {
      ctx.strokeStyle = '#5f8a3a'; ctx.lineWidth = s * 0.06; ctx.lineCap = 'round';
      for (const [ox, oy] of [[-0.35, 0.1], [0.3, -0.05], [0, 0.4], [-0.1, -0.35]]) {
        const x = ox * s, y = oy * s;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.quadraticCurveTo(x - s * 0.02, y - s * 0.12, x - s * 0.1, y - s * 0.18);
        ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.2);
        ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 0.02, y - s * 0.12, x + s * 0.1, y - s * 0.18);
        ctx.stroke();
      }
    },
    tree(ctx, x, y, s) {
      ctx.fillStyle = '#5b4330'; ctx.fillRect(x - s * 0.04, y - s * 0.12, s * 0.08, s * 0.16);
      ctx.fillStyle = '#2f5a33'; ctx.beginPath(); ctx.arc(x, y - s * 0.28, s * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#437a44'; ctx.beginPath(); ctx.arc(x - s * 0.04, y - s * 0.31, s * 0.18, Math.PI * 0.55, Math.PI * 1.95); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(x - s * 0.08, y - s * 0.38, s * 0.07, 0, Math.PI * 2); ctx.fill();
    },
    forest(ctx, s) { [[-0.3, -0.05, 0.85], [0.3, -0.1, 0.9], [0, 0.3, 1]].forEach(([x, y, k]) => icon.tree(ctx, x * s, y * s + s * 0.2, s * k)); },
    hills(ctx, s) {
      const mound = (x, y, w, h) => {
        ctx.fillStyle = '#8b8750'; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#6f6c40'; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, Math.PI * 1.55, 0); ctx.lineTo(x, y); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.ellipse(x - w * 0.35, y - h * 0.55, w * 0.25, h * 0.18, -0.4, 0, Math.PI * 2); ctx.fill();
      };
      mound(s * 0.2, s * 0.1, s * 0.42, s * 0.34); mound(-s * 0.22, s * 0.3, s * 0.38, s * 0.3);
    },
    mountains(ctx, s) {
      const peak = (x, y, w, h) => {
        ctx.fillStyle = '#7d8088'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x, y - h); ctx.lineTo(x + w, y); ctx.fill();
        ctx.fillStyle = '#5c5f67'; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w, y); ctx.lineTo(x + w * 0.1, y); ctx.fill();
        ctx.fillStyle = '#f4f6f8'; ctx.beginPath();
        ctx.moveTo(x - w * 0.32, y - h * 0.68); ctx.lineTo(x, y - h); ctx.lineTo(x + w * 0.32, y - h * 0.68);
        ctx.lineTo(x + w * 0.12, y - h * 0.6); ctx.lineTo(x, y - h * 0.7); ctx.lineTo(x - w * 0.14, y - h * 0.58); ctx.fill();
      };
      peak(s * 0.28, s * 0.2, s * 0.32, s * 0.55); peak(-s * 0.1, s * 0.42, s * 0.48, s * 0.85);
    },
    water(ctx, s) {
      ctx.strokeStyle = '#8ec0e6'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
      [[-0.1, -0.3], [0.15, 0.0], [-0.15, 0.3]].forEach(([ox, oy]) => {
        const x = ox * s, y = oy * s, w = s * 0.22;
        ctx.beginPath(); ctx.moveTo(x - w * 1.5, y);
        ctx.bezierCurveTo(x - w, y - w * 0.5, x - w * 0.5, y - w * 0.5, x, y);
        ctx.bezierCurveTo(x + w * 0.5, y + w * 0.5, x + w, y + w * 0.5, x + w * 1.5, y); ctx.stroke();
      });
    },
    desert(ctx, s) {
      const dune = (x, y, w, h, c1, c2) => {
        ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.2, y - h * 1.6, x + w, y); ctx.fill();
        ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(x + w * 0.05, y - h * 0.78); ctx.quadraticCurveTo(x + w * 0.55, y - h * 0.5, x + w, y); ctx.lineTo(x + w * 0.3, y); ctx.fill();
      };
      dune(-s * 0.15, s * 0.1, s * 0.5, s * 0.3, '#caa65f', '#b38d4d'); dune(s * 0.2, s * 0.42, s * 0.5, s * 0.25, '#d2b06a', '#b89452');
      ctx.fillStyle = '#6d8f4a'; ctx.lineCap = 'round'; ctx.strokeStyle = '#6d8f4a'; ctx.lineWidth = s * 0.08;
      const cx = s * 0.4, cy = -s * 0.1;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - s * 0.38);
      ctx.moveTo(cx, cy - s * 0.14); ctx.lineTo(cx - s * 0.1, cy - s * 0.14); ctx.lineTo(cx - s * 0.1, cy - s * 0.26);
      ctx.moveTo(cx, cy - s * 0.2); ctx.lineTo(cx + s * 0.1, cy - s * 0.2); ctx.lineTo(cx + s * 0.1, cy - s * 0.3); ctx.stroke();
    },
    swamp(ctx, s) {
      ctx.fillStyle = '#4b5b4a'; ctx.beginPath(); ctx.ellipse(0, s * 0.2, s * 0.55, s * 0.24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7e9086'; ctx.lineWidth = s * 0.04; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-s * 0.25, s * 0.25); ctx.lineTo(s * 0.05, s * 0.25); ctx.moveTo(s * 0.15, s * 0.15); ctx.lineTo(s * 0.35, s * 0.15); ctx.stroke();
      [[-0.3, 0.12, 0.55], [-0.12, 0.08, 0.7], [0.08, 0.1, 0.5]].forEach(([ox, oy, hh]) => {
        const x = ox * s, y = oy * s, top = y - hh * s;
        ctx.strokeStyle = '#4b5a33'; ctx.lineWidth = s * 0.04; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, top); ctx.stroke();
        ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.moveTo(x, top + s * 0.06); ctx.lineTo(x, top + s * 0.2); ctx.stroke();
      });
    },
    tundra(ctx, s) {
      const drift = (x, y, w, h) => {
        ctx.fillStyle = '#b9c7d6'; ctx.beginPath(); ctx.ellipse(x + w * 0.1, y + h * 0.15, w, h, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#f7fafc'; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, Math.PI, 0); ctx.fill();
      };
      ctx.fillStyle = '#7e858d'; ctx.beginPath(); ctx.moveTo(s * 0.2, s * 0.05); ctx.lineTo(s * 0.32, -s * 0.18); ctx.lineTo(s * 0.5, -s * 0.12); ctx.lineTo(s * 0.56, s * 0.05); ctx.fill();
      drift(-s * 0.15, s * 0.1, s * 0.4, s * 0.2); drift(s * 0.15, s * 0.42, s * 0.45, s * 0.18);
    },
  };

  const tabletop = {
    id: 'tabletop-tiles',
    title: 'D. Tabletop Tiles',
    blurb: 'Flat, high-contrast board-game tiles: a small gutter between hexes, a soft top-left bevel, and one bold two-tone icon per tile (mirrored and jittered per hex). The most readable at small zoom levels and on the combat grid, and the cheapest to render.',
    render(canvas, board) {
      const ctx = canvas.getContext('2d'), r = board.r;
      for (const h of board.hexes) {
        const rand = rng(h.seed), rt = r * 0.94;
        hexPath(ctx, h.x, h.y, r); ctx.fillStyle = '#1b1f24'; ctx.fill();
        ctx.save();
        hexPath(ctx, h.x, h.y, rt); ctx.clip();
        const base = scale(rgb(TILE[h.key] || '#888'), 0.97 + rand() * 0.06);
        ctx.fillStyle = css(base); ctx.fillRect(h.x - r, h.y - r, r * 2, r * 2);
        const grad = ctx.createLinearGradient(h.x - r, h.y - r, h.x + r, h.y + r);
        grad.addColorStop(0, 'rgba(255,255,255,0.16)'); grad.addColorStop(0.5, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.16)');
        ctx.fillStyle = grad; ctx.fillRect(h.x - r, h.y - r, r * 2, r * 2);
        if (h.key === 'river') {
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          for (const [w, c] of [[r * 0.34, '#3b78ad'], [r * 0.26, '#4d8fc4'], [r * 0.07, '#8ec0e6']]) {
            ctx.strokeStyle = c; ctx.lineWidth = w;
            for (const [ax, ay, bx, by] of h.riverSegs) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
          }
        } else {
          ctx.translate(h.x + (rand() - 0.5) * r * 0.1, h.y + (rand() - 0.5) * r * 0.08);
          if (rand() < 0.5) ctx.scale(-1, 1);
          const s = r * 0.75;
          ({ grassland: icon.grass, forest: icon.forest, hills: icon.hills, mountains: icon.mountains, water: icon.water, desert: icon.desert, swamp: icon.swamp, tundra: icon.tundra }[h.key] || (() => {}))(ctx, s);
        }
        ctx.restore();
        // Bevel: light rim top-left, dark rim bottom-right
        const bev = ctx.createLinearGradient(h.x - r, h.y - r, h.x + r, h.y + r);
        bev.addColorStop(0, 'rgba(255,255,255,0.35)'); bev.addColorStop(1, 'rgba(0,0,0,0.3)');
        hexPath(ctx, h.x, h.y, rt - 1.25); ctx.strokeStyle = bev; ctx.lineWidth = 2.5; ctx.stroke();
      }
    },
  };

  window.STYLES = [current, relief, atlas, pixel, tabletop];
  window.PIXEL = { PX, BAYER, PAL, rng, sprite, scatterInHex };
})();
