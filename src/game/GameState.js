/**
 * GameState manages the overall game state and save/load functionality
 */
export class GameState {
    constructor() {
        this.playerPosition = { col: 10, row: 7 }; // Starting position
        this.party = null; // Will be set when Party is created
        this.playerCharacter = null; // Will be set when Character is created
        this.mapData = null; // Current hex map data
        this.currentScene = 'title';
        this.mapSeed = '';
        this.exploredHexes = new Set(); // Track fog of war
    }

    /**
     * Save game state to localStorage
     */
    save() {
        const saveData = {
            version: '1.0',
            timestamp: Date.now(),
            playerPosition: this.playerPosition,
            playerCharacter: this.playerCharacter ? this.playerCharacter.toJSON() : null,
            party: this.party ? this.party.toJSON() : null,
            currentScene: this.currentScene,
            mapSeed: this.mapSeed,
            exploredHexes: Array.from(this.exploredHexes),
            mapData: this.serializeMapData()
        };

        try {
            localStorage.setItem('hexcrawl_save', JSON.stringify(saveData));
            console.log('Game saved successfully');
            return true;
        } catch (error) {
            console.error('Failed to save game:', error);
            return false;
        }
    }

    /**
     * Load game state from localStorage
     */
    load() {
        try {
            const saveDataStr = localStorage.getItem('hexcrawl_save');
            if (!saveDataStr) {
                return false;
            }

            const saveData = JSON.parse(saveDataStr);

            this.playerPosition = saveData.playerPosition;
            this.currentScene = saveData.currentScene;
            this.mapSeed = saveData.mapSeed;
            this.exploredHexes = new Set(saveData.exploredHexes || []);

            // Character and party will be loaded by their respective managers
            this.savedPlayerCharacter = saveData.playerCharacter;
            this.savedParty = saveData.party;
            this.savedMapData = saveData.mapData;

            console.log('Game loaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to load game:', error);
            return false;
        }
    }

    /**
     * Check if a save exists
     */
    hasSave() {
        return localStorage.getItem('hexcrawl_save') !== null;
    }

    /**
     * Delete save data
     */
    deleteSave() {
        localStorage.removeItem('hexcrawl_save');
    }

    /**
     * Serialize map data for saving
     */
    serializeMapData() {
        if (!this.mapData) return null;

        // Store minimal map data
        return {
            width: this.mapData.width,
            height: this.mapData.height,
            seed: this.mapSeed
        };
    }

    /**
     * Set player position
     */
    setPlayerPosition(col, row) {
        this.playerPosition = { col, row };
        // Mark hex as explored
        this.exploredHexes.add(`${col},${row}`);
    }

    /**
     * Check if hex is explored
     */
    isHexExplored(col, row) {
        return this.exploredHexes.has(`${col},${row}`);
    }

    /**
     * Reveal hexes around player (for initial vision)
     */
    revealAroundPlayer(radius = 2) {
        const { col, row } = this.playerPosition;

        for (let r = row - radius; r <= row + radius; r++) {
            for (let c = col - radius; c <= col + radius; c++) {
                const distance = this.getHexDistance(col, row, c, r);
                if (distance <= radius) {
                    this.exploredHexes.add(`${c},${r}`);
                }
            }
        }
    }

    /**
     * Calculate hex distance between two hexes (axial coordinates)
     */
    getHexDistance(col1, row1, col2, row2) {
        // Convert offset coordinates to cube coordinates for distance calculation
        const x1 = col1 - Math.floor(row1 / 2);
        const z1 = row1;
        const y1 = -x1 - z1;

        const x2 = col2 - Math.floor(row2 / 2);
        const z2 = row2;
        const y2 = -x2 - z2;

        // Cube distance formula
        return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
    }

    /**
     * Check if a hex is within view distance of player
     */
    isHexVisible(col, row) {
        if (!this.playerCharacter) return false;
        const distance = this.getHexDistance(this.playerPosition.col, this.playerPosition.row, col, row);
        return distance <= this.playerCharacter.viewDistance;
    }

    /**
     * Check if a hex is within move distance of player
     */
    isHexReachable(col, row) {
        if (!this.playerCharacter) return false;
        const distance = this.getHexDistance(this.playerPosition.col, this.playerPosition.row, col, row);
        return distance <= this.playerCharacter.moveDistance;
    }
}
