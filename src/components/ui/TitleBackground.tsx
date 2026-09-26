import { useEffect, useRef } from 'react';
import { TerrainGenerator } from '../../terrainGenerator';
import { TownGenerator } from '../../game/TownGenerator';
import { DungeonGenerator } from '../../game/DungeonGenerator';
import { CaveGenerator } from '../../game/CaveGenerator';
import { RuinsGenerator } from '../../game/RuinsGenerator';
import { TowerGenerator } from '../../game/TowerGenerator';
import { PixelTerrainRenderer, ART_PX } from '../../utils/pixelTerrainRenderer';
import { renderInteriorFloor, type InteriorTheme } from '../../utils/pixelInteriorRenderer';
import { calculateHexPosition, sizeCanvasForDpr } from '../../utils/hexRenderer';
import { drawPixelIcon } from '../../utils/pixelIcons';

const HEX = 30; // same world hex size as the in-game canvases
const SEED = 'hexcrawler-title'; // fixed so the backdrop always looks the same
const SCENE_MS = 9000;
const FADE_MS = 2000;

/** A fully rendered map in world px, drawn once and panned across. */
type Scene = HTMLCanvasElement;

function blank(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function overworld(): Scene {
  const COLS = 44, ROWS = 32;
  const gen = new TerrainGenerator();
  gen.setSeed(SEED);
  const { grid } = gen.generate(COLS, ROWS, 0.5, 5);
  const hexes = grid.flatMap((cells, row) =>
    cells.map((cell, col) => ({ col, row, terrain: cell.terrain, poi: cell.poi as { icon?: string; name?: string } | null }))
  );
  const renderer = new PixelTerrainRenderer(hexes, HEX);
  // Crop a hex off every side so the jagged grid edge never shows
  const x0 = calculateHexPosition(1, 0, HEX).x, y0 = calculateHexPosition(0, 1, HEX).y;
  const x1 = calculateHexPosition(COLS - 2, 0, HEX).x, y1 = calculateHexPosition(0, ROWS - 2, HEX).y;
  const [c, ctx] = blank(x1 - x0, y1 - y0);
  ctx.translate(-x0, -y0);
  for (const layer of ['ground', 'sprites'] as const) {
    for (const h of hexes) {
      const tile = renderer.getTile(h.col, h.row), img = tile[layer];
      ctx.drawImage(img, tile.x, tile.y, img.width * ART_PX, img.height * ART_PX);
    }
  }
  for (const h of hexes) {
    const name = h.poi?.icon || h.poi?.name;
    if (name) {
      const { x, y } = calculateHexPosition(h.col, h.row, HEX);
      drawPixelIcon(ctx, name, x, y);
    }
  }
  return c;
}

function interior(theme: InteriorTheme, hexes: Parameters<typeof renderInteriorFloor>[0]): Scene {
  const floor = renderInteriorFloor(hexes, theme, HEX);
  const [c, ctx] = blank(floor.canvas.width * ART_PX, floor.canvas.height * ART_PX);
  ctx.drawImage(floor.canvas, 0, 0, c.width, c.height);
  return c;
}

function seeded<T extends { setSeed(s: string): void }>(gen: T, tag: string): T {
  gen.setSeed(`${SEED}:${tag}`);
  return gen;
}

// Built lazily, one per scene change, so first paint only waits for the overworld.
const BUILDERS: Array<() => Scene> = [
  overworld,
  () => interior('town', seeded(new TownGenerator(), 'town').generate(36, 30, { settlementSize: 'metropolis' }).hexes),
  () => interior('dungeon', seeded(new DungeonGenerator(), 'dungeon').generate(25, 20, 5).hexes),
  () => interior('cave', seeded(new CaveGenerator(), 'cave').generate(28, 20, 5).hexes),
  () => interior('ruins', seeded(new RuinsGenerator(), 'ruins').generate(28, 20, 5).hexes),
  () => interior('tower', seeded(new TowerGenerator(), 'tower').generate(30, 12, 5).hexes),
];

/** Full-screen pixel-art backdrop: slow pans across the world and its interiors, crossfading between them. */
function TitleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const scenes: Scene[] = [];
    const sceneAt = (i: number) => (scenes[i % BUILDERS.length] ??= BUILDERS[i % BUILDERS.length]());
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const start = performance.now();

    // Pan diagonally across the scene; direction alternates per scene.
    const draw = (ctx: CanvasRenderingContext2D, s: Scene, i: number, t: number, alpha: number, w: number, h: number) => {
      const pan = still ? 0 : Math.min(w, h) * 0.3;
      const scale = Math.max(1, (w + pan) / s.width, (h + pan) / s.height);
      const ox = s.width * scale - w, oy = s.height * scale - h;
      const dir = [[1, 1], [-1, 1], [1, -1], [-1, -1]][i % 4];
      const p = still ? 0.5 : t;
      const x = dir[0] > 0 ? ox * p : ox * (1 - p), y = dir[1] > 0 ? oy * p : oy * (1 - p);
      ctx.globalAlpha = alpha;
      ctx.drawImage(s, -x, -y, s.width * scale, s.height * scale);
    };

    const frame = (now: number) => {
      const w = window.innerWidth, h = window.innerHeight;
      if (canvas.width !== Math.round(w * devicePixelRatio) || canvas.height !== Math.round(h * devicePixelRatio)) sizeCanvasForDpr(canvas, w, h);
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#050507';
      ctx.fillRect(0, 0, w, h);

      const elapsed = Math.max(0, now - start), i = Math.floor(elapsed / SCENE_MS), into = elapsed % SCENE_MS;
      const span = SCENE_MS + FADE_MS; // each scene stays on screen through the next one's fade-in
      draw(ctx, sceneAt(i), i, (into + FADE_MS) / span, 1, w, h);
      const fade = into - (SCENE_MS - FADE_MS);
      if (fade > 0) draw(ctx, sceneAt(i + 1), i + 1, fade / span, fade / FADE_MS, w, h);
      // ponytail: builds run on the main thread (~100-300ms hitch); move to a worker if it shows.
      else if (into > 500) sceneAt(i + 1);

      if (!still) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="title-background" aria-hidden="true" />;
}

export default TitleBackground;
