/**
 * HexDetailPanel component - displays selected hex details with Move button
 */
export class HexDetailPanel {
    constructor(container, onMoveClick, gameState) {
        this.container = container;
        this.onMoveClick = onMoveClick;
        this.gameState = gameState;
        this.selectedHex = null;
    }

    /**
     * Set the selected hex
     */
    setHex(hex, terrainGenerator) {
        this.selectedHex = hex;
        this.terrainGenerator = terrainGenerator;
        this.render();
    }

    /**
     * Clear selection
     */
    clear() {
        this.selectedHex = null;
        this.render();
    }

    /**
     * Render the hex details
     */
    render() {
        if (!this.selectedHex) {
            this.container.innerHTML = `
                <div class="hex-info-placeholder">
                    Click a hex to view details
                </div>
            `;
            return;
        }

        const hex = this.selectedHex;

        // Calculate difficulty
        let totalDifficulty = hex.terrain.difficulty || 1;
        let diffDesc = 'Easy';

        if (this.terrainGenerator && this.terrainGenerator.encounterManager) {
            totalDifficulty = this.terrainGenerator.encounterManager.calculateDifficulty(
                hex.terrain,
                hex.weather
            );
            diffDesc = this.terrainGenerator.encounterManager.getDifficultyDescription(totalDifficulty);
        }

        // Check if hex is reachable
        const isReachable = this.gameState ? this.gameState.isHexReachable(hex.col, hex.row) : true;
        const distance = this.gameState ? this.gameState.getHexDistance(
            this.gameState.playerPosition.col,
            this.gameState.playerPosition.row,
            hex.col,
            hex.row
        ) : 0;

        this.container.innerHTML = `
            <div class="hex-detail-display">
                <div class="hex-detail-header">
                    <h3>Hex (${hex.col}, ${hex.row})</h3>
                    <div class="hex-terrain-badge" style="background-color: ${hex.terrain.color}">
                        ${hex.terrain.name}
                    </div>
                </div>

                <div class="hex-detail-content">
                    <div class="detail-item">
                        <div class="detail-label">Distance</div>
                        <div class="detail-value ${isReachable ? 'highlight' : 'detail-muted'}">
                            ${distance} hex${distance !== 1 ? 'es' : ''} away
                            ${!isReachable ? '(Too far)' : ''}
                        </div>
                    </div>

                    <div class="detail-item">
                        <div class="detail-label">Difficulty</div>
                        <div class="detail-value">${diffDesc}</div>
                    </div>

                    ${hex.poi ? `
                        <div class="detail-item">
                            <div class="detail-label">Point of Interest</div>
                            <div class="detail-value highlight">${hex.poi.name}</div>
                        </div>
                    ` : ''}

                    ${hex.weather ? `
                        <div class="detail-item">
                            <div class="detail-label">Weather</div>
                            <div class="detail-value">${hex.weather.condition}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Effect</div>
                            <div class="detail-value detail-muted">${hex.weather.effect || 'None'}</div>
                        </div>
                    ` : ''}

                    <div class="detail-item">
                        <div class="detail-label">Encounter</div>
                        <div class="detail-value detail-muted">${hex.encounter ? `CR ${hex.encounter.cr}` : 'None'}</div>
                    </div>
                </div>

                <button id="move-to-hex-btn" class="btn-primary" ${!isReachable ? 'disabled' : ''}>
                    ${isReachable ? 'Move Here' : 'Out of Range'}
                </button>
            </div>
        `;

        // Add click listener to Move button
        const moveBtn = this.container.querySelector('#move-to-hex-btn');
        if (moveBtn && this.onMoveClick) {
            moveBtn.addEventListener('click', () => {
                this.onMoveClick(this.selectedHex);
            });
        }
    }
}
