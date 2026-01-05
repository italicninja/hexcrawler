/**
 * ConfigPanel component - displays game configuration options
 */
export class ConfigPanel {
    constructor(container, settings) {
        this.container = container;
        this.settings = settings;
        this.render();
    }

    /**
     * Render the config panel
     */
    render() {
        const doubleClickEnabled = this.settings.get('doubleClickMove');

        this.container.innerHTML = `
            <div class="config-panel">
                <h3>Settings</h3>

                <div class="config-section">
                    <h4>Controls</h4>

                    <div class="config-item">
                        <label class="toggle-label">
                            <input type="checkbox" id="toggle-double-click" ${doubleClickEnabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                            <span class="toggle-text">Double-click to move</span>
                        </label>
                        <p class="config-description">Enable double-clicking a hex to move there instantly</p>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for controls
     */
    setupEventListeners() {
        const doubleClickToggle = this.container.querySelector('#toggle-double-click');
        if (doubleClickToggle) {
            doubleClickToggle.addEventListener('change', (e) => {
                this.settings.set('doubleClickMove', e.target.checked);
            });
        }
    }
}
