import { Scene } from './Scene.js';

/**
 * TitleScene - Main menu / title screen
 */
export class TitleScene extends Scene {
    constructor(sceneManager) {
        super(sceneManager);
        this.container = null;
    }

    async init() {
        await super.init();
        this.createUI();
    }

    enter() {
        if (this.container) {
            this.container.style.display = 'flex';
        }
        this.updateContinueButton();
    }

    exit() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    createUI() {
        // Create title screen container
        this.container = document.createElement('div');
        this.container.id = 'title-screen';
        this.container.className = 'title-screen';

        this.container.innerHTML = `
            <div class="title-content">
                <h1 class="title-logo">hexcrawlers</h1>
                <div class="title-subtitle">An RPG Journey</div>

                <div class="title-form">
                    <div class="control-group">
                        <label for="game-seed">World Seed (optional):</label>
                        <input type="text" id="game-seed" placeholder="Leave blank for random">
                    </div>

                    <div class="title-buttons">
                        <button id="btn-new-game" class="title-btn btn-primary">New Game</button>
                        <button id="btn-continue" class="title-btn" disabled>Continue</button>
                    </div>
                </div>

                <div class="title-footer">
                    <strong>Controls:</strong> Click hex to view details • Click "Move Here" or double-click to travel<br>
                    <strong>Shift+S</strong> to manually save • Configure settings in Config tab
                </div>
            </div>
        `;

        document.getElementById('app').appendChild(this.container);

        // Add event listeners
        document.getElementById('btn-new-game').addEventListener('click', () => this.startNewGame());
        document.getElementById('btn-continue').addEventListener('click', () => this.continueGame());
    }

    updateContinueButton() {
        const continueBtn = document.getElementById('btn-continue');
        const gameState = this.sceneManager.getGameState();

        if (continueBtn && gameState) {
            continueBtn.disabled = !gameState.hasSave();
        }
    }

    startNewGame() {
        const gameState = this.sceneManager.getGameState();

        // Confirm if save exists
        if (gameState.hasSave()) {
            if (!confirm('Starting a new game will overwrite your current save. Continue?')) {
                return;
            }
            gameState.deleteSave();
        }

        // Get seed from input
        const seedInput = document.getElementById('game-seed');
        const seed = seedInput.value.trim() || Date.now().toString();

        // Store seed in game state for map generation
        gameState.newGameSeed = seed;

        // Initialize new game state
        this.sceneManager.switchScene('overworld');
    }

    continueGame() {
        const gameState = this.sceneManager.getGameState();

        if (gameState.load()) {
            this.sceneManager.switchScene('overworld');
        } else {
            alert('Failed to load save game.');
        }
    }

    handleKeyDown(event) {
        if (event.key === 'Escape') {
            // Could return to settings or close
        }
    }

    render() {
        // Title screen is static, no rendering needed
    }

    update(deltaTime) {
        // No updates needed for title screen
    }

    destroy() {
        if (this.container) {
            this.container.remove();
        }
        super.destroy();
    }
}
