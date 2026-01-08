import { useGameState } from '../contexts/GameStateContext';
import { useEventInfoBox } from '../contexts/EventInfoBoxContext';
import DiceRoller from '../game/DiceRoller';
import { CaveGenerator } from '../game/CaveGenerator';
import { RuinsGenerator } from '../game/RuinsGenerator';
import { TowerGenerator } from '../game/TowerGenerator';
import { DungeonGenerator } from '../game/DungeonGenerator';

/**
 * useHexInteraction Hook
 *
 * Handles all POI interaction logic including:
 * - Passive event interactions (towns, shrines, camps)
 * - Search action with perception checks
 * - Explore action with interior map generation
 * - Event choices (pray, offer, leave, etc.)
 *
 * @param {Object} hex - Current hex object
 * @returns {Object} - { handleInteract } function to trigger POI interactions
 */
export function useHexInteraction(hex) {
  const { state, dispatch, actions, isPoiSearched } = useGameState();
  const { showEvent, showMessage, dismissEvent } = useEventInfoBox();

  /**
   * Get choice options for passive events based on POI type
   */
  const getPassiveEventChoices = (poi) => {
    if (poi.type === 'town') {
      return [
        { label: 'Enter Town', action: 'enter', style: 'primary' },
        { label: 'Leave', action: 'leave', style: '' }
      ];
    } else if (poi.type === 'shrine') {
      return [
        { label: 'Pray', action: 'pray', style: 'primary' },
        { label: 'Make Offering', action: 'offer', style: '' },
        { label: 'Leave', action: 'leave', style: '' }
      ];
    } else if (poi.type === 'camp') {
      return [
        { label: 'Approach', action: 'approach', style: 'primary' },
        { label: 'Trade', action: 'trade', style: '' },
        { label: 'Leave', action: 'leave', style: '' }
      ];
    } else {
      // Ruins, caves, towers
      return [
        { label: 'Explore', action: 'explore', style: 'primary' },
        { label: 'Search', action: 'search', style: '' },
        { label: 'Leave', action: 'leave', style: '' }
      ];
    }
  };

  /**
   * Handle passive event choice
   */
  const handlePassiveChoice = (action, poi) => {
    const poiKey = `${hex.col},${hex.row}`;

    if (action === 'search') {
      // Check if already searched
      if (isPoiSearched(hex.col, hex.row)) {
        showEvent(
          {
            ...poi,
            name: 'Already Searched',
            description: `You've already searched this ${poi.type}. There's nothing new to find.`
          },
          'passive',
          [{ label: 'Continue', action: 'leave', style: 'primary' }],
          (action) => dismissEvent()
        );
        return;
      }

      // Null check for player character
      if (!state.playerCharacter) {
        showEvent(
          {
            ...poi,
            name: 'Error',
            description: 'No player character found'
          },
          'passive',
          [{ label: 'Continue', action: 'leave', style: 'primary' }],
          (action) => dismissEvent()
        );
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

      // Show perception check result and hints in event box
      const hintText = hints.length > 0 ? hints.join('\n\n') : 'You learn nothing new about this location.';
      
      showEvent(
        {
          ...poi,
          name: `Perception Check: ${result.total}`,
          description: hintText
        },
        'passive',
        [{ label: 'Continue', action: 'leave', style: 'primary' }],
        (action) => dismissEvent()
      );

      // Mark as searched
      dispatch({
        type: actions.SEARCH_POI,
        payload: poiKey
      });

    } else if (action === 'explore') {
      // Handle exploration - generate interior and transition to exploration scene
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

      // Transition to exploration scene
      dispatch({
        type: actions.ENTER_EXPLORATION,
        payload: { col: hex.col, row: hex.row, poi: poi }
      });

    } else if (action === 'pray') {
      // Check if already interacted with this shrine
      if (isPoiSearched(hex.col, hex.row)) {
        showEvent(
          {
            ...poi,
            name: 'Already Visited',
            description: `You have already paid your respects at this ${poi.name}.`
          },
          'passive',
          [{ label: 'Continue', action: 'leave', style: 'primary' }],
          (action) => dismissEvent()
        );
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

      // Show result in event box
      showEvent(
        {
          ...poi,
          name: 'Prayer',
          description: `You kneel before the ${poi.name} and offer your prayers. You feel a sense of peace wash over you.\n\n+1 Piety`
        },
        'passive',
        [{ label: 'Continue', action: 'leave', style: 'primary' }],
        (action) => dismissEvent()
      );

    } else if (action === 'offer') {
      // Check if already interacted with this shrine
      if (isPoiSearched(hex.col, hex.row)) {
        showEvent(
          {
            ...poi,
            name: 'Already Visited',
            description: `You have already paid your respects at this ${poi.name}.`
          },
          'passive',
          [{ label: 'Continue', action: 'leave', style: 'primary' }],
          (action) => dismissEvent()
        );
        return;
      }

      // Default offering amount (could be made customizable)
      const offeringAmount = 10;
      const character = state.playerCharacter;
      
      // Attempt to make offering
      const result = character.increaseGenerosity(offeringAmount);

      if (!result.success) {
        // Not enough gold
        showEvent(
          {
            ...poi,
            name: 'Insufficient Gold',
            description: result.message
          },
          'passive',
          [{ label: 'Continue', action: 'leave', style: 'primary' }],
          (action) => dismissEvent()
        );
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

      // Show result in event box
      showEvent(
        {
          ...poi,
          name: 'Offering',
          description: `You place ${result.goldOffered} gold at the ${poi.name}. The shrine glows faintly in response.\n\n+${result.generosityGain} Generosity\nRemaining Gold: ${result.remainingGold}`
        },
        'passive',
        [{ label: 'Continue', action: 'leave', style: 'primary' }],
        (action) => dismissEvent()
      );

    } else if (action === 'leave') {
      // Close the event box
      dismissEvent();

    } else if (action === 'enter') {
      // Handle entering town
      dispatch({
        type: actions.ENTER_TOWN,
        payload: { col: hex.col, row: hex.row, poi: poi }
      });
      // Dismiss the event box
      dismissEvent();

    } else if (action === 'approach' || action === 'trade') {
      // Handle camp interactions (to be implemented) - show result in event box
      showEvent(
        {
          ...poi,
          name: action === 'approach' ? 'Approaching Camp' : 'Trading',
          description: `You ${action === 'approach' ? 'cautiously approach' : 'begin trading with'} the ${poi.name}.\n\nThis feature is coming soon!`
        },
        'passive',
        [{ label: 'Continue', action: 'leave', style: 'primary' }],
        (action) => dismissEvent()
      );

    } else {
      // Unknown action
      console.log(`Unknown action: ${action} at ${poi.name}`);
    }
  };

  /**
   * Handle POI interaction - shows event dialog with choices
   */
  const handleInteract = () => {
    if (hex.poi && hex.poi.eventType === 'passive') {
      const choices = getPassiveEventChoices(hex.poi);
      showEvent(hex.poi, 'passive', choices, (action) => handlePassiveChoice(action, hex.poi));
    }
  };

  return {
    handleInteract,
    handlePassiveChoice
  };
}
