/* Style C (16-bit pixel art) applied to interior maps: dungeon, cave, ruins, tower, town. */
/* global window, TX, PIXEL */
(function () {
  const { hash2, fbm, vnoise, worley, clamp01, rgb, mix, buildBoard } = TX;
  const { PX, BAYER, PAL, rng, sprite, scatterInHex } = PIXEL;
  const F = 6; // height of a wall's south face, in art pixels (the 3/4 "depth" trick)
  const BLOCKS = new Set(['wall', 'water', 'chasm', 'building', 'fence']);
  const SOLID = new Set(['wall', 'building']);
  const P = (a) => a.map(rgb);
  const bay = (i, j) => BAYER[j & 3][i & 3] / 16;

  const THEMES = {
    dungeon: {
      ambient: 0.42, torches: true, floor: 'flag', wallTop: 'masonry', face: 'brick', void: 'dark',
      floorPal: P(['#34302b', '#57524a', '#655f55', '#736c60']),
      wallPal: P(['#101014', '#1c1c22', '#24242b', '#2e2e37']),
      facePal: P(['#1a1715', '#4a423a', '#5c5248', '#6e6356']),
    },
    cave: {
      ambient: 0.36, glow: true, floor: 'rock', wallTop: 'lumps', face: 'strata', void: 'dark',
      floorPal: P(['#3a3026', '#54473a', '#615242', '#6f5e4b']),
      wallPal: P(['#110e0b', '#1c1712', '#241e17', '#2e261d']),
      facePal: P(['#16120e', '#3e3428', '#4d4132', '#5d4f3d']),
    },
    ruins: {
      ambient: 1, floor: 'ruinflag', wallTop: 'masonry', face: 'brick', void: 'overgrowth',
      floorPal: P(['#5e5a4a', '#7a7461', '#8d8671', '#a19a83']),
      wallPal: P(['#4a463b', '#625d4f', '#777161', '#8c8674']),
      facePal: P(['#3a362d', '#4d483c', '#5f594b', '#716a5a']),
    },
    tower: {
      ambient: 0.36, torches: true, floor: 'planks', wallTop: 'masonry', face: 'brick', void: 'night',
      floorPal: P(['#3a2618', '#553a24', '#66472c', '#7a5736']),
      wallPal: P(['#141310', '#201e1b', '#2a2824', '#35322d']),
      facePal: P(['#2a2724', '#57524a', '#6a645b', '#7d766b']),
    },
    town: {
      ambient: 1, floor: 'cobble', wallTop: 'masonry', face: 'brick', void: 'dark',
      floorPal: P(['#4c4439', '#6a6053', '#7e7466', '#948a7b']),
      wallPal: P(['#4a4740', '#646058', '#7a766c', '#908b80']),
      facePal: P(['#3e3b35', '#524e46', '#666157', '#7a7469']),
    },
  };
  const GRASS = P(PAL.grassland), OVERGROWTH = P(PAL.forest);
  const WATER = P(['#0e2238', '#16304c', '#1f4062', '#2f5a80']);
  const PAVERS = P(['#6e6552', '#948a72', '#a89e85', '#bcb299']);
  const BUILDINGS = {
    inn: { roof: 'tile', roofPal: P(['#3e1512', '#6e2620', '#8c3428', '#ac4a38']), wall: '#d8c8a0', timber: '#5a3a20' },
    shop: { roof: 'slate', roofPal: P(['#1e252e', '#344050', '#465466', '#5e6e84']), wall: '#c8c0b0', timber: '#4a3a2a' },
    blacksmith: { roof: 'slate', roofPal: P(['#18191c', '#2e3136', '#3e4248', '#52575f']), wall: '#6e6a62', timber: '#3a3632' },
    temple: { roof: 'slate', roofPal: P(['#4a5058', '#727880', '#8e949c', '#aab0b8']), wall: '#dcdcd2', timber: '#b8b8ae', ridge: '#e0b848' },
    house: { roof: 'thatch', roofPal: P(['#4e3818', '#7a5c28', '#98763a', '#b8924c']), wall: '#cdb890', timber: '#6a4a2a' },
    market: { roof: 'stripes', roofPal: P(['#5a1a14', '#a8352c', '#c24a3c', '#e8dcc0']), wall: '#c8b890', timber: '#5a3a20' },
    barracks: { roof: 'slate', roofPal: P(['#2a2a22', '#44443a', '#56564a', '#6a6a5c']), wall: '#7a7a70', timber: '#4a4a40' },
    tent: { roof: 'stripes', roofPal: P(['#5a4a30', '#a89870', '#c4b48a', '#e2d6b4']), wall: '#b8a880', timber: '#5a4a30' },
  };
  BUILDINGS.default = BUILDINGS.house;

  // ── Tile patterns (return a palette index 0..3) ─────────────────────────
  function flag(i, j, s, w = 6, h = 4) {
    const row = Math.floor(j / h), off = (row & 1) * (w >> 1);
    const x = (i + off) % w, y = j % h, col = Math.floor((i + off) / w);
    if (x === 0 || y === 0) return { idx: 0, k: -1 };
    const k = hash2(col, row, s);
    let idx = 1 + Math.floor(k * 2.4);
    if (y === 1 && idx < 3) idx++;
    if (k > 0.93 && x === y + 1) idx = 0; // hairline crack
    return { idx: Math.min(3, idx), k };
  }
  function floorColor(T, i, j, style) {
    const t = bay(i, j);
    switch (style) {
      case 'flag': return T.floorPal[flag(i, j, 11, 8, 5).idx];
      case 'rock': {
        const w = worley(i / 8, j / 8, 21);
        if (w.f2 - w.f1 < 0.06) return T.floorPal[0];
        if (hash2(i, j, 23) > 0.985) return T.floorPal[3];
        return T.floorPal[1 + Math.min(2, Math.floor(w.id * 1.6 + (w.f1 < 0.35 ? 0.5 : 0) + (t - 0.5) * 0.4))];
      }
      case 'ruinflag': {
        const f = flag(i, j, 12);
        if (f.k >= 0 && f.k < 0.16) return GRASS[1 + Math.min(2, Math.floor(fbm(i * 0.2, j * 0.2, 2, 3) * 2 + t))]; // missing stone
        if (f.idx === 0 && hash2(i, j, 13) > 0.45) return GRASS[t > 0.5 ? 1 : 2]; // moss in the joints
        return T.floorPal[f.idx];
      }
      case 'planks': {
        const row = Math.floor(j / 3);
        if (j % 3 === 0) return T.floorPal[0];
        const x = i + Math.floor(hash2(row, 1, 31) * 16);
        if (x % 14 === 0) return T.floorPal[0];
        if (x % 14 === 1 && j % 3 === 1) return T.floorPal[3]; // nail head
        return T.floorPal[1 + Math.min(2, Math.floor(fbm(i * 0.25, row * 2.1, 2, 33) * 2 + t * 0.6))];
      }
      case 'cobble': {
        const w = worley(i / 2.6, j / 2.6, 41);
        if (w.f2 - w.f1 < 0.16) return T.floorPal[0];
        return T.floorPal[1 + Math.min(2, Math.floor(w.id * 2 + (w.f1 < 0.3 ? 0.6 : 0)))];
      }
      case 'pavers': return PAVERS[flag(i, j, 51, 8, 5).idx];
      case 'grass': return GRASS[1 + Math.min(2, Math.floor(clamp01((fbm(i * 0.06, j * 0.06, 3, 7) - 0.28) / 0.44) * 2 + t))];
      default: return T.floorPal[1];
    }
  }
  function wallTopColor(T, i, j) {
    if (T.wallTop === 'lumps') {
      const w = worley(i / 4, j / 4, 61);
      if (w.f2 - w.f1 < 0.1) return T.wallPal[0];
      const f = w.f1 + (bay(i, j) - 0.5) * 0.15;
      return T.wallPal[f < 0.3 ? 3 : f < 0.55 ? 2 : 1];
    }
    return T.wallPal[flag(i, j, 62, 5, 3).idx];
  }
  function faceColor(T, i, k) {
    if (T.face === 'strata') {
      if (k === F) return T.facePal[0];
      return T.facePal[Math.min(3, 1 + ((Math.floor(k / 2) + Math.floor(vnoise(i * 0.25, 3, 71) * 2)) % 2) + (hash2(i >> 1, k, 72) > 0.8 ? 1 : 0))];
    }
    if (k === 1) return T.facePal[3];
    if (k === 4 || k === F) return T.facePal[0];
    const course = k < 4 ? 0 : 1;
    if ((i + course * 3) % 6 === 0) return T.facePal[0];
    const v = hash2(Math.floor((i + course * 3) / 6), course, 73);
    return T.facePal[v > 0.75 ? 1 : 2];
  }
  function facadeColor(b, i, k, h, cxEntrance) {
    const wall = rgb(b.wall), timber = rgb(b.timber);
    if (k === 1) return mix(wall, [0, 0, 0], 0.55); // eave shadow
    if (k === F) return rgb('#5a5248'); // stone footing
    if (cxEntrance !== null && Math.abs(i - cxEntrance) <= 2 && k >= 2) {
      if (Math.abs(i - cxEntrance) === 2) return timber;
      return k === 4 && i === cxEntrance + 1 ? rgb('#e0b040') : rgb('#4a2c14');
    }
    if (i % 7 === 0 || k === 2) return timber;
    if ((k === 3 || k === 4) && (i % 7 === 3 || i % 7 === 4)) return k === 3 && i % 7 === 3 ? rgb('#8fb0c8') : rgb('#2a3848');
    return wall;
  }
  function roofColor(g, i, j, onEdge) {
    const b = g.def, pal = b.roofPal, dy = j - g.ridge, t = bay(i, j);
    if (onEdge) return pal[0];
    if (Math.abs(dy) < 0.5) return b.ridge ? rgb(b.ridge) : pal[3];
    let idx = dy < 0 ? 2 : 1;
    if (b.roof === 'tile') { if (j % 2 === 0 || (i + (Math.floor(j / 2) % 2) * 2) % 4 === 0) idx--; } else if (b.roof === 'slate') { if (flag(i, j, 81, 3, 2).idx === 0) idx--; } else if (b.roof === 'thatch') {
      const n = vnoise(i * 0.8, j * 0.15, 82) + (t - 0.5) * 0.2;
      idx += n > 0.62 ? 1 : n < 0.3 ? -1 : 0;
    } else if (b.roof === 'stripes') return mix(i % 6 < 3 ? pal[2] : pal[3], [0, 0, 0], dy < 0 ? 0 : 0.2);
    return pal[Math.max(0, Math.min(3, idx))];
  }

  // ── Sprites (low-res, 1 art pixel = 1 canvas pixel on the art buffer) ───
  const RAW = {
    chest: { rows: ['.ooooo.', 'olllllo', 'obbybbo', 'ooyyyoo', 'obbybbo', 'odddddo', '.ooooo.'], pal: { o: '#24150a', b: '#8b5a2b', l: '#a8733a', d: '#5e3b1c', y: '#f0c848' } },
    skull: { rows: ['.www.', 'wwwww', 'wkwkw', 'wwwww', '.w.w.'], pal: { w: '#ece6d6', k: '#2a0808' } },
    coins: { rows: ['..y..', '.oyyo', 'oyyyyo', 'oooooo'], pal: { y: '#f0c848', o: '#8a6414' } },
    ladder: { rows: ['l...l', 'lllll', 'l...l', 'lllll', 'l...l', 'lllll', 'l...l'], pal: { l: '#a07c48' } },
    door: { rows: ['..sss..', '.swwws.', 'swwwwws', 'swdwdws', 'swwwkws', 'swdwdws', 'swwwwws'], pal: { s: '#8a877e', w: '#6b4524', d: '#4a2e16', k: '#e0b040' } },
    torch: { rows: ['.y.', 'fyf', '.f.', '.b.', '.b.'], pal: { y: '#fff3a8', f: '#ff9a2e', b: '#5a3a1e' } },
    shroom: { rows: ['.c.', 'ccc', '.s.'], pal: { c: '#7fe8e0', s: '#c8c0a8' } },
    rubble1: { rows: ['.oo.', 'olmo', 'ommd'], pal: { o: '#2a2926', l: '#8d8a82', m: '#6a675f', d: '#4a4843' } },
    rubble2: { rows: ['oo', 'lm'], pal: { o: '#2a2926', l: '#8d8a82', m: '#5a5852' } },
    tuft: { rows: ['h.h', 'lhl'], pal: { h: '#8fc25c', l: '#4a7f33' } },
    flower: { rows: ['y'], pal: { y: '#f0e07a' } },
  };
  const drawRaw = (ctx, name, ax, ay) => {
    const { rows, pal } = RAW[name];
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (!pal[ch]) return;
      ctx.fillStyle = pal[ch]; ctx.fillRect(ax + i - (row.length >> 1), ay - rows.length + 1 + j, 1, 1);
    }));
  };
  const drawSpr = (ctx, s, ax, ay) => { for (const [x, y, ch] of s.px) { if (!s.pal[ch]) continue; ctx.fillStyle = s.pal[ch]; ctx.fillRect(ax + x, ay + y, 1, 1); } };

  // ── Renderer ─────────────────────────────────────────────────────────────
  function render(canvas, map, themeKey, r = 30) {
    const T = THEMES[themeKey];
    const grid = [];
    for (const h of map.hexes) { (grid[h.row] = grid[h.row] || [])[h.col] = h.terrain.key; }
    const board = buildBoard(grid, r, 4);
    for (const h of map.hexes) { const b = board.at(h.col, h.row); b.key = h.terrain.key; b.content = h.content; b.buildingType = h.buildingType; }
    for (const h of board.hexes) h.walk = !BLOCKS.has(h.key);
    for (const h of board.hexes) h.edge = SOLID.has(h.key) && h.neighbors.some(n => n && n.walk);
    // Group building hexes so each building gets one continuous roof.
    for (const h of board.hexes) {
      if (h.key !== 'building' || h.group) continue;
      const g = { hexes: [], def: BUILDINGS[h.buildingType] || BUILDINGS.default }, stack = [h];
      h.group = g;
      while (stack.length) {
        const c = stack.pop(); g.hexes.push(c);
        for (const n of c.neighbors) if (n && !n.group && (n.key === 'building' || n.key === 'buildingEntrance') && n.buildingType === h.buildingType) { n.group = g; stack.push(n); }
      }
      const roofHexes = g.hexes.filter(x => x.key === 'building');
      g.ridge = Math.round(roofHexes.reduce((s, x) => s + x.y, 0) / roofHexes.length / PX);
    }

    const W = board.width, H = board.height, GW = Math.ceil(W / PX), GH = Math.ceil(H / PX);
    const cells = new Array(GW * GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) cells[j * GW + i] = board.nearest((i + 0.5) * PX, (j + 0.5) * PX);
    const G = (i, j) => (i < 0 || j < 0 || i >= GW || j >= GH ? null : cells[j * GW + i]);
    const solidAt = (i, j) => { const a = G(i, j); return !!a && SOLID.has(a.key); };

    const art = document.createElement('canvas'); art.width = GW; art.height = GH;
    const actx = art.getContext('2d');
    const img = actx.createImageData(GW, GH), d = img.data;
    const unlit = new Uint8Array(GW * GH); // stars etc. ignore the light map

    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const h = G(i, j); if (!h) continue;
      const t = bay(i, j), cx = Math.round(h.x / PX), cy = Math.round(h.y / PX);
      let c;
      // Ground style for this tile
      const ground = themeKey === 'town'
        ? ({ road: 'cobble', gate: 'cobble', buildingEntrance: 'cobble', townSquare: 'pavers', grass: 'grass', fence: 'grass' }[h.key] || 'grass')
        : T.floor;

      if (h.key === 'building') {
        const onEdge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const n = G(i + a, j + b); return !n || n.group !== h.group || n.key !== 'building'; });
        c = roofColor(h.group, i, j, onEdge);
      } else if (h.key === 'wall' && !h.edge) {
        if (T.void === 'night') { c = rgb(t > 0.5 ? '#0b1020' : '#0e1428'); if (hash2(i, j, 77) > 0.992) { c = rgb('#c9d3f0'); unlit[j * GW + i] = 1; } } else if (T.void === 'overgrowth') c = OVERGROWTH[1 + Math.min(2, Math.floor(fbm(i * 0.1, j * 0.1, 3, 9) * 2 + t))];
        else c = rgb(fbm(i * 0.1, j * 0.1, 2, 5) + t * 0.2 > 0.72 ? '#131318' : '#0a0a0d');
      } else if (h.key === 'wall') {
        c = wallTopColor(T, i, j);
        if (!solidAt(i, j - 1) || !solidAt(i - 1, j) || !solidAt(i + 1, j)) c = T.wallPal[0]; // outline where the top meets open floor
      } else if (h.key === 'chasm') {
        let k = 0; for (let kk = 1; kk <= F; kk++) { const a = G(i, j - kk); if (a && a.walk) { k = kk; break; } }
        c = k ? mix(T.facePal[2], [4, 4, 6], (k - 1) / F) : rgb(hash2(i, j, 91) > 0.985 ? '#15151c' : '#050507');
      } else if (h.key === 'water') {
        const up1 = G(i, j - 1), up2 = G(i, j - 2);
        if (up1 && up1.walk) c = T.facePal[2];
        else if (up2 && up2.walk) c = T.facePal[1];
        else if ([G(i + 1, j), G(i - 1, j), G(i, j + 1)].some(n => n && n.walk)) c = rgb('#8fb8d0');
        else c = WATER[Math.sin(j * 0.9 + fbm(i * 0.1, j * 0.1, 2, 93) * 5) > 0.85 ? 3 : 1 + Math.min(1, Math.floor(fbm(i * 0.08, j * 0.08, 3, 92) * 1.4 + t * 0.6))];
      } else {
        c = floorColor(T, i, j, ground);
        if ((h.key === 'stairsDown' || h.key === 'stairsUp') && Math.abs(i - cx) <= 5 && Math.abs(j - cy) <= 5) {
          const step = Math.floor((j - cy + 5) / 2), f = h.key === 'stairsDown' ? step / 5.5 : (5 - step) / 5.5;
          c = Math.abs(i - cx) === 5 ? rgb('#141210') : (j - cy + 5) % 2 === 0 ? mix(rgb('#a39c8c'), [0, 0, 0], f * 0.7) : mix(rgb('#5e594f'), [0, 0, 0], f * 0.85);
        }
        if (h.key === 'fence' && (j - cy === -2 || j - cy === 0 || ((i % 5 === 0) && j - cy >= -4 && j - cy <= 1))) c = rgb(i % 5 === 0 ? '#4a3018' : '#7a5632');
        if (h.key === 'gate' && Math.abs(Math.abs(i - cx) - 5) <= 1 && j - cy >= -6 && j - cy <= 1) c = rgb(j - cy === -6 ? '#a19a83' : '#6e6858');
      }
      // South faces: an open pixel just below a solid block shows that block's front wall
      if (!SOLID.has(h.key) && h.key !== 'chasm' && !(h.key === 'wall' && !h.edge)) {
        for (let k = 1; k <= F + 2; k++) {
          const a = G(i, j - k);
          if (!a) break;
          if (!SOLID.has(a.key)) continue;
          if (a.key === 'wall' && !a.edge) break;
          if (k <= F) {
            if (a.key === 'building') {
              const ent = h.key === 'buildingEntrance' && h.group === a.group ? Math.round(h.x / PX) : null;
              c = facadeColor(a.group.def, i, k, h, ent);
            } else c = faceColor(T, i, k);
          } else if (k === F + 1 || t < 0.5) c = mix(c, [0, 0, 0], 0.45); // contact shadow
          break;
        }
      }
      const o = (j * GW + i) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    actx.putImageData(img, 0, 0);

    // Decorations that receive lighting
    const lights = [], emissive = [];
    const hexes = [...board.hexes].sort((a, b) => a.y - b.y || a.x - b.x);
    const lr = r / PX;
    for (const h of hexes) {
      const rand = rng(h.seed), cx = Math.round(h.x / PX), cy = Math.round(h.y / PX);
      const spots = (n, md, margin) => scatterInHex({ x: cx, y: cy }, lr, n, md, margin, rand).map(p => [Math.round(p.x), Math.round(p.y), p.k]);
      if (h.key === 'rubble') for (const [x, y, k] of spots(4, 3, 2)) drawRaw(actx, k < 0.5 ? 'rubble1' : 'rubble2', x, y);
      if (themeKey === 'town' && h.key === 'grass') {
        for (const [x, y, k] of spots(3, 3, 2)) drawRaw(actx, k < 0.3 ? 'flower' : 'tuft', x, y);
        if (rand() < 0.14 && h.neighbors.every(n => !n || n.key === 'grass')) drawSpr(actx, sprite('tree', 3), cx, cy + 3);
      }
      if (T.void === 'overgrowth' && h.key === 'wall' && !h.edge && rand() < 0.7) for (const [x, y, k] of spots(2, 5, 3)) drawSpr(actx, sprite('tree', k < 0.5 ? 3 : 4), x, y);
      if (T.torches && h.key === 'wall' && h.edge && hash2(h.col, h.row, 5) < 0.4) {
        const tx = cx, ty = Math.round((h.y + r) / PX) + 3;
        const below = G(tx, ty);
        if (below && below.walk && !lights.some(l => Math.hypot(l.x - tx, l.y - ty) < lr * 4.5)) {
          lights.push({ x: tx, y: ty, R: lr * 4.2, p: 1.1, tint: [1.15, 0.95, 0.7] });
          emissive.push(['torch', tx, ty]);
        }
      }
      if (T.glow && h.walk && h.neighbors.some(n => n && n.key === 'wall') && hash2(h.col, h.row, 6) < 0.16) {
        const [[x, y] = [cx, cy]] = spots(1, 0, 3);
        lights.push({ x, y, R: lr * 2.4, p: 0.8, tint: [0.7, 1.1, 1.15] });
        emissive.push(['shroom', x, y]);
      }
      const marker = h.content || (['entrance', 'exit'].includes(h.key) ? h.key : null);
      if (marker === 'exit' && themeKey !== 'town') {
        lights.push({ x: cx, y: cy, R: lr * 2.2, p: 1.2, tint: [1.05, 1.02, 0.9] });
        drawRaw(actx, 'ladder', cx, cy + 3);
      }
      if (marker === 'entrance' && themeKey !== 'town') drawRaw(actx, 'door', cx, cy + 3);
    }

    // Light map: ambient + point lights, quantised to 4 levels with ordered dithering
    if (T.ambient < 1) {
      const px = actx.getImageData(0, 0, GW, GH), q = px.data;
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
        if (unlit[j * GW + i]) continue;
        let L = T.ambient, tr = 0, tg = 0, tb = 0, sum = 0;
        for (const l of lights) {
          const f = Math.max(0, 1 - Math.hypot(i - l.x, j - l.y) / l.R); if (!f) continue;
          const c = l.p * f * f; L += c; sum += c; tr += c * l.tint[0]; tg += c * l.tint[1]; tb += c * l.tint[2];
        }
        const level = Math.min(3, Math.floor(clamp01(L) * 3 + bay(i, j))) / 3;
        const b = 0.2 + 0.8 * level, w = sum ? Math.min(1, sum / L) * 0.6 : 0;
        const o = (j * GW + i) * 4;
        q[o] *= b * (1 - w + w * (sum ? tr / sum : 1));
        q[o + 1] *= b * (1 - w + w * (sum ? tg / sum : 1));
        q[o + 2] *= b * (1 - w + w * (sum ? tb / sum : 1));
      }
      actx.putImageData(px, 0, 0);
    }

    // Emissive sprites and gameplay markers stay full-bright so they read in the dark
    for (const [name, x, y] of emissive) drawRaw(actx, name, x, y);
    for (const h of hexes) {
      const cx = Math.round(h.x / PX), cy = Math.round(h.y / PX);
      if (h.content === 'chest') drawRaw(actx, 'chest', cx, cy + 3);
      if (h.content === 'loot') drawRaw(actx, 'coins', cx, cy + 2);
      if (h.content === 'encounter') {
        for (let a = 0; a < 40; a++) { const ang = (a / 40) * Math.PI * 2; if (a % 2) continue; actx.fillStyle = '#d8342a'; actx.fillRect(Math.round(cx + Math.cos(ang) * 6), Math.round(cy + 1 + Math.sin(ang) * 4), 1, 1); }
        drawRaw(actx, 'skull', cx, cy + 2);
      }
    }

    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(art, 0, 0, GW * PX, GH * PX);
  }

  /** Hand-built room that shows every interior tile key in context. */
  const SAMPLER = [
    '###########',
    '#..~~..C..#',
    '#..~~.,,.$#',
    '#.....__..#',
    '#<....__.>#',
    '#.E..M...X#',
    '###########',
  ];
  const SAMPLER_KEYS = { '#': 'wall', '.': 'floor', '~': 'water', _: 'chasm', ',': 'rubble', '<': 'stairsUp', '>': 'stairsDown', E: 'entrance', X: 'exit' };
  const SAMPLER_CONTENT = { C: 'chest', M: 'encounter', $: 'loot' };
  function samplerMap() {
    const hexes = [];
    SAMPLER.forEach((line, row) => [...line].forEach((ch, col) => hexes.push({ col, row, terrain: { key: SAMPLER_KEYS[ch] || 'floor' }, content: SAMPLER_CONTENT[ch] || null })));
    return { hexes };
  }

  window.INTERIOR_PIXEL = { render, samplerMap, THEMES };
})();
