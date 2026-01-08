import PropTypes from 'prop-types';
import { useGameState } from '../../contexts/GameStateContext';

/**
 * InteriorInfoPane - Info panel shown when inside a POI/town
 * Displays current location info and selected hex details
 */
function InteriorInfoPane({ selectedHex, playerPosition, interiorMap }) {
  const { state, actions, dispatch } = useGameState();

  if (!state.currentPOI || !interiorMap) {
    return (
      <div style={{
        padding: '1rem',
        color: 'var(--text-muted)',
        textAlign: 'center'
      }}>
        <p>Loading interior...</p>
      </div>
    );
  }

  const { poi } = state.currentPOI;
  const isPlayerHere = selectedHex && 
    playerPosition.col === selectedHex.col && 
    playerPosition.row === selectedHex.row;

  const handleExitInterior = () => {
    if (poi.type === 'town') {
      dispatch({ type: actions.EXIT_TOWN });
    } else {
      dispatch({ type: actions.EXIT_EXPLORATION });
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-darker)'
      }}>
        <h3 style={{
          margin: '0 0 0.5rem 0',
          color: 'var(--accent-color)',
          fontSize: '1.1rem'
        }}>
          {poi.name}
        </h3>
        <p style={{
          margin: 0,
          fontSize: '0.85rem',
          color: 'var(--text-muted)'
        }}>
          {poi.type === 'town' ? 'Town' : 'Interior'}
        </p>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        padding: '1rem',
        overflowY: 'auto'
      }}>
        {selectedHex ? (
          <div>
            <h4 style={{
              margin: '0 0 0.5rem 0',
              color: 'var(--text-color)',
              fontSize: '1rem'
            }}>
              {selectedHex.terrain.name}
            </h4>

            {isPlayerHere && (
              <div style={{
                display: 'inline-block',
                background: '#27ae60',
                color: 'white',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                marginBottom: '0.75rem'
              }}>
                You are here
              </div>
            )}

            <div style={{
              padding: '0.5rem',
              backgroundColor: 'var(--bg-lighter)',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              marginTop: '0.5rem'
            }}>
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                fontWeight: '600',
                marginBottom: '0.25rem'
              }}>
                Walkable
              </div>
              <div style={{
                fontSize: '0.85rem',
                color: 'var(--text-color)'
              }}>
                {selectedHex.terrain.walkable ? 'Yes' : 'No'}
              </div>
            </div>

            {selectedHex.buildingType && (
              <div style={{
                padding: '0.5rem',
                backgroundColor: 'var(--bg-lighter)',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                marginTop: '0.5rem'
              }}>
                <div style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: '600',
                  marginBottom: '0.25rem'
                }}>
                  Building
                </div>
                <div style={{
                  fontSize: '0.85rem',
                  color: 'var(--accent-color)',
                  fontWeight: '600'
                }}>
                  {selectedHex.buildingType}
                </div>
                {selectedHex.terrain.isInteractive && !isPlayerHere && (
                  <p style={{
                    margin: '0.5rem 0 0 0',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic'
                  }}>
                    Double-click or press Space to interact
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            padding: '2rem 0'
          }}>
            <p>Click a hex to see details</p>
          </div>
        )}
      </div>

      {/* Exit Button */}
      <div style={{
        padding: '1rem',
        borderTop: '1px solid var(--border-color)'
      }}>
        <button
          onClick={handleExitInterior}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'var(--primary-color)',
            border: '2px solid var(--accent-color)',
            borderRadius: '6px',
            color: 'var(--text-color)',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          ← Exit {poi.type === 'town' ? 'Town' : 'Interior'}
        </button>
      </div>
    </div>
  );
}

InteriorInfoPane.propTypes = {
  selectedHex: PropTypes.object,
  playerPosition: PropTypes.shape({
    col: PropTypes.number.isRequired,
    row: PropTypes.number.isRequired
  }).isRequired,
  interiorMap: PropTypes.object.isRequired
};

export default InteriorInfoPane;
