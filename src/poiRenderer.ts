/**
 * POI Icon Renderer — Old School RuneScape map-icon style.
 *
 * Every POI is drawn as a small parchment plate (tan square, dark brown
 * border) with a flat-shaded, black-outlined glyph on top — the way OSRS
 * marks banks, dungeons and quest starts on the world map.
 */

type DrawFn = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => void;

interface POIMarker {
  icon?: string;
  name?: string;
}

const OUTLINE = '#2a2014';
const PLATE_FILL = '#e8dbb4';
const PLATE_BORDER = '#3f3527';

export class POIRenderer {
  iconDrawers: Record<string, DrawFn>;

  constructor() {
    // Icon drawing functions for each POI type
    this.iconDrawers = {
      Dungeon: this.drawDungeon.bind(this),
      Settlement: this.drawSettlement.bind(this),
      Town: this.drawSettlement.bind(this),
      Village: this.drawVillage.bind(this),
      City: this.drawCity.bind(this),
      Metropolis: this.drawMetropolis.bind(this),
      Ruins: this.drawRuins.bind(this),
      Tower: this.drawTower.bind(this),
      Cave: this.drawCave.bind(this),
      Shrine: this.drawShrine.bind(this),
      Camp: this.drawCamp.bind(this),
    };
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, poi: POIMarker): void {
    const iconKey = poi.icon || poi.name;
    if (!iconKey) return;

    const drawer = this.iconDrawers[iconKey];
    if (drawer) {
      ctx.save();
      this.drawPlate(ctx, x, y, size);
      drawer(ctx, x, y, size * 0.7);
      ctx.restore();
    }
  }

  /** The parchment square every map icon sits on. */
  private drawPlate(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const half = size * 0.6;
    const r = 2;

    ctx.beginPath();
    ctx.roundRect(x - half, y - half, half * 2, half * 2, r);
    ctx.fillStyle = PLATE_FILL;
    ctx.fill();
    ctx.strokeStyle = PLATE_BORDER;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Worn top-edge highlight
    ctx.strokeStyle = 'rgba(255, 250, 230, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - half + 2, y - half + 1.5);
    ctx.lineTo(x + half - 2, y - half + 1.5);
    ctx.stroke();
  }

  private prep(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
  }

  drawDungeon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const s = size * 0.9;
    this.prep(ctx);
    // Grey gatehouse with crenellations
    ctx.fillStyle = '#757079';
    ctx.fillRect(x - s * 0.4, y - s * 0.2, s * 0.8, s * 0.6);
    ctx.fillRect(x - s * 0.5, y - s * 0.5, s * 0.25, s * 0.3);
    ctx.fillRect(x - s * 0.125, y - s * 0.5, s * 0.25, s * 0.3);
    ctx.fillRect(x + s * 0.25, y - s * 0.5, s * 0.25, s * 0.3);
    ctx.strokeRect(x - s * 0.4, y - s * 0.2, s * 0.8, s * 0.6);
    // Black doorway
    ctx.fillStyle = '#0d0b08';
    ctx.fillRect(x - s * 0.15, y + s * 0.05, s * 0.3, s * 0.35);
  }

  drawSettlement(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const s = size * 0.95;
    this.prep(ctx);
    // Single house: tan walls, rust-brown roof — the classic map house
    ctx.fillStyle = '#cdbb92';
    ctx.fillRect(x - s * 0.35, y - s * 0.05, s * 0.7, s * 0.45);
    ctx.strokeRect(x - s * 0.35, y - s * 0.05, s * 0.7, s * 0.45);
    ctx.fillStyle = '#8a4f2c';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.45, y - s * 0.05);
    ctx.lineTo(x, y - s * 0.45);
    ctx.lineTo(x + s * 0.45, y - s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Door
    ctx.fillStyle = '#5a3c20';
    ctx.fillRect(x - s * 0.08, y + s * 0.12, s * 0.16, s * 0.28);
  }

  drawVillage(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const s = size * 0.95;
    this.prep(ctx);
    // Two small huts
    for (const dx of [-s * 0.25, s * 0.25]) {
      ctx.fillStyle = '#cdbb92';
      ctx.fillRect(x + dx - s * 0.18, y + s * 0.02, s * 0.36, s * 0.32);
      ctx.strokeRect(x + dx - s * 0.18, y + s * 0.02, s * 0.36, s * 0.32);
      ctx.fillStyle = '#8a6b3c'; // thatch
      ctx.beginPath();
      ctx.moveTo(x + dx - s * 0.25, y + s * 0.02);
      ctx.lineTo(x + dx, y - s * 0.25);
      ctx.lineTo(x + dx + s * 0.25, y + s * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  drawCity(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const s = size * 0.95;
    this.prep(ctx);
    // Stone keep flanked by two towers
    ctx.fillStyle = '#8c8c94';
    ctx.fillRect(x - s * 0.45, y - s * 0.25, s * 0.22, s * 0.65);
    ctx.strokeRect(x - s * 0.45, y - s * 0.25, s * 0.22, s * 0.65);
    ctx.fillRect(x + s * 0.23, y - s * 0.25, s * 0.22, s * 0.65);
    ctx.strokeRect(x + s * 0.23, y - s * 0.25, s * 0.22, s * 0.65);
    ctx.fillRect(x - s * 0.2, y - s * 0.45, s * 0.4, s * 0.85);
    ctx.strokeRect(x - s * 0.2, y - s * 0.45, s * 0.4, s * 0.85);
    // Gold windows
    ctx.fillStyle = '#e8c04a';
    ctx.fillRect(x - s * 0.06, y - s * 0.3, s * 0.12, s * 0.12);
    ctx.fillRect(x - s * 0.06, y - s * 0.08, s * 0.12, s * 0.12);
  }

  drawMetropolis(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const s = size * 0.95;
    this.prep(ctx);
    // Grand castle: wide wall, tall keep, gold-tipped banner
    ctx.fillStyle = '#8c8c94';
    ctx.fillRect(x - s * 0.5, y, s, s * 0.4);
    ctx.strokeRect(x - s * 0.5, y, s, s * 0.4);
    ctx.fillRect(x - s * 0.18, y - s * 0.5, s * 0.36, s * 0.9);
    ctx.strokeRect(x - s * 0.18, y - s * 0.5, s * 0.36, s * 0.9);
    // Crenellations on the keep
    ctx.fillRect(x - s * 0.22, y - s * 0.6, s * 0.12, s * 0.12);
    ctx.fillRect(x - s * 0.06, y - s * 0.6, s * 0.12, s * 0.12);
    ctx.fillRect(x + s * 0.1, y - s * 0.6, s * 0.12, s * 0.12);
    // Banner
    ctx.strokeStyle = OUTLINE;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.6);
    ctx.lineTo(x, y - s * 0.85);
    ctx.stroke();
    ctx.fillStyle = '#e8c04a';
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.85);
    ctx.lineTo(x + s * 0.22, y - s * 0.78);
    ctx.lineTo(x, y - s * 0.71);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Gold gate
    ctx.fillStyle = '#e8c04a';
    ctx.fillRect(x - s * 0.07, y + s * 0.16, s * 0.14, s * 0.24);
  }

  drawRuins(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const s = size * 0.95;
    this.prep(ctx);
    ctx.fillStyle = '#a09a8c';
    // Standing pillars of varying height
    ctx.fillRect(x - s * 0.42, y - s * 0.15, s * 0.18, s * 0.55);
    ctx.strokeRect(x - s * 0.42, y - s * 0.15, s * 0.18, s * 0.55);
    ctx.fillRect(x - s * 0.08, y + s * 0.05, s * 0.18, s * 0.35);
    ctx.strokeRect(x - s * 0.08, y + s * 0.05, s * 0.18, s * 0.35);
    ctx.fillRect(x + s * 0.26, y - s * 0.05, s * 0.18, s * 0.45);
    ctx.strokeRect(x + s * 0.26, y - s * 0.05, s * 0.18, s * 0.45);
    // Fallen slab
    ctx.save();
    ctx.translate(x + s * 0.05, y + s * 0.38);
    ctx.rotate(Math.PI / 9);
    ctx.fillRect(-s * 0.18, -s * 0.05, s * 0.36, s * 0.1);
    ctx.strokeRect(-s * 0.18, -s * 0.05, s * 0.36, s * 0.1);
    ctx.restore();
  }

  drawTower(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const s = size * 0.95;
    this.prep(ctx);
    // Wizard's tower: grey shaft, violet-blue cone roof, gold window
    ctx.fillStyle = '#7d7d88';
    ctx.fillRect(x - s * 0.22, y - s * 0.3, s * 0.44, s * 0.7);
    ctx.strokeRect(x - s * 0.22, y - s * 0.3, s * 0.44, s * 0.7);
    ctx.fillStyle = '#5a5a9c';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.32, y - s * 0.3);
    ctx.lineTo(x, y - s * 0.62);
    ctx.lineTo(x + s * 0.32, y - s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e8c04a';
    ctx.fillRect(x - s * 0.08, y - s * 0.12, s * 0.16, s * 0.16);
  }

  drawCave(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const s = size * 0.95;
    this.prep(ctx);
    // Rock mound with a black mouth
    ctx.fillStyle = '#7a7468';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y + s * 0.35);
    ctx.lineTo(x - s * 0.35, y - s * 0.15);
    ctx.lineTo(x - s * 0.1, y - s * 0.38);
    ctx.lineTo(x + s * 0.25, y - s * 0.28);
    ctx.lineTo(x + s * 0.5, y + s * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0d0b08';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.2, y + s * 0.35);
    ctx.lineTo(x - s * 0.12, y - s * 0.05);
    ctx.lineTo(x + s * 0.12, y - s * 0.05);
    ctx.lineTo(x + s * 0.2, y + s * 0.35);
    ctx.closePath();
    ctx.fill();
  }

  drawShrine(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const s = size * 0.95;
    this.prep(ctx);
    // Stone altar with a gold star above it
    ctx.fillStyle = '#8c8c94';
    ctx.fillRect(x - s * 0.3, y + s * 0.05, s * 0.6, s * 0.18);
    ctx.strokeRect(x - s * 0.3, y + s * 0.05, s * 0.6, s * 0.18);
    ctx.fillRect(x - s * 0.2, y + s * 0.23, s * 0.4, s * 0.18);
    ctx.strokeRect(x - s * 0.2, y + s * 0.23, s * 0.4, s * 0.18);
    // Gold star
    ctx.fillStyle = '#e8c04a';
    ctx.beginPath();
    const starY = y - s * 0.18;
    const outer = s * 0.24;
    const inner = s * 0.1;
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const ox = x + Math.cos(a) * outer;
      const oy = starY + Math.sin(a) * outer;
      if (i === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
      const ia = a + Math.PI / 5;
      ctx.lineTo(x + Math.cos(ia) * inner, starY + Math.sin(ia) * inner);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawCamp(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const s = size * 0.95;
    this.prep(ctx);
    // Canvas tent
    ctx.fillStyle = '#c2a36b';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.42, y + s * 0.35);
    ctx.lineTo(x - s * 0.02, y - s * 0.3);
    ctx.lineTo(x + s * 0.38, y + s * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Tent opening
    ctx.fillStyle = '#4a3a22';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.16, y + s * 0.35);
    ctx.lineTo(x - s * 0.02, y + s * 0.05);
    ctx.lineTo(x + s * 0.12, y + s * 0.35);
    ctx.closePath();
    ctx.fill();
    // Campfire: logs + orange flame
    ctx.strokeStyle = '#5a3c20';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.52, y + s * 0.42);
    ctx.lineTo(x - s * 0.32, y + s * 0.36);
    ctx.moveTo(x - s * 0.52, y + s * 0.36);
    ctx.lineTo(x - s * 0.32, y + s * 0.42);
    ctx.stroke();
    ctx.fillStyle = '#e07820';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.48, y + s * 0.36);
    ctx.lineTo(x - s * 0.42, y + s * 0.18);
    ctx.lineTo(x - s * 0.36, y + s * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f0c040';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.46, y + s * 0.36);
    ctx.lineTo(x - s * 0.42, y + s * 0.26);
    ctx.lineTo(x - s * 0.38, y + s * 0.36);
    ctx.closePath();
    ctx.fill();
  }
}
