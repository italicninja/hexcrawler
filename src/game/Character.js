/**
 * Character class - D&D 5e based character
 */
export class Character {
    constructor(name, charClass) {
        this.name = name;
        this.class = charClass;
        this.level = 1;

        // D&D 5e Ability Scores
        this.abilities = {
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10
        };

        // Combat stats
        this.maxHP = 10;
        this.currentHP = 10;
        this.armorClass = 10;
        this.proficiencyBonus = 2;

        // Movement and vision
        this.moveDistance = 1;  // Can move 1 hex per turn
        this.viewDistance = 2;  // Can see 2 hexes away

        // Class-specific
        this.hitDie = 'd8';
        this.proficiencies = [];
        this.spells = [];
        this.abilities_list = [];

        // Equipment slots
        this.equipment = {
            head: null,
            neck: null,
            chest: null,
            hands: null,
            legs: null,
            feet: null,
            ring1: null,
            ring2: null,
            mainHand: null,
            offHand: null
        };

        // Inventory
        this.inventory = [];

        // Apply class modifiers
        if (charClass) {
            this.applyClassModifiers(charClass);
        }
    }

    /**
     * Apply class-specific modifiers
     */
    applyClassModifiers(charClass) {
        if (charClass === 'paladin') {
            this.hitDie = 'd10';
            this.abilities.strength = 16; // Primary stat
            this.abilities.charisma = 14; // Secondary stat
            this.abilities.constitution = 14;
            this.abilities.wisdom = 12;
            this.abilities.dexterity = 10;
            this.abilities.intelligence = 8;

            // Calculate HP
            this.maxHP = 10 + this.getModifier('constitution');
            this.currentHP = this.maxHP;

            // AC (assume chain mail + shield)
            this.armorClass = 18;

            // Proficiencies (stub)
            this.proficiencies = [
                'All Armor',
                'All Shields',
                'Simple Weapons',
                'Martial Weapons',
                'Wisdom Saves',
                'Charisma Saves'
            ];

            // Placeholder for abilities
            this.abilities_list = [
                { name: 'Divine Sense', uses: 4, maxUses: 4 },
                { name: 'Lay on Hands', uses: 5, maxUses: 5 }
            ];
        }
    }

    /**
     * Get ability modifier
     */
    getModifier(ability) {
        const score = this.abilities[ability];
        return Math.floor((score - 10) / 2);
    }

    /**
     * Take damage
     */
    takeDamage(amount) {
        this.currentHP = Math.max(0, this.currentHP - amount);
        return this.currentHP === 0; // Return true if character dies
    }

    /**
     * Heal
     */
    heal(amount) {
        this.currentHP = Math.min(this.maxHP, this.currentHP + amount);
    }

    /**
     * Level up
     */
    levelUp() {
        this.level++;
        this.proficiencyBonus = Math.floor((this.level - 1) / 4) + 2;

        // Roll for HP (using average for now)
        const hitDieValue = parseInt(this.hitDie.substring(1));
        const hpGain = Math.floor(hitDieValue / 2) + 1 + this.getModifier('constitution');
        this.maxHP += hpGain;
        this.currentHP += hpGain;
    }

    /**
     * Serialize to JSON for saving
     */
    toJSON() {
        return {
            name: this.name,
            class: this.class,
            level: this.level,
            abilities: { ...this.abilities },
            maxHP: this.maxHP,
            currentHP: this.currentHP,
            armorClass: this.armorClass,
            proficiencyBonus: this.proficiencyBonus,
            moveDistance: this.moveDistance,
            viewDistance: this.viewDistance,
            hitDie: this.hitDie,
            proficiencies: [...this.proficiencies],
            spells: [...this.spells],
            abilities_list: [...this.abilities_list],
            equipment: { ...this.equipment },
            inventory: [...this.inventory]
        };
    }

    /**
     * Load from JSON
     */
    static fromJSON(data) {
        const char = new Character(data.name, null);
        char.class = data.class;
        char.level = data.level;
        char.abilities = { ...data.abilities };
        char.maxHP = data.maxHP;
        char.currentHP = data.currentHP;
        char.armorClass = data.armorClass;
        char.proficiencyBonus = data.proficiencyBonus;
        char.moveDistance = data.moveDistance || 1;
        char.viewDistance = data.viewDistance || 2;
        char.hitDie = data.hitDie;
        char.proficiencies = [...data.proficiencies];
        char.spells = [...data.spells];
        char.abilities_list = [...data.abilities_list];
        char.equipment = data.equipment ? { ...data.equipment } : {};
        char.inventory = data.inventory ? [...data.inventory] : [];
        return char;
    }
}
