export class UIController {
    constructor(hexGrid, terrainGenerator) {
        this.hexGrid = hexGrid;
        this.terrainGenerator = terrainGenerator;
        this.hexInfoPanel = document.getElementById('hexInfoPanel');
        this.popupMode = false;
        this.isPinned = false;
        this.pinnedHex = null;

        this.setupEventListeners();
        this.updateLegend();

        // Set hex selection callback (click to pin/unpin)
        this.hexGrid.onHexSelected = (hex) => this.togglePin(hex);
        // Set hover callback (show info when unpinned)
        this.hexGrid.onHexHover = (hex) => this.handleHexHover(hex);
        this.hexGrid.onMouseMove = (x, y) => this.updatePopupPosition(x, y);
    }

    setupEventListeners() {
        document.getElementById('generate').addEventListener('click', () => this.generateMap());
        document.getElementById('randomSeed').addEventListener('click', () => this.randomizeSeed());
        document.getElementById('save').addEventListener('click', () => this.saveMap());
        document.getElementById('load').addEventListener('click', () => this.loadMap());
        document.getElementById('export').addEventListener('click', () => this.exportMap());

        // Update value displays
        document.getElementById('terrainDensity').addEventListener('input', (e) => {
            document.getElementById('terrainDensityValue').textContent = e.target.value;
        });

        document.getElementById('poiFrequency').addEventListener('input', (e) => {
            document.getElementById('poiFrequencyValue').textContent = e.target.value + '%';
        });

        // Popup mode toggle
        document.getElementById('popupMode').addEventListener('change', (e) => {
            this.popupMode = e.target.checked;
            if (this.popupMode) {
                this.hexInfoPanel.classList.add('popup');
            } else {
                this.hexInfoPanel.classList.remove('popup');
            }
        });
    }

    generateMap() {
        const width = parseInt(document.getElementById('gridWidth').value);
        const height = parseInt(document.getElementById('gridHeight').value);
        const seed = document.getElementById('seed').value;
        const terrainVariety = parseInt(document.getElementById('terrainDensity').value);
        const poiFrequency = parseInt(document.getElementById('poiFrequency').value);

        // Set seed
        this.terrainGenerator.setSeed(seed);

        // Update grid dimensions
        this.hexGrid.setDimensions(width, height);

        // Generate terrain data
        const terrainData = this.terrainGenerator.generate(width, height, terrainVariety, poiFrequency);

        // Generate and draw grid
        this.hexGrid.generateGrid(terrainData);
    }

    randomizeSeed() {
        const seed = Math.floor(Math.random() * 1000000);
        document.getElementById('seed').value = seed;
    }

    togglePin(hex) {
        if (this.isPinned && this.pinnedHex === hex) {
            // Clicking the same hex unpins it
            this.isPinned = false;
            this.pinnedHex = null;
            this.hexInfoPanel.classList.remove('pinned');
            this.hexInfoPanel.classList.add('hidden');
        } else {
            // Pin to clicked hex
            this.isPinned = true;
            this.pinnedHex = hex;
            this.hexInfoPanel.classList.add('pinned');
            this.displayHexInfo(hex);
        }
    }

    handleHexHover(hex) {
        if (!this.isPinned) {
            // Only update on hover if not pinned
            if (hex) {
                this.displayHexInfo(hex);
            } else {
                this.hexInfoPanel.classList.add('hidden');
            }
        }
    }

    displayHexInfo(hex) {
        const details = document.getElementById('hexDetails');

        let html = `
            <p><strong>Hex (${hex.col}, ${hex.row})</strong></p>
            <p>${hex.terrain.name} • Difficulty ${hex.terrain.difficulty}/4</p>
        `;

        if (hex.poi) {
            html += `<p>${hex.poi.icon} ${hex.poi.name}</p>`;
        }

        if (hex.weather) {
            html += `<p>${hex.weather.condition}</p>`;
        }

        html += `<p>Encounter: ${hex.encounter}</p>`;

        details.innerHTML = html;
        this.hexInfoPanel.classList.remove('hidden');
    }

    updatePopupPosition(x, y) {
        if (this.popupMode) {
            this.hexInfoPanel.style.left = x + 'px';
            this.hexInfoPanel.style.top = y + 'px';
        }
    }

    updateLegend() {
        const terrainTypes = this.terrainGenerator.getTerrainTypes();
        const legendContent = document.getElementById('legendContent');

        let html = '';
        for (const [key, terrain] of Object.entries(terrainTypes)) {
            html += `
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${terrain.color}"></div>
                    <span>${terrain.name}</span>
                </div>
            `;
        }

        legendContent.innerHTML = html;
    }

    saveMap() {
        const data = {
            width: this.hexGrid.width,
            height: this.hexGrid.height,
            seed: document.getElementById('seed').value,
            hexes: this.hexGrid.hexes
        };

        localStorage.setItem('hexcrawlMap', JSON.stringify(data));
        alert('Map saved to browser storage!');
    }

    loadMap() {
        const savedData = localStorage.getItem('hexcrawlMap');

        if (!savedData) {
            alert('No saved map found!');
            return;
        }

        const data = JSON.parse(savedData);

        document.getElementById('gridWidth').value = data.width;
        document.getElementById('gridHeight').value = data.height;
        document.getElementById('seed').value = data.seed;

        this.hexGrid.setDimensions(data.width, data.height);
        this.hexGrid.hexes = data.hexes;
        this.hexGrid.draw();

        alert('Map loaded!');
    }

    exportMap() {
        const link = document.createElement('a');
        link.download = 'hexcrawl-map.png';
        link.href = this.hexGrid.canvas.toDataURL();
        link.click();
    }
}
