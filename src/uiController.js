export class UIController {
  constructor(hexGrid, terrainGenerator) {
    this.hexGrid = hexGrid;
    this.terrainGenerator = terrainGenerator;
    this.hexInfoPanel = document.getElementById('hexInfoPanel');
    this.popupMode = false;
    this.isPinned = false;
    this.pinnedHex = null;
    this.selectedTerrainFilter = null;

    this.setupEventListeners();
    this.updateLegend();

    // Set hex selection callback (click to pin/unpin)
    this.hexGrid.onHexSelected = hex => this.togglePin(hex);
    // Set hover callback (show info when unpinned)
    this.hexGrid.onHexHover = hex => this.handleHexHover(hex);
    this.hexGrid.onMouseMove = (x, y) => this.updatePopupPosition(x, y);
  }

  setupEventListeners() {
    // Tab switching - handle both control panels separately
    document.querySelectorAll('.controls').forEach(controlPanel => {
      const buttons = controlPanel.querySelectorAll('.tab-button');
      buttons.forEach(button => {
        button.addEventListener('click', e => {
          const tabName = e.target.dataset.tab;
          this.switchTab(tabName, controlPanel);
        });
      });
    });

    // Generation controls
    document.getElementById('generate').addEventListener('click', () => this.generateMap());
    document.getElementById('randomSeed').addEventListener('click', () => this.randomizeSeed());
    document.getElementById('save').addEventListener('click', () => this.saveMap());
    document.getElementById('load').addEventListener('click', () => this.loadMap());
    document.getElementById('export').addEventListener('click', () => this.exportMap());

    // Update value displays
    document.getElementById('terrainDensity').addEventListener('input', e => {
      document.getElementById('terrainDensityValue').textContent = e.target.value;
    });

    document.getElementById('poiFrequency').addEventListener('input', e => {
      document.getElementById('poiFrequencyValue').textContent = e.target.value + '%';
    });

    // Customization controls
    document.getElementById('popupMode').addEventListener('change', e => {
      this.popupMode = e.target.checked;
      if (this.popupMode) {
        this.hexInfoPanel.classList.add('popup');
      } else {
        this.hexInfoPanel.classList.remove('popup');
      }
    });

    document.getElementById('showCoordinates').addEventListener('change', e => {
      this.hexGrid.setShowCoordinates(e.target.checked);
    });

    document.getElementById('hexSize').addEventListener('input', e => {
      document.getElementById('hexSizeValue').textContent = e.target.value;
      this.hexGrid.setHexSize(parseInt(e.target.value));
    });

    document.getElementById('showGrid').addEventListener('change', e => {
      this.hexGrid.setShowGrid(e.target.checked);
    });
  }

  switchTab(tabName, controlPanel) {
    // Update tab buttons within this control panel
    controlPanel.querySelectorAll('.tab-button').forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tabName);
    });

    // Update tab content within this control panel
    controlPanel.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
  }

  generateMap() {
    const width = parseInt(document.getElementById('gridWidth').value);
    const height = parseInt(document.getElementById('gridHeight').value);
    const seed = document.getElementById('seed').value;
    const terrainVariety = parseInt(document.getElementById('terrainDensity').value);
    const poiFrequency = parseInt(document.getElementById('poiFrequency').value);
    const algorithm = document.getElementById('terrainAlgorithm').value;

    // Set seed and algorithm
    this.terrainGenerator.setSeed(seed);
    this.terrainGenerator.setAlgorithm(algorithm);

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

    // Calculate total difficulty
    const totalDifficulty = this.terrainGenerator.encounterManager.calculateDifficulty(
      hex.terrain,
      hex.weather
    );
    const diffDesc =
      this.terrainGenerator.encounterManager.getDifficultyDescription(totalDifficulty);

    let html = `
            <p><strong>Hex (${hex.col}, ${hex.row})</strong></p>
            <p>${hex.terrain.name} • ${diffDesc}</p>
        `;

    if (hex.poi) {
      html += `<p><strong>${hex.poi.name}</strong></p>`;
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
                <div class="legend-item" data-terrain-key="${key}">
                    <div class="legend-color" style="background-color: ${terrain.color}"></div>
                    <span>${terrain.name}</span>
                </div>
            `;
    }

    legendContent.innerHTML = html;

    // Add click listeners to legend items
    document.querySelectorAll('.legend-item').forEach(item => {
      item.addEventListener('click', e => {
        const terrainKey = e.currentTarget.dataset.terrainKey;
        this.toggleTerrainFilter(terrainKey);
      });
    });
  }

  toggleTerrainFilter(terrainKey) {
    // If clicking the same terrain, turn off filter
    if (this.selectedTerrainFilter === terrainKey) {
      this.selectedTerrainFilter = null;
      this.hexGrid.setFilteredTerrain(null);
      // Remove active class from all items
      document.querySelectorAll('.legend-item').forEach(item => {
        item.classList.remove('active');
      });
    } else {
      // Set new filter
      this.selectedTerrainFilter = terrainKey;
      this.hexGrid.setFilteredTerrain(terrainKey);
      // Update active state
      document.querySelectorAll('.legend-item').forEach(item => {
        if (item.dataset.terrainKey === terrainKey) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }
  }

  saveMap() {
    const data = {
      width: this.hexGrid.width,
      height: this.hexGrid.height,
      seed: document.getElementById('seed').value,
      hexes: this.hexGrid.hexes,
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
