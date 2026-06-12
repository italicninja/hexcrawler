/**
 * useCombatOrchestration — everything OverworldScene needs to run a combat:
 * victory/defeat detection, initiative logging, the AI turn system, and the
 * player-facing combat handlers (hex clicks, end turn, animation completion).
 *
 * Extracted from OverworldScene.tsx (TODO #3). The hook must be mounted for
 * the whole lifetime of the scene — its effects are self-guarding when no
 * combat is active.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import logger from '../utils/logger';
import { useGameState } from '../contexts/GameStateContext';
import { useGameLog } from '../contexts/GameLogContext';
import { getXPForCR } from '../game/Combat';
import { findPath } from '../game/Pathfinding';
import { AIEngine } from '../game/ai/AIEngine';
import type { CombatTurnEntry } from '../types/state';
import type { CombatUIState } from '../types/scene';

export function useCombatOrchestration() {
  const { state, dispatch, actions, getHexDistance } = useGameState();
  const { addMessage } = useGameLog();

  // Combat ability menu
  const [showAbilityMenu, setShowAbilityMenu] = useState(false);

  // Combat UI state
  const [combatUIState, setCombatUIState] = useState<CombatUIState>({
    selectedAction: null,
    selectedTarget: null,
    hoveredHex: null,
    cameraOffset: { x: 50, y: 50 },
    cameraZoom: 1.0, // Locked at 1.0 - zoom disabled in combat
    attacksUsedThisTurn: 0,
  });

  // Check for victory/defeat in combat
  const combatEndHandledRef = useRef(false);
  const combatStartRoundRef = useRef<number | null>(null);

  // Tracks "round:index" of the turn currently being processed.
  const lastProcessedTurnRef = useRef<string | null>(null);
  // Holds the fallback timeout ID so onAnimationComplete can cancel it early.
  const aiTimeoutRefs = useRef<{
    turnTimeout: ReturnType<typeof setTimeout> | null;
    victory: ReturnType<typeof setTimeout> | null;
    defeat: ReturnType<typeof setTimeout> | null;
  }>({
    turnTimeout: null,
    victory: null,
    defeat: null,
  });
  // Set to true when an AI move animation is running; advance fires from onAnimationComplete.
  const pendingAIAdvanceRef = useRef(false);

  useEffect(() => {
    if (!state.combatState) {
      combatEndHandledRef.current = false;
      combatStartRoundRef.current = null;
      return;
    }

    // Don't check on the very first round/turn (combat just started)
    if (combatStartRoundRef.current === null) {
      combatStartRoundRef.current = state.combatState.round;
      logger.combat.debug('Combat started, skipping initial victory check');
      return;
    }

    // Already handled combat end
    if (combatEndHandledRef.current) return;

    const livingAllies = state.combatState.turnOrder.filter(c => c.isAlly && c.currentHP > 0);
    const livingEnemies = state.combatState.turnOrder.filter(c => c.isEnemy && c.currentHP > 0);

    logger.combat.debug('Victory check', {
      livingAllies: livingAllies.length,
      livingEnemies: livingEnemies.length,
      allAllies: state.combatState.turnOrder
        .filter(c => c.isAlly)
        .map(c => ({ name: c.name, hp: c.currentHP })),
      allEnemies: state.combatState.turnOrder
        .filter(c => c.isEnemy)
        .map(c => ({ name: c.name, hp: c.currentHP })),
    });

    if (livingEnemies.length === 0 && livingAllies.length > 0) {
      combatEndHandledRef.current = true;

      // Calculate XP from all defeated enemies
      const defeatedEnemies = state.combatState.turnOrder.filter(c => c.isEnemy && c.enemy);
      const totalXP = defeatedEnemies.reduce((sum, c) => sum + getXPForCR(c.enemy.cr ?? 0), 0);
      const livingAllyCount = livingAllies.length;
      const xpPerCharacter = livingAllyCount > 0 ? Math.floor(totalXP / livingAllyCount) : 0;

      addMessage('Victory! All enemies defeated!', 'success');

      if (defeatedEnemies.length > 0) {
        defeatedEnemies.forEach(c => {
          const xp = getXPForCR(c.enemy.cr ?? 0);
          addMessage(`  ${c.name} defeated — ${xp} XP (CR ${c.enemy.cr ?? 0})`, 'info');
        });
        addMessage(
          `Total XP: ${totalXP} / ${livingAllyCount} ally = ${xpPerCharacter} XP each`,
          'success'
        );
      }

      aiTimeoutRefs.current.victory = setTimeout(() => {
        if (xpPerCharacter > 0) {
          dispatch({ type: actions.AWARD_XP, payload: { xp: xpPerCharacter } });
        }
        dispatch({ type: actions.END_COMBAT, payload: { victory: true } });
        aiTimeoutRefs.current.victory = null;
      }, 2000);
    } else if (livingAllies.length === 0) {
      combatEndHandledRef.current = true;
      addMessage('Defeat! All party members have fallen...', 'error');
      aiTimeoutRefs.current.defeat = setTimeout(() => {
        dispatch({ type: actions.SET_CURRENT_SCENE, payload: 'gameover' });
        aiTimeoutRefs.current.defeat = null;
      }, 2000);
    }

    return () => {
      if (aiTimeoutRefs.current.victory) {
        clearTimeout(aiTimeoutRefs.current.victory);
        aiTimeoutRefs.current.victory = null;
      }
      if (aiTimeoutRefs.current.defeat) {
        clearTimeout(aiTimeoutRefs.current.defeat);
        aiTimeoutRefs.current.defeat = null;
      }
    };
  }, [
    state.combatState?.currentTurnIndex,
    state.combatState?.round,
    // Re-run immediately when ally HP changes so defeat is caught as soon as
    // PROCESS_COMBAT_ACTION zeroes the last ally — not only after ADVANCE_COMBAT_TURN.
    state.combatState?.turnOrder?.filter(c => c.isAlly).reduce((sum, c) => sum + c.currentHP, 0),
    dispatch,
    actions,
    addMessage,
  ]);

  // Log initiative rolls when combat starts
  const initiativeLoggedRef = useRef(false);

  useEffect(() => {
    if (
      !state.combatState ||
      !state.combatState.turnOrder ||
      state.combatState.turnOrder.length === 0
    ) {
      initiativeLoggedRef.current = false;
      return;
    }

    // Only log once when combat starts (check round 1 and currentTurnIndex 0)
    if (state.combatState.round !== 1 || state.combatState.currentTurnIndex !== 0) {
      return;
    }

    // Check if already logged
    if (initiativeLoggedRef.current) {
      return;
    }

    initiativeLoggedRef.current = true;

    logger.combat.info('Logging initiative rolls', {
      turnOrderLength: state.combatState.turnOrder.length,
    });

    // Log initiative header
    addMessage('=== INITIATIVE ===', 'system');

    logger.combat.info('Starting initiative forEach loop', {
      count: state.combatState.turnOrder.length,
    });

    // Log each combatant's initiative
    state.combatState.turnOrder.forEach((combatant, index) => {
      logger.combat.debug('Processing combatant', {
        index,
        name: combatant.name,
        hasCharacter: !!combatant.character,
        hasEnemy: !!combatant.enemy,
        initiative: combatant.initiative,
      });

      if (!combatant.character && !combatant.enemy) {
        logger.combat.error('Combatant missing both character and enemy', {
          index,
          combatant,
        });
        return;
      }

      const char = combatant.character || combatant.enemy;

      if (!char || !char.abilities) {
        logger.combat.error('Character missing abilities', { index, char });
        return;
      }

      const dexMod = Math.floor((char.abilities.dexterity - 10) / 2);
      const itemBonus = char.initiativeBonus || 0;
      const initiative = combatant.initiative as number;
      const roll = initiative - dexMod - itemBonus;

      let modStr = `${dexMod >= 0 ? '+' : ''}${dexMod}`;
      if (itemBonus !== 0) {
        modStr += ` item+${itemBonus}`;
      }
      const logMessage = `${combatant.name}: ${initiative} (rolled ${roll}${modStr})`;

      logger.combat.info('Adding initiative message', { logMessage });
      addMessage(logMessage, 'system');
    });

    logger.combat.info('Finished initiative forEach loop');
    addMessage('', 'system'); // Blank line for spacing
  }, [
    state.combatState?.round,
    state.combatState?.currentTurnIndex,
    state.combatState?.turnOrder?.length,
    addMessage,
  ]);

  // Keep a ref that always holds the latest combatState so AI timers can read
  // current state without needing it as a useCallback dependency (which would
  // cause the cleanup to cancel in-flight timers on every state update).
  const combatStateRef = useRef(state.combatState);
  useEffect(() => {
    combatStateRef.current = state.combatState;
  });

  // ─── AI Turn System ──────────────────────────────────────────────────────────
  //
  // Design principles:
  //  1. A "turn token" (round:index string) is minted when an enemy's turn begins.
  //     Every timer callback checks it before doing anything — if the token no
  //     longer matches the live combat state the callback is a no-op (stale turn).
  //  2. Timers are NEVER cancelled by the useEffect cleanup.  Cancellation was the
  //     root cause of stuck turns: React's strict-mode double-invoke and mid-turn
  //     state updates (HP sync after attack) can retrigger the effect and wipe
  //     in-flight timers before they fire.
  //  3. The 5-second hard-fallback is cancelled on unmount only (via the ref the
  //     onAnimationComplete callback also holds), so it doesn't linger post-combat.

  const processAITurn = useCallback(
    (combatant: CombatTurnEntry, turnToken: string) => {
      if (!combatant || !combatant.enemy) {
        logger.combat.error('Invalid combatant for AI turn', { combatant });
        return;
      }

      const currentCombatState = combatStateRef.current;
      if (!currentCombatState || !currentCombatState.battlefield) {
        logger.combat.error('Combat state invalid at AI turn start');
        return;
      }

      const enemy = combatant.enemy;
      addMessage(`${enemy.name} is thinking...`, 'encounter');
      pendingAIAdvanceRef.current = false;

      logger.combat.info('Processing AI turn', { name: enemy.name, turnToken });

      // Helper: check whether this turn is still the active one before acting.
      const isTokenStale = () => lastProcessedTurnRef.current !== turnToken;

      // Decide action synchronously so the closure captures it for the 800ms timer.
      let action: { type: string; [key: string]: unknown };
      try {
        action = AIEngine.decideAction(
          combatant as unknown as Parameters<typeof AIEngine.decideAction>[0],
          currentCombatState.battlefield,
          currentCombatState.turnOrder as unknown as Parameters<typeof AIEngine.decideAction>[2],
          currentCombatState.movementRemaining
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.combat.error('AIEngine.decideAction threw', { combatant: enemy.name, error: msg });
        addMessage(`${enemy.name} failed to act`, 'error');
        dispatch({ type: actions.ADVANCE_COMBAT_TURN });
        return;
      }

      logger.combat.debug('AI action decided', { action, turnToken });

      // 5-second hard fallback — fires if the normal path never advances the turn.
      if (aiTimeoutRefs.current.turnTimeout)
        clearTimeout(aiTimeoutRefs.current.turnTimeout ?? undefined);
      aiTimeoutRefs.current.turnTimeout = setTimeout(() => {
        if (isTokenStale()) return; // already advanced
        logger.combat.warn('AI turn timeout – forcing advance', { combatant: enemy.name });
        addMessage(`${enemy.name}'s turn timed out`, 'warning');
        pendingAIAdvanceRef.current = false;
        dispatch({ type: actions.ADVANCE_COMBAT_TURN });
      }, 5000);

      // 800ms delay so the player can read the "thinking…" message.
      setTimeout(() => {
        if (isTokenStale()) {
          logger.combat.debug('AI action timer stale, skipping', { turnToken });
          return;
        }
        if (!combatStateRef.current) {
          logger.combat.warn('Combat ended during AI turn');
          clearTimeout(aiTimeoutRefs.current.turnTimeout ?? undefined);
          return;
        }

        try {
          if (action.type === 'move') {
            const dest = action.destination as { col: number; row: number };
            addMessage(`${enemy.name} moves to (${dest.col}, ${dest.row})`, 'encounter');
            pendingAIAdvanceRef.current = true;
            dispatch({
              type: actions.PROCESS_COMBAT_MOVEMENT,
              payload: {
                path: action.path,
                cost: (action.moveCost as number) * 5,
              },
            });
            // Turn advance driven by onAnimationComplete — no advance timer here.
          } else if (action.type === 'attack') {
            const tgt = action.target as { character?: { name: string }; enemy?: { name: string } };
            const targetName = tgt.character?.name || tgt.enemy?.name;
            addMessage(`${enemy.name} attacks ${targetName}!`, 'encounter');
            dispatch({
              type: actions.PROCESS_COMBAT_ACTION,
              payload: { actionType: 'attack', target: action.target, attacker: combatant },
            });
          } else if (action.type === 'ability') {
            const tgt = action.target as
              | { character?: { name: string }; enemy?: { name: string } }
              | undefined;
            const targetName = tgt?.character?.name || tgt?.enemy?.name;
            addMessage(
              `${enemy.name} uses ${action.ability}${targetName ? ` on ${targetName}` : ''}!`,
              'encounter'
            );
            dispatch({
              type: actions.PROCESS_COMBAT_ACTION,
              payload: {
                actionType: 'ability',
                abilityName: action.ability,
                target: action.target,
                attacker: combatant,
              },
            });
          } else if (action.type === 'dodge') {
            dispatch({
              type: actions.PROCESS_COMBAT_ACTION,
              payload: {
                actionType: 'dodge',
                attacker: combatant,
                target: combatant,
              },
            });
          } else if (action.type === 'dash') {
            addMessage(`${enemy.name} takes the Dash action`, 'encounter');
          } else if (action.type === 'wait') {
            addMessage(`${enemy.name} waits`, 'encounter');
          } else {
            logger.combat.warn('AI returned unhandled action type — treating as wait', {
              combatant: enemy.name,
              actionType: action.type,
            });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.combat.error('AI action dispatch threw', { combatant: enemy.name, error: msg });
          pendingAIAdvanceRef.current = false;
          clearTimeout(aiTimeoutRefs.current.turnTimeout ?? undefined);
          addMessage(`${enemy.name} failed to act`, 'error');
          dispatch({ type: actions.ADVANCE_COMBAT_TURN });
          return;
        }

        // Advance turn 500ms after non-move actions.
        if (!pendingAIAdvanceRef.current) {
          setTimeout(() => {
            if (isTokenStale()) return; // already advanced
            if (!combatStateRef.current) return;
            clearTimeout(aiTimeoutRefs.current.turnTimeout ?? undefined);
            logger.combat.info('Advancing turn after AI action', { combatant: enemy.name });
            dispatch({ type: actions.ADVANCE_COMBAT_TURN });
          }, 500);
        }
      }, 800);
    },
    [dispatch, actions, addMessage]
  );

  useEffect(() => {
    if (!state.combatState?.active) return;

    const { currentTurnIndex, round, waitingForPlayerAction } = state.combatState;
    const turnKey = `${round}:${currentTurnIndex}`;

    // Already processed this exact turn — skip.
    if (lastProcessedTurnRef.current === turnKey) return;

    const currentCombatant = state.combatState.turnOrder[currentTurnIndex];
    if (!currentCombatant) return;

    logger.combat.debug('AI turn check', {
      combatant: currentCombatant.name,
      isEnemy: currentCombatant.isEnemy,
      waitingForPlayer: waitingForPlayerAction,
      turnKey,
    });

    if (currentCombatant.isEnemy && !waitingForPlayerAction) {
      lastProcessedTurnRef.current = turnKey;
      processAITurn(currentCombatant, turnKey);
    }

    // Only clean up the fallback timeout on unmount, not on every dep change.
    // Individual timer callbacks are self-guarded via isTokenStale().
    return () => {
      if (aiTimeoutRefs.current.turnTimeout) {
        clearTimeout(aiTimeoutRefs.current.turnTimeout ?? undefined);
        aiTimeoutRefs.current.turnTimeout = null;
      }
    };
  }, [
    state.combatState?.active,
    state.combatState?.currentTurnIndex,
    state.combatState?.round,
    state.combatState?.waitingForPlayerAction,
    processAITurn,
  ]);

  // Combat handlers
  const handleCombatHexClick = useCallback(
    (hex: { col: number; row: number; [key: string]: unknown }) => {
      logger.combat.debug('Combat hex clicked', { hex, hasCombatState: !!state.combatState });

      if (!state.combatState) return;

      const currentCombatant = state.combatState.turnOrder[state.combatState.currentTurnIndex];
      if (!currentCombatant) {
        logger.combat.warn('No current combatant');
        return;
      }

      logger.combat.debug('Current combatant', {
        name: currentCombatant.name,
        isAlly: currentCombatant.isAlly,
        position: currentCombatant.position,
      });

      if (!currentCombatant.isAlly) {
        addMessage("It's not your turn!", 'warning');
        return;
      }

      // Check if hex is occupied by a combatant
      const targetCombatant = state.combatState.turnOrder.find(
        c => c.position?.col === hex.col && c.position?.row === hex.row
      );

      logger.combat.debug('Hex click routing', {
        selectedAction: combatUIState.selectedAction,
        hasTarget: !!targetCombatant,
        targetHex: { col: hex.col, row: hex.row },
      });

      // If "move" action is selected, try to move
      if (combatUIState.selectedAction === 'move') {
        logger.combat.info('Processing movement action');

        if (targetCombatant) {
          addMessage('Hex is occupied', 'warning');
          return;
        }

        // Calculate path using Pathfinding
        const path = findPath(
          currentCombatant.position as Parameters<typeof findPath>[0],
          hex as Parameters<typeof findPath>[1],
          state.combatState.battlefield as unknown as Parameters<typeof findPath>[2],
          state.combatState.turnOrder as unknown as Parameters<typeof findPath>[3]
        );

        if (!path || path.length === 0) {
          addMessage('No valid path to destination', 'warning');
          return;
        }

        const moveCost = path.length - 1; // First hex is current position
        const moveCostFeet = moveCost * 5;

        if (moveCostFeet > state.combatState.movementRemaining) {
          addMessage(
            `Not enough movement (need ${moveCostFeet} ft, have ${state.combatState.movementRemaining} ft)`,
            'warning'
          );
          return;
        }

        logger.combat.info('Dispatching PROCESS_COMBAT_MOVEMENT', {
          combatantId: currentCombatant.id,
          path,
          moveCost,
          moveCostFeet,
        });

        dispatch({
          type: actions.PROCESS_COMBAT_MOVEMENT,
          payload: {
            combatantId: currentCombatant.id,
            path,
            cost: moveCostFeet,
          },
        });

        addMessage(
          `Moved ${moveCost} hex${moveCost !== 1 ? 'es' : ''} to (${hex.col}, ${hex.row})`,
          'action'
        );

        // Clear selection
        setCombatUIState(prev => ({
          ...prev,
          selectedAction: null,
        }));
      } else if (
        combatUIState.selectedAction === 'attack' &&
        targetCombatant &&
        !targetCombatant.isAlly
      ) {
        // Attack action already selected, clicking enemy executes attack
        // Validate range before dispatching
        const weapon = currentCombatant.character?.equipment?.mainHand;
        const weaponRange = weapon?.range || 1;
        const attackDistance = getHexDistance(
          currentCombatant.position?.col ?? 0,
          currentCombatant.position?.row ?? 0,
          targetCombatant.position?.col ?? 0,
          targetCombatant.position?.row ?? 0
        );

        if (attackDistance > weaponRange) {
          if (weaponRange <= 1) {
            // Melee weapon or unarmed — target too far, no ranged option
            const weaponName = weapon?.name || 'your weapon';
            addMessage(
              `${weaponName} is a melee weapon. Equip a ranged weapon to attack at distance.`,
              'warning'
            );
          } else {
            addMessage(
              `Target out of range (${attackDistance} hexes, max ${weaponRange}).`,
              'warning'
            );
          }
          return;
        }

        logger.combat.info('Executing attack on target', {
          attacker: currentCombatant.name,
          target: targetCombatant.name,
          attackDistance,
          weaponRange,
        });

        dispatch({
          type: actions.PROCESS_COMBAT_ACTION,
          payload: {
            actionType: 'attack',
            attacker: currentCombatant,
            target: targetCombatant,
          },
        });

        addMessage(
          `${currentCombatant.name} attacks ${targetCombatant.enemy?.name || targetCombatant.name}!`,
          'action'
        );

        // Clear selection and increment attacks
        setCombatUIState(prev => ({
          ...prev,
          selectedAction: null,
          selectedTarget: null,
          attacksUsedThisTurn: prev.attacksUsedThisTurn + 1,
        }));
      } else if (targetCombatant && !targetCombatant.isAlly) {
        // Clicking an enemy without action selected - auto-select attack
        logger.combat.info('Auto-selecting attack for enemy click');
        setCombatUIState(prev => ({
          ...prev,
          selectedAction: 'attack',
          selectedTarget: targetCombatant,
        }));
        addMessage(`Targeting ${targetCombatant.enemy?.name || targetCombatant.name}`, 'action');
      } else {
        logger.combat.debug('No action taken for hex click');
      }
    },
    [state.combatState, combatUIState.selectedAction, dispatch, actions, addMessage]
  );

  const handleCombatEndTurn = useCallback(() => {
    if (!state.combatState) return;

    const currentCombatant = state.combatState.turnOrder[state.combatState.currentTurnIndex];
    addMessage(`${currentCombatant.name} ended their turn`, 'action');

    setCombatUIState(prev => ({
      ...prev,
      attacksUsedThisTurn: 0,
      selectedAction: null,
      selectedTarget: null,
    }));

    dispatch({ type: actions.ADVANCE_COMBAT_TURN });
  }, [state.combatState, dispatch, actions, addMessage]);

  const getCurrentCombatant = () => {
    if (!state.combatState?.turnOrder || state.combatState.currentTurnIndex === undefined) {
      return null;
    }
    return state.combatState.turnOrder[state.combatState.currentTurnIndex];
  };

  // Movement animation finished (called by CombatCanvas)
  const handleAnimationComplete = () => {
    // Clear the animation marker from state
    dispatch({ type: actions.CLEAR_COMBAT_ANIMATION });

    // If an AI move triggered this animation, advance the combat turn now
    if (pendingAIAdvanceRef.current) {
      pendingAIAdvanceRef.current = false;
      clearTimeout(aiTimeoutRefs.current.turnTimeout ?? undefined);
      aiTimeoutRefs.current.turnTimeout = null;
      logger.combat.info('Advancing turn after AI movement animation completed');
      dispatch({ type: actions.ADVANCE_COMBAT_TURN });
    }
  };

  return {
    combatUIState,
    setCombatUIState,
    showAbilityMenu,
    setShowAbilityMenu,
    handleCombatHexClick,
    handleCombatEndTurn,
    getCurrentCombatant,
    handleAnimationComplete,
  };
}

export type CombatOrchestration = ReturnType<typeof useCombatOrchestration>;
