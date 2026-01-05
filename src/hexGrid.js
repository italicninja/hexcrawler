import { POIRenderer } from './poiRenderer.js';

export class HexGrid {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.hexSize = 30;
        this.width = 20;
        this.height = 15;
        this.hexes = [];
        this.selectedHex = null;
        this.poiRenderer = new POIRenderer();

        // Zoom and pan (zoom locked at 1.0)
        this.zoom = 1.0;
        this.minZoom = 1.0;
        this.maxZoom = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isPanning = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Display options
        this.showCoordinates = false;
        this.showGrid = true;
        this.filteredTerrain = null; // For legend filtering

        this.setupCanvas();
        this.setupEventListeners();
    }

    setupCanvas() {
        // Make canvas fill the container
        const container = this.canvas.parentElement;
        if (container) {
            this.canvas.width = container.clientWidth - 48; // Account for padding
            this.canvas.height = container.clientHeight - 48;
        } else {
            // Fallback if container not available
            this.canvas.width = 800;
            this.canvas.height = 600;
        }
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        // Zoom and pan disabled
        // this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        // this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        // this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        // this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
    }

    setDimensions(width, height) {
        this.width = width;
        this.height = height;
        this.setupCanvas();
    }

    setHexSize(size) {
        this.hexSize = size;
        this.setupCanvas();
        this.draw();
    }

    setShowCoordinates(show) {
        this.showCoordinates = show;
        this.draw();
    }

    setShowGrid(show) {
        this.showGrid = show;
        this.draw();
    }

    setFilteredTerrain(terrainKey) {
        this.filteredTerrain = terrainKey;
        this.draw();
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

    /**
     * Center the view on a specific hex
     */
    centerOnHex(col, row) {
        const hex = this.hexes.find(h => h.col === col && h.row === row);
        if (!hex) return;

        // Calculate canvas center
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Calculate offset to center the hex
        this.offsetX = centerX - hex.x;
        this.offsetY = centerY - hex.y;

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

        // Apply zoom and pan transformations
        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.zoom, this.zoom);

        // Draw all hexes
        this.hexes.forEach(hex => {
            this.drawHex(hex);
        });

        // Highlight selected hex
        if (this.selectedHex) {
            this.drawHexOutline(this.selectedHex, '#ff6b6b', 3);
        }

        this.ctx.restore();
    }

    /**
     * Set visibility checker function
     */
    setVisibilityChecker(checker) {
        this.visibilityChecker = checker;
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

        // Check visibility
        const isVisible = this.visibilityChecker ? this.visibilityChecker(hex.col, hex.row) : true;

        if (!isVisible) {
            // Draw fog of war (dark gray hex)
            this.ctx.fillStyle = '#1a1a1a';
            this.ctx.fill();
            if (this.showGrid) {
                this.ctx.strokeStyle = '#333';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            }
            return; // Don't draw terrain details
        }

        // Apply greyscale if filtering and this hex doesn't match
        const shouldFade = this.filteredTerrain && hex.terrain.key !== this.filteredTerrain;
        let fillColor = hex.terrain.color;

        if (shouldFade) {
            fillColor = this.toGreyscale(hex.terrain.color);
        }

        // Fill with terrain color (or greyscale)
        this.ctx.fillStyle = fillColor;
        this.ctx.fill();

        // Draw border
        if (this.showGrid) {
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }

        // Draw coordinates if enabled
        if (this.showCoordinates) {
            this.ctx.fillStyle = '#000';
            this.ctx.font = `${Math.max(8, this.hexSize * 0.3)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`${hex.col},${hex.row}`, x, y);
        }

        // Draw POI icon if present
        if (hex.poi && !this.showCoordinates) {
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
        this.poiRenderer.draw(this.ctx, x, y, this.hexSize, poi);
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

    handleDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const hex = this.getHexAtPoint(x, y);
        if (hex && this.onHexDoubleClicked) {
            this.onHexDoubleClicked(hex);
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

    handleMouseDown(e) {
        // Middle mouse button or Ctrl+Left for panning
        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
            this.isPanning = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    }

    handleMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'default';
        }
    }

    handleWheel(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate mouse position in world space before zoom
        const worldX = (mouseX - this.offsetX) / this.zoom;
        const worldY = (mouseY - this.offsetY) / this.zoom;

        // Adjust zoom
        const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomDelta));

        // Calculate new offset to keep mouse position fixed
        this.offsetX = mouseX - worldX * newZoom;
        this.offsetY = mouseY - worldY * newZoom;

        this.zoom = newZoom;
        this.draw();
    }

    getHexAtPoint(x, y) {
        // Transform point to world space
        const worldX = (x - this.offsetX) / this.zoom;
        const worldY = (y - this.offsetY) / this.zoom;

        for (const hex of this.hexes) {
            if (this.isPointInHex(worldX, worldY, hex)) {
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

    toGreyscale(hexColor) {
        // Convert hex color to RGB
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);

        // Calculate luminance (perceived brightness)
        const grey = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

        // Reduce brightness slightly for better contrast
        const dimmedGrey = Math.round(grey * 0.6);

        // Convert back to hex
        const greyHex = dimmedGrey.toString(16).padStart(2, '0');
        return `#${greyHex}${greyHex}${greyHex}`;
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
