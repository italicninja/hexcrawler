// @ts-nocheck
import { useGameState } from '../../contexts/GameStateContext';

/**
 * InteriorInfoPane - Info panel shown when inside a POI/town
 * Displays current location info and selected hex details in dual-pane layout
 */
function InteriorInfoPane({ selectedHex, playerPosition, interiorMap }) {
  const { state, actions, dispatch } = useGameState();

  if (!state.currentPOI || !interiorMap || !playerPosition) {
    return (
      <div
        style={{
          padding: '1rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}
      >
        <p>Loading interior...</p>
      </div>
    );
  }

  const { poi } = state.currentPOI;

  // Towns exit freely; dungeons/caves/ruins/towers/starting_cache require the Exit Hex
  const isTown = ['town', 'village', 'city', 'metropolis', 'camp'].includes(poi.type);

  // Check if the player is currently standing on an Exit Hex
  const currentHex = interiorMap.hexes.find(
    h => h.col === playerPosition.col && h.row === playerPosition.row
  );
  const onExitHex = currentHex?.terrain?.key === 'exit' || currentHex?.content === 'exit';

  const handleExitInterior = () => {
    if (poi.type === 'town') {
      dispatch({ type: actions.EXIT_TOWN });
    } else {
      dispatch({ type: actions.EXIT_EXPLORATION });
    }
  };

  // Render a single hex pane
  const renderHexPane = (displayHex, isCurrentHex) => {
    if (!displayHex) {
      return (
        <div
          style={{
            textAlign: 'center',
            padding: '1.5rem 0.5rem',
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
          }}
        >
          {isCurrentHex ? 'No current hex' : 'Click a hex'}
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {/* Header */}
        <div
          style={{
            borderBottom: `1px solid var(--border-color)`,
            paddingBottom: '0.4rem',
          }}
        >
          <div
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              fontWeight: '600',
              marginBottom: '0.2rem',
            }}
          >
            {isCurrentHex ? 'Current Hex' : 'Selected Hex'}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontSize: '0.85rem',
                color: 'var(--accent-color)',
                fontWeight: '600',
              }}
            >
              ({displayHex.col}, {displayHex.row})
            </div>
            <div
              style={{
                backgroundColor: displayHex.terrain.walkable ? '#27ae60' : '#e74c3c',
                padding: '0.2rem 0.5rem',
                borderRadius: '3px',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'white',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(0, 0, 0, 0.2)',
              }}
            >
              {displayHex.terrain.name}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {/* Walkable status */}
          <div
            style={{
              padding: '0.3rem 0.4rem',
              backgroundColor: 'var(--bg-lighter)',
              borderRadius: '3px',
              fontSize: '0.75rem',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Walkable</span>
            <span
              style={{
                color: displayHex.terrain.walkable ? '#27ae60' : '#e74c3c',
                fontWeight: '600',
              }}
            >
              {displayHex.terrain.walkable ? 'Yes' : 'No'}
            </span>
          </div>

          {/* Building info */}
          {displayHex.buildingType && (
            <div
              style={{
                padding: '0.3rem 0.4rem',
                backgroundColor: 'var(--bg-lighter)',
                borderRadius: '3px',
                border: '1px solid var(--accent-color)',
                fontSize: '0.75rem',
              }}
            >
              <div style={{ color: 'var(--text-muted)', marginBottom: '0.1rem' }}>Building</div>
              <div
                style={{
                  color: 'var(--accent-color)',
                  fontWeight: '700',
                  fontSize: '0.8rem',
                  textTransform: 'capitalize',
                }}
              >
                {displayHex.buildingType}
              </div>
              {displayHex.terrain.isInteractive && isCurrentHex && (
                <div
                  style={{
                    marginTop: '0.3rem',
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                  }}
                >
                  Press Space to interact
                </div>
              )}
            </div>
          )}

          {/* Loot/chest hint */}
          {(displayHex.content === 'loot' || displayHex.content === 'chest') && (
            <div
              style={{
                padding: '0.3rem 0.4rem',
                backgroundColor: 'rgba(243,156,18,0.15)',
                borderRadius: '3px',
                border: '1px solid #f39c12',
                fontSize: '0.75rem',
              }}
            >
              <div style={{ color: '#f39c12', fontWeight: '700', marginBottom: '0.1rem' }}>
                📦 {isCurrentHex ? 'Loot here!' : 'Loot'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontStyle: 'italic' }}>
                {isCurrentHex ? 'Double-click to collect' : 'Walk onto it to collect'}
              </div>
            </div>
          )}

          {/* Exit hint */}
          {(displayHex.terrain?.key === 'exit' || displayHex.content === 'exit') && (
            <div
              style={{
                padding: '0.3rem 0.4rem',
                backgroundColor: 'rgba(46,204,113,0.15)',
                borderRadius: '3px',
                border: '1px solid #2ecc71',
                fontSize: '0.75rem',
              }}
            >
              <div style={{ color: '#2ecc71', fontWeight: '700', marginBottom: '0.1rem' }}>
                🚪 {isCurrentHex ? 'Exit here!' : 'Exit'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontStyle: 'italic' }}>
                {isCurrentHex ? 'Click "← Exit" to leave' : 'Walk here to unlock exit'}
              </div>
            </div>
          )}

          {/* Gate info */}
          {displayHex.terrain.key === 'gate' && (
            <div
              style={{
                padding: '0.3rem 0.4rem',
                backgroundColor: 'var(--bg-lighter)',
                borderRadius: '3px',
                border: '1px solid var(--accent-color)',
                fontSize: '0.75rem',
              }}
            >
              <div style={{ color: 'var(--text-muted)', marginBottom: '0.1rem' }}>Exit</div>
              <div style={{ color: 'var(--accent-color)', fontWeight: '700', fontSize: '0.8rem' }}>
                Town Gate
              </div>
              {isCurrentHex && (
                <div
                  style={{
                    marginTop: '0.3rem',
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                  }}
                >
                  Press Space to exit
                </div>
              )}
            </div>
          )}

          {/* Terrain type */}
          <div
            style={{
              padding: '0.3rem 0.4rem',
              backgroundColor: 'var(--bg-lighter)',
              borderRadius: '3px',
              fontSize: '0.75rem',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Type</span>
            <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>
              {displayHex.terrain.key}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: '0.5rem',
        padding: '0.5rem',
      }}
    >
      {/* POI Header */}
      <div
        style={{
          padding: '0.6rem',
          backgroundColor: 'var(--panel-bg)',
          border: '1px solid var(--accent-color)',
          borderRadius: '6px',
        }}
      >
        <div
          style={{
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            fontWeight: '600',
            marginBottom: '0.2rem',
          }}
        >
          {poi.type === 'town' ? 'Town' : 'Interior'}
        </div>
        <div
          style={{
            color: 'var(--accent-color)',
            fontSize: '0.9rem',
            fontWeight: '700',
          }}
        >
          {poi.name}
        </div>
      </div>

      {/* Current Hex Pane */}
      <div
        style={{
          flex: 1,
          backgroundColor: 'var(--panel-bg)',
          border: '1px solid var(--accent-color)',
          borderRadius: '6px',
          padding: '0.6rem',
          overflow: 'auto',
        }}
      >
        {renderHexPane(currentHex, true)}
      </div>

      {/* Selected Hex Pane */}
      <div
        style={{
          flex: 1,
          backgroundColor: 'var(--panel-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '0.6rem',
          overflow: 'auto',
        }}
      >
        {renderHexPane(selectedHex, false)}
      </div>

      {/* Exit Button — towns exit freely; non-towns require the Exit Hex */}
      <button
        onClick={isTown || onExitHex ? handleExitInterior : undefined}
        title={isTown || onExitHex ? `Leave ${poi.name}` : 'Return to the green EXIT tile to leave'}
        style={{
          padding: '0.5rem',
          background: 'var(--primary-color)',
          border: '1px solid var(--accent-color)',
          borderRadius: '4px',
          color: isTown || onExitHex ? 'var(--text-color)' : 'var(--text-muted)',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          cursor: isTown || onExitHex ? 'pointer' : 'not-allowed',
          opacity: isTown || onExitHex ? 1 : 0.45,
        }}
      >
        {isTown || onExitHex
          ? `← Exit ${poi.type === 'town' || isTown ? 'Town' : 'Interior'}`
          : '🔒 Find the Exit Hex'}
      </button>
    </div>
  );
}

export default InteriorInfoPane;
