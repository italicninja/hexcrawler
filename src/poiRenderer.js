/**
 * POI Icon Renderer
 * Draws custom icons for points of interest on the hex map
 */

export class POIRenderer {
    constructor() {
        // Icon drawing functions for each POI type
        this.iconDrawers = {
            'Dungeon': this.drawDungeon.bind(this),
            'Settlement': this.drawSettlement.bind(this),
            'Ruins': this.drawRuins.bind(this),
            'Tower': this.drawTower.bind(this),
            'Cave': this.drawCave.bind(this),
            'Shrine': this.drawShrine.bind(this),
            'Camp': this.drawCamp.bind(this)
        };
    }

    /**
     * Draw POI icon at specified location
     */
    draw(ctx, x, y, size, poi) {
        const drawer = this.iconDrawers[poi.name];
        if (drawer) {
            ctx.save();
            drawer(ctx, x, y, size);
            ctx.restore();
        }
    }

    /**
     * Draw dungeon icon (castle/fortress)
     */
    drawDungeon(ctx, x, y, size) {
        const s = size * 0.6;

        ctx.fillStyle = '#2c3e50';
        ctx.strokeStyle = '#1a252f';
        ctx.lineWidth = 2;

        // Main structure
        ctx.fillRect(x - s * 0.4, y - s * 0.2, s * 0.8, s * 0.6);

        // Battlements
        ctx.fillRect(x - s * 0.5, y - s * 0.5, s * 0.25, s * 0.3);
        ctx.fillRect(x - s * 0.125, y - s * 0.5, s * 0.25, s * 0.3);
        ctx.fillRect(x + s * 0.25, y - s * 0.5, s * 0.25, s * 0.3);

        // Door
        ctx.fillStyle = '#000';
        ctx.fillRect(x - s * 0.15, y + s * 0.1, s * 0.3, s * 0.3);

        // Outline
        ctx.strokeRect(x - s * 0.4, y - s * 0.2, s * 0.8, s * 0.6);
    }

    /**
     * Draw settlement icon (houses)
     */
    drawSettlement(ctx, x, y, size) {
        const s = size * 0.6;

        ctx.fillStyle = '#8B4513';
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 1.5;

        // House 1
        ctx.beginPath();
        ctx.moveTo(x - s * 0.5, y);
        ctx.lineTo(x - s * 0.5, y + s * 0.4);
        ctx.lineTo(x - s * 0.1, y + s * 0.4);
        ctx.lineTo(x - s * 0.1, y);
        ctx.lineTo(x - s * 0.3, y - s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // House 2
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

    /**
     * Draw ruins icon (broken columns)
     */
    drawRuins(ctx, x, y, size) {
        const s = size * 0.6;

        ctx.fillStyle = '#95a5a6';
        ctx.strokeStyle = '#7f8c8d';
        ctx.lineWidth = 1.5;

        // Broken column 1
        ctx.fillRect(x - s * 0.4, y - s * 0.1, s * 0.2, s * 0.5);
        ctx.strokeRect(x - s * 0.4, y - s * 0.1, s * 0.2, s * 0.5);

        // Broken column 2 (shorter)
        ctx.fillRect(x - s * 0.05, y + s * 0.1, s * 0.2, s * 0.3);
        ctx.strokeRect(x - s * 0.05, y + s * 0.1, s * 0.2, s * 0.3);

        // Broken column 3
        ctx.fillRect(x + s * 0.25, y, s * 0.2, s * 0.4);
        ctx.strokeRect(x + s * 0.25, y, s * 0.2, s * 0.4);

        // Fallen piece
        ctx.save();
        ctx.translate(x + s * 0.1, y + s * 0.4);
        ctx.rotate(Math.PI / 6);
        ctx.fillRect(-s * 0.15, -s * 0.05, s * 0.3, s * 0.1);
        ctx.restore();
    }

    /**
     * Draw tower icon (tall structure)
     */
    drawTower(ctx, x, y, size) {
        const s = size * 0.6;

        ctx.fillStyle = '#34495e';
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;

        // Main tower
        ctx.fillRect(x - s * 0.25, y - s * 0.4, s * 0.5, s * 0.8);
        ctx.strokeRect(x - s * 0.25, y - s * 0.4, s * 0.5, s * 0.8);

        // Top
        ctx.beginPath();
        ctx.moveTo(x - s * 0.35, y - s * 0.4);
        ctx.lineTo(x, y - s * 0.6);
        ctx.lineTo(x + s * 0.35, y - s * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Window
        ctx.fillStyle = '#f39c12';
        ctx.fillRect(x - s * 0.1, y - s * 0.15, s * 0.2, s * 0.15);
    }

    /**
     * Draw cave icon (cave entrance)
     */
    drawCave(ctx, x, y, size) {
        const s = size * 0.6;

        // Cave background (dark)
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.ellipse(x, y, s * 0.5, s * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cave entrance outline
        ctx.strokeStyle = '#1a252f';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Rock above
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

    /**
     * Draw shrine icon (temple/shrine)
     */
    drawShrine(ctx, x, y, size) {
        const s = size * 0.6;

        ctx.fillStyle = '#e74c3c';
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 1.5;

        // Base
        ctx.fillRect(x - s * 0.4, y + s * 0.2, s * 0.8, s * 0.2);

        // Pillars
        ctx.fillRect(x - s * 0.35, y - s * 0.2, s * 0.15, s * 0.4);
        ctx.fillRect(x + s * 0.2, y - s * 0.2, s * 0.15, s * 0.4);

        // Roof
        ctx.beginPath();
        ctx.moveTo(x - s * 0.5, y - s * 0.2);
        ctx.lineTo(x, y - s * 0.5);
        ctx.lineTo(x + s * 0.5, y - s * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Torii gate style top beam
        ctx.fillRect(x - s * 0.55, y - s * 0.3, s * 1.1, s * 0.1);
    }

    /**
     * Draw camp icon (tent)
     */
    drawCamp(ctx, x, y, size) {
        const s = size * 0.6;

        ctx.fillStyle = '#8B7355';
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 1.5;

        // Tent
        ctx.beginPath();
        ctx.moveTo(x - s * 0.5, y + s * 0.4);
        ctx.lineTo(x, y - s * 0.3);
        ctx.lineTo(x + s * 0.5, y + s * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Tent entrance (darker)
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.moveTo(x - s * 0.2, y + s * 0.4);
        ctx.lineTo(x, y + s * 0.1);
        ctx.lineTo(x + s * 0.2, y + s * 0.4);
        ctx.closePath();
        ctx.fill();

        // Campfire
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
}
