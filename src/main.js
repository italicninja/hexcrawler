import { HexGrid } from './hexGrid.js';
import { TerrainGenerator } from './terrainGenerator.js';
import { UIController } from './uiController.js';

// Initialize the application
const app = {
    hexGrid: null,
    terrainGenerator: null,
    uiController: null,

    init() {
        const canvas = document.getElementById('hexCanvas');

        this.hexGrid = new HexGrid(canvas);
        this.terrainGenerator = new TerrainGenerator();
        this.uiController = new UIController(this.hexGrid, this.terrainGenerator);

        // Generate initial map
        this.uiController.generateMap();
    }
};

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
