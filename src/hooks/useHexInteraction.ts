// @ts-nocheck -- TODO: Remove after GameStateContext → .tsx and game/ files → .ts (Phase 3 & 6)
import { useGameState } from '../contexts/GameStateContext';
import { useGameLog } from '../contexts/GameLogContext';
import DiceRoller from '../game/DiceRoller';
import { generateSettlementFlavor } from '../utils/flavorTextGenerator';
import logger from '../utils/logger';

// Lazy load generators to reduce initial bundle size
// These are loaded dynamically when entering POIs
const loadCaveGenerator = () => import('../game/CaveGenerator').then(m => m.CaveGenerator);
const loadRuinsGenerator = () => import('../game/RuinsGenerator').then(m => m.RuinsGenerator);
const loadTowerGenerator = () => import('../game/TowerGenerator').then(m => m.TowerGenerator);
const loadDungeonGenerator = () => import('../game/DungeonGenerator').then(m => m.DungeonGenerator);
const loadTownGenerator = () => import('../game/TownGenerator').then(m => m.TownGenerator);
const loadStartingCacheGenerator = () =>
  import('../game/StartingCacheGenerator').then(m => m.StartingCacheGenerator);

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

    // Roll perception check with logger
    const diceRoller = new DiceRoller(null, addMessage);
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
    const hintText =
      hints.length > 0 ? hints.join('\n') : 'You learn nothing new about this location.';
    addMessage(`Perception Check: ${result.total}\n\n${hintText}`, 'info');

    // Mark as searched
    dispatch({
      type: actions.SEARCH_POI,
      payload: poiKey,
    });
  };

  /**
   * Handle explore action - generates interior and enters exploration scene
   */
  const handleExplore = async () => {
    if (!hex || !hex.poi) return;

    const poi = hex.poi;

    // Starting cache is a one-time location — can't re-enter after leaving
    if (poi.isStartingLocation) {
      addMessage('The shelter is empty now. There is nothing left for you here.', 'info');
      return;
    }

    const poiKey = `${hex.col},${hex.row}`;

    // Check if interior already exists
    if (!state.interiorMaps[poiKey]) {
      // Log loading message
      addMessage(`Preparing to explore ${poi.name}...`, 'action');

      // Dynamically load the appropriate generator based on POI type
      let GeneratorClass;
      try {
        switch (poi.type) {
          case 'cave':
            GeneratorClass = await loadCaveGenerator();
            break;
          case 'ruins':
            GeneratorClass = await loadRuinsGenerator();
            break;
          case 'tower':
            GeneratorClass = await loadTowerGenerator();
            break;
          case 'dungeon':
            GeneratorClass = await loadDungeonGenerator();
            break;
          case 'starting_cache':
            GeneratorClass = await loadStartingCacheGenerator();
            break;
          default:
            GeneratorClass = await loadCaveGenerator(); // Fallback to cave
            break;
        }
      } catch (error) {
        logger.general.error('Failed to load generator:', error);
        addMessage('Failed to load area. Please try again.', 'error');
        return;
      }

      const generator = new GeneratorClass();
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
        payload: { key: poiKey, map: interiorMap },
      });
    }

    // Log exploration
    addMessage(`Exploring ${poi.name}...`, 'action');

    // Transition to exploration scene
    dispatch({
      type: actions.ENTER_EXPLORATION,
      payload: { col: hex.col, row: hex.row, poi: poi },
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
      payload: poiKey,
    });

    // Update character in state
    dispatch({
      type: actions.UPDATE_CHARACTER,
      payload: character,
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
      payload: poiKey,
    });

    // Update character in state
    dispatch({
      type: actions.UPDATE_CHARACTER,
      payload: character,
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
  const handleEnterTown = async () => {
    if (!hex || !hex.poi) return;

    const poi = hex.poi;
    const settlementTypes = ['town', 'village', 'city', 'metropolis', 'camp'];

    if (!settlementTypes.includes(poi.type)) return;

    const poiKey = `${hex.col},${hex.row}`;

    // Check if interior already exists
    if (!state.interiorMaps[poiKey]) {
      // Dynamically load TownGenerator
      let TownGeneratorClass;
      try {
        TownGeneratorClass = await loadTownGenerator();
      } catch (error) {
        logger.general.error('Failed to load town generator:', error);
        addMessage('Failed to load town. Please try again.', 'error');
        return;
      }

      const generator = new TownGeneratorClass();

      const seed = `poi-${poiKey}-${state.mapSeed}`;
      generator.setSeed(seed);

      // Extract settlement size from poi
      const settlementSize = poi.settlementSize || poi.type;

      // Determine interior size based on settlement tier
      let width, height;
      switch (settlementSize) {
        case 'camp':
          width = 12;
          height = 10;
          break;
        case 'village':
          width = 18;
          height = 14;
          break;
        case 'town':
          width = 24;
          height = 18;
          break;
        case 'city':
          width = 30;
          height = 24;
          break;
        case 'metropolis':
          width = 36;
          height = 30;
          break;
        default:
          width = 24;
          height = 18;
      }

      // Generate interior map with settlement size in townData
      const townData = {
        name: poi.name,
        settlementSize: settlementSize,
      };
      const interiorMap = generator.generate(width, height, townData);

      // Store interior map in state
      dispatch({
        type: actions.SET_INTERIOR_MAP,
        payload: { key: poiKey, map: interiorMap },
      });
    }

    // Log entry
    addMessage(`Entering ${poi.name}...`, 'action');

    // Settlement entry flavor (50% chance)
    if (Math.random() < 0.5) {
      const settlementSize = poi.settlementSize || poi.type;
      const flavor = generateSettlementFlavor(settlementSize);
      if (flavor) addMessage(flavor, 'info');
    }

    // Dispatch enter town action
    dispatch({
      type: actions.ENTER_TOWN,
      payload: { col: hex.col, row: hex.row, poi: poi },
    });
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
      case 'camp':
      case 'village':
      case 'town':
      case 'city':
      case 'metropolis':
        handleEnterTown();
        break;
      case 'shrine':
        handlePray();
        break;
      case 'cave':
      case 'ruins':
      case 'tower':
      case 'dungeon':
      case 'starting_cache':
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
  };
}
