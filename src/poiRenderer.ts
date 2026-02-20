// @ts-nocheck
// TODO: Add proper types
/**
 * POI Icon Renderer
 * Draws custom icons for points of interest on the hex map
 */

export class POIRenderer {
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

  draw(ctx, x, y, size, poi) {
    const iconKey = poi.icon || poi.name;
    if (!iconKey) return;

    const drawer = this.iconDrawers[iconKey];
    if (drawer) {
      ctx.save();
      drawer(ctx, x, y, size);
      ctx.restore();
    }
  }

  drawDungeon(ctx, x, y, size) {
    const s = size * 0.9;
    ctx.fillStyle = '#2c3e50';
    ctx.strokeStyle = '#1a252f';
    ctx.lineWidth = 2;
    ctx.fillRect(x - s * 0.4, y - s * 0.2, s * 0.8, s * 0.6);
    ctx.fillRect(x - s * 0.5, y - s * 0.5, s * 0.25, s * 0.3);
    ctx.fillRect(x - s * 0.125, y - s * 0.5, s * 0.25, s * 0.3);
    ctx.fillRect(x + s * 0.25, y - s * 0.5, s * 0.25, s * 0.3);
    ctx.fillStyle = '#000';
    ctx.fillRect(x - s * 0.15, y + s * 0.1, s * 0.3, s * 0.3);
    ctx.strokeRect(x - s * 0.4, y - s * 0.2, s * 0.8, s * 0.6);
  }

  drawSettlement(ctx, x, y, size) {
    const s = size * 0.9;
    ctx.fillStyle = '#8B4513';
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y);
    ctx.lineTo(x - s * 0.5, y + s * 0.4);
    ctx.lineTo(x - s * 0.1, y + s * 0.4);
    ctx.lineTo(x - s * 0.1, y);
    ctx.lineTo(x - s * 0.3, y - s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s * 0.1, y + s * 0.1);
    ctx.lineTo(x + s * 0.1, y + s * 0.4);
    ctx.lineTo(x + s * 0.5, y + s * 0.4);
    ctx.lineTo(x + s * 0.5, y + s * 0.1);
    ctx.lineTo(x + s * 0.3, y - s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawRuins(ctx, x, y, size) {
    const s = size * 0.9;
    ctx.fillStyle = '#95a5a6';
    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x - s * 0.4, y - s * 0.1, s * 0.2, s * 0.5);
    ctx.strokeRect(x - s * 0.4, y - s * 0.1, s * 0.2, s * 0.5);
    ctx.fillRect(x - s * 0.05, y + s * 0.1, s * 0.2, s * 0.3);
    ctx.strokeRect(x - s * 0.05, y + s * 0.1, s * 0.2, s * 0.3);
    ctx.fillRect(x + s * 0.25, y, s * 0.2, s * 0.4);
    ctx.strokeRect(x + s * 0.25, y, s * 0.2, s * 0.4);
    ctx.save();
    ctx.translate(x + s * 0.1, y + s * 0.4);
    ctx.rotate(Math.PI / 6);
    ctx.fillRect(-s * 0.15, -s * 0.05, s * 0.3, s * 0.1);
    ctx.restore();
  }

  drawTower(ctx, x, y, size) {
    const s = size * 0.9;
    ctx.fillStyle = '#34495e';
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2;
    ctx.fillRect(x - s * 0.25, y - s * 0.4, s * 0.5, s * 0.8);
    ctx.strokeRect(x - s * 0.25, y - s * 0.4, s * 0.5, s * 0.8);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.35, y - s * 0.4);
    ctx.lineTo(x, y - s * 0.6);
    ctx.lineTo(x + s * 0.35, y - s * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(x - s * 0.1, y - s * 0.15, s * 0.2, s * 0.15);
  }

  drawCave(ctx, x, y, size) {
    const s = size * 0.9;
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.5, s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a252f';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#7f8c8d';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.6, y - s * 0.2);
    ctx.lineTo(x - s * 0.3, y - s * 0.5);
    ctx.lineTo(x + s * 0.3, y - s * 0.5);
    ctx.lineTo(x + s * 0.6, y - s * 0.2);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawShrine(ctx, x, y, size) {
    const s = size * 0.9;
    ctx.fillStyle = '#e74c3c';
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x - s * 0.4, y + s * 0.2, s * 0.8, s * 0.2);
    ctx.fillRect(x - s * 0.35, y - s * 0.2, s * 0.15, s * 0.4);
    ctx.fillRect(x + s * 0.2, y - s * 0.2, s * 0.15, s * 0.4);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y - s * 0.2);
    ctx.lineTo(x, y - s * 0.5);
    ctx.lineTo(x + s * 0.5, y - s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(x - s * 0.55, y - s * 0.3, s * 1.1, s * 0.1);
  }

  drawCamp(ctx, x, y, size) {
    const s = size * 0.9;
    ctx.fillStyle = '#8B7355';
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y + s * 0.4);
    ctx.lineTo(x, y - s * 0.3);
    ctx.lineTo(x + s * 0.5, y + s * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#654321';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.2, y + s * 0.4);
    ctx.lineTo(x, y + s * 0.1);
    ctx.lineTo(x + s * 0.2, y + s * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.6, y + s * 0.5);
    ctx.lineTo(x - s * 0.5, y + s * 0.35);
    ctx.lineTo(x - s * 0.4, y + s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.55, y + s * 0.5);
    ctx.lineTo(x - s * 0.5, y + s * 0.4);
    ctx.lineTo(x - s * 0.45, y + s * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  drawVillage(ctx, x, y, size) {
    const s = size * 0.9;
    ctx.fillStyle = '#A0826D';
    ctx.strokeStyle = '#7D6651';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.45, y + s * 0.1);
    ctx.lineTo(x - s * 0.45, y + s * 0.4);
    ctx.lineTo(x - s * 0.15, y + s * 0.4);
    ctx.lineTo(x - s * 0.15, y + s * 0.1);
    ctx.lineTo(x - s * 0.3, y - s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s * 0.15, y + s * 0.1);
    ctx.lineTo(x + s * 0.15, y + s * 0.4);
    ctx.lineTo(x + s * 0.45, y + s * 0.4);
    ctx.lineTo(x + s * 0.45, y + s * 0.1);
    ctx.lineTo(x + s * 0.3, y - s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawCity(ctx, x, y, size) {
    const s = size * 0.9;
    ctx.fillStyle = '#654321';
    ctx.strokeStyle = '#4a3319';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x - s * 0.5, y - s * 0.3, s * 0.18, s * 0.7);
    ctx.strokeRect(x - s * 0.5, y - s * 0.3, s * 0.18, s * 0.7);
    ctx.fillRect(x - s * 0.28, y - s * 0.1, s * 0.18, s * 0.5);
    ctx.strokeRect(x - s * 0.28, y - s * 0.1, s * 0.18, s * 0.5);
    ctx.fillRect(x - s * 0.06, y - s * 0.45, s * 0.18, s * 0.85);
    ctx.strokeRect(x - s * 0.06, y - s * 0.45, s * 0.18, s * 0.85);
    ctx.fillRect(x + s * 0.16, y - s * 0.15, s * 0.18, s * 0.55);
    ctx.strokeRect(x + s * 0.16, y - s * 0.15, s * 0.18, s * 0.55);
    ctx.fillRect(x + s * 0.38, y + s * 0.05, s * 0.18, s * 0.35);
    ctx.strokeRect(x + s * 0.38, y + s * 0.05, s * 0.18, s * 0.35);
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(x - s * 0.01, y - s * 0.35, s * 0.08, s * 0.08);
    ctx.fillRect(x - s * 0.01, y - s * 0.2, s * 0.08, s * 0.08);
  }

  drawMetropolis(ctx, x, y, size) {
    const s = size * 0.9;
    ctx.fillStyle = '#8B7500';
    ctx.strokeStyle = '#6B5800';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#9B8520';
    ctx.fillRect(x - s * 0.55, y - s * 0.15, s * 0.15, s * 0.55);
    ctx.fillRect(x - s * 0.25, y - s * 0.2, s * 0.15, s * 0.6);
    ctx.fillRect(x + s * 0.15, y - s * 0.18, s * 0.15, s * 0.58);
    ctx.fillRect(x + s * 0.45, y - s * 0.12, s * 0.15, s * 0.52);
    ctx.fillStyle = '#8B7500';
    ctx.fillRect(x - s * 0.38, y - s * 0.4, s * 0.18, s * 0.8);
    ctx.strokeRect(x - s * 0.38, y - s * 0.4, s * 0.18, s * 0.8);
    ctx.fillRect(x - s * 0.1, y - s * 0.55, s * 0.2, s * 0.95);
    ctx.strokeRect(x - s * 0.1, y - s * 0.55, s * 0.2, s * 0.95);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.1, y - s * 0.55);
    ctx.lineTo(x, y - s * 0.7);
    ctx.lineTo(x + s * 0.1, y - s * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(x + s * 0.25, y - s * 0.35, s * 0.18, s * 0.75);
    ctx.strokeRect(x + s * 0.25, y - s * 0.35, s * 0.18, s * 0.75);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x - s * 0.05, y - s * 0.45, s * 0.1, s * 0.1);
    ctx.fillRect(x - s * 0.05, y - s * 0.28, s * 0.1, s * 0.1);
    ctx.fillRect(x - s * 0.05, y - s * 0.11, s * 0.1, s * 0.1);
  }
}
