/**
 * Settings - Manages game configuration and preferences
 */
export class Settings {
    constructor() {
        this.settings = {
            doubleClickMove: true
        };
        this.load();
    }

    /**
     * Get a setting value
     */
    get(key) {
        return this.settings[key];
    }

    /**
     * Set a setting value
     */
    set(key, value) {
        this.settings[key] = value;
        this.save();
    }

    /**
     * Save settings to localStorage
     */
    save() {
        try {
            localStorage.setItem('hexcrawl_settings', JSON.stringify(this.settings));
            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
            return false;
        }
    }

    /**
     * Load settings from localStorage
     */
    load() {
        try {
            const saved = localStorage.getItem('hexcrawl_settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    /**
     * Reset to defaults
     */
    reset() {
        this.settings = {
            doubleClickMove: true
        };
        this.save();
    }
}
