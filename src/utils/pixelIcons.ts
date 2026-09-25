/**
 * Pixel-art map icons (player, POIs, interior markers) matching the 16-bit overworld
 * terrain in pixelTerrainRenderer. Sprites are ASCII rows: one char per art pixel,
 * '.' transparent. A dark 1px outline is added automatically (plus an optional
 * halo ring), then each sprite is baked once to a canvas and drawn at ART_PX scale.
 */

import { ART_PX } from './pixelTerrainRenderer';

type Palette = Record<string, string>;

const SHARED: Palette = {
  k: '#1a150c', n: '#0d0b08', h: '#f4f1e8',
  w: '#e0d2a8', W: '#a8966c', // plaster / tan
  r: '#c0582f', R: '#83371c', // roof tiles
  t: '#d4ae55', T: '#94702c', // thatch
  s: '#b4b3bb', S: '#7f7e89', d: '#57565f', // stone
  b: '#8a5a2e', B: '#5a3a1c', // wood
  y: '#f2cb4c', Y: '#fff1a0', // gold / light
  g: '#5e9a3a', G: '#3b6a26', // leaves / moss
  c: '#e2d3a8', C: '#a88f5e', // tent canvas
  o: '#ff8a1e', // flame
  a: '#6fd0f0', A: '#e8fbff', // arcane
  e: '#d8dde3', m: '#8a929c', // steel
  x: '#c0392b', X: '#7a1f16', // red
  p: '#a86ae0', P: '#5a2a8a', // violet
  u: '#3b6fd0', // blue
};
const OUTLINE = '#1a150c';

interface Art {
  rows: string[];
  pal?: Palette;
  halo?: string;
}

// ── Overworld POIs ──────────────────────────────────────────────────────────
const HOUSE = [
  '.....R.....',
  '....rRR....',
  '...rrRRR...',
  '..rrrRRRR..',
  '.rrrrRRRRR.',
  'rrrrrRRRRRR',
  '.wwwwwwWWW.',
  '.wyywwwWnW.',
  '.wyywwwWnW.',
  '.wwwwwwWnW.',
];
const CITY = [
  '....s.s.s....',
  '....sssss....',
  's.s.ssyss.s.s',
  'sss.sssSs.sss',
  'sSs.sssSs.sSs',
  'sSsssssSsssSs',
  'sSsysssSsysSs',
  'sSsssnnnsssSs',
  'sSsssnnnsssSs',
];
const CHEST = [
  '.bbbbbbb.',
  'bbbbbbbbb',
  'yyyyYyyyy',
  'bbbbybbbb',
  'bbbbbbbbb',
  'BBBBBBBBB',
];

const ICONS: Record<string, Art> = {
  Settlement: { rows: HOUSE },
  Town: { rows: HOUSE },
  Village: {
    rows: [
      '..tT.........',
      '.ttTT........',
      'tttTTT...tT..',
      '.wwWW...ttTT.',
      '.wnWW..tttTTT',
      '.wnWW...wwWW.',
      '........wnWW.',
    ],
  },
  City: { rows: CITY },
  Metropolis: {
    rows: [
      '.......y.......',
      '......yyy......',
      '.x...yyyyy...x.',
      '.b..sssssss..b.',
      's.s.sssssSs.s.s',
      'sss.ssysysS.sss',
      'sSs.sssssSs.sSs',
      'sSsssssssSsssSs',
      'sSsysssssSsysSs',
      'sSssssnnnSsssSs',
      'sSssssnnnSsssSs',
    ],
  },
  Dungeon: {
    rows: [
      's.s.s.s.s',
      'sssssssss',
      'ssSsssSSs',
      'sssnnnsSs',
      'ssnnnnnSs',
      'ssnnnnnSs',
      'ssnnnnnSs',
    ],
  },
  Ruins: {
    rows: [
      '.s.......s...',
      '.sg......S...',
      '.ss....s.s...',
      '.ss..s.s.ss..',
      '.Ss..ssssSs..',
      'gss.dsSs.sSg.',
      'ssssddssdsss.',
    ],
  },
  Tower: {
    rows: [
      '...R...',
      '..rRR..',
      '.rrRRR.',
      'rrrRRRR',
      '.ssSSs.',
      '.sysSs.',
      '.ssSSs.',
      '.ssSSs.',
      '.sysSs.',
      '.ssSSs.',
      '.snnSs.',
      '.snnSs.',
    ],
  },
  Cave: {
    rows: [
      '....sssss....',
      '..sssssSSSs..',
      '.sssnnnnSSSS.',
      'sssnnnnnnSSSS',
      'ssnnnnnnnnSSS',
      'ssnnnnnnnnSSS',
      'ddddddddddddd',
    ],
  },
  Shrine: {
    rows: [
      '....a....',
      '...aAa...',
      '...aAa...',
      '....a....',
      '.sssssss.',
      '..sSSSs..',
      '..sSSSs..',
      '.sssssss.',
    ],
  },
  Camp: {
    rows: [
      '....c......',
      '...cCC.....',
      '..ccCCC....',
      '.cccnCCC...',
      'cccnnnCCC.o',
      'cccnnnCCCoY',
      '.........bb',
    ],
  },
  Cache: { rows: CHEST },
  star: { rows: ['..y..', '.yyy.', 'yyyyy', '.yyy.', '.y.y.'] },

  // ── Interior markers ──────────────────────────────────────────────────────
  entrance: {
    rows: ['.bbbbb.', 'bbBbBbb', 'bbBbBbb', 'bbBbBbb', 'bbBbByb', 'bbBbBbb', 'bbBbBbb', 'bbbbbbb'],
  },
  exit: {
    rows: ['b.....b', 'bbbbbbb', 'b.....b', 'b.....b', 'bbbbbbb', 'b.....b', 'b.....b', 'bbbbbbb', 'b.....b'],
  },
  stairsUp: {
    rows: ['..y........', '.yyy.......', 'yyyyy....ww', '..y.....wWW', '..y...wwWWW', '....wwWWWWW', '..wwWWWWWWW'],
  },
  stairsDown: {
    rows: ['..y........', '..y........', 'yyyyy....ww', '.yyy....wWW', '..y...wwWWW', '....wwWWWWW', '..wwWWWWWWW'],
  },
  chest: { rows: CHEST, halo: '#f39c12' },
  chestOpened: { rows: CHEST, pal: { b: '#666', B: '#444', y: '#888', Y: '#999' } },
  hazard: { rows: ['....o....', '...ooo...', '...oko...', '..ookoo..', '..ookoo..', '.ooooooo.', '.oookooo.', 'ooooooooo'] },
  hazardTriggered: {
    rows: ['....o....', '...ooo...', '...oko...', '..ookoo..', '..ookoo..', '.ooooooo.', '.oookooo.', 'ooooooooo'],
    pal: { o: '#777' },
  },
};

// ── UI icons (HTML, via <PixelIcon>) ────────────────────────────────────────
Object.assign(ICONS, {
  action: { rows: ['ee.....ee', 'eee...eee', '.eee.eee.', '..eeeee..', '...eee...', '..yeeey..', '.yb...by.', 'bb.....bb', 'b.......b'] },
  bonus: { rows: ['....Y....', '....y....', '...yYy...', '.yyYYYyy.', 'YyYYYYYyY', '.yyYYYyy.', '...yYy...', '....y....', '....Y....'] },
  move: { rows: ['..bbb...', '..bbb...', '..bbb...', '..bbB...', '..bbbbb.', '.bbbbbbb', 'BBBBBBBB'] },
  object: { rows: ['...bb...', '...ee...', '..e..e..', '.exxxxe.', '.exXxxe.', '.exxxxe.', '..eeee..'] },
  lock: { rows: ['..mmm..', '.m...m.', '.m...m.', 'yyyyyyy', 'yyykyyy', 'yyykyyy', 'yyyyyyy'] },
  coins: { rows: ['..yyy..', '.yYyyT.', '.yyyyT.', 'yyyTTT.', 'yYyyT..', 'yyyyT..', '.TTT...'] },
  gift: { rows: ['.x...x.', '..x.x..', '...y...', 'xxxyxxx', 'xxxyxxx', 'XXXyXXX', 'XXXyXXX'] },
  bolt: { rows: ['....yy', '...yy.', '..yy..', '.yyyyy', '...yy.', '..yy..', '.yy...', 'yy....'] },
  disk: { rows: ['uuuuuu.', 'uhhhhuu', 'uhhhhuu', 'uuuuuuu', 'uueeeuu', 'uuekeuu', 'uueeeuu'] },
  pin: { rows: ['.xxx.', 'xxhxx', 'xxxxx', '.xxx.', '.xxx.', '..x..'] },
  bulb: { rows: ['.yyy.', 'yYYyy', 'yYyyy', 'yyyyy', '.yyy.', '.mmm.', '..m..'] },
});

const ENEMY = [
  '.x.....x.',
  '.xx...xx.',
  '..xxxxx..',
  '.xxxxxxx.',
  '.xYxxxYx.',
  '.xxxxxxx.',
  '..xkkkx..',
  '..xxxxx..',
  '.xx...xx.',
];
ICONS.enemy = { rows: ENEMY, pal: { Y: '#ffb0a0' } };
ICONS.enemyBoss = { rows: ['..y.y.y..', '..yyyyy..', ...ENEMY], pal: { x: '#8a3fd0', X: '#4a1a7a', Y: '#e8c8ff' } };
ICONS.enemyDefeated = { rows: ENEMY, pal: { x: '#666', Y: '#333', k: '#444' } };

// ── Player (per class) ──────────────────────────────────────────────────────
// Head sits above the 7-wide body; items are placed on an 11-wide grid (body at cols 2..8,
// hands at cols 2 and 8) with `dy` relative to the body's top row.
const HEADS: Record<string, string[]> = {
  hair: ['..HHH..', '.HHHHH.', '.HkfkH.', '.HfffH.', '..fff..'],
  bald: ['..fff..', '.fffff.', '.fkfkf.', '.fffff.', '..fff..'],
  helm: ['...H...', '..eee..', '.eeeee.', '.mkfkm.', '..fff..'],
  hood: ['..HHH..', '.HHHHH.', 'HHkfkHH', 'HHfffHH', '.HHfHH.'],
  hat: ['....H..', '...HH..', '..HHH..', '.HHyHH.', 'HHHHHHH', '..kfk..', '..fff..'],
};
const BODY = ['.CCCCc.', 'fCCCCcf', 'fCCCCcf', '.zzzzz.', '.CCCCc.', '.LL.LL.', '.LL.LL.'];

interface Item {
  rows: string[];
  x: number;
  dy: number;
}
const ITEMS: Record<string, Item> = {
  sword: { rows: ['.e.', '.e.', '.e.', '.e.', 'yyy', '.b.'], x: 8, dy: -3 },
  axe: { rows: ['.ee', 'bee', 'be.', 'b..', 'b..'], x: 9, dy: -2 },
  staff: { rows: ['.a.', 'aAa', '.a.', '.b.', '.b.', '.b.', '.b.', '.b.', '.b.'], x: 8, dy: -3 },
  leafstaff: { rows: ['g.g', '.g.', 'gbg', '.b.', '.b.', '.b.', '.b.', '.b.', '.b.'], x: 8, dy: -3 },
  mace: { rows: ['.m.', 'mem', '.m.', '.b.', '.b.'], x: 8, dy: -2 },
  dagger: { rows: ['.e.', '.e.', '.y.', '.b.'], x: 8, dy: -1 },
  orb: { rows: ['.p.', 'pAp', '.p.'], x: 8, dy: 0 },
  flame: { rows: ['..o', '.oY', 'oYo', '.o.'], x: 8, dy: -1 },
  bow: { rows: ['.bh', 'b.h', 'b.h', 'b.h', '.bh'], x: -1, dy: -1 },
  shield: { rows: ['uuu', 'uyu', 'uyu', '.u.'], x: -1, dy: 1 },
  lute: { rows: ['b..', '.b.', '.yy', 'yyy', '.y.'], x: -1, dy: 0 },
};

interface Kit {
  head: keyof typeof HEADS;
  pal: Palette; // H head, C/c tunic light/shade, L legs, z belt
  items: string[];
}
const SKIN = '#f0c8a0';
const KITS: Record<string, Kit> = {
  fighter: { head: 'helm', pal: { H: '#c0392b', C: '#b33a2e', c: '#7e2219', L: '#5a4632', z: '#3a2a1a' }, items: ['sword'] },
  paladin: { head: 'helm', pal: { H: '#3b6fd0', C: '#c8ccd4', c: '#8e949e', L: '#6a6f78', z: '#d4a82a' }, items: ['sword', 'shield'] },
  wizard: { head: 'hat', pal: { H: '#3b5fc0', C: '#3b5fc0', c: '#243c85', L: '#243c85', z: '#d4a82a' }, items: ['staff'] },
  cleric: { head: 'hood', pal: { H: '#e8e2cf', C: '#e8e2cf', c: '#b0a88e', L: '#7a6a4a', z: '#d4a82a' }, items: ['mace'] },
  rogue: { head: 'hood', pal: { H: '#3a3a44', C: '#4a4a55', c: '#2c2c34', L: '#2c2c34', z: '#6b4424' }, items: ['dagger'] },
  ranger: { head: 'hood', pal: { H: '#3f7a3a', C: '#4f7a3a', c: '#2f5226', L: '#5a4632', z: '#6b4424' }, items: ['bow'] },
  barbarian: { head: 'hair', pal: { H: '#c0502a', C: '#8a5a2e', c: '#5a3a1c', L: '#5a4632', z: '#3a2a1a' }, items: ['axe'] },
  druid: { head: 'hood', pal: { H: '#6b8a3a', C: '#6b5a3a', c: '#4a3e28', L: '#4a3e28', z: '#5e9a3a' }, items: ['leafstaff'] },
  bard: { head: 'hair', pal: { H: '#6b4424', C: '#8a3fa0', c: '#5a2a6a', L: '#3a2a4a', z: '#d4a82a' }, items: ['lute'] },
  sorcerer: { head: 'hair', pal: { H: '#e8e8f0', C: '#c0402a', c: '#842a1c', L: '#3a2a2a', z: '#d4a82a' }, items: ['flame'] },
  warlock: { head: 'hood', pal: { H: '#2a1a3a', C: '#3a2350', c: '#221433', L: '#221433', z: '#7a4fb0' }, items: ['orb'] },
  monk: { head: 'bald', pal: { C: '#d9822b', c: '#a35a18', L: '#a35a18', z: '#6b4424' }, items: [] },
};
const DEFAULT_KIT: Kit = { head: 'hair', pal: { H: '#6b4424', C: '#7a6a4a', c: '#54482f', L: '#3a2a1a', z: '#3a2a1a' }, items: [] };

type PixelMap = Map<string, string>; // "x,y" -> palette char

function stamp(px: PixelMap, rows: string[], ox: number, oy: number): void {
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') px.set(`${ox + i},${oy + j}`, ch); }));
}

function playerArt(cls: string): Art {
  const kit = KITS[cls] ?? DEFAULT_KIT;
  const head = HEADS[kit.head], px: PixelMap = new Map();
  stamp(px, head, 2, 0);
  stamp(px, BODY, 2, head.length);
  for (const name of kit.items) {
    const it = ITEMS[name];
    stamp(px, it.rows, it.x, head.length + it.dy);
  }
  return { rows: toRows(px), pal: { f: SKIN, ...kit.pal }, halo: '#f4f1e8' };
}

function toRows(px: PixelMap): string[] {
  const pts = [...px.keys()].map(k => k.split(',').map(Number));
  const x0 = Math.min(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1]));
  const x1 = Math.max(...pts.map(p => p[0])), y1 = Math.max(...pts.map(p => p[1]));
  const rows: string[] = [];
  for (let y = y0; y <= y1; y++) {
    let row = '';
    for (let x = x0; x <= x1; x++) row += px.get(`${x},${y}`) ?? '.';
    rows.push(row);
  }
  return rows;
}

/** Bake art to a canvas: fill, then a dark outline ring, then an optional halo ring. */
function bake({ rows, pal = {}, halo }: Art): HTMLCanvasElement {
  const colors = { ...SHARED, ...pal };
  const ring = halo ? 2 : 1;
  const w = Math.max(...rows.map(r => r.length)) + ring * 2, h = rows.length + ring * 2;
  const fill = new Map<string, string>();
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') fill.set(`${i + ring},${j + ring}`, colors[ch] ?? OUTLINE); }));
  const grow = (color: string) => {
    for (const k of [...fill.keys()]) {
      const [x, y] = k.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = `${x + dx},${y + dy}`;
        if (!fill.has(nk)) fill.set(nk, color);
      }
    }
  };
  grow(OUTLINE);
  if (halo) grow(halo);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  for (const [k, color] of fill) {
    const [x, y] = k.split(',').map(Number);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }
  return canvas;
}

const baked = new Map<string, HTMLCanvasElement | null>();
function getSprite(name: string): HTMLCanvasElement | null {
  if (!baked.has(name)) {
    const art = name.startsWith('player:') ? playerArt(name.slice(7)) : ICONS[name];
    baked.set(name, art ? bake(art) : null);
  }
  return baked.get(name) ?? null;
}

/** A baked sprite as an image URL plus its art-pixel size, for HTML UI (see PixelIcon). */
export function pixelIconImage(name: string): { url: string; w: number; h: number } | null {
  const img = getSprite(name);
  return img ? { url: img.toDataURL(), w: img.width, h: img.height } : null;
}

/** Draw a named icon centred on (x, y), snapped to the world art-pixel grid. Returns false if unknown. */
export function drawPixelIcon(ctx: CanvasRenderingContext2D, name: string, x: number, y: number): boolean {
  const img = getSprite(name);
  if (!img) return false;
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  const left = Math.round(x / ART_PX - img.width / 2) * ART_PX;
  const top = Math.round(y / ART_PX - img.height / 2) * ART_PX;
  ctx.drawImage(img, left, top, img.width * ART_PX, img.height * ART_PX);
  ctx.imageSmoothingEnabled = smoothing;
  return true;
}

/** The party leader, dressed and armed for their class. */
export function drawPixelPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, playerClass?: string): void {
  drawPixelIcon(ctx, `player:${playerClass ?? ''}`, x, y);
}

/** A pixel ellipse under a token's feet (turn / rage indicator). */
export function drawPixelRing(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  const cx = Math.round(x / ART_PX), cy = Math.round(y / ART_PX) + 7;
  const seen = new Set<string>();
  ctx.fillStyle = color;
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    const i = Math.round(cx + Math.cos(t) * 8), j = Math.round(cy + Math.sin(t) * 3);
    if (seen.has(`${i},${j}`)) continue;
    seen.add(`${i},${j}`);
    ctx.fillRect(i * ART_PX, j * ART_PX, ART_PX, ART_PX);
  }
}

/** Chunky HP bar: dark frame, 2 art px tall, snapped to the art grid. */
export function drawPixelBar(ctx: CanvasRenderingContext2D, x: number, y: number, pct: number): void {
  const w = 14, left = Math.round(x / ART_PX) - w / 2, top = Math.round(y / ART_PX);
  const fill = Math.round(w * Math.max(0, Math.min(1, pct)));
  ctx.fillStyle = OUTLINE;
  ctx.fillRect((left - 1) * ART_PX, (top - 1) * ART_PX, (w + 2) * ART_PX, 4 * ART_PX);
  ctx.fillStyle = '#3a2f22';
  ctx.fillRect(left * ART_PX, top * ART_PX, w * ART_PX, 2 * ART_PX);
  ctx.fillStyle = pct < 0.3 ? '#d8342a' : pct < 0.6 ? '#f2cb4c' : '#5ec23a';
  ctx.fillRect(left * ART_PX, top * ART_PX, fill * ART_PX, 2 * ART_PX);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; // top highlight row
  ctx.fillRect(left * ART_PX, top * ART_PX, fill * ART_PX, ART_PX / 2);
}
