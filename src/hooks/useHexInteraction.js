import { useGameState } from '../contexts/GameStateContext';
import { useGameLog } from '../contexts/GameLogContext';
import DiceRoller from '../game/DiceRoller';
import { CaveGenerator } from '../game/CaveGenerator';
import { RuinsGenerator } from '../game/RuinsGenerator';
import { TowerGenerator } from '../game/TowerGenerator';
import { DungeonGenerator } from '../game/DungeonGenerator';

/**
 * useHexInteraction Hook
 *
 * Handles all POI interaction logic including:
 * - Search action with perception checks
 * - Explore action with interior map generation
 * - Shrine interactions (pray, offer)
 * - Town entry
 * - Camp interactions
 *
 * All interactions now log to GameLog instead of showing EventInfoBox
 *
 * @param {Object} hex - Current hex object
 * @returns {Object} - Action handlers for POI interactions
 */
export function useHexInteraction(hex) {
  const { state, dispatch, actions, isPoiSearched } = useGameState();
  const { addMessage } = useGameLog();

  /**
   * Handle search action - rolls perception and logs hints
   */
  const handleSearch = () => {
    if (!hex || !hex.poi) return;

    const poi = hex.poi;
    const poiKey = `${hex.col},${hex.row}`;

    // Check if already searched
    if (isPoiSearched(hex.col, hex.row)) {
      addMessage(`You've already searched this ${poi.type}. Nothing new to find.`, 'info');
      return;
    }

    // Null check for player character
    if (!state.playerCharacter) {
      addMessage('No player character found', 'error');
      return;
    }

    // Roll perception check
    const diceRoller = new DiceRoller();
    const result = diceRoller.perceptionCheck(state.playerCharacter, 0); // DC 0, we check thresholds manually

    // Generate hints based on roll thresholds
    const hints = [];

    if (result.total >= 5) {
      hints.push(`A ${poi.type} of unknown depth. Proceed with caution.`);
    }

    if (result.total >= 10) {
      hints.push(`Challenge Rating: ${poi.cr}. ${poi.creatures ? `Expect ${poi.creatures}.` : ''}`);
    }

    if (result.total >= 15) {
      // Preview interior size (estimate based on CR)
      const estimatedWidth = 10 + Math.floor(poi.cr * 1.5);
      const estimatedHeight = 8 + Math.floor(poi.cr);
      hints.push(`Estimated size: ${estimatedWidth}x${estimatedHeight} hexes.`);
      hints.push(`Multiple encounters and treasures likely inside.`);
    }

    if (result.total >= 20) {
      hints.push(`You sense significant hazards and traps within.`);
      hints.push(`The most dangerous area appears to be deep inside.`);
    }

    // Log perception check result and hints
    const hintText = hints.length > 0 ? hints.join('\n') : 'You learn nothing new about this location.';
    addMessage(`Perception Check: ${result.total}\n\n${hintText}`, 'info');

    // Mark as searched
    dispatch({
      type: actions.SEARCH_POI,
      payload: poiKey
    });
  };

  /**
   * Handle explore action - generates interior and enters exploration scene
   */
  const handleExplore = () => {
    if (!hex || !hex.poi) return;

    const poi = hex.poi;
    const poiKey = `${hex.col},${hex.row}`;

    // Check if interior already exists
    if (!state.interiorMaps[poiKey]) {
      // Generate new interior map based on POI type
      let generator;
      switch (poi.type) {
        case 'cave':
          generator = new CaveGenerator();
          break;
        case 'ruins':
          generator = new RuinsGenerator();
          break;
        case 'tower':
          generator = new TowerGenerator();
          break;
        case 'dungeon':
          generator = new DungeonGenerator();
          break;
        default:
          generator = new CaveGenerator(); // Fallback to cave
          break;
      }

      const seed = `poi-${poiKey}-${state.mapSeed}`;
      generator.setSeed(seed);

      // Determine interior size based on CR and POI type
      const cr = poi.cr || 1;
      let width, height;

      if (poi.type === 'tower') {
        // Towers are wider (multiple floors side-by-side)
        width = Math.min(30, 15 + Math.floor(cr * 2));
        height = Math.min(12, 8 + Math.floor(cr * 0.5));
      } else if (poi.type === 'dungeon') {
        // Dungeons are larger
        width = Math.min(25, 12 + Math.floor(cr * 2));
        height = Math.min(20, 10 + Math.floor(cr * 1.5));
      } else {
        // Caves and ruins are medium sized
        width = Math.min(20, 10 + Math.floor(cr * 1.5));
        height = Math.min(15, 8 + Math.floor(cr));
      }

      // Generate interior map
      const interiorMap = generator.generate(width, height, cr);

      // Place encounters, loot, and hazards
      interiorMap.encounters = generator.placeEncounters(interiorMap, poi);
      interiorMap.loot = generator.placeLoot(interiorMap);
      interiorMap.hazards = generator.placeHazards(interiorMap);

      // Store interior map in state
      dispatch({
        type: actions.SET_INTERIOR_MAP,
        payload: { key: poiKey, map: interiorMap }
      });
    }

    // Log exploration
    addMessage(`Exploring ${poi.name}...`, 'action');

    // Transition to exploration scene
    dispatch({
      type: actions.ENTER_EXPLORATION,
      payload: { col: hex.col, row: hex.row, poi: poi }
    });
  };

  /**
   * Handle pray action at shrine
   */
  const handlePray = () => {
    if (!hex || !hex.poi || hex.poi.type !== 'shrine') return;

    const poi = hex.poi;
    const poiKey = `${hex.col},${hex.row}`;

    // Check if already interacted with this shrine
    if (isPoiSearched(hex.col, hex.row)) {
      addMessage(`You have already paid your respects at ${poi.name}.`, 'info');
      return;
    }

    // Increase piety
    const character = state.playerCharacter;
    character.increasePiety(1);

    // Mark shrine as visited
    dispatch({
      type: actions.SEARCH_POI,
      payload: poiKey
    });

    // Update character in state
    dispatch({
      type: actions.UPDATE_CHARACTER,
      payload: character
    });

    // Log result
    addMessage(`Prayed at ${poi.name}. You feel a sense of peace. +1 Piety`, 'poi-interaction');
  };

  /**
   * Handle make offering action at shrine
   */
  const handleOffer = () => {
    if (!hex || !hex.poi || hex.poi.type !== 'shrine') return;

    const poi = hex.poi;
    const poiKey = `${hex.col},${hex.row}`;

    // Check if already interacted with this shrine
    if (isPoiSearched(hex.col, hex.row)) {
      addMessage(`You have already paid your respects at ${poi.name}.`, 'info');
      return;
    }

    // Default offering amount (could be made customizable)
    const offeringAmount = 10;
    const character = state.playerCharacter;
    
    // Attempt to make offering
    const result = character.increaseGenerosity(offeringAmount);

    if (!result.success) {
      // Not enough gold
      addMessage(result.message, 'warning');
      return;
    }

    // Mark shrine as visited
    dispatch({
      type: actions.SEARCH_POI,
      payload: poiKey
    });

    // Update character in state
    dispatch({
      type: actions.UPDATE_CHARACTER,
      payload: character
    });

    // Log result
    addMessage(
      `Offered ${result.goldOffered} gold at ${poi.name}. The shrine glows faintly. +${result.generosityGain} Generosity (${result.remainingGold} gold remaining)`,
      'poi-interaction'
    );
  };

  /**
   * Handle enter town action
   */
  const handleEnterTown = () => {
    if (!hex || !hex.poi || hex.poi.type !== 'town') return;

    const poi = hex.poi;

    // Log entry
    addMessage(`Entering ${poi.name}...`, 'action');

    // Dispatch enter town action
    dispatch({
      type: actions.ENTER_TOWN,
      payload: { col: hex.col, row: hex.row, poi: poi }
    });
  };

  /**
   * Handle approach camp action
   */
  const handleApproach = () => {
    if (!hex || !hex.poi || hex.poi.type !== 'camp') return;

    const poi = hex.poi;
    addMessage(`Approaching ${poi.name}... (Feature coming soon!)`, 'info');
  };

  /**
   * Handle trade at camp action
   */
  const handleTrade = () => {
    if (!hex || !hex.poi || hex.poi.type !== 'camp') return;

    const poi = hex.poi;
    addMessage(`Trading with ${poi.name}... (Feature coming soon!)`, 'info');
  };

  /**
   * Legacy handleInteract for backward compatibility
   * Now just determines default action based on POI type
   */
  const handleInteract = () => {
    if (!hex || !hex.poi) return;

    const poi = hex.poi;

    // Default actions by POI type
    switch (poi.type) {
      case 'town':
        handleEnterTown();
        break;
      case 'shrine':
        handlePray();
        break;
      case 'camp':
        handleApproach();
        break;
      case 'cave':
      case 'ruins':
      case 'tower':
      case 'dungeon':
        handleExplore();
        break;
      default:
        addMessage(`No interaction available for ${poi.type}`, 'info');
    }
  };

  return {
    handleInteract,
    handleSearch,
    handleExplore,
    handlePray,
    handleOffer,
    handleEnterTown,
    handleApproach,
    handleTrade
  };
}
