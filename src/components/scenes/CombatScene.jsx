import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useGameState } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import CombatCanvas from '../canvas/CombatCanvas';
import ActionPanel from '../ui/combat/ActionPanel';
import TurnOrderPanel from '../ui/combat/TurnOrderPanel';
import AbilityMenu from '../ui/combat/AbilityMenu';
import SpellMenu from '../ui/combat/SpellMenu';
import { findPath } from '../../game/Pathfinding';
import { checkLineOfSight } from '../../game/LineOfSight';
import { EnemyAI } from '../../game/EnemyAI';
import { DiceRoller } from '../../game/DiceRoller';
import { OpportunityAttackSystem } from '../../game/OpportunityAttack';
import OpportunityAttackPrompt from '../ui/combat/OpportunityAttackPrompt';
import logger from '../../utils/logger.js';
import './CombatScene.css';

/**
 * CombatScene - Tactical hex-based D&D 5e combat controller
 * 
 * Orchestrates turn-based tactical combat on a hex grid battlefield.
 * Manages player actions (movement, attacks, abilities, spells), AI turns,
 * and victory/defeat conditions.
 * 
 * NOTE: Requires combat state in GameStateContext with structure:
 * state.combatState = {
 *   battlefield: { width, height, hexes: [] },
 *   turnOrder: [{ type, character/enemy, position, initiative }],
 *   currentTurnIndex: number,
 *   round: number,
 *   movementRemaining: number,
 *   encounterName: string,
 *   waitingForPlayerAction: boolean
 * }
 * 
 * Required actions: PROCESS_COMBAT_MOVEMENT, PROCESS_COMBAT_ACTION, ADVANCE_COMBAT_TURN
 */
function CombatScene() {
  const { state, dispatch, actions } = useGameState();
  const { addMessage } = useGameLog();
  
  // Stable reference to addMessage to prevent infinite loops
  const addMessageRef = useRef(addMessage);
  useEffect(() => {
    addMessageRef.current = addMessage;
  }, [addMessage]);

  // Local combat UI state
  const [localCombatState, setLocalCombatState] = useState({
    selectedAction: null,  // 'move' | 'attack' | 'spell' | 'ability' | null
    selectedTarget: null,
    hoveredHex: null,
    cameraOffset: { x: 0, y: 0 }, // Will be auto-centered on mount
    cameraZoom: 1.0,
    showAbilityMenu: false,
    showSpellMenu: false,
    attacksUsedThisTurn: 0,
    cameraInitialized: false,
    opportunityAttackPrompt: null // {attackers, target, movement}
  });
  
  // Auto-center camera on battlefield when combat starts
  useEffect(() => {
    if (!state.combatState || !state.combatState.battlefield || localCombatState.cameraInitialized) {
      return;
    }
    
    // Start with camera showing top-left of battlefield
    // Player can pan/zoom to see combatants
    setLocalCombatState(prev => ({
      ...prev,
      cameraOffset: { x: 50, y: 50 },
      cameraInitialized: true
    }));
    
    console.log('[CombatScene] Camera initialized');
  }, [state.combatState, localCombatState.cameraInitialized]);

  /**
   * Get the current combatant from turnOrder
   * @returns {object|null} Current combatant or null
   * Note: Not memoized - will be recreated on every render, but that's okay
   */
  const getCurrentCombatant = () => {
    if (!state.combatState?.turnOrder || state.combatState.currentTurnIndex === undefined) {
      return null;
    }
    return state.combatState.turnOrder[state.combatState.currentTurnIndex];
  };

  /**
   * Handle action selection from ActionPanel
   * @param {string} actionType - 'move', 'attack', 'spell', 'ability'
   */
  const handleActionSelect = useCallback((actionType) => {
    setLocalCombatState(prev => ({
      ...prev,
      selectedAction: actionType,
      selectedTarget: null
    }));

    const actionLabels = {
      move: 'Move',
      attack: 'Attack',
      spell: 'Cast Spell',
      ability: 'Use Ability'
    };

    addMessage(`Selected action: ${actionLabels[actionType] || actionType}`, 'action');
  }, []);

  /**
   * Handle hex click - routes to movement or attack based on selectedAction
   * Only allow clicks on player turns
   * @param {object} hex - Clicked hex {col, row, terrain, ...}
   */
  const handleHexClick = useCallback((hex) => {
    logger.combat.debug('Hex clicked', { hex, selectedAction: localCombatState.selectedAction });
    
    if (!hex || !state.combatState) {
      logger.combat.warn('Invalid hex or combat state', { hasHex: !!hex, hasCombatState: !!state.combatState });
      return;
    }

    const currentCombatant = getCurrentCombatant();
    if (!currentCombatant) {
      logger.combat.warn('No current combatant');
      return;
    }
    
    logger.combat.debug('Current combatant', { 
      name: currentCombatant.name,
      isAlly: currentCombatant.isAlly,
      position: currentCombatant.position
    });
    
    // Only allow player to interact on their party's turn
    if (!currentCombatant.isAlly) {
      addMessage("It's not your turn!", 'warning');
      return;
    }

    // Check if hex contains a target
    const target = state.combatState.turnOrder.find(
      c => c.position.col === hex.col && c.position.row === hex.row
    );

    logger.combat.debug('Hex click routing', {
      selectedAction: localCombatState.selectedAction,
      hasTarget: !!target,
      targetHex: { col: hex.col, row: hex.row }
    });

    if (localCombatState.selectedAction === 'move') {
      logger.combat.info('Routing to handleMovement');
      handleMovement(hex);
    } else if (localCombatState.selectedAction === 'attack' && target) {
      logger.combat.info('Routing to handleAttack');
      handleAttack(target);
    } else if (!localCombatState.selectedAction && target && target !== currentCombatant) {
      // Default: clicking enemy selects attack action
      logger.combat.info('Auto-selecting attack action for enemy target');
      setLocalCombatState(prev => ({
        ...prev,
        selectedAction: 'attack',
        selectedTarget: target
      }));
      addMessage(`Targeting ${target.character?.name || target.enemy?.name}`, 'action');
    } else {
      logger.combat.debug('No action taken for hex click', {
        selectedAction: localCombatState.selectedAction,
        hasTarget: !!target,
        isCurrentCombatant: target === currentCombatant
      });
    }
  }, [localCombatState.selectedAction]);

  /**
   * Handle movement to target hex
   * @param {object} targetHex - Destination hex {col, row}
   */
  const handleMovement = useCallback((targetHex) => {
    if (!state.combatState) return;

    const currentCombatant = getCurrentCombatant();
    if (!currentCombatant) {
      addMessage('No active combatant for movement', 'error');
      return;
    }

    // Check if hex is occupied
    const occupied = state.combatState.turnOrder.some(
      c => c.position.col === targetHex.col && c.position.row === targetHex.row
    );

    if (occupied) {
      addMessage('Hex is occupied', 'warning');
      return;
    }

    // Calculate path
    const path = findPath(
      currentCombatant.position,
      targetHex,
      state.combatState.battlefield,
      state.combatState.turnOrder
    );

    if (!path || path.length === 0) {
      addMessage('No valid path to destination', 'warning');
      return;
    }

    // Check movement cost (in hexes, convert to feet for comparison)
    const moveCost = path.length - 1; // First hex is current position
    const moveCostFeet = moveCost * 5; // Each hex is 5 feet
    
    if (moveCostFeet > state.combatState.movementRemaining) {
      addMessage(`Not enough movement (need ${moveCostFeet} ft, have ${state.combatState.movementRemaining} ft)`, 'warning');
      return;
    }

    // Dispatch movement action
    if (actions.PROCESS_COMBAT_MOVEMENT) {
      logger.combat.info('Dispatching PROCESS_COMBAT_MOVEMENT', {
        currentCombatant: currentCombatant.name,
        combatantId: currentCombatant.id,
        path,
        moveCost,
        moveCostFeet,
        destination: targetHex
      });

      dispatch({
        type: actions.PROCESS_COMBAT_MOVEMENT,
        payload: {
          combatantId: currentCombatant.id,
          path,
          cost: moveCostFeet // Pass feet cost (hexes * 5)
        }
      });

      addMessage(`Moved ${moveCost} hex${moveCost !== 1 ? 'es' : ''} to (${targetHex.col}, ${targetHex.row})`, 'action');

      // Clear selection
      setLocalCombatState(prev => ({
        ...prev,
        selectedAction: null
      }));
    } else {
      logger.combat.error('PROCESS_COMBAT_MOVEMENT action not defined in GameStateContext');
      addMessage('Combat movement not yet implemented', 'error');
    }
  }, [dispatch, actions]);

  /**
   * Handle attack action on target
   * @param {object} target - Target combatant
   */
  const handleAttack = useCallback((target) => {
    if (!state.combatState) return;

    const currentCombatant = getCurrentCombatant();
    if (!currentCombatant) {
      addMessage('No active combatant for attack', 'error');
      return;
    }

    const attacker = currentCombatant.character || currentCombatant.enemy;
    const defender = target.character || target.enemy;

    if (!attacker || !defender) {
      addMessage('Invalid attacker or defender', 'error');
      return;
    }

    // Check line of sight
    const hasLoS = checkLineOfSight(
      currentCombatant.position,
      target.position,
      state.combatState.battlefield
    );

    if (!hasLoS) {
      addMessage('No line of sight to target', 'warning');
      return;
    }

    // Check range (melee range = 1 hex, ranged varies by weapon)
    // TODO: Get actual weapon range from equipped weapon
    const distance = getHexDistance(
      currentCombatant.position.col,
      currentCombatant.position.row,
      target.position.col,
      target.position.row
    );

    const attackRange = 1; // Default melee range
    if (distance > attackRange) {
      addMessage(`Target out of range (${distance} hexes, max ${attackRange})`, 'warning');
      return;
    }

    // Check if Extra Attack available
    const hasExtraAttack = attacker.level >= 5 && localCombatState.attacksUsedThisTurn === 0;

    // Dispatch attack action
    // TODO: This action needs to be added to GameStateContext
    if (actions.PROCESS_COMBAT_ACTION) {
      dispatch({
        type: actions.PROCESS_COMBAT_ACTION,
        payload: {
          actionType: 'attack',
          target: target,
          attacker: currentCombatant
        }
      });

      addMessage(`${attacker.name} attacks ${defender.name}!`, 'encounter');

      // Update attacks used
      setLocalCombatState(prev => ({
        ...prev,
        attacksUsedThisTurn: prev.attacksUsedThisTurn + 1,
        selectedAction: hasExtraAttack ? 'attack' : null,
        selectedTarget: hasExtraAttack ? target : null
      }));

      if (hasExtraAttack) {
        addMessage('Extra Attack available! Select target again', 'info');
      }
    } else {
      logger.combat.error('PROCESS_COMBAT_ACTION action not defined in GameStateContext');
      addMessage('Combat actions not yet implemented', 'error');
    }
  }, [localCombatState.attacksUsedThisTurn, dispatch, actions]);

  /**
   * Handle ability selection from AbilityMenu
   * @param {object} ability - Selected ability
   */
  const handleAbilitySelect = useCallback((ability) => {
    if (!state.combatState) return;

    const currentCombatant = getCurrentCombatant();
    if (!currentCombatant) return;

    // TODO: This action needs to be added to GameStateContext
    if (actions.PROCESS_COMBAT_ACTION) {
      dispatch({
        type: actions.PROCESS_COMBAT_ACTION,
        payload: {
          actionType: 'ability',
          ability: ability,
          user: currentCombatant
        }
      });

      addMessage(`Used ability: ${ability.name}`, 'action');
    } else {
      logger.combat.error('PROCESS_COMBAT_ACTION action not defined in GameStateContext');
      addMessage('Ability actions not yet implemented', 'error');
    }

    setLocalCombatState(prev => ({
      ...prev,
      showAbilityMenu: false,
      selectedAction: null
    }));
  }, [dispatch, actions]);

  /**
   * Handle spell selection from SpellMenu
   * @param {object} spell - Selected spell
   * @param {number} level - Spell slot level used
   */
  const handleSpellSelect = useCallback((spell, level) => {
    if (!state.combatState) return;

    const currentCombatant = getCurrentCombatant();
    if (!currentCombatant) return;

    // TODO: This action needs to be added to GameStateContext
    if (actions.PROCESS_COMBAT_ACTION) {
      dispatch({
        type: actions.PROCESS_COMBAT_ACTION,
        payload: {
          actionType: 'spell',
          spell: spell,
          spellLevel: level,
          caster: currentCombatant
        }
      });

      addMessage(`Cast ${spell.name} (Level ${level})`, 'action');
    } else {
      logger.combat.error('PROCESS_COMBAT_ACTION action not defined in GameStateContext');
      addMessage('Spell actions not yet implemented', 'error');
    }

    setLocalCombatState(prev => ({
      ...prev,
      showSpellMenu: false,
      selectedAction: null
    }));
  }, [dispatch, actions]);

  /**
   * Handle Dodge action
   */
  const handleDodge = useCallback(() => {
    if (!state.combatState) return;

    const currentCombatant = getCurrentCombatant();
    if (!currentCombatant) return;

    // Check if Action already used
    if (state.combatState.turnState.actionUsed) {
      addMessage('You have already used your Action this turn', 'warning');
      return;
    }

    // Use action
    dispatch({
      type: actions.USE_COMBAT_ACTION,
      payload: {
        actionType: 'action',
        actionName: 'dodge'
      }
    });

    // Add Dodging condition
    dispatch({
      type: actions.ADD_COMBAT_CONDITION,
      payload: {
        condition: 'Dodging',
        duration: 'end_of_turn'
      }
    });

    addMessage('Taking Dodge action - attackers have disadvantage against you until your next turn', 'action');

    setLocalCombatState(prev => ({
      ...prev,
      selectedAction: null
    }));
  }, [state.combatState, dispatch, actions, addMessage]);

  /**
   * Handle Dash action (double movement)
   */
  const handleDash = useCallback(() => {
    if (!state.combatState) return;

    const currentCombatant = getCurrentCombatant();
    if (!currentCombatant) return;

    // Check if Action already used
    if (state.combatState.turnState.actionUsed) {
      addMessage('You have already used your Action this turn', 'warning');
      return;
    }

    const character = currentCombatant.character;
    const moveSpeed = character?.moveDistance || 6;
    const additionalMovement = moveSpeed * 5; // Convert hexes to feet

    // Use action
    dispatch({
      type: actions.USE_COMBAT_ACTION,
      payload: {
        actionType: 'action',
        actionName: 'dash'
      }
    });

    // Add movement (set movementRemaining to current + speed)
    dispatch({
      type: actions.SET_COMBAT_TURN_STATE,
      payload: {
        // Don't use SET directly, this is handled by reducer
      }
    });

    addMessage(`Dashing! Gained ${additionalMovement} ft additional movement`, 'action');

    setLocalCombatState(prev => ({
      ...prev,
      selectedAction: null
    }));
  }, [state.combatState, dispatch, actions, addMessage]);

  /**
   * Handle Disengage action
   */
  const handleDisengage = useCallback(() => {
    if (!state.combatState) return;

    const currentCombatant = getCurrentCombatant();
    if (!currentCombatant) return;

    // Check if Action already used
    if (state.combatState.turnState.actionUsed) {
      addMessage('You have already used your Action this turn', 'warning');
      return;
    }

    // Use action
    dispatch({
      type: actions.USE_COMBAT_ACTION,
      payload: {
        actionType: 'action',
        actionName: 'disengage'
      }
    });

    // Add Disengaged condition
    dispatch({
      type: actions.ADD_COMBAT_CONDITION,
      payload: {
        condition: 'Disengaged',
        duration: 'end_of_turn'
      }
    });

    addMessage('You Disengage - your movement will not provoke opportunity attacks', 'action');

    setLocalCombatState(prev => ({
      ...prev,
      selectedAction: null
    }));
  }, [state.combatState, dispatch, actions, addMessage]);

  /**
   * Handle Help action
   */
  const handleHelp = useCallback((targetAlly) => {
    if (!state.combatState) return;

    const currentCombatant = getCurrentCombatant();
    if (!currentCombatant) return;

    // Check if Action already used
    if (state.combatState.turnState.actionUsed) {
      addMessage('You have already used your Action this turn', 'warning');
      return;
    }

    // Check target is within 1 hex (5 feet)
    const distance = getHexDistance(
      currentCombatant.position.col,
      currentCombatant.position.row,
      targetAlly.position.col,
      targetAlly.position.row
    );

    if (distance > 1) {
      addMessage('Target must be within 5 feet (1 hex) to Help', 'warning');
      return;
    }

    // Use action
    dispatch({
      type: actions.USE_COMBAT_ACTION,
      payload: {
        actionType: 'action',
        actionName: 'help',
        target: targetAlly
      }
    });

    // Add Helped condition to ally
    dispatch({
      type: actions.ADD_COMBAT_CONDITION,
      payload: {
        targetId: targetAlly.id,
        condition: 'Helped',
        duration: 'next_attack'
      }
    });

    addMessage(`You Help ${targetAlly.name} - they have advantage on their next attack`, 'action');

    setLocalCombatState(prev => ({
      ...prev,
      selectedAction: null
    }));
  }, [state.combatState, dispatch, actions, addMessage]);

  /**
   * Handle Hide action
   */
  const handleHide = useCallback(() => {
    if (!state.combatState) return;

    const currentCombatant = getCurrentCombatant();
    if (!currentCombatant) return;

    // Check if Action already used
    if (state.combatState.turnState.actionUsed) {
      addMessage('You have already used your Action this turn', 'warning');
      return;
    }

    const character = currentCombatant.character;
    if (!character) return;

    // Make Stealth check
    const dexMod = character.getModifier('dexterity');
    const proficient = character.proficiencies.includes('Stealth');
    const stealthBonus = dexMod + (proficient ? character.proficiencyBonus : 0);
    
    const diceRoller = new DiceRoller(null, addMessage);
    const roll = diceRoller.rollD20();
    const total = roll + stealthBonus;

    // Find highest enemy Perception (passive = 10 + WIS mod)
    const enemies = state.combatState.turnOrder.filter(c => c.isEnemy && c.currentHP > 0);
    const highestPerception = Math.max(...enemies.map(e => {
      const enemy = e.enemy;
      const wisMod = enemy ? enemy.getModifier('wisdom') : 0;
      return 10 + wisMod;
    }));

    const success = total >= highestPerception;

    // Use action
    dispatch({
      type: actions.USE_COMBAT_ACTION,
      payload: {
        actionType: 'action',
        actionName: 'hide'
      }
    });

    if (success) {
      dispatch({
        type: actions.ADD_COMBAT_CONDITION,
        payload: {
          condition: 'Hidden',
          duration: 'until_revealed',
          data: { stealthTotal: total }
        }
      });
      addMessage(`Stealth ${roll}+${stealthBonus}=${total} vs DC ${highestPerception}: Hidden!`, 'success');
    } else {
      addMessage(`Stealth ${roll}+${stealthBonus}=${total} vs DC ${highestPerception}: Failed to hide`, 'warning');
    }

    setLocalCombatState(prev => ({
      ...prev,
      selectedAction: null
    }));
  }, [state.combatState, dispatch, actions, addMessage]);

  /**
   * Handle Search action
   */
  const handleSearch = useCallback(() => {
    if (!state.combatState) return;

    const currentCombatant = getCurrentCombatant();
    if (!currentCombatant) return;

    // Check if Action already used
    if (state.combatState.turnState.actionUsed) {
      addMessage('You have already used your Action this turn', 'warning');
      return;
    }

    const character = currentCombatant.character;
    if (!character) return;

    // Make Perception check
    const wisMod = character.getModifier('wisdom');
    const proficient = character.proficiencies.includes('Perception');
    const perceptionBonus = wisMod + (proficient ? character.proficiencyBonus : 0);
    
    const diceRoller = new DiceRoller(null, addMessage);
    const roll = diceRoller.rollD20();
    const total = roll + perceptionBonus;

    // Use action
    dispatch({
      type: actions.USE_COMBAT_ACTION,
      payload: {
        actionType: 'action',
        actionName: 'search'
      }
    });

    // Find hidden enemies
    const hiddenEnemies = state.combatState.turnOrder.filter(c => 
      c.isEnemy && 
      c.conditions?.some(cond => cond.type === 'Hidden')
    );

    let foundAny = false;
    hiddenEnemies.forEach(enemy => {
      const hiddenCondition = enemy.conditions.find(c => c.type === 'Hidden');
      const hiddenDC = hiddenCondition?.data?.stealthTotal || 15;
      
      if (total >= hiddenDC) {
        dispatch({
          type: actions.REMOVE_COMBAT_CONDITION,
          payload: { targetId: enemy.id, condition: 'Hidden' }
        });
        addMessage(`Perception ${roll}+${perceptionBonus}=${total}: Found ${enemy.name}!`, 'success');
        foundAny = true;
      }
    });

    if (!foundAny) {
      addMessage(`Perception ${roll}+${perceptionBonus}=${total}: Found nothing`, 'info');
    }

    setLocalCombatState(prev => ({
      ...prev,
      selectedAction: null
    }));
  }, [state.combatState, dispatch, actions, addMessage]);

  /**
   * Handle end turn
   */
  const handleEndTurn = useCallback(() => {
    if (!state.combatState) return;

    const currentCombatant = getCurrentCombatant();
    if (!currentCombatant) return;

    const combatantName = currentCombatant.character?.name || currentCombatant.enemy?.name;
    addMessage(`${combatantName} ended their turn`, 'action');

    // Reset attacks used
    setLocalCombatState(prev => ({
      ...prev,
      attacksUsedThisTurn: 0,
      selectedAction: null,
      selectedTarget: null
    }));

    // Advance turn
    // TODO: This action needs to be added to GameStateContext
    if (actions.ADVANCE_COMBAT_TURN) {
      dispatch({
        type: actions.ADVANCE_COMBAT_TURN
      });

      // Check if next combatant is AI
      const nextIndex = (state.combatState.currentTurnIndex + 1) % state.combatState.turnOrder.length;
      const nextCombatant = state.combatState.turnOrder[nextIndex];

      if (nextCombatant && nextCombatant.type === 'enemy') {
        // AI turn will be processed by useEffect
        addMessage(`${nextCombatant.enemy?.name}'s turn`, 'encounter');
      }
    } else {
      logger.combat.error('ADVANCE_COMBAT_TURN action not defined in GameStateContext');
      addMessage('Turn advancement not yet implemented', 'error');
    }
  }, [dispatch, actions]);

  /**
   * Process AI turn - memoized to prevent recreation
   */
  const processAITurnRef = useRef();
  processAITurnRef.current = (combatant) => {
    if (!combatant || !combatant.enemy) {
      logger.combat.error('processAITurn called with invalid combatant', { combatant });
      return;
    }
    
    // Null check combat state (might be undefined if component unmounted)
    if (!state.combatState || !state.combatState.battlefield) {
      logger.combat.error('processAITurn called but combat state is invalid');
      return;
    }

    const enemy = combatant.enemy;
    addMessageRef.current(`${enemy.name} is thinking...`, 'encounter');

    // Use EnemyAI to decide action
    const action = EnemyAI.decideAction(
      combatant,
      state.combatState.battlefield,
      state.combatState.turnOrder,
      state.combatState.movementRemaining
    );

    // Wait 800ms for player to see AI thinking
    setTimeout(() => {
      // Check again that combat is still active before dispatching
      if (!state.combatState) {
        logger.combat.warn('Combat ended during AI turn processing');
        return;
      }
      
      if (action.type === 'move') {
        addMessageRef.current(`${enemy.name} moves to (${action.destination.col}, ${action.destination.row})`, 'encounter');

        if (actions.PROCESS_COMBAT_MOVEMENT) {
          dispatch({
            type: actions.PROCESS_COMBAT_MOVEMENT,
            payload: {
              path: action.path,
              cost: action.moveCost * 5 // Convert hexes to feet
            }
          });
        }
      } else if (action.type === 'attack') {
        const targetName = action.target.character?.name || action.target.enemy?.name;
        addMessageRef.current(`${enemy.name} attacks ${targetName}!`, 'encounter');

        if (actions.PROCESS_COMBAT_ACTION) {
          dispatch({
            type: actions.PROCESS_COMBAT_ACTION,
            payload: {
              actionType: 'attack',
              target: action.target,
              attacker: combatant
            }
          });
        }
      }

      // Wait 500ms more, then advance turn
      setTimeout(() => {
        // Final check that combat is still active
        if (!state.combatState) {
          logger.combat.warn('Combat ended during AI turn advancement');
          return;
        }
        
        if (actions.ADVANCE_COMBAT_TURN) {
          dispatch({
            type: actions.ADVANCE_COMBAT_TURN
          });
        }
      }, 500);
    }, 800);
  };
  
  const processAITurn = useCallback((combatant) => {
    processAITurnRef.current(combatant);
  }, []);

  /**
   * Auto-process AI turns (enemies only)
   * Track which turn has been processed to prevent infinite loops
   */
  const lastProcessedTurnRef = useRef(null);
  
  useEffect(() => {
    if (!state.combatState) return;
    
    const currentTurnIndex = state.combatState.currentTurnIndex;
    const waitingForPlayer = state.combatState.waitingForPlayerAction;
    
    // Skip if already processed this turn
    if (lastProcessedTurnRef.current === currentTurnIndex) {
      return;
    }
    
    const currentCombatant = getCurrentCombatant();
    if (!currentCombatant) return;
    
    console.log('[CombatScene] Turn check:', {
      combatant: currentCombatant.name,
      isAlly: currentCombatant.isAlly,
      isEnemy: currentCombatant.isEnemy,
      waitingForPlayer,
      currentTurnIndex
    });
    
    // Only process AI turns (enemies)
    if (currentCombatant.isEnemy && !waitingForPlayer) {
      lastProcessedTurnRef.current = currentTurnIndex;
      processAITurn(currentCombatant);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.combatState?.currentTurnIndex, state.combatState?.waitingForPlayerAction]);
  // NOTE: Dependencies are primitive values that only change when turn actually advances

  /**
   * Check for victory/defeat after combat state changes
   * Only check when turn order actually changes (HP updates)
   */
  const combatEndHandledRef = useRef(false);
  const turnOrderHashRef = useRef('');
  
  useEffect(() => {
    if (!state.combatState || combatEndHandledRef.current) return;

    // Create a hash of HP values to detect actual changes
    const hpHash = state.combatState.turnOrder
      .map(c => {
        return `${c.id}:${c.currentHP}`;
      })
      .join('|');
    
    // Skip if HP values haven't changed
    if (turnOrderHashRef.current === hpHash) return;
    turnOrderHashRef.current = hpHash;

    const livingCharacters = state.combatState.turnOrder.filter(
      c => c.isAlly && c.currentHP > 0
    );
    const livingEnemies = state.combatState.turnOrder.filter(
      c => c.isEnemy && c.currentHP > 0
    );

    console.log('[CombatScene] Victory/defeat check:', {
      livingCharacters: livingCharacters.length,
      livingEnemies: livingEnemies.length,
      characterNames: livingCharacters.map(c => c.name),
      enemyNames: livingEnemies.map(c => c.name)
    });

    if (livingEnemies.length === 0 && livingCharacters.length > 0) {
      combatEndHandledRef.current = true;
      addMessageRef.current('Victory! All enemies defeated!', 'success');
      setTimeout(() => {
        dispatch({
          type: actions.SET_CURRENT_SCENE,
          payload: 'overworld'
        });
      }, 2000);
    } else if (livingCharacters.length === 0) {
      combatEndHandledRef.current = true;
      addMessageRef.current('Defeat! All party members have fallen...', 'error');
      setTimeout(() => {
        dispatch({
          type: actions.SET_CURRENT_SCENE,
          payload: 'gameOver'
        });
      }, 2000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.combatState?.currentTurnIndex]);
  // NOTE: Check on turn index change instead of turnOrder array reference
  // This prevents checking on every render while still catching HP changes

  /**
   * ESC key to deselect action
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setLocalCombatState(prev => ({
          ...prev,
          selectedAction: null,
          selectedTarget: null,
          showAbilityMenu: false,
          showSpellMenu: false
        }));
        addMessageRef.current('Action cancelled', 'info');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // No dependencies - stable function

  // Null check - combat state not initialized
  if (!state.combatState) {
    console.error('[CombatScene] state.combatState is null - showing error screen');
    logger.combat.error('CombatScene: state.combatState is null');
    return (
      <div className="combat-scene error-state">
        <h2>Combat state not initialized</h2>
        <p>Combat system is not yet fully implemented in GameStateContext.</p>
        <button onClick={() => dispatch({ type: actions.SET_CURRENT_SCENE, payload: 'overworld' })}>
          Return to Overworld
        </button>
      </div>
    );
  }
  
  // Null check - battlefield not generated
  if (!state.combatState.battlefield || !state.combatState.battlefield.hexes) {
    console.error('[CombatScene] Battlefield not generated - showing error screen', {
      hasBattlefield: !!state.combatState.battlefield,
      hasHexes: !!state.combatState.battlefield?.hexes,
      hexCount: state.combatState.battlefield?.hexes?.length,
      combatState: state.combatState
    });
    logger.combat.error('CombatScene: battlefield not generated', { combatState: state.combatState });
    return (
      <div className="combat-scene error-state">
        <h2>Battlefield not generated</h2>
        <p>Failed to generate combat battlefield. This is a bug.</p>
        <button onClick={() => dispatch({ type: actions.SET_CURRENT_SCENE, payload: 'overworld' })}>
          Return to Overworld
        </button>
      </div>
    );
  }
  
  console.log('[CombatScene] Rendering combat UI', {
    encounterName: state.combatState.encounterName,
    round: state.combatState.round,
    turnOrderCount: state.combatState.turnOrder?.length,
    hexCount: state.combatState.battlefield?.hexes?.length
  });
  
  // Removed debug logging (combat rendering normally)
  
  // Debug logging - minimal tracking to catch infinite loops
  const renderCountRef = useRef(0);
  const renderTimestampRef = useRef(Date.now());
  
  renderCountRef.current++;
  
  // Reset counter every 5 seconds
  const now = Date.now();
  if (now - renderTimestampRef.current > 5000) {
    if (renderCountRef.current > 50) {
      logger.render.warn('CombatScene: excessive renders', { renderCount: renderCountRef.current, timeWindow: '5s' });
    }
    renderCountRef.current = 0;
    renderTimestampRef.current = now;
  }
  
  // Safety check - stop if truly infinite (increased threshold from 200 to 500)
  if (renderCountRef.current > 500) {
    logger.render.error('CombatScene: Infinite render loop detected!', { renderCount: renderCountRef.current });
    logger.combat.error('Combat state during infinite loop', { combatState: state.combatState });
    throw new Error('Infinite render loop in CombatScene');
  }

  const currentCombatant = getCurrentCombatant();
  
  // Memoize callbacks to prevent infinite loops in child components
  const handleHexHover = useCallback((hex) => {
    setLocalCombatState(prev => ({...prev, hoveredHex: hex}));
  }, []);
  
  const handleCameraChange = useCallback((offset, zoom) => {
    setLocalCombatState(prev => ({...prev, cameraOffset: offset, cameraZoom: zoom}));
  }, []);

  return (
    <div className="combat-scene">
      <div className="combat-header">
        <h2>{state.combatState.encounterName || 'Combat'}</h2>
        <span className="round-indicator">Round {state.combatState.round}</span>
      </div>
      
      <div className="combat-main">
        <div className="combat-canvas-container">
          <CombatCanvas
            battlefield={state.combatState.battlefield}
            combatants={state.combatState.turnOrder}
            currentTurnIndex={state.combatState.currentTurnIndex}
            selectedAction={localCombatState.selectedAction}
            hoveredHex={localCombatState.hoveredHex}
            movementRemaining={state.combatState.movementRemaining}
            onHexClick={handleHexClick}
            onHexHover={handleHexHover}
            cameraOffset={localCombatState.cameraOffset}
            cameraZoom={localCombatState.cameraZoom}
            onCameraChange={handleCameraChange}
          />
        </div>
        
        <TurnOrderPanel
          turnOrder={state.combatState.turnOrder}
          currentTurnIndex={state.combatState.currentTurnIndex}
          round={state.combatState.round}
        />
      </div>
      
      <div className="combat-actions">
        {currentCombatant && currentCombatant.isAlly ? (
          <ActionPanel
            combatant={currentCombatant}
            selectedAction={localCombatState.selectedAction}
            movementRemaining={state.combatState.movementRemaining}
            turnState={state.combatState.turnState}
            attacksUsedThisTurn={localCombatState.attacksUsedThisTurn}
            onActionSelect={handleActionSelect}
            onAbilityClick={() => setLocalCombatState(prev => ({...prev, showAbilityMenu: true}))}
            onSpellClick={() => setLocalCombatState(prev => ({...prev, showSpellMenu: true}))}
            onDodgeClick={handleDodge}
            onDashClick={handleDash}
            onDisengageClick={handleDisengage}
            onHelpClick={handleHelp}
            onHideClick={handleHide}
            onSearchClick={handleSearch}
            onEndTurn={handleEndTurn}
          />
        ) : currentCombatant && currentCombatant.isEnemy ? (
          <div className="enemy-turn-indicator" style={{
            padding: '1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-lighter)',
            border: '2px solid var(--border-color)',
            borderRadius: '8px'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#ff6b6b', fontSize: '1.3rem' }}>
              {currentCombatant.name}'s Turn
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Enemy is taking their turn...
            </p>
          </div>
        ) : null}
      </div>
      
      {localCombatState.showAbilityMenu && currentCombatant && (
        <AbilityMenu
          character={currentCombatant.character}
          onSelect={handleAbilitySelect}
          onClose={() => setLocalCombatState(prev => ({...prev, showAbilityMenu: false}))}
        />
      )}
      
      {localCombatState.showSpellMenu && currentCombatant && (
        <SpellMenu
          character={currentCombatant.character}
          onSelect={handleSpellSelect}
          onClose={() => setLocalCombatState(prev => ({...prev, showSpellMenu: false}))}
        />
      )}

      {/* Opportunity Attack Prompt */}
      {localCombatState.opportunityAttackPrompt && (
        <OpportunityAttackPrompt
          attackers={localCombatState.opportunityAttackPrompt.attackers}
          target={localCombatState.opportunityAttackPrompt.target}
          onConfirm={() => {
            // Process OAs then move
            const { attackers, target, movement } = localCombatState.opportunityAttackPrompt;
            
            // TODO: Process each attacker's opportunity attack
            attackers.forEach(attacker => {
              // Mark reaction as used
              dispatch({
                type: actions.USE_COMBAT_REACTION,
                payload: { combatantId: attacker.id }
              });
              
              // TODO: Process attack roll and damage
              addMessage(`${attacker.name} makes opportunity attack against ${target.name}!`, 'encounter');
            });

            // Clear prompt and process movement
            setLocalCombatState(prev => ({ ...prev, opportunityAttackPrompt: null }));
            
            // Now process the movement
            if (movement && actions.PROCESS_COMBAT_MOVEMENT) {
              dispatch({
                type: actions.PROCESS_COMBAT_MOVEMENT,
                payload: movement
              });
            }
          }}
          onDecline={() => {
            // Cancel movement
            setLocalCombatState(prev => ({ ...prev, opportunityAttackPrompt: null }));
            addMessage('Movement cancelled', 'info');
          }}
        />
      )}
    </div>
  );
}

/**
 * Helper: Calculate hex distance
 * @param {number} col1 - Start column
 * @param {number} row1 - Start row
 * @param {number} col2 - End column
 * @param {number} row2 - End row
 * @returns {number} Hex distance
 */
function getHexDistance(col1, row1, col2, row2) {
  const x1 = col1 - Math.floor(row1 / 2);
  const z1 = row1;
  const y1 = -x1 - z1;

  const x2 = col2 - Math.floor(row2 / 2);
  const z2 = row2;
  const y2 = -x2 - z2;

  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}

// No props expected - scene component
CombatScene.propTypes = {};

export default CombatScene;
