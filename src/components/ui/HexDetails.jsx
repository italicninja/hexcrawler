import { useState } from 'react';
import PropTypes from 'prop-types';
import { useGameState } from '../../contexts/GameStateContext';
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
  
  // If no hex is selected, use the player's current hex
  const displayHex = hex || (state.mapData?.[`${state.playerPosition.col},${state.playerPosition.row}`]);
  
  const { 
    handleInteract, 
    handleSearch, 
    handleExplore, 
    handlePray, 
    handleOffer, 
    handleEnterTown, 
    handleApproach, 
    handleTrade 
  } = useHexInteraction(displayHex);
  const [showQuestGiver, setShowQuestGiver] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [shopType, setShopType] = useState('general');
  
  // Check for blocking movement during active events
  const isBlockingMovement = state.hasActiveEvent || false;

  if (!displayHex) {
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
  let totalDifficulty = displayHex.terrain.difficulty || 1;
  let diffDesc = 'Easy';

  if (terrainGenerator && terrainGenerator.poiSystem) {
    // Use terrain difficulty
    totalDifficulty = displayHex.terrain.difficulty || 1;
    if (totalDifficulty <= 1) diffDesc = 'Easy';
    else if (totalDifficulty <= 2) diffDesc = 'Moderate';
    else if (totalDifficulty <= 3) diffDesc = 'Difficult';
    else diffDesc = 'Very Difficult';
  }

  // Check if hex is reachable
  const reachable = isHexReachable(displayHex.col, displayHex.row);
  const distance = getHexDistance(
    state.playerPosition.col,
    state.playerPosition.row,
    displayHex.col,
    displayHex.row
  );

  // Check if player is on this hex
  const isPlayerOnHex = state.playerPosition.col === displayHex.col && state.playerPosition.row === displayHex.row;

  const handleMoveClick = () => {
    if (reachable && onMoveClick) {
      onMoveClick(displayHex);
    }
  };

  // Check if POI is discovered
  const poiDiscovered = displayHex.poi ? isPoiDiscovered(displayHex.col, displayHex.row) : false;
  const poiVisible = displayHex.poi ? (displayHex.poi.visibleWithoutDiscovery || poiDiscovered) : false;

  // Check if this is a town with quest givers
  const isTown = displayHex.poi && displayHex.poi.type === 'town';

  // Handler for opening quest giver dialog
  const handleTalkToQuestGiver = () => {
    const location = { col: displayHex.col, row: displayHex.row };
    const locationKey = `${location.col},${location.row}`;

    // Check if quests already exist for this town
    if (!state.townQuests[locationKey]) {
      // Generate quests for this town
      const generator = new QuestGenerator(state.mapSeed);
      const playerLevel = state.playerCharacter?.level || 1;

      // Get nearby terrain types for context
      const nearbyTerrain = getNearbyTerrain(displayHex, state.mapData);

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
        const nearbyTerrain = getNearbyTerrain(displayHex, state.mapData);
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
    const locationKey = `${displayHex.col},${displayHex.row}`;
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
          Hex ({displayHex.col}, {displayHex.row})
        </h3>
        <div className="hex-terrain-badge" style={{
          backgroundColor: displayHex.terrain.color,
          padding: '0.4rem 0.8rem',
          borderRadius: '4px',
          fontSize: '0.85rem',
          fontWeight: '600',
          color: 'white',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
          display: 'inline-block',
          border: '1px solid rgba(0, 0, 0, 0.2)'
        }}>
          {displayHex.terrain.name}
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
        {displayHex.poi && poiVisible && (
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
                {displayHex.poi.name}
              </div>
            </div>

            {poiDiscovered && displayHex.poi.description && (
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
                  {displayHex.poi.description}
                </div>
              </div>
            )}

            {poiDiscovered && displayHex.poi.cr !== undefined && (
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
                  CR {displayHex.poi.cr}
                </div>
              </div>
            )}

            {poiDiscovered && displayHex.poi.eventType && (
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
                  {displayHex.poi.eventType === 'active' ? 'Combat' : 'Exploration'}
                </div>
              </div>
            )}
          </>
        )}

        {displayHex.weather && (
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
                {displayHex.weather.condition}
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
                {displayHex.weather.effect || 'None'}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Action Buttons Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.75rem' }}>
        {/* Enter button for towns - only when on the hex */}
        {displayHex.poi && poiVisible && displayHex.poi.eventType === 'passive' && displayHex.poi.type === 'town' && isPlayerOnHex && (
          <button
            className="hex-action-btn hex-action-btn-success"
            onClick={handleEnterTown}
            style={{
              background: 'var(--primary-color)',
              borderColor: 'var(--accent-color)',
              color: 'var(--text-color)'
            }}
          >
            Enter {displayHex.poi.name}
          </button>
        )}

        {/* Interact button for other passive POIs (not shrines/camps which have specific buttons) */}
        {displayHex.poi && poiVisible && displayHex.poi.eventType === 'passive' && 
         !['town', 'shrine', 'camp'].includes(displayHex.poi.type) && isPlayerOnHex && (
          <button
            className="hex-action-btn hex-action-btn-success"
            onClick={handleInteract}
            style={{
              background: 'var(--primary-color)',
              borderColor: 'var(--accent-color)',
              color: 'var(--text-color)'
            }}
          >
            Interact with {displayHex.poi.name}
          </button>
        )}

        {/* Search button for explorable POIs - only when on the hex and not yet searched */}
        {displayHex.poi && poiVisible && isPlayerOnHex && !isPoiSearched(displayHex.col, displayHex.row) &&
         ['cave', 'ruins', 'tower', 'dungeon'].includes(displayHex.poi.type) && (
          <button
            className="hex-action-btn hex-action-btn-search"
            onClick={handleSearch}
            style={{
              background: 'var(--primary-color)',
              borderColor: 'var(--accent-color)',
              color: 'var(--text-color)'
            }}
          >
            Search {displayHex.poi.name}
          </button>
        )}

        {/* Explore button for searched explorable POIs - only when on the hex */}
        {displayHex.poi && poiVisible && isPlayerOnHex && isPoiSearched(displayHex.col, displayHex.row) &&
         ['cave', 'ruins', 'tower', 'dungeon'].includes(displayHex.poi.type) && (
          <button
            className="hex-action-btn hex-action-btn-explore"
            onClick={handleExplore}
            style={{
              background: 'var(--primary-color)',
              borderColor: 'var(--accent-color)',
              color: 'var(--text-color)'
            }}
          >
            Explore {displayHex.poi.name}
          </button>
        )}

        {/* Shrine interaction buttons - only when on the hex and not yet visited */}
        {displayHex.poi && poiVisible && displayHex.poi.type === 'shrine' && isPlayerOnHex && !isPoiSearched(displayHex.col, displayHex.row) && (
          <>
            <button
              className="hex-action-btn hex-action-btn-success"
              onClick={handlePray}
              style={{
                background: 'var(--primary-color)',
                borderColor: 'var(--accent-color)',
                color: 'var(--text-color)'
              }}
            >
              Pray at {displayHex.poi.name}
            </button>
            <button
              className="hex-action-btn hex-action-btn-success"
              onClick={handleOffer}
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
        {displayHex.poi && poiVisible && displayHex.poi.type === 'shrine' && isPlayerOnHex && isPoiSearched(displayHex.col, displayHex.row) && (
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
        {displayHex.poi && poiVisible && displayHex.poi.type === 'camp' && isPlayerOnHex && (
          <>
            <button
              className="hex-action-btn hex-action-btn-success"
              onClick={handleApproach}
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
              onClick={handleTrade}
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
          poiKey={`${displayHex.col},${displayHex.row}`}
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
