import { useState } from 'react';
import PropTypes from 'prop-types';
import { useGameState } from '../../contexts/GameStateContext';
import { useEventInfoBox } from '../../contexts/EventInfoBoxContext';
import { useHexInteraction } from '../../hooks/useHexInteraction';
import QuestGiverUI from './QuestGiverUI';
import QuestGenerator from '../../game/QuestGenerator';
import ShopUI from './ShopUI';
import { ACTIONS } from '../../contexts/GameStateContext';

/**
 * HexDetails component - displays selected hex details with Move button
 */

function HexDetails({ hex, terrainGenerator, onMoveClick }) {
  const { state, dispatch, isHexReachable, isPoiDiscovered, isPoiSearched, getHexDistance } = useGameState();
  const { isBlockingMovement } = useEventInfoBox();
  const { handleInteract, handlePassiveChoice } = useHexInteraction(hex);
  const [showQuestGiver, setShowQuestGiver] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [shopType, setShopType] = useState('general');

  if (!hex) {
    return (
      <div className="hex-info-placeholder" style={{
        textAlign: 'center',
        padding: '3rem 1rem',
        color: 'var(--text-muted)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🗺️</div>
        <p style={{ margin: 0, fontSize: '0.95rem' }}>Click a hex to view details</p>
      </div>
    );
  }

  // Calculate difficulty
  let totalDifficulty = hex.terrain.difficulty || 1;
  let diffDesc = 'Easy';

  if (terrainGenerator && terrainGenerator.poiSystem) {
    // Use terrain difficulty
    totalDifficulty = hex.terrain.difficulty || 1;
    if (totalDifficulty <= 1) diffDesc = 'Easy';
    else if (totalDifficulty <= 2) diffDesc = 'Moderate';
    else if (totalDifficulty <= 3) diffDesc = 'Difficult';
    else diffDesc = 'Very Difficult';
  }

  // Check if hex is reachable
  const reachable = isHexReachable(hex.col, hex.row);
  const distance = getHexDistance(
    state.playerPosition.col,
    state.playerPosition.row,
    hex.col,
    hex.row
  );

  // Check if player is on this hex
  const isPlayerOnHex = state.playerPosition.col === hex.col && state.playerPosition.row === hex.row;

  const handleMoveClick = () => {
    if (reachable && onMoveClick) {
      onMoveClick(hex);
    }
  };

  // Check if POI is discovered
  const poiDiscovered = hex.poi ? isPoiDiscovered(hex.col, hex.row) : false;
  const poiVisible = hex.poi ? (hex.poi.visibleWithoutDiscovery || poiDiscovered) : false;

  // Check if this is a town with quest givers
  const isTown = hex.poi && hex.poi.type === 'town';

  // Handler for opening quest giver dialog
  const handleTalkToQuestGiver = () => {
    const location = { col: hex.col, row: hex.row };
    const locationKey = `${location.col},${location.row}`;

    // Check if quests already exist for this town
    if (!state.townQuests[locationKey]) {
      // Generate quests for this town
      const generator = new QuestGenerator(state.mapSeed);
      const playerLevel = state.playerCharacter?.level || 1;

      // Get nearby terrain types for context
      const nearbyTerrain = getNearbyTerrain(hex, state.mapData);

      // Generate 2-3 quests
      const questCount = 2 + Math.floor(Math.random() * 2);
      const quests = generator.generateTownQuests(playerLevel, location, questCount, nearbyTerrain);

      // Store quests in state
      dispatch({
        type: ACTIONS.GENERATE_TOWN_QUESTS,
        payload: { location, quests }
      });
    } else {
      // Check if quests should be refreshed (every 7 days)
      const townData = state.townQuests[locationKey];
      const daysSinceGenerated = state.gameTime.day - townData.lastGenerated;

      if (daysSinceGenerated >= 7) {
        // Refresh quests
        const generator = new QuestGenerator(state.mapSeed);
        const playerLevel = state.playerCharacter?.level || 1;
        const nearbyTerrain = getNearbyTerrain(hex, state.mapData);
        const questCount = 2 + Math.floor(Math.random() * 2);
        const quests = generator.generateTownQuests(playerLevel, location, questCount, nearbyTerrain);

        dispatch({
          type: ACTIONS.REFRESH_QUESTS,
          payload: { location, quests }
        });
      }
    }

    setShowQuestGiver(true);
  };

  // Handler for accepting a quest
  const handleAcceptQuest = (quest) => {
    dispatch({
      type: ACTIONS.ACCEPT_QUEST,
      payload: { quest }
    });
    setShowQuestGiver(false);
  };

  // Get nearby terrain types
  const getNearbyTerrain = (centerHex, mapData) => {
    if (!mapData) return [];

    const terrainTypes = new Set();
    const radius = 3;

    for (let r = centerHex.row - radius; r <= centerHex.row + radius; r++) {
      for (let c = centerHex.col - radius; c <= centerHex.col + radius; c++) {
        const key = `${c},${r}`;
        if (mapData[key]) {
          terrainTypes.add(mapData[key].terrain.name.toLowerCase());
        }
      }
    }

    return Array.from(terrainTypes);
  };

  // Get available quests for this town
  const getAvailableQuests = () => {
    const locationKey = `${hex.col},${hex.row}`;
    const townData = state.townQuests[locationKey];

    if (!townData) return [];

    // Filter out quests that have already been accepted
    return townData.quests.filter(quest => {
      return !state.activeQuests.find(aq => aq.id === quest.id);
    });
  };

  return (
    <div className="hex-detail-display">
      <div className="hex-detail-header" style={{
        borderBottom: `2px solid var(--border-color)`,
        paddingBottom: '0.75rem',
        marginBottom: '1rem'
      }}>
        <h3 style={{
          margin: '0 0 0.5rem 0',
          color: 'var(--accent-color)',
          fontSize: '1.2rem',
          fontWeight: '600'
        }}>
          Hex ({hex.col}, {hex.row})
        </h3>
        <div className="hex-terrain-badge" style={{
          backgroundColor: hex.terrain.color,
          padding: '0.4rem 0.8rem',
          borderRadius: '4px',
          fontSize: '0.85rem',
          fontWeight: '600',
          color: 'white',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
          display: 'inline-block',
          border: '1px solid rgba(0, 0, 0, 0.2)'
        }}>
          {hex.terrain.name}
        </div>
      </div>

      <div className="hex-detail-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div className="detail-item" style={{
          padding: '0.4rem 0.5rem',
          backgroundColor: 'var(--bg-lighter)',
          borderRadius: '4px',
          border: '1px solid var(--border-color)'
        }}>
          <div className="detail-label" style={{
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            fontWeight: '600',
            marginBottom: '0.2rem',
            letterSpacing: '0.5px'
          }}>
            Distance
          </div>
          <div className={`detail-value ${reachable ? 'highlight' : 'detail-muted'}`} style={{
            color: reachable ? 'var(--accent-color)' : 'var(--text-muted)',
            fontSize: '0.85rem',
            fontWeight: '500'
          }}>
            {distance} hex{distance !== 1 ? 'es' : ''} away
            {!reachable && ' (Too far)'}
          </div>
        </div>

        <div className="detail-item" style={{
          padding: '0.4rem 0.5rem',
          backgroundColor: 'var(--bg-lighter)',
          borderRadius: '4px',
          border: '1px solid var(--border-color)'
        }}>
          <div className="detail-label" style={{
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            fontWeight: '600',
            marginBottom: '0.2rem',
            letterSpacing: '0.5px'
          }}>
            Difficulty
          </div>
          <div className="detail-value" style={{
            color: 'var(--text-color)',
            fontSize: '0.85rem',
            fontWeight: '500'
          }}>
            {diffDesc}
          </div>
        </div>

        {/* Show POI information if visible */}
        {hex.poi && poiVisible && (
          <>
            <div className="detail-item" style={{
              padding: '0.4rem 0.5rem',
              backgroundColor: 'var(--bg-lighter)',
              borderRadius: '4px',
              border: '2px solid var(--accent-color)'
            }}>
              <div className="detail-label" style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                fontWeight: '600',
                marginBottom: '0.2rem',
                letterSpacing: '0.5px'
              }}>
                Point of Interest
              </div>
              <div className="detail-value highlight" style={{
                color: 'var(--accent-color)',
                fontSize: '0.95rem',
                fontWeight: '700'
              }}>
                {hex.poi.name}
              </div>
            </div>

            {poiDiscovered && hex.poi.description && (
              <div className="detail-item" style={{
                padding: '0.4rem 0.5rem',
                backgroundColor: 'var(--bg-lighter)',
                borderRadius: '4px',
                border: '1px solid var(--border-color)'
              }}>
                <div className="detail-label" style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: '600',
                  marginBottom: '0.2rem',
                  letterSpacing: '0.5px'
                }}>
                  Description
                </div>
                <div className="detail-value detail-muted" style={{
                  color: 'var(--text-light)',
                  fontSize: '0.8rem',
                  lineHeight: '1.3',
                  fontStyle: 'italic'
                }}>
                  {hex.poi.description}
                </div>
              </div>
            )}

            {poiDiscovered && hex.poi.cr !== undefined && (
              <div className="detail-item" style={{
                padding: '0.4rem 0.5rem',
                backgroundColor: 'var(--bg-lighter)',
                borderRadius: '4px',
                border: '1px solid var(--border-color)'
              }}>
                <div className="detail-label" style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: '600',
                  marginBottom: '0.2rem',
                  letterSpacing: '0.5px'
                }}>
                  Challenge Rating
                </div>
                <div className="detail-value" style={{
                  color: '#e74c3c',
                  fontSize: '0.85rem',
                  fontWeight: '700'
                }}>
                  CR {hex.poi.cr}
                </div>
              </div>
            )}

            {poiDiscovered && hex.poi.eventType && (
              <div className="detail-item" style={{
                padding: '0.4rem 0.5rem',
                backgroundColor: 'var(--bg-lighter)',
                borderRadius: '4px',
                border: '1px solid var(--border-color)'
              }}>
                <div className="detail-label" style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: '600',
                  marginBottom: '0.2rem',
                  letterSpacing: '0.5px'
                }}>
                  Type
                </div>
                <div className="detail-value" style={{
                  color: 'var(--text-color)',
                  fontSize: '0.85rem',
                  fontWeight: '500'
                }}>
                  {hex.poi.eventType === 'active' ? 'Combat' : 'Exploration'}
                </div>
              </div>
            )}
          </>
        )}

        {hex.weather && (
          <>
            <div className="detail-item" style={{
              padding: '0.4rem 0.5rem',
              backgroundColor: 'var(--bg-lighter)',
              borderRadius: '4px',
              border: '1px solid var(--border-color)'
            }}>
              <div className="detail-label" style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                fontWeight: '600',
                marginBottom: '0.2rem',
                letterSpacing: '0.5px'
              }}>
                Weather
              </div>
              <div className="detail-value" style={{
                color: 'var(--text-color)',
                fontSize: '0.85rem',
                fontWeight: '500'
              }}>
                {hex.weather.condition}
              </div>
            </div>
            <div className="detail-item" style={{
              padding: '0.4rem 0.5rem',
              backgroundColor: 'var(--bg-lighter)',
              borderRadius: '4px',
              border: '1px solid var(--border-color)'
            }}>
              <div className="detail-label" style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                fontWeight: '600',
                marginBottom: '0.2rem',
                letterSpacing: '0.5px'
              }}>
                Effect
              </div>
              <div className="detail-value detail-muted" style={{
                color: 'var(--text-light)',
                fontSize: '0.8rem'
              }}>
                {hex.weather.effect || 'None'}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Action Buttons Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.75rem' }}>
        {/* Move button */}
        <button
          className="hex-action-btn hex-action-btn-primary"
          disabled={!reachable || isBlockingMovement}
          onClick={handleMoveClick}
          style={{
            background: (!reachable || isBlockingMovement) ? 'var(--bg-lighter)' : 'var(--primary-color)',
            borderColor: (!reachable || isBlockingMovement) ? 'var(--border-color)' : 'var(--accent-color)',
            color: (!reachable || isBlockingMovement) ? 'var(--text-muted)' : 'var(--text-color)',
            cursor: (!reachable || isBlockingMovement) ? 'not-allowed' : 'pointer',
            opacity: (!reachable || isBlockingMovement) ? 0.5 : 1
          }}
        >
          {isBlockingMovement ? 'Resolve Event First' : (reachable ? 'Move Here' : 'Out of Range')}
        </button>

        {/* Helper text when POI is visible but player not on hex */}
        {hex.poi && poiVisible && !isPlayerOnHex && hex.poi.eventType === 'passive' && (
          <div style={{
            padding: '0.75rem',
            background: 'var(--bg-lighter)',
            border: '2px dashed var(--accent-color)',
            borderRadius: '4px',
            color: 'var(--accent-color)',
            fontSize: '0.85rem',
            textAlign: 'center',
            fontStyle: 'italic',
            lineHeight: '1.4'
          }}>
            Move to this hex to interact with {hex.poi.name}
          </div>
        )}

        {/* Enter button for towns - only when on the hex */}
        {hex.poi && poiVisible && hex.poi.eventType === 'passive' && hex.poi.type === 'town' && isPlayerOnHex && (
          <button
            className="hex-action-btn hex-action-btn-success"
            onClick={handleInteract}
            style={{
              background: 'var(--primary-color)',
              borderColor: 'var(--accent-color)',
              color: 'var(--text-color)'
            }}
          >
            Enter {hex.poi.name}
          </button>
        )}

        {/* Interact button for other passive POIs (not shrines/camps which have specific buttons) */}
        {hex.poi && poiVisible && hex.poi.eventType === 'passive' && 
         !['town', 'shrine', 'camp'].includes(hex.poi.type) && isPlayerOnHex && (
          <button
            className="hex-action-btn hex-action-btn-success"
            onClick={handleInteract}
            style={{
              background: 'var(--primary-color)',
              borderColor: 'var(--accent-color)',
              color: 'var(--text-color)'
            }}
          >
            Interact with {hex.poi.name}
          </button>
        )}

        {/* Search button for POIs (including towns) - only when on the hex and not yet searched */}
        {hex.poi && poiVisible && isPlayerOnHex && !isPoiSearched(hex.col, hex.row) &&
         ['cave', 'ruins', 'tower', 'dungeon', 'town'].includes(hex.poi.type) && (
          <button
            className="hex-action-btn hex-action-btn-search"
            onClick={() => handlePassiveChoice('search', hex.poi)}
            style={{
              background: 'var(--primary-color)',
              borderColor: 'var(--accent-color)',
              color: 'var(--text-color)'
            }}
          >
            Search {hex.poi.name}
          </button>
        )}

        {/* Explore button for searched explorable POIs - only when on the hex */}
        {hex.poi && poiVisible && isPlayerOnHex && isPoiSearched(hex.col, hex.row) &&
         ['cave', 'ruins', 'tower', 'dungeon'].includes(hex.poi.type) && (
          <button
            className="hex-action-btn hex-action-btn-explore"
            onClick={() => handlePassiveChoice('explore', hex.poi)}
            style={{
              background: 'var(--primary-color)',
              borderColor: 'var(--accent-color)',
              color: 'var(--text-color)'
            }}
          >
            Explore {hex.poi.name}
          </button>
        )}

        {/* Shrine interaction buttons - only when on the hex and not yet visited */}
        {hex.poi && poiVisible && hex.poi.type === 'shrine' && isPlayerOnHex && !isPoiSearched(hex.col, hex.row) && (
          <>
            <button
              className="hex-action-btn hex-action-btn-success"
              onClick={() => handlePassiveChoice('pray', hex.poi)}
              style={{
                background: 'var(--primary-color)',
                borderColor: 'var(--accent-color)',
                color: 'var(--text-color)'
              }}
            >
              Pray at {hex.poi.name}
            </button>
            <button
              className="hex-action-btn hex-action-btn-success"
              onClick={() => handlePassiveChoice('offer', hex.poi)}
              style={{
                background: 'var(--primary-color)',
                borderColor: 'var(--accent-color)',
                color: 'var(--text-color)'
              }}
            >
              Make Offering (10 gold)
            </button>
          </>
        )}

        {/* Shrine already visited message */}
        {hex.poi && poiVisible && hex.poi.type === 'shrine' && isPlayerOnHex && isPoiSearched(hex.col, hex.row) && (
          <div style={{
            padding: '0.75rem',
            background: 'var(--bg-lighter)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            textAlign: 'center',
            fontStyle: 'italic'
          }}>
            You have already paid your respects at this shrine.
          </div>
        )}

        {/* Camp interaction buttons - only when on the hex */}
        {hex.poi && poiVisible && hex.poi.type === 'camp' && isPlayerOnHex && (
          <>
            <button
              className="hex-action-btn hex-action-btn-success"
              onClick={() => handlePassiveChoice('approach', hex.poi)}
              style={{
                background: 'var(--primary-color)',
                borderColor: 'var(--accent-color)',
                color: 'var(--text-color)'
              }}
            >
              Approach Camp
            </button>
            <button
              className="hex-action-btn hex-action-btn-success"
              onClick={() => handlePassiveChoice('trade', hex.poi)}
              style={{
                background: 'var(--primary-color)',
                borderColor: 'var(--accent-color)',
                color: 'var(--text-color)'
              }}
            >
              Trade with Camp
            </button>
          </>
        )}
      </div>

      {/* Quest Giver UI Modal */}
      {showQuestGiver && isTown && (
        <QuestGiverUI
          questGiver={{ name: 'Village Elder' }}
          availableQuests={getAvailableQuests()}
          onClose={() => setShowQuestGiver(false)}
          onAcceptQuest={handleAcceptQuest}
        />
      )}

      {/* Shop UI Modal */}
      {showShop && (
        <ShopUI
          poiKey={`${hex.col},${hex.row}`}
          shopType={shopType}
          onClose={() => setShowShop(false)}
        />
      )}
    </div>
  );
}

HexDetails.propTypes = {
  hex: PropTypes.shape({
    col: PropTypes.number.isRequired,
    row: PropTypes.number.isRequired,
    terrain: PropTypes.shape({
      name: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
      difficulty: PropTypes.number
    }).isRequired,
    poi: PropTypes.shape({
      name: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      description: PropTypes.string,
      cr: PropTypes.number,
      creatures: PropTypes.string,
      eventType: PropTypes.oneOf(['active', 'passive']),
      visibleWithoutDiscovery: PropTypes.bool
    }),
    weather: PropTypes.shape({
      condition: PropTypes.string.isRequired,
      effect: PropTypes.string
    })
  }),
  terrainGenerator: PropTypes.shape({
    poiSystem: PropTypes.object
  }),
  onMoveClick: PropTypes.func
};

export default HexDetails;
