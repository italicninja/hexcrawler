import { SceneManager } from './scenes/SceneManager.js';
import { TitleScene } from './scenes/TitleScene.js';
import { OverworldScene } from './scenes/OverworldScene.js';
import { GameState } from './game/GameState.js';
import { Settings } from './game/Settings.js';

/**
 * Main game initialization
 */
class Game {
    constructor() {
        this.sceneManager = null;
        this.gameState = null;
        this.settings = null;
    }

    async init() {
        console.log('Initializing hexcrawlers...');

        // Create game state manager
        this.gameState = new GameState();

        // Create settings manager
        this.settings = new Settings();

        // Create scene manager
        this.sceneManager = new SceneManager();
        this.sceneManager.setGameState(this.gameState);
        this.sceneManager.setSettings(this.settings);

        // Register scenes
        this.sceneManager.registerScene('title', TitleScene);
        this.sceneManager.registerScene('overworld', OverworldScene);

        // Hide the container initially (will be shown by overworld scene)
        document.querySelector('.container').style.display = 'none';

        // Start with title screen
        await this.sceneManager.switchScene('title');

        // Start game loop
        this.sceneManager.start();

        console.log('Game initialized!');
    }
}

// Create and start the game
const game = new Game();

document.addEventListener('DOMContentLoaded', () => {
    game.init();
});

// Export for debugging
window.game = game;
