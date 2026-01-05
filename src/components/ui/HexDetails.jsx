import { useGameState } from '../../contexts/GameStateContext';

/**
 * HexDetails component - displays selected hex details with Move button
 */

function HexDetails({ hex, terrainGenerator, onMoveClick }) {
  const { state, isHexReachable, getHexDistance } = useGameState();

  if (!hex) {
    return (
      <div className="hex-info-placeholder">
        Click a hex to view details
      </div>
    );
  }

  // Calculate difficulty
  let totalDifficulty = hex.terrain.difficulty || 1;
  let diffDesc = 'Easy';

  if (terrainGenerator && terrainGenerator.encounterManager) {
    totalDifficulty = terrainGenerator.encounterManager.calculateDifficulty(
      hex.terrain,
      hex.weather
    );
    diffDesc = terrainGenerator.encounterManager.getDifficultyDescription(totalDifficulty);
  }

  // Check if hex is reachable
  const reachable = isHexReachable(hex.col, hex.row);
  const distance = getHexDistance(
    state.playerPosition.col,
    state.playerPosition.row,
    hex.col,
    hex.row
  );

  const handleMoveClick = () => {
    if (reachable && onMoveClick) {
      onMoveClick(hex);
    }
  };

  return (
    <div className="hex-detail-display">
      <div className="hex-detail-header">
        <h3>Hex ({hex.col}, {hex.row})</h3>
        <div className="hex-terrain-badge" style={{ backgroundColor: hex.terrain.color }}>
          {hex.terrain.name}
        </div>
      </div>

      <div className="hex-detail-content">
        <div className="detail-item">
          <div className="detail-label">Distance</div>
          <div className={`detail-value ${reachable ? 'highlight' : 'detail-muted'}`}>
            {distance} hex{distance !== 1 ? 'es' : ''} away
            {!reachable && ' (Too far)'}
          </div>
        </div>

        <div className="detail-item">
          <div className="detail-label">Difficulty</div>
          <div className="detail-value">{diffDesc}</div>
        </div>

        {hex.poi && (
          <div className="detail-item">
            <div className="detail-label">Point of Interest</div>
            <div className="detail-value highlight">{hex.poi.name}</div>
          </div>
        )}

        {hex.weather && (
          <>
            <div className="detail-item">
              <div className="detail-label">Weather</div>
              <div className="detail-value">{hex.weather.condition}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Effect</div>
              <div className="detail-value detail-muted">
                {hex.weather.effect || 'None'}
              </div>
            </div>
          </>
        )}

        <div className="detail-item">
          <div className="detail-label">Encounter</div>
          <div className="detail-value detail-muted">
            {hex.encounter ? `CR ${hex.encounter.cr}` : 'None'}
          </div>
        </div>
      </div>

      <button
        className="btn-primary"
        disabled={!reachable}
        onClick={handleMoveClick}
      >
        {reachable ? 'Move Here' : 'Out of Range'}
      </button>
    </div>
  );
}

export default HexDetails;
