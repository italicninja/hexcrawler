/**
 * SceneManager handles scene transitions and lifecycle
 */
export class SceneManager {
    constructor() {
        this.scenes = new Map();
        this.currentScene = null;
        this.lastFrameTime = 0;
        this.isRunning = false;

        this.boundGameLoop = this.gameLoop.bind(this);
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        this.boundHandleClick = this.handleClick.bind(this);
    }

    /**
     * Register a scene type
     */
    registerScene(name, SceneClass) {
        this.scenes.set(name, { SceneClass, instance: null });
    }

    /**
     * Switch to a different scene
     */
    async switchScene(name) {
        // Exit current scene
        if (this.currentScene) {
            this.currentScene.exit();
        }

        // Get or create scene instance
        const sceneData = this.scenes.get(name);
        if (!sceneData) {
            throw new Error(`Scene "${name}" not registered`);
        }

        if (!sceneData.instance) {
            sceneData.instance = new sceneData.SceneClass(this);
            await sceneData.instance.init();
        }

        this.currentScene = sceneData.instance;
        this.currentScene.enter();
    }

    /**
     * Start the game loop
     */
    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.lastFrameTime = performance.now();

        // Add event listeners
        document.addEventListener('keydown', this.boundHandleKeyDown);
        document.addEventListener('click', this.boundHandleClick);

        requestAnimationFrame(this.boundGameLoop);
    }

    /**
     * Stop the game loop
     */
    stop() {
        this.isRunning = false;

        // Remove event listeners
        document.removeEventListener('keydown', this.boundHandleKeyDown);
        document.removeEventListener('click', this.boundHandleClick);
    }

    /**
     * Main game loop
     */
    gameLoop(currentTime) {
        if (!this.isRunning) return;

        const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
        this.lastFrameTime = currentTime;

        // Update and render current scene
        if (this.currentScene) {
            this.currentScene.update(deltaTime);
            this.currentScene.render();
        }

        requestAnimationFrame(this.boundGameLoop);
    }

    /**
     * Handle keyboard input
     */
    handleKeyDown(event) {
        if (this.currentScene) {
            this.currentScene.handleKeyDown(event);
        }
    }

    /**
     * Handle click events
     */
    handleClick(event) {
        if (this.currentScene) {
            this.currentScene.handleClick(event);
        }
    }

    /**
     * Get the game state manager (will be passed to scenes)
     */
    getGameState() {
        return this.gameState;
    }

    /**
     * Set the game state manager
     */
    setGameState(gameState) {
        this.gameState = gameState;
    }

    /**
     * Get the settings manager (will be passed to scenes)
     */
    getSettings() {
        return this.settings;
    }

    /**
     * Set the settings manager
     */
    setSettings(settings) {
        this.settings = settings;
    }
}
