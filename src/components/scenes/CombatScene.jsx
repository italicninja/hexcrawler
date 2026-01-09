import { useState, useEffect, useCallback } from 'react';
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

  // Local combat UI state
  const [localCombatState, setLocalCombatState] = useState({
    selectedAction: null,  // 'move' | 'attack' | 'spell' | 'ability' | null
    selectedTarget: null,
    hoveredHex: null,
    cameraOffset: { x: 100, y: 50 }, // Initial offset to center battlefield
    cameraZoom: 1.0,
    showAbilityMenu: false,
    showSpellMenu: false,
    attacksUsedThisTurn: 0
  });

  /**
   * Get the current combatant from turnOrder
   * @returns {object|null} Current combatant or null
   */
  const getCurrentCombatant = useCallback(() => {
    if (!state.combatState?.turnOrder || state.combatState.currentTurnIndex === undefined) {
      return null;
    }
    return state.combatState.turnOrder[state.combatState.currentTurnIndex];
  }, [state.combatState]);

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
  }, [addMessage]);

  /**
   * Handle hex click - routes to movement or attack based on selectedAction
   * @param {object} hex - Clicked hex {col, row, terrain, ...}
   */
  const handleHexClick = useCallback((hex) => {
    if (!hex || !state.combatState) return;

    const currentCombatant = getCurrentCombatant();
    if (!currentCombatant) return;

    // Check if hex contains a target
    const target = state.combatState.turnOrder.find(
      c => c.position.col === hex.col && c.position.row === hex.row
    );

    if (localCombatState.selectedAction === 'move') {
      handleMovement(hex);
    } else if (localCombatState.selectedAction === 'attack' && target) {
      handleAttack(target);
    } else if (!localCombatState.selectedAction && target && target !== currentCombatant) {
      // Default: clicking enemy selects attack action
      setLocalCombatState(prev => ({
        ...prev,
        selectedAction: 'attack',
        selectedTarget: target
      }));
      addMessage(`Targeting ${target.character?.name || target.enemy?.name}`, 'action');
    }
  }, [localCombatState.selectedAction, state.combatState, getCurrentCombatant, addMessage]);

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

    // Check movement cost
    const moveCost = path.length - 1; // First hex is current position
    if (moveCost > state.combatState.movementRemaining) {
      addMessage(`Not enough movement (need ${moveCost}, have ${state.combatState.movementRemaining})`, 'warning');
      return;
    }

    // Dispatch movement action
    // TODO: This action needs to be added to GameStateContext
    if (actions.PROCESS_COMBAT_MOVEMENT) {
      dispatch({
        type: actions.PROCESS_COMBAT_MOVEMENT,
        payload: {
          path,
          moveCost
        }
      });

      addMessage(`Moved to (${targetHex.col}, ${targetHex.row})`, 'action');

      // Clear selection
      setLocalCombatState(prev => ({
        ...prev,
        selectedAction: null
      }));
    } else {
      console.error('PROCESS_COMBAT_MOVEMENT action not defined in GameStateContext');
      addMessage('Combat movement not yet implemented', 'error');
    }
  }, [state.combatState, getCurrentCombatant, dispatch, actions, addMessage]);

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
      console.error('PROCESS_COMBAT_ACTION action not defined in GameStateContext');
      addMessage('Combat actions not yet implemented', 'error');
    }
  }, [state.combatState, getCurrentCombatant, localCombatState.attacksUsedThisTurn, dispatch, actions, addMessage]);

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
      console.error('PROCESS_COMBAT_ACTION action not defined in GameStateContext');
      addMessage('Ability actions not yet implemented', 'error');
    }

    setLocalCombatState(prev => ({
      ...prev,
      showAbilityMenu: false,
      selectedAction: null
    }));
  }, [state.combatState, getCurrentCombatant, dispatch, actions, addMessage]);

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
      console.error('PROCESS_COMBAT_ACTION action not defined in GameStateContext');
      addMessage('Spell actions not yet implemented', 'error');
    }

    setLocalCombatState(prev => ({
      ...prev,
      showSpellMenu: false,
      selectedAction: null
    }));
  }, [state.combatState, getCurrentCombatant, dispatch, actions, addMessage]);

  /**
   * Handle Dodge action
   */
  const handleDodge = useCallback(() => {
    if (!state.combatState) return;

    const currentCombatant = getCurrentCombatant();
    if (!currentCombatant) return;

    // TODO: This action needs to be added to GameStateContext
    if (actions.PROCESS_COMBAT_ACTION) {
      dispatch({
        type: actions.PROCESS_COMBAT_ACTION,
        payload: {
          actionType: 'dodge',
          user: currentCombatant
        }
      });

      addMessage('Taking Dodge action - disadvantage on attacks against you until next turn', 'action');
    } else {
      console.error('PROCESS_COMBAT_ACTION action not defined in GameStateContext');
      addMessage('Dodge action not yet implemented', 'error');
    }

    setLocalCombatState(prev => ({
      ...prev,
      selectedAction: null
    }));
  }, [state.combatState, getCurrentCombatant, dispatch, actions, addMessage]);

  /**
   * Handle Dash action (double movement)
   */
  const handleDash = useCallback(() => {
    if (!state.combatState) return;

    const currentCombatant = getCurrentCombatant();
    if (!currentCombatant) return;

    const character = currentCombatant.character;
    if (!character) return;

    // Double movement remaining
    // TODO: This action needs to be added to GameStateContext
    if (actions.PROCESS_COMBAT_ACTION) {
      dispatch({
        type: actions.PROCESS_COMBAT_ACTION,
        payload: {
          actionType: 'dash',
          user: currentCombatant
        }
      });

      addMessage(`Dashing! Movement doubled to ${character.moveDistance * 2} hexes`, 'action');
    } else {
      console.error('PROCESS_COMBAT_ACTION action not defined in GameStateContext');
      addMessage('Dash action not yet implemented', 'error');
    }

    setLocalCombatState(prev => ({
      ...prev,
      selectedAction: null
    }));
  }, [state.combatState, getCurrentCombatant, dispatch, actions, addMessage]);

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
      console.error('ADVANCE_COMBAT_TURN action not defined in GameStateContext');
      addMessage('Turn advancement not yet implemented', 'error');
    }
  }, [state.combatState, getCurrentCombatant, dispatch, actions, addMessage]);

  /**
   * Process AI turn
   */
  const processAITurn = useCallback((combatant) => {
    if (!combatant || !combatant.enemy) return;

    const enemy = combatant.enemy;
    addMessage(`${enemy.name} is thinking...`, 'encounter');

    // Use EnemyAI to decide action
    const action = EnemyAI.decideAction(
      combatant,
      state.combatState.battlefield,
      state.combatState.turnOrder,
      state.combatState.movementRemaining
    );

    // Wait 800ms for player to see AI thinking
    setTimeout(() => {
      if (action.type === 'move') {
        addMessage(`${enemy.name} moves to (${action.destination.col}, ${action.destination.row})`, 'encounter');

        if (actions.PROCESS_COMBAT_MOVEMENT) {
          dispatch({
            type: actions.PROCESS_COMBAT_MOVEMENT,
            payload: {
              path: action.path,
              moveCost: action.moveCost
            }
          });
        }
      } else if (action.type === 'attack') {
        const targetName = action.target.character?.name || action.target.enemy?.name;
        addMessage(`${enemy.name} attacks ${targetName}!`, 'encounter');

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
        if (actions.ADVANCE_COMBAT_TURN) {
          dispatch({
            type: actions.ADVANCE_COMBAT_TURN
          });
        }
      }, 500);
    }, 800);
  }, [state.combatState, dispatch, actions, addMessage]);

  /**
   * Auto-process AI turns when waitingForPlayerAction is false
   */
  useEffect(() => {
    if (!state.combatState?.waitingForPlayerAction) {
      const currentCombatant = getCurrentCombatant();
      if (currentCombatant && currentCombatant.type === 'enemy') {
        processAITurn(currentCombatant);
      }
    }
  }, [state.combatState?.waitingForPlayerAction, state.combatState?.currentTurnIndex, getCurrentCombatant, processAITurn]);

  /**
   * Check for victory/defeat after combat state changes
   */
  useEffect(() => {
    if (!state.combatState) return;

    const livingCharacters = state.combatState.turnOrder.filter(
      c => c.type === 'character' && c.character?.currentHP > 0
    );
    const livingEnemies = state.combatState.turnOrder.filter(
      c => c.type === 'enemy' && c.enemy?.currentHP > 0
    );

    if (livingEnemies.length === 0 && livingCharacters.length > 0) {
      addMessage('Victory! All enemies defeated!', 'success');
      // TODO: Transition to victory screen or back to overworld
      setTimeout(() => {
        dispatch({
          type: actions.SET_CURRENT_SCENE,
          payload: 'overworld'
        });
      }, 2000);
    } else if (livingCharacters.length === 0) {
      addMessage('Defeat! All party members have fallen...', 'error');
      // TODO: Transition to game over screen
      setTimeout(() => {
        dispatch({
          type: actions.SET_CURRENT_SCENE,
          payload: 'gameOver'
        });
      }, 2000);
    }
  }, [state.combatState?.turnOrder, dispatch, actions, addMessage]);

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
        addMessage('Action cancelled', 'info');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addMessage]);

  // Null check - combat state not initialized
  if (!state.combatState) {
    console.error('CombatScene: state.combatState is null');
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
  
  // Debug logging
  console.log('CombatScene rendering with state:', {
    hasCombatState: !!state.combatState,
    hasBattlefield: !!state.combatState?.battlefield,
    battlefieldHexes: state.combatState?.battlefield?.hexes?.length,
    turnOrderLength: state.combatState?.turnOrder?.length,
    currentTurn: state.combatState?.currentTurnIndex
  });

  const currentCombatant = getCurrentCombatant();

  return (
    <div className="combat-scene">
      <div className="combat-header">
        <h2>{state.combatState.encounterName || 'Combat'}</h2>
        <span className="round-indicator">Round {state.combatState.round}</span>
      </div>
      
      <div className="combat-main">
        <CombatCanvas
          battlefield={state.combatState.battlefield}
          combatants={state.combatState.turnOrder}
          currentTurnIndex={state.combatState.currentTurnIndex}
          selectedAction={localCombatState.selectedAction}
          hoveredHex={localCombatState.hoveredHex}
          movementRemaining={state.combatState.movementRemaining}
          onHexClick={handleHexClick}
          onHexHover={(hex) => setLocalCombatState(prev => ({...prev, hoveredHex: hex}))}
          cameraOffset={localCombatState.cameraOffset}
          cameraZoom={localCombatState.cameraZoom}
          onCameraChange={(offset, zoom) => setLocalCombatState(prev => ({...prev, cameraOffset: offset, cameraZoom: zoom}))}
        />
        
        <TurnOrderPanel
          turnOrder={state.combatState.turnOrder}
          currentTurnIndex={state.combatState.currentTurnIndex}
          round={state.combatState.round}
        />
      </div>
      
      <div className="combat-actions">
        {currentCombatant && (
          <ActionPanel
            combatant={currentCombatant}
            selectedAction={localCombatState.selectedAction}
            movementRemaining={state.combatState.movementRemaining}
            attacksUsedThisTurn={localCombatState.attacksUsedThisTurn}
            onActionSelect={handleActionSelect}
            onAbilityClick={() => setLocalCombatState(prev => ({...prev, showAbilityMenu: true}))}
            onSpellClick={() => setLocalCombatState(prev => ({...prev, showSpellMenu: true}))}
            onDodgeClick={handleDodge}
            onDashClick={handleDash}
            onEndTurn={handleEndTurn}
          />
        )}
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

      {/* TODO: Add reaction prompts (future feature) */}
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
