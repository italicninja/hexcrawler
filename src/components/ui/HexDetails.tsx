// @ts-nocheck
import { useState } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import { useHexInteraction } from '../../hooks/useHexInteraction';
import QuestGiverUI from './QuestGiverUI';
import QuestGenerator from '../../game/QuestGenerator';
import ShopUI from './ShopUI';
import { ACTIONS } from '../../contexts/GameStateContext';
import { QUEST_COUNTS_BY_SIZE } from '../../constants/gameConstants';

/**
 * HexDetails component - displays current hex and selected hex in two panes
 */

function HexDetails({ hex, terrainGenerator, onMoveClick }) {
  const { state, dispatch, isHexReachable, isPoiDiscovered, isPoiSearched, getHexDistance } =
    useGameState();

  // Current hex the player is standing on
  const currentHex = state.mapData?.find(
    h => h.col === state.playerPosition.col && h.row === state.playerPosition.row
  );

  // Selected hex (the one clicked)
  const selectedHex = hex;

  const { handleInteract, handleSearch, handleExplore, handlePray, handleOffer, handleEnterTown } =
    useHexInteraction(currentHex);
  const [showQuestGiver, setShowQuestGiver] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [shopType, setShopType] = useState('general');

  // Check for blocking movement during active events
  const isBlockingMovement = state.hasActiveEvent || false;

  // Handler for opening quest giver dialog
  const handleTalkToQuestGiver = () => {
    const location = { col: currentHex.col, row: currentHex.row };
    const locationKey = `${location.col},${location.row}`;

    // Check if quests already exist for this town
    if (!state.townQuests[locationKey]) {
      // Extract quest chance and settlement size from POI
      const poi = currentHex.poi;
      const questChance = poi.questChance || 0.75;
      const settlementSize = poi.settlementSize || poi.type;

      // Check if quests should be generated based on chance
      let quests = [];
      if (Math.random() < questChance) {
        // Generate quests for this town
        const generator = new QuestGenerator(state.mapSeed);
        const playerLevel = state.playerCharacter?.level || 1;

        // Get nearby terrain types for context
        const nearbyTerrain = getNearbyTerrain(currentHex, state.mapData);

        // Determine quest count based on settlement size
        const questRange = QUEST_COUNTS_BY_SIZE[settlementSize] || { min: 0, max: 1 };
        const minQuests = questRange.min;
        const maxQuests = questRange.max;

        const questCount = minQuests + Math.floor(Math.random() * (maxQuests - minQuests + 1));
        quests = generator.generateTownQuests(playerLevel, location, questCount, nearbyTerrain);
      }

      // Store quests in state (even if empty array)
      dispatch({
        type: ACTIONS.GENERATE_TOWN_QUESTS,
        payload: { location, quests },
      });
    } else {
      // Check if quests should be refreshed (every 7 days)
      const townData = state.townQuests[locationKey];
      const daysSinceGenerated = state.gameTime.day - townData.lastGenerated;

      if (daysSinceGenerated >= 7) {
        // Refresh quests with same logic
        const poi = currentHex.poi;
        const questChance = poi.questChance || 0.75;
        const settlementSize = poi.settlementSize || poi.type;

        let quests = [];
        if (Math.random() < questChance) {
          const generator = new QuestGenerator(state.mapSeed);
          const playerLevel = state.playerCharacter?.level || 1;
          const nearbyTerrain = getNearbyTerrain(currentHex, state.mapData);

          const questRange = QUEST_COUNTS_BY_SIZE[settlementSize] || { min: 0, max: 1 };
          const minQuests = questRange.min;
          const maxQuests = questRange.max;

          const questCount = minQuests + Math.floor(Math.random() * (maxQuests - minQuests + 1));
          quests = generator.generateTownQuests(playerLevel, location, questCount, nearbyTerrain);
        }

        dispatch({
          type: ACTIONS.REFRESH_QUESTS,
          payload: { location, quests },
        });
      }
    }

    setShowQuestGiver(true);
  };

  // Handler for accepting a quest
  const handleAcceptQuest = quest => {
    dispatch({
      type: ACTIONS.ACCEPT_QUEST,
      payload: { quest },
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
    const locationKey = `${currentHex.col},${currentHex.row}`;
    const townData = state.townQuests[locationKey];

    if (!townData) return [];

    // Filter out quests that have already been accepted
    return townData.quests.filter(quest => {
      return !state.activeQuests.find(aq => aq.id === quest.id);
    });
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

    // Calculate difficulty
    let totalDifficulty = displayHex.terrain.difficulty || 1;
    let diffDesc = 'Easy';

    if (terrainGenerator && terrainGenerator.poiSystem) {
      totalDifficulty = displayHex.terrain.difficulty || 1;
      if (totalDifficulty <= 1) diffDesc = 'Easy';
      else if (totalDifficulty <= 2) diffDesc = 'Moderate';
      else if (totalDifficulty <= 3) diffDesc = 'Difficult';
      else diffDesc = 'Very Difficult';
    }

    // Check if hex is reachable (for selected hex)
    const reachable = !isCurrentHex && isHexReachable(displayHex.col, displayHex.row);
    const distance = !isCurrentHex
      ? getHexDistance(
          state.playerPosition.col,
          state.playerPosition.row,
          displayHex.col,
          displayHex.row
        )
      : 0;

    // Check if POI is discovered
    const poiDiscovered = displayHex.poi ? isPoiDiscovered(displayHex.col, displayHex.row) : false;
    const poiVisible = displayHex.poi
      ? displayHex.poi.visibleWithoutDiscovery || poiDiscovered
      : false;

    // Check if this is a town with quest givers
    const isTown = displayHex.poi && displayHex.poi.type === 'town';

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
                backgroundColor: displayHex.terrain.color,
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
          {/* Distance (only for selected hex) */}
          {!isCurrentHex && (
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
              <span style={{ color: 'var(--text-muted)' }}>Distance</span>
              <span
                style={{
                  color: reachable ? 'var(--accent-color)' : 'var(--text-muted)',
                  fontWeight: '500',
                }}
              >
                {distance} hex{distance !== 1 ? 'es' : ''} {!reachable && '(Far)'}
              </span>
            </div>
          )}

          {/* Difficulty */}
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
            <span style={{ color: 'var(--text-muted)' }}>Difficulty</span>
            <span style={{ fontWeight: '500' }}>{diffDesc}</span>
          </div>

          {/* POI Info */}
          {displayHex.poi && poiVisible && (
            <>
              <div
                style={{
                  padding: '0.3rem 0.4rem',
                  backgroundColor: 'var(--bg-lighter)',
                  borderRadius: '3px',
                  border: '1px solid var(--accent-color)',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.1rem' }}>POI</div>
                <div
                  style={{ color: 'var(--accent-color)', fontWeight: '700', fontSize: '0.8rem' }}
                >
                  {displayHex.poi.name}
                </div>
              </div>

              {poiDiscovered && displayHex.poi.description && (
                <div
                  style={{
                    padding: '0.3rem 0.4rem',
                    backgroundColor: 'var(--bg-lighter)',
                    borderRadius: '3px',
                    fontSize: '0.7rem',
                    color: 'var(--text-light)',
                    fontStyle: 'italic',
                    lineHeight: '1.2',
                  }}
                >
                  {displayHex.poi.description}
                </div>
              )}

              {poiDiscovered && displayHex.poi.cr !== undefined && (
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
                  <span style={{ color: 'var(--text-muted)' }}>CR</span>
                  <span style={{ color: '#e74c3c', fontWeight: '700' }}>{displayHex.poi.cr}</span>
                </div>
              )}

              {poiDiscovered && displayHex.poi.eventType && (
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
                  <span style={{ fontWeight: '500' }}>
                    {displayHex.poi.eventType === 'active' ? 'Combat' : 'Exploration'}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Weather */}
          {displayHex.weather && (
            <>
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
                <span style={{ color: 'var(--text-muted)' }}>Weather</span>
                <span style={{ fontWeight: '500' }}>{displayHex.weather.condition}</span>
              </div>
              {displayHex.weather.effect && (
                <div
                  style={{
                    padding: '0.3rem 0.4rem',
                    backgroundColor: 'var(--bg-lighter)',
                    borderRadius: '3px',
                    fontSize: '0.7rem',
                    color: 'var(--text-light)',
                  }}
                >
                  {displayHex.weather.effect}
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Buttons - only for current hex */}
        {isCurrentHex && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.3rem' }}
          >
            {/* Enter button for towns */}
            {displayHex.poi &&
              poiVisible &&
              displayHex.poi.eventType === 'passive' &&
              displayHex.poi.type === 'town' && (
                <button
                  className="hex-action-btn hex-action-btn-success"
                  onClick={handleEnterTown}
                  style={{
                    background: 'var(--primary-color)',
                    borderColor: 'var(--accent-color)',
                    color: 'var(--text-color)',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.75rem',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    border: '1px solid',
                    fontWeight: '600',
                  }}
                >
                  Enter {displayHex.poi.name}
                </button>
              )}

            {/* Interact button for other passive POIs */}
            {displayHex.poi &&
              poiVisible &&
              displayHex.poi.eventType === 'passive' &&
              !['town', 'shrine', 'camp'].includes(displayHex.poi.type) && (
                <button
                  className="hex-action-btn hex-action-btn-success"
                  onClick={handleInteract}
                  style={{
                    background: 'var(--primary-color)',
                    borderColor: 'var(--accent-color)',
                    color: 'var(--text-color)',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.75rem',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    border: '1px solid',
                    fontWeight: '600',
                  }}
                >
                  Interact
                </button>
              )}

            {/* Search button */}
            {displayHex.poi &&
              poiVisible &&
              !isPoiSearched(displayHex.col, displayHex.row) &&
              ['cave', 'ruins', 'tower', 'dungeon'].includes(displayHex.poi.type) && (
                <button
                  className="hex-action-btn hex-action-btn-search"
                  onClick={handleSearch}
                  style={{
                    background: 'var(--primary-color)',
                    borderColor: 'var(--accent-color)',
                    color: 'var(--text-color)',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.75rem',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    border: '1px solid',
                    fontWeight: '600',
                  }}
                >
                  Search
                </button>
              )}

            {/* Explore button */}
            {displayHex.poi &&
              poiVisible &&
              isPoiSearched(displayHex.col, displayHex.row) &&
              ['cave', 'ruins', 'tower', 'dungeon'].includes(displayHex.poi.type) && (
                <button
                  className="hex-action-btn hex-action-btn-explore"
                  onClick={handleExplore}
                  style={{
                    background: 'var(--primary-color)',
                    borderColor: 'var(--accent-color)',
                    color: 'var(--text-color)',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.75rem',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    border: '1px solid',
                    fontWeight: '600',
                  }}
                >
                  Explore
                </button>
              )}

            {/* Shrine buttons */}
            {displayHex.poi &&
              poiVisible &&
              displayHex.poi.type === 'shrine' &&
              !isPoiSearched(displayHex.col, displayHex.row) && (
                <>
                  <button
                    onClick={handlePray}
                    style={{
                      background: 'var(--primary-color)',
                      borderColor: 'var(--accent-color)',
                      color: 'var(--text-color)',
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.75rem',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      border: '1px solid',
                      fontWeight: '600',
                    }}
                  >
                    Pray
                  </button>
                  <button
                    onClick={handleOffer}
                    style={{
                      background: 'var(--primary-color)',
                      borderColor: 'var(--accent-color)',
                      color: 'var(--text-color)',
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.75rem',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      border: '1px solid',
                      fontWeight: '600',
                    }}
                  >
                    Offer (10g)
                  </button>
                </>
              )}

            {/* Shrine visited message */}
            {displayHex.poi &&
              poiVisible &&
              displayHex.poi.type === 'shrine' &&
              isPoiSearched(displayHex.col, displayHex.row) && (
                <div
                  style={{
                    padding: '0.4rem',
                    background: 'var(--bg-lighter)',
                    borderRadius: '3px',
                    color: 'var(--text-muted)',
                    fontSize: '0.7rem',
                    textAlign: 'center',
                    fontStyle: 'italic',
                  }}
                >
                  Already visited
                </div>
              )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: '0.75rem',
      }}
    >
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

      {/* Quest Giver UI Modal */}
      {showQuestGiver && isTown && currentHex && (
        <QuestGiverUI
          questGiver={{ name: 'Village Elder' }}
          availableQuests={getAvailableQuests()}
          onClose={() => setShowQuestGiver(false)}
          onAcceptQuest={handleAcceptQuest}
        />
      )}

      {/* Shop UI Modal */}
      {showShop && currentHex && (
        <ShopUI
          poiKey={`${currentHex.col},${currentHex.row}`}
          shopType={shopType}
          onClose={() => setShowShop(false)}
        />
      )}
    </div>
  );
}

export default HexDetails;
