/**
 * CharacterCard UI component - displays character stats in D&D 5e format
 */
export class CharacterCard {
    constructor(character, container) {
        this.character = character;
        this.container = container;
    }

    /**
     * Render the character card
     */
    render() {
        if (!this.character) {
            this.container.innerHTML = '<div class="character-card">No character</div>';
            return;
        }

        const char = this.character;
        const hpPercent = (char.currentHP / char.maxHP) * 100;

        this.container.innerHTML = `
            <div class="character-card">
                <div class="character-name">${char.name}</div>
                <div class="character-class">Level ${char.level} ${this.capitalize(char.class)}</div>

                <div class="ability-scores">
                    ${this.renderAbility('STR', 'strength')}
                    ${this.renderAbility('DEX', 'dexterity')}
                    ${this.renderAbility('CON', 'constitution')}
                    ${this.renderAbility('INT', 'intelligence')}
                    ${this.renderAbility('WIS', 'wisdom')}
                    ${this.renderAbility('CHA', 'charisma')}
                </div>

                <div class="character-stats">
                    <div class="stat-item">
                        <div class="stat-label">Armor Class</div>
                        <div class="stat-value">${char.armorClass}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Proficiency</div>
                        <div class="stat-value">+${char.proficiencyBonus}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Hit Die</div>
                        <div class="stat-value">${char.hitDie}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Initiative</div>
                        <div class="stat-value">${this.formatModifier(char.getModifier('dexterity'))}</div>
                    </div>
                </div>

                <div class="stat-item" style="margin-top: 1rem;">
                    <div class="stat-label">Hit Points</div>
                    <div class="stat-value">${char.currentHP} / ${char.maxHP}</div>
                    <div class="hp-bar">
                        <div class="hp-fill" style="width: ${hpPercent}%">
                            ${Math.round(hpPercent)}%
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render a single ability score
     */
    renderAbility(label, abilityKey) {
        const score = this.character.abilities[abilityKey];
        const modifier = this.character.getModifier(abilityKey);

        return `
            <div class="ability-score">
                <div class="ability-label">${label}</div>
                <div class="ability-value">${score}</div>
                <div class="ability-modifier">${this.formatModifier(modifier)}</div>
            </div>
        `;
    }

    /**
     * Format ability modifier with +/- sign
     */
    formatModifier(value) {
        return value >= 0 ? `+${value}` : `${value}`;
    }

    /**
     * Capitalize first letter
     */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Update character data and re-render
     */
    update(character) {
        this.character = character;
        this.render();
    }
}
