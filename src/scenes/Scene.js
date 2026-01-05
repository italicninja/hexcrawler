/**
 * Base Scene class
 * All game scenes (Title, Overworld, Character, etc.) inherit from this
 */
export class Scene {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.isInitialized = false;
    }

    /**
     * Initialize the scene (called once when scene is first created)
     */
    async init() {
        this.isInitialized = true;
    }

    /**
     * Called when scene becomes active
     */
    enter() {
        // Override in subclasses
    }

    /**
     * Called when scene is no longer active
     */
    exit() {
        // Override in subclasses
    }

    /**
     * Update game logic (called every frame)
     */
    update(deltaTime) {
        // Override in subclasses
    }

    /**
     * Render the scene
     */
    render() {
        // Override in subclasses
    }

    /**
     * Clean up resources when scene is destroyed
     */
    destroy() {
        this.isInitialized = false;
    }

    /**
     * Handle keyboard input
     */
    handleKeyDown(event) {
        // Override in subclasses
    }

    /**
     * Handle mouse/click events
     */
    handleClick(event) {
        // Override in subclasses
    }
}
