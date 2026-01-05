/**
 * EquipmentUI component - displays character equipment
 */
export class EquipmentUI {
    constructor(container) {
        this.container = container;
        this.character = null;
    }

    /**
     * Set the character to display equipment for
     */
    setCharacter(character) {
        this.character = character;
        this.render();
    }

    /**
     * Render the equipment UI
     */
    render() {
        if (!this.character) {
            this.container.innerHTML = `
                <div class="equipment-placeholder">
                    Select a party member to view equipment
                </div>
            `;
            return;
        }

        const char = this.character;
        const equipment = char.equipment;

        this.container.innerHTML = `
            <div class="equipment-display">
                <div class="equipment-header">
                    <h3>${char.name}'s Equipment</h3>
                </div>

                <div class="equipment-grid">
                    <div class="equipment-column">
                        ${this.renderSlot('Head', equipment.head, 'head')}
                        ${this.renderSlot('Neck', equipment.neck, 'neck')}
                        ${this.renderSlot('Chest', equipment.chest, 'chest')}
                        ${this.renderSlot('Hands', equipment.hands, 'hands')}
                        ${this.renderSlot('Legs', equipment.legs, 'legs')}
                    </div>

                    <div class="equipment-column">
                        ${this.renderSlot('Feet', equipment.feet, 'feet')}
                        ${this.renderSlot('Ring 1', equipment.ring1, 'ring1')}
                        ${this.renderSlot('Ring 2', equipment.ring2, 'ring2')}
                        ${this.renderSlot('Main Hand', equipment.mainHand, 'mainHand')}
                        ${this.renderSlot('Off Hand', equipment.offHand, 'offHand')}
                    </div>
                </div>

                ${this.renderInventory(char.inventory)}
            </div>
        `;
    }

    /**
     * Render a single equipment slot
     */
    renderSlot(label, item, slotId) {
        if (!item) {
            return `
                <div class="equipment-slot empty" data-slot="${slotId}">
                    <div class="slot-label">${label}</div>
                    <div class="slot-content">Empty</div>
                </div>
            `;
        }

        let stats = '';
        if (item.ac) {
            stats = `<span class="item-stat">AC +${item.ac}</span>`;
        } else if (item.damage) {
            stats = `<span class="item-stat">${item.damage}</span>`;
        }

        return `
            <div class="equipment-slot" data-slot="${slotId}">
                <div class="slot-label">${label}</div>
                <div class="slot-content">
                    <div class="item-name">${item.name}</div>
                    ${stats}
                </div>
            </div>
        `;
    }

    /**
     * Render inventory section
     */
    renderInventory(inventory) {
        if (!inventory || inventory.length === 0) {
            return `
                <div class="inventory-section">
                    <h4>Inventory</h4>
                    <div class="inventory-empty">No items</div>
                </div>
            `;
        }

        const itemsHtml = inventory.map(item => `
            <div class="inventory-item">
                <span class="item-name">${item.name}</span>
            </div>
        `).join('');

        return `
            <div class="inventory-section">
                <h4>Inventory</h4>
                <div class="inventory-list">${itemsHtml}</div>
            </div>
        `;
    }

    /**
     * Clear the display
     */
    clear() {
        this.character = null;
        this.render();
    }
}
