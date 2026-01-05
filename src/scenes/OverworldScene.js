import { Scene } from './Scene.js';
import { HexGrid } from '../hexGrid.js';
import { TerrainGenerator } from '../terrainGenerator.js';
import { Character } from '../game/Character.js';
import { Party } from '../game/Party.js';
import { CharacterCard } from '../ui/CharacterCard.js';
import { PartyUI } from '../ui/PartyUI.js';
import { EquipmentUI } from '../ui/EquipmentUI.js';
import { HexDetailPanel } from '../ui/HexDetailPanel.js';
import { GameLog } from '../ui/GameLog.js';
import { ConfigPanel } from '../ui/ConfigPanel.js';

/**
 * OverworldScene - Main gameplay scene with hex grid exploration
 */
export class OverworldScene extends Scene {
    constructor(sceneManager) {
        super(sceneManager);
        this.hexGrid = null;
        this.terrainGenerator = null;
        this.canvas = null;
        this.playerMarker = null;
        this.characterCard = null;
        this.partyUI = null;
        this.equipmentUI = null;
        this.hexDetailPanel = null;
        this.gameLog = null;
        this.configPanel = null;
        this.selectedHex = null;
    }

    async init() {
        await super.init();

        // Get or create game elements
        this.canvas = document.getElementById('hexCanvas');
        this.hexGrid = new HexGrid(this.canvas);
        this.terrainGenerator = new TerrainGenerator();

        // Initialize game state
        const gameState = this.sceneManager.getGameState();

        // Create player character if doesn't exist
        if (!gameState.playerCharacter) {
            gameState.playerCharacter = new Character('Hero', 'paladin');
        }

        // Create party if doesn't exist
        if (!gameState.party) {
            gameState.party = new Party();
            gameState.party.setPlayer(gameState.playerCharacter);
            gameState.party.createPlaceholderNPCs();
        }

        // Initialize UI components
        this.characterCard = new CharacterCard(
            gameState.playerCharacter,
            document.getElementById('character-container')
        );

        this.equipmentUI = new EquipmentUI(
            document.getElementById('equipment-container')
        );

        this.partyUI = new PartyUI(
            gameState.party,
            document.getElementById('party-container'),
            (member, index) => this.onPartyMemberSelected(member, index)
        );

        this.hexDetailPanel = new HexDetailPanel(
            document.getElementById('hex-detail-container'),
            (hex) => this.moveToHex(hex),
            gameState
        );

        this.gameLog = new GameLog(
            document.getElementById('game-log')
        );

        this.configPanel = new ConfigPanel(
            document.getElementById('config-container'),
            this.sceneManager.getSettings()
        );

        // Setup hex selection on click
        this.hexGrid.onHexSelected = (hex) => this.selectHex(hex);

        // Setup double-click to move
        this.hexGrid.onHexDoubleClicked = (hex) => this.handleDoubleClick(hex);

        // Setup visibility checker for fog of war
        this.hexGrid.setVisibilityChecker((col, row) => {
            return gameState.isHexVisible(col, row);
        });

        this.setupControls();

        // Handle window resize to adjust canvas
        this.resizeHandler = () => {
            if (this.hexGrid) {
                this.hexGrid.setupCanvas();
                const gameState = this.sceneManager.getGameState();
                this.hexGrid.centerOnHex(gameState.playerPosition.col, gameState.playerPosition.row);
            }
        };
        window.addEventListener('resize', this.resizeHandler);
    }

    /**
     * Handle party member selection
     */
    onPartyMemberSelected(member, index) {
        if (member && this.equipmentUI) {
            this.equipmentUI.setCharacter(member);
        }
    }

    /**
     * Handle double-click on hex
     */
    handleDoubleClick(hex) {
        const settings = this.sceneManager.getSettings();
        if (settings.get('doubleClickMove')) {
            this.moveToHex(hex);
        }
    }

    /**
     * Handle hex selection
     */
    selectHex(hex) {
        this.selectedHex = hex;
        this.hexGrid.selectedHex = hex; // Update hexGrid's selected hex for highlighting
        if (this.hexDetailPanel && hex) {
            this.hexDetailPanel.setHex(hex, this.terrainGenerator);
        }
        this.hexGrid.draw();
        this.drawPlayer();
    }

    /**
     * Move player to selected hex
     */
    moveToHex(hex) {
        if (!hex) return;

        const gameState = this.sceneManager.getGameState();

        // Check if hex is valid and within range
        if (this.isValidMove(hex.col, hex.row) && gameState.isHexReachable(hex.col, hex.row)) {
            gameState.setPlayerPosition(hex.col, hex.row);

            // Reveal hexes within view distance
            gameState.revealAroundPlayer(gameState.playerCharacter.viewDistance);

            // Log movement
            if (this.gameLog) {
                const terrainName = hex.terrain.name;
                const encounterInfo = hex.encounter ? ` (Encounter: CR ${hex.encounter.cr})` : '';
                this.gameLog.addMessage(`Moved to ${terrainName} at (${hex.col}, ${hex.row})${encounterInfo}`, 'info');
            }

            // Clear selection
            this.selectedHex = null;
            this.hexGrid.selectedHex = null;
            this.hexDetailPanel.clear();

            // Center view on new player position
            this.hexGrid.centerOnHex(hex.col, hex.row);

            // Redraw
            this.hexGrid.draw();
            this.drawPlayer();

            // Auto-save after movement
            gameState.save();
        }
    }

    enter() {
        const gameState = this.sceneManager.getGameState();

        // Show game UI
        document.querySelector('.container').style.display = 'flex';
        document.querySelector('.game-log-container').style.display = 'flex';

        // Generate or restore map
        const isNewGame = !gameState.mapData && !gameState.savedMapData;
        if (isNewGame) {
            this.generateNewMap();
            if (this.gameLog) {
                this.gameLog.addMessage('Welcome to Hexcrawl Adventures! Your journey begins...', 'success');
            }
        } else {
            this.restoreMap();
            if (this.gameLog) {
                this.gameLog.addMessage('Game loaded. Welcome back, adventurer!', 'success');
            }
        }

        // Reveal area around player
        gameState.revealAroundPlayer(2);

        // Update UI
        this.characterCard.render();
        this.partyUI.render();

        // Auto-select player character for equipment view
        if (gameState.playerCharacter) {
            this.equipmentUI.setCharacter(gameState.playerCharacter);
            this.partyUI.selectMember(0); // Select player
        }

        // Center view on player position
        this.hexGrid.centerOnHex(gameState.playerPosition.col, gameState.playerPosition.row);

        // Draw initial state
        this.hexGrid.draw();
        this.drawPlayer();
    }

    exit() {
        // Hide game UI
        document.querySelector('.container').style.display = 'none';
        document.querySelector('.game-log-container').style.display = 'none';
    }

    setupControls() {
        // Setup tab switching for all tab panels
        document.querySelectorAll('.tabs').forEach(tabPanel => {
            const buttons = tabPanel.querySelectorAll('.tab-button');
            buttons.forEach(button => {
                button.addEventListener('click', (e) => {
                    const tabName = e.target.dataset.tab;
                    this.switchTab(tabName, tabPanel.parentElement);
                });
            });
        });
    }

    /**
     * Switch tabs within a panel
     */
    switchTab(tabName, panel) {
        // Update tab buttons
        panel.querySelectorAll('.tab-button').forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabName);
        });

        // Update tab content
        panel.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
    }

    generateNewMap() {
        const gameState = this.sceneManager.getGameState();

        // Use default settings
        const width = 30;
        const height = 40;
        const seed = gameState.newGameSeed || Date.now().toString();
        const variety = 5;
        const poiFreq = 5;
        const algorithm = 'biome';

        // Set terrain generator
        this.terrainGenerator.setSeed(seed);
        this.terrainGenerator.setAlgorithm(algorithm);

        // Generate terrain
        this.hexGrid.setDimensions(width, height);
        const terrainData = this.terrainGenerator.generate(width, height, variety, poiFreq);
        this.hexGrid.generateGrid(terrainData);

        // Save map data
        gameState.mapData = { width, height };
        gameState.mapSeed = seed;

        // Set starting position (center of map)
        gameState.setPlayerPosition(Math.floor(width / 2), Math.floor(height / 2));
    }

    restoreMap() {
        const gameState = this.sceneManager.getGameState();
        const mapData = gameState.savedMapData;

        // Regenerate map from seed
        this.terrainGenerator.setSeed(mapData.seed);
        this.hexGrid.setDimensions(mapData.width, mapData.height);

        const variety = 5;
        const poiFreq = 5;
        const terrainData = this.terrainGenerator.generate(mapData.width, mapData.height, variety, poiFreq);
        this.hexGrid.generateGrid(terrainData);

        gameState.mapData = mapData;
    }

    /**
     * Draw player marker on the grid
     */
    drawPlayer() {
        const gameState = this.sceneManager.getGameState();
        const { col, row } = gameState.playerPosition;

        // Find the hex
        const hex = this.hexGrid.hexes.find(h => h.col === col && h.row === row);
        if (!hex) return;

        const ctx = this.hexGrid.ctx;
        ctx.save();
        ctx.translate(this.hexGrid.offsetX, this.hexGrid.offsetY);
        ctx.scale(this.hexGrid.zoom, this.hexGrid.zoom);

        // Draw player marker (yellow circle)
        ctx.beginPath();
        ctx.arc(hex.x, hex.y, this.hexGrid.hexSize * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw party size indicator
        const partySize = gameState.party.getSize();
        ctx.fillStyle = '#000';
        ctx.font = `bold ${this.hexGrid.hexSize * 0.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(partySize.toString(), hex.x, hex.y);

        ctx.restore();
    }

    /**
     * Handle keyboard input
     */
    handleKeyDown(event) {
        const gameState = this.sceneManager.getGameState();

        switch (event.key) {
            // Save game
            case 'S':
                if (event.shiftKey) {
                    this.saveGame();
                    event.preventDefault();
                }
                break;
        }
    }

    /**
     * Check if move is valid
     */
    isValidMove(col, row) {
        // Check bounds
        if (col < 0 || col >= this.hexGrid.width || row < 0 || row >= this.hexGrid.height) {
            return false;
        }

        // Check terrain (could add impassable terrain logic here)
        const hex = this.hexGrid.hexes.find(h => h.col === col && h.row === row);
        if (!hex) return false;

        // For now, all terrain is passable
        return true;
    }

    /**
     * Save game
     */
    saveGame() {
        const gameState = this.sceneManager.getGameState();
        if (gameState.save()) {
            if (this.gameLog) {
                this.gameLog.addMessage('Game saved successfully!', 'success');
            }
        } else {
            if (this.gameLog) {
                this.gameLog.addMessage('Failed to save game.', 'error');
            }
        }
    }

    render() {
        // Main rendering done by hexGrid
        // We just need to draw player on top
        if (this.hexGrid) {
            this.hexGrid.draw();
            this.drawPlayer();
        }
    }

    update(deltaTime) {
        // No continuous updates needed for turn-based gameplay
    }

    destroy() {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        super.destroy();
    }
}
