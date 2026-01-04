export class HexGrid {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.hexSize = 30;
        this.width = 20;
        this.height = 15;
        this.hexes = [];
        this.selectedHex = null;

        this.setupCanvas();
        this.setupEventListeners();
    }

    setupCanvas() {
        const xSpacing = this.hexSize * Math.sqrt(3);
        const ySpacing = this.hexSize * 1.5;

        this.canvas.width = (this.width * xSpacing) + (this.hexSize * Math.sqrt(3));
        this.canvas.height = (this.height * ySpacing) + (this.hexSize * 2);
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    }

    setDimensions(width, height) {
        this.width = width;
        this.height = height;
        this.setupCanvas();
    }

    generateGrid(terrainData) {
        this.hexes = [];

        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                const hex = {
                    row,
                    col,
                    x: this.getHexX(col, row),
                    y: this.getHexY(row),
                    terrain: terrainData[row][col].terrain,
                    poi: terrainData[row][col].poi,
                    encounter: terrainData[row][col].encounter
                };
                this.hexes.push(hex);
            }
        }

        this.draw();
    }

    getHexX(col, row) {
        const xSpacing = this.hexSize * Math.sqrt(3);
        const xOffset = (row % 2) * (this.hexSize * Math.sqrt(3) / 2);
        return col * xSpacing + this.hexSize * 1.5 + xOffset;
    }

    getHexY(row) {
        const ySpacing = this.hexSize * 1.5;
        return row * ySpacing + this.hexSize * 1.5;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw all hexes
        this.hexes.forEach(hex => {
            this.drawHex(hex);
        });

        // Highlight selected hex
        if (this.selectedHex) {
            this.drawHexOutline(this.selectedHex, '#ff6b6b', 3);
        }
    }

    drawHex(hex) {
        const { x, y } = hex;
        const size = this.hexSize;

        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            const hx = x + size * Math.cos(angle);
            const hy = y + size * Math.sin(angle);

            if (i === 0) {
                this.ctx.moveTo(hx, hy);
            } else {
                this.ctx.lineTo(hx, hy);
            }
        }
        this.ctx.closePath();

        // Fill with terrain color
        this.ctx.fillStyle = hex.terrain.color;
        this.ctx.fill();

        // Draw border
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        // Draw POI icon if present
        if (hex.poi) {
            this.drawPOI(hex);
        }
    }

    drawHexOutline(hex, color, width) {
        const { x, y } = hex;
        const size = this.hexSize;

        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            const hx = x + size * Math.cos(angle);
            const hy = y + size * Math.sin(angle);

            if (i === 0) {
                this.ctx.moveTo(hx, hy);
            } else {
                this.ctx.lineTo(hx, hy);
            }
        }
        this.ctx.closePath();

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.stroke();
    }

    drawPOI(hex) {
        const { x, y, poi } = hex;

        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(poi.icon, x, y);
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const hex = this.getHexAtPoint(x, y);
        if (hex) {
            this.selectedHex = hex;
            this.draw();
            this.onHexSelected(hex);
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const hex = this.getHexAtPoint(x, y);
        this.canvas.style.cursor = hex ? 'pointer' : 'default';

        // Call the onHexHover callback when hovering over a hex
        if (this.onHexHover) {
            this.onHexHover(hex);
        }

        // Call the onMouseMove callback with screen coordinates
        if (this.onMouseMove) {
            this.onMouseMove(e.clientX, e.clientY);
        }
    }

    getHexAtPoint(x, y) {
        for (const hex of this.hexes) {
            if (this.isPointInHex(x, y, hex)) {
                return hex;
            }
        }
        return null;
    }

    isPointInHex(x, y, hex) {
        const dx = Math.abs(x - hex.x);
        const dy = Math.abs(y - hex.y);

        if (dx > this.hexSize * 0.866) return false;
        if (dy > this.hexSize) return false;

        return (this.hexSize * Math.sqrt(3) / 2 * this.hexSize -
                this.hexSize / 2 * dx -
                this.hexSize * Math.sqrt(3) / 2 * dy) >= 0;
    }

    onHexSelected(hex) {
        // This will be overridden by UIController
    }

    onHexHover(hex) {
        // This will be overridden by UIController
    }

    onMouseMove(x, y) {
        // This will be overridden by UIController
    }
}
