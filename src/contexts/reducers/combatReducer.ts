// @ts-nocheck -- TODO: Remove after src/game/Combat.js is converted to TypeScript (Phase 3)
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Combat Reducer - Handles combat state, turns, and combat actions
 *
 * Actions handled:
 * - START_COMBAT
 * - RESOLVE_COMBAT
 * - PROCESS_COMBAT_MOVEMENT
 * - PROCESS_COMBAT_ACTION
 * - ADVANCE_COMBAT_TURN
 * - END_COMBAT
 * - UPDATE_COMBAT_STATE
 * - USE_COMBAT_ACTION
 * - USE_COMBAT_BONUS_ACTION
 * - USE_COMBAT_REACTION
 * - USE_COMBAT_MOVEMENT
 * - USE_FREE_OBJECT_INTERACTION
 * - RESET_COMBAT_TURN_STATE
 * - SET_COMBAT_TURN_STATE
 * - INCREMENT_ATTACK_COUNT
 * - ADD_COMBAT_CONDITION
 * - REMOVE_COMBAT_CONDITION
 * - SET_READY_ACTION
 * - TRIGGER_READY_ACTION
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { Combat } from '../../game/Combat';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { CombatTerrainGenerator } from '../../game/CombatTerrainGenerator';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { EncounterPositions } from '../../game/EncounterPositions';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { OpportunityAttackSystem } from '../../game/OpportunityAttack';
import { COMBAT } from '../../constants/gameConstants';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import logger from '../../utils/logger';
import { Character } from '../../game/Character';
import type { GameState, Action } from '../../types/state';

export function combatReducer(
  state: GameState,
  action: Action,
  ACTIONS: Record<string, string>
): GameState | null {
  switch (action.type) {
    case ACTIONS.START_COMBAT: {
      // Legacy combat log support (keep for backward compatibility)
      if (action.payload.combatLog) {
        return {
          ...state,
          combatLog: action.payload.combatLog,
        };
      }

      // New tactical combat system
      const { allies, enemies, encounterName, encounterType, terrainType, gameLogger } =
        action.payload;

      logger.combat.info('[START_COMBAT] Payload:', {
        allies,
        enemies,
        encounterName,
        encounterType,
        terrainType,
      });

      if (!allies || !enemies) {
        logger.combat.error('START_COMBAT requires allies and enemies');
        return state;
      }

      if (allies.length === 0) {
        logger.combat.error('START_COMBAT: allies array is empty');
        return state;
      }

      if (enemies.length === 0) {
        logger.combat.error('START_COMBAT: enemies array is empty');
        return state;
      }

      logger.combat.info('[START_COMBAT] Generating battlefield...', {
        encounterType,
        terrainType,
        seed: state.mapSeed,
      });

      // Generate battlefield
      const battlefield = CombatTerrainGenerator.generate(
        encounterType,
        terrainType,
        state.mapSeed
      );

      logger.combat.info('[START_COMBAT] Battlefield generated:', {
        width: battlefield.width,
        height: battlefield.height,
        hexCount: battlefield.hexes.length,
      });

      // Create combat instance, wiring up GameLog so attack rolls and results surface to the player
      const combat = new Combat(allies, enemies, battlefield, {
        logger: gameLogger || null,
      });

      // Roll initiative
      const initiativeOrder = combat.rollInitiative();

      // Transform initiative order into combat-ready format
      // rollInitiative() returns { type, combatant, initiative, roll }
      // We need { id, name, currentHP, maxHP, isAlly, character/enemy, position }
      const turnOrder = initiativeOrder.map((init, index) => {
        const isAlly = init.type === 'character';
        const combatant = init.combatant;

        // Derive attack range for this combatant so the canvas overlay is accurate.
        // Heroes: read from equipped mainHand weapon; Enemies: read from their .range stat.
        const attackRange = isAlly
          ? combatant.equipment?.mainHand?.range || 1
          : combatant.range || 1;

        return {
          id: isAlly ? `ally-${index}` : `enemy-${index}`,
          name: combatant.name,
          currentHP: combatant.currentHP,
          maxHP: combatant.maxHP,
          isAlly: isAlly,
          isEnemy: !isAlly,
          character: isAlly ? combatant : null,
          enemy: !isAlly ? combatant : null,
          characterClass: combatant.class || combatant.type || 'Fighter',
          initiative: init.initiative,
          position: null, // Will be set by EncounterPositions
          statusEffects: [],
          aiConfig: !isAlly ? combatant.aiConfig : null, // Copy AI config from enemy
          attackRange, // Weapon/stat range for canvas overlay and attack validation
        };
      });

      // Place combatants on battlefield
      const alliesToPlace = turnOrder.filter(c => c.isAlly);
      const enemiesToPlace = turnOrder.filter(c => c.isEnemy);

      const { allies: placedAllies, enemies: placedEnemies } = EncounterPositions.placeForEncounter(
        encounterType,
        alliesToPlace,
        enemiesToPlace,
        battlefield
      );

      // Merge positions back into turnOrder
      const updatedTurnOrder = turnOrder.map(combatant => {
        const placed = combatant.isAlly
          ? placedAllies.find(a => a.id === combatant.id)
          : placedEnemies.find(e => e.id === combatant.id);

        if (!placed || !placed.position) {
          logger.combat.error('Failed to place combatant', { name: combatant.name });
          return { ...combatant, position: { col: 0, row: 0 } }; // Fallback position
        }

        return { ...combatant, position: placed.position };
      });

      logger.combat.info('[START_COMBAT] Turn order created:', {
        turnOrder: updatedTurnOrder.map(c => ({
          name: c.name,
          position: c.position,
          isAlly: c.isAlly,
          currentHP: c.currentHP,
          maxHP: c.maxHP,
        })),
      });

      // Update combat instance with positioned combatants
      combat.turnOrder = updatedTurnOrder;
      combat.allies = updatedTurnOrder.filter(c => !c.isEnemy);
      combat.enemies = updatedTurnOrder.filter(c => c.isEnemy);

      // Get first combatant's movement distance
      const firstCombatant = updatedTurnOrder[0];
      const moveDistance =
        firstCombatant?.character?.moveDistance || firstCombatant?.enemy?.moveDistance || 6;

      // Determine if first turn is player-controlled
      const waitingForPlayer = firstCombatant?.isAlly || false;

      const newCombatState = {
        active: true,
        combat,
        battlefield,
        turnOrder: updatedTurnOrder,
        currentTurnIndex: 0,
        round: 1,
        encounterName: encounterName || 'Combat',
        encounterType: encounterType || 'standard',
        waitingForPlayerAction: waitingForPlayer,
        movementRemaining: moveDistance * 5, // Convert hexes to feet
        // D&D 5e Action Economy
        turnState: {
          actionUsed: false,
          bonusActionUsed: false,
          reactionUsed: false,
          movementUsed: 0,
          freeObjectUsed: false,
          attacksMade: 0,
          conditions: [],
          readyAction: null,
        },
      };

      logger.combat.info('[START_COMBAT] Combat state created:', {
        hasBattlefield: !!newCombatState.battlefield,
        hasHexes: !!newCombatState.battlefield?.hexes,
        hexCount: newCombatState.battlefield?.hexes?.length,
        turnOrderCount: newCombatState.turnOrder.length,
        firstCombatant: firstCombatant?.name,
        firstIsAlly: firstCombatant?.isAlly,
        waitingForPlayer: waitingForPlayer,
      });

      logger.combat.info('[START_COMBAT] Combat initialized (staying on overworld scene)');

      return {
        ...state,
        combatState: newCombatState,
        // No scene transition - combat overlays on overworld
      };
    }

    case ACTIONS.RESOLVE_COMBAT: {
      const { victory } = action.payload;

      if (!state.combat) return state;

      let updates = { ...state };

      if (victory && state.playerCharacter) {
        // Award XP immutably
        const xp = state.combat.calculateXPReward();
        const character = Character.fromJSON(state.playerCharacter.toJSON());
        character.gainXP(xp);
        updates.playerCharacter = character;
      }

      return updates;
    }

    case ACTIONS.PROCESS_COMBAT_MOVEMENT: {
      if (!state.combatState) return state;

      const { path, cost } = action.payload;

      if (!path || path.length === 0) {
        logger.combat.warn('[PROCESS_COMBAT_MOVEMENT] No path provided');
        return state;
      }

      // Get the destination (last hex in path)
      const destination = path[path.length - 1];

      // Ensure destination has col and row properties
      if (
        !destination ||
        typeof destination.col !== 'number' ||
        typeof destination.row !== 'number'
      ) {
        logger.combat.error('[PROCESS_COMBAT_MOVEMENT] Invalid destination', { destination });
        return state;
      }

      // Update current combatant's position in turnOrder
      const currentCombatant = state.combatState.turnOrder[state.combatState.currentTurnIndex];
      if (!currentCombatant) {
        logger.combat.warn('[PROCESS_COMBAT_MOVEMENT] No current combatant at index', {
          index: state.combatState.currentTurnIndex,
        });
        return state;
      }

      logger.combat.debug('[PROCESS_COMBAT_MOVEMENT] Updating position:', {
        combatant: currentCombatant.name,
        oldPosition: currentCombatant.position,
        newPosition: destination,
        currentTurnIndex: state.combatState.currentTurnIndex,
        costInFeet: cost,
        pathLength: path.length,
        fullPath: path,
      });

      const updatedTurnOrder = state.combatState.turnOrder.map((combatant, idx) => {
        if (idx === state.combatState.currentTurnIndex) {
          logger.combat.debug('[PROCESS_COMBAT_MOVEMENT] Updating combatant position', {
            name: combatant.name,
            from: combatant.position,
            to: destination,
          });
          return {
            ...combatant,
            position: { col: destination.col, row: destination.row },
          };
        }
        return combatant;
      });

      logger.combat.info('Movement processed', {
        combatant: currentCombatant.name,
        from: currentCombatant.position,
        to: destination,
        costInFeet: cost,
        movementRemaining: state.combatState.movementRemaining,
        newMovementRemaining: Math.max(0, state.combatState.movementRemaining - cost),
        newTurnOrder: updatedTurnOrder.map(c => ({ name: c.name, position: c.position })),
      });

      // Opportunity attack check: did the moving combatant leave any enemy's melee range?
      const fromHex = currentCombatant.position;
      const toHex = destination;
      const opportunityAttackers = OpportunityAttackSystem.checkOpportunityAttacks(
        currentCombatant,
        fromHex,
        toHex,
        state.combatState.turnOrder
      );

      // Sync updated positions into the Combat instance so processAttack (called for OAs)
      // sees current positions, not starting positions.
      const combat = state.combatState.combat;
      if (combat) {
        updatedTurnOrder.forEach(c => {
          const combatEntry = combat.turnOrder.find(ct => ct.id === c.id);
          if (combatEntry && c.position) {
            combatEntry.position = c.position;
            combatEntry.hp = c.currentHP;
          }
        });
      }

      // Process opportunity attacks immediately (AI auto-confirms; player OA prompts are
      // stored in pendingOpportunityAttacks for the UI to handle)
      let oaTurnOrder = updatedTurnOrder;
      const pendingPlayerOAs = [];

      for (const oaAttacker of opportunityAttackers) {
        if (oaAttacker.isEnemy && combat) {
          // AI auto-confirms — resolve the attack immediately
          logger.combat.info('Opportunity attack (AI)', {
            attacker: oaAttacker.name,
            target: currentCombatant.name,
          });
          const oaResult = combat.processAttack(oaAttacker.id, currentCombatant.id);
          if (oaResult.success && combat) {
            // Sync HP after OA
            oaTurnOrder = oaTurnOrder.map(c => {
              if (c.id === oaAttacker.id || c.id === currentCombatant.id) {
                const fromCombat = combat.turnOrder.find(ct => ct.id === c.id);
                if (fromCombat) return { ...c, currentHP: fromCombat.hp };
              }
              return c;
            });
          }
          // Mark OA attacker's reaction as used
          oaTurnOrder = oaTurnOrder.map(c =>
            c.id === oaAttacker.id ? { ...c, reactionUsed: true } : c
          );
        } else if (oaAttacker.isAlly) {
          // Player-controlled — queue for UI prompt
          pendingPlayerOAs.push({ attacker: oaAttacker, target: currentCombatant });
        }
      }

      const newCombatState = {
        ...state.combatState,
        turnOrder: oaTurnOrder,
        movementRemaining: Math.max(0, state.combatState.movementRemaining - cost),
        // Store the full path for the canvas animation system.
        // CombatCanvas will animate the combatant hex-by-hex along this path
        // and call onAnimationComplete when done, which dispatches CLEAR_COMBAT_ANIMATION.
        pendingAnimation: {
          combatantId: currentCombatant.id,
          path: path, // full path including start hex
        },
        // Player-side opportunity attack prompts (if any)
        pendingOpportunityAttacks: pendingPlayerOAs.length > 0 ? pendingPlayerOAs : null,
      };

      logger.combat.debug('[PROCESS_COMBAT_MOVEMENT] New combat state:', {
        turnOrderCount: newCombatState.turnOrder.length,
        updatedCombatant: newCombatState.turnOrder[state.combatState.currentTurnIndex],
        movementRemaining: newCombatState.movementRemaining,
        animationPath: path.length,
      });

      return {
        ...state,
        combatState: newCombatState,
      };
    }

    case ACTIONS.PROCESS_COMBAT_ACTION: {
      if (!state.combatState) return state;

      const { actionType, attacker, target, ability, spell, spellLevel } = action.payload;

      logger.combat.info('[PROCESS_COMBAT_ACTION] Called', { actionType, attacker, target });

      if (actionType === 'attack') {
        // Use Combat instance to process attack (handles dice rolling with logger)
        const combat = state.combatState.combat;

        if (!combat) {
          logger.combat.error('[PROCESS_COMBAT_ACTION] Combat instance not available');
          return state;
        }

        logger.combat.info('[PROCESS_COMBAT_ACTION] Processing attack via Combat instance', {
          attacker: attacker.name,
          target: target.name,
        });

        // Sync current positions from Redux state into the Combat instance's turnOrder
        // before calling processAttack. PROCESS_COMBAT_MOVEMENT updates the Redux copy
        // immutably but does not mutate the Combat instance, so positions would be stale
        // without this sync.
        state.combatState.turnOrder.forEach(c => {
          const combatEntry = combat.turnOrder.find(ct => ct.id === c.id);
          if (combatEntry && c.position) {
            combatEntry.position = c.position;
            combatEntry.hp = c.currentHP;
          }
        });

        // Use Combat.processAttack which uses DiceRoller with auto-logging
        const attackResult = combat.processAttack(attacker.id, target.id);

        if (!attackResult.success) {
          logger.combat.warn('[PROCESS_COMBAT_ACTION] Attack failed', attackResult.message);
          // Surface failure message to player via GameLog if logger is available
          if (combat.logger) {
            combat.logger(attackResult.message, 'warning');
          }
          return state;
        }

        // Apply damage to target HP (Combat.processAttack already updated combatant.hp)
        // We need to sync the turn order HP from the Combat instance
        const syncedTurnOrder = state.combatState.turnOrder.map(c => {
          if (c.id === attacker.id || c.id === target.id) {
            // Find matching combatant in combat.turnOrder
            const combatantFromCombat = combat.turnOrder.find(ct => ct.id === c.id);
            if (combatantFromCombat) {
              return { ...c, currentHP: combatantFromCombat.hp };
            }
          }
          return c;
        });

        // Get attacker character for action economy
        const attackerChar = attacker.character || attacker.enemy;

        // Calculate max attacks for this combatant (Extra Attack feature)
        const maxAttacks = attackerChar?.getAttacksPerAction
          ? attackerChar.getAttacksPerAction()
          : 1;
        const newAttacksMade = state.combatState.turnState.attacksMade + 1;

        // Only mark action as used when all attacks have been made
        const actionNowUsed = newAttacksMade >= maxAttacks;

        logger.combat.debug('Attack action economy', {
          attacker: attackerChar?.name,
          attacksMade: newAttacksMade,
          maxAttacks,
          actionUsed: actionNowUsed,
        });

        // Mark action as used only if all attacks consumed
        return {
          ...state,
          combatState: {
            ...state.combatState,
            turnOrder: syncedTurnOrder,
            turnState: {
              ...state.combatState.turnState,
              actionUsed: actionNowUsed,
              attacksMade: newAttacksMade,
            },
          },
        };
      }

      if (actionType === 'ability') {
        // Process ability action
        const user = attacker;
        const userChar = user.character || user.enemy;

        if (!userChar || !ability) {
          logger.combat.error('[PROCESS_COMBAT_ACTION] Invalid ability action', { user, ability });
          return state;
        }

        // Use Combat.processAbility() to execute ability
        const combat = state.combatState.combat;
        if (combat && combat.processAbility) {
          const result = combat.processAbility(user.id, ability.name, target?.id || null);

          logger.combat.info('Ability used', {
            user: userChar.name,
            ability: ability.name,
            success: result.success,
            message: result.message,
          });

          if (result.message && combat.logger) {
            combat.logger(result.message, result.success ? 'action' : 'warning');
          }

          // Determine action type (action, bonus action, reaction)
          const abilityActionType = ability.actionType || 'action';

          // Sync abilities_list uses AND statusEffects back from the Combat instance
          // into Redux turnOrder so the UI reflects changes immediately.
          const syncedTurnOrder = state.combatState.turnOrder.map(c => {
            if (c.id === user.id && c.character) {
              const combatEntry = combat.turnOrder.find(ct => ct.id === c.id);
              if (combatEntry) {
                return {
                  ...c,
                  statusEffects: [...(combatEntry.statusEffects || [])],
                  character: combatEntry.character?.abilities_list
                    ? {
                        ...c.character,
                        abilities_list: combatEntry.character.abilities_list.map(a => ({ ...a })),
                      }
                    : c.character,
                };
              }
            }
            return c;
          });

          // 'free' action type (e.g. Reckless Attack) consumes no action economy slot
          return {
            ...state,
            combatState: {
              ...state.combatState,
              turnOrder: syncedTurnOrder,
              turnState: {
                ...state.combatState.turnState,
                actionUsed:
                  abilityActionType === 'action' ? true : state.combatState.turnState.actionUsed,
                bonusActionUsed:
                  abilityActionType === 'bonusAction'
                    ? true
                    : state.combatState.turnState.bonusActionUsed,
                reactionUsed:
                  abilityActionType === 'reaction'
                    ? true
                    : state.combatState.turnState.reactionUsed,
              },
            },
          };
        }
      }

      if (actionType === 'dodge') {
        const combat = state.combatState.combat;
        if (!combat) return state;

        const dodgerEntry = combat.turnOrder.find(c => c.id === attacker.id);
        if (!dodgerEntry) return state;

        // Call Combat.processDodge — adds the Dodge status effect to the combatant
        const result = combat.processDodge(attacker.id);

        logger.combat.info('Dodge action', {
          combatant: attacker.name,
          success: result.success,
        });

        if (result.message && combat.logger) {
          combat.logger(result.message, 'action');
        }

        // Sync the updated statusEffects back into the immutable Redux turnOrder
        const syncedTurnOrder = state.combatState.turnOrder.map(c => {
          if (c.id === attacker.id) {
            const combatEntry = combat.turnOrder.find(ct => ct.id === c.id);
            return { ...c, statusEffects: [...(combatEntry?.statusEffects || [])] };
          }
          return c;
        });

        return {
          ...state,
          combatState: {
            ...state.combatState,
            turnOrder: syncedTurnOrder,
            turnState: {
              ...state.combatState.turnState,
              actionUsed: true,
            },
          },
        };
      }

      if (actionType === 'spell') {
        // Process spell action
        const caster = attacker;
        const casterChar = caster.character || caster.enemy;

        if (!casterChar || !spell) {
          logger.combat.error('[PROCESS_COMBAT_ACTION] Invalid spell action', { caster, spell });
          return state;
        }

        // Use Combat.processSpell() to execute spell
        const combat = state.combatState.combat;
        if (combat && combat.processSpell) {
          const result = combat.processSpell(
            caster.id,
            spell.name,
            target?.id || null,
            spellLevel || spell.level || 1
          );

          logger.combat.info('Spell cast', {
            caster: casterChar.name,
            spell: spell.name,
            level: spellLevel,
            success: result.success,
            message: result.message,
          });

          // Spells use Action unless specified otherwise
          const spellActionType = spell.castingTime === 'bonus action' ? 'bonusAction' : 'action';

          return {
            ...state,
            combatState: {
              ...state.combatState,
              turnState: {
                ...state.combatState.turnState,
                actionUsed:
                  spellActionType === 'action' ? true : state.combatState.turnState.actionUsed,
                bonusActionUsed:
                  spellActionType === 'bonusAction'
                    ? true
                    : state.combatState.turnState.bonusActionUsed,
              },
            },
          };
        }
      }

      return state;
    }

    case ACTIONS.ADVANCE_COMBAT_TURN: {
      if (!state.combatState) return state;

      // Find next LIVING combatant, skipping dead ones
      const turnOrderLength = state.combatState.turnOrder.length;
      let nextIndex = (state.combatState.currentTurnIndex + 1) % turnOrderLength;

      // Iterate forward until we find a living combatant (guard: max one full cycle)
      for (let i = 0; i < turnOrderLength; i++) {
        if (state.combatState.turnOrder[nextIndex].currentHP > 0) break;
        nextIndex = (nextIndex + 1) % turnOrderLength;
      }

      const nextCombatant = state.combatState.turnOrder[nextIndex];

      // Increment round if we wrapped past index 0 during this advance
      const prevIndex = state.combatState.currentTurnIndex;
      const newRound =
        nextIndex <= prevIndex ? state.combatState.round + 1 : state.combatState.round;

      // Reset movement for new turn
      const moveDistance =
        nextCombatant?.character?.moveDistance || nextCombatant?.enemy?.moveDistance || 6;

      // Set waitingForPlayerAction based on whether next combatant is an ally
      const waitingForPlayer = nextCombatant?.isAlly || false;

      logger.combat.info('[ADVANCE_COMBAT_TURN]', {
        nextIndex,
        nextCombatant: nextCombatant?.name,
        isAlly: nextCombatant?.isAlly,
        waitingForPlayer,
        newRound,
      });

      // --- Start-of-turn ticks: Rage + status effect durations ---
      // tickRage() checks whether Rage extension criteria were met and ends Rage if not.
      // tickStatusEffects() decrements duration on all other effects (e.g. Dodge) and removes
      // any that have expired, so Dodge applied last turn is gone before this turn's action.
      const combat = state.combatState.combat;
      let updatedTurnOrder = state.combatState.turnOrder;

      if (combat && nextCombatant?.statusEffects?.length) {
        const nextCombatantInCombat = combat.turnOrder.find(c => c.id === nextCombatant.id);
        if (nextCombatantInCombat) {
          // Tick Rage first (has its own extension logic)
          if (nextCombatant.isAlly && nextCombatant.statusEffects.some(e => e.name === 'Rage')) {
            combat.tickRage(nextCombatantInCombat);
          }
          // Tick all other duration-based effects (Dodge expires here after 1 full round)
          combat.tickStatusEffects(nextCombatantInCombat);

          // Sync the updated statusEffects back into the immutable Redux turnOrder
          updatedTurnOrder = state.combatState.turnOrder.map(c => {
            if (c.id === nextCombatant.id) {
              return { ...c, statusEffects: [...(nextCombatantInCombat.statusEffects || [])] };
            }
            return c;
          });
        }
      }

      return {
        ...state,
        combatState: {
          ...state.combatState,
          currentTurnIndex: nextIndex,
          round: newRound,
          movementRemaining: moveDistance * 5, // Convert hexes to feet
          waitingForPlayerAction: waitingForPlayer,
          turnOrder: updatedTurnOrder,
          // Reset turn state for new turn
          turnState: {
            actionUsed: false,
            bonusActionUsed: false,
            reactionUsed: false,
            movementUsed: 0,
            freeObjectUsed: false,
            attacksMade: 0,
            conditions: state.combatState.turnState.conditions.filter(
              c => c.duration !== 'end_of_turn'
            ),
            readyAction: null,
          },
        },
      };
    }

    case ACTIONS.END_COMBAT: {
      return {
        ...state,
        combatState: null,
        currentScene: 'overworld',
      };
    }

    case ACTIONS.UPDATE_COMBAT_STATE: {
      return {
        ...state,
        ...action.payload,
      };
    }

    // ============================================
    // D&D 5e Action Economy Actions
    // ============================================

    case ACTIONS.USE_COMBAT_ACTION: {
      if (!state.combatState) return state;

      const { actionType, actionName, target, data } = action.payload;

      return {
        ...state,
        combatState: {
          ...state.combatState,
          turnState: {
            ...state.combatState.turnState,
            actionUsed: actionType === 'action' ? true : state.combatState.turnState.actionUsed,
            bonusActionUsed:
              actionType === 'bonusAction' ? true : state.combatState.turnState.bonusActionUsed,
          },
        },
      };
    }

    case ACTIONS.USE_COMBAT_BONUS_ACTION: {
      if (!state.combatState) return state;

      return {
        ...state,
        combatState: {
          ...state.combatState,
          turnState: {
            ...state.combatState.turnState,
            bonusActionUsed: true,
          },
        },
      };
    }

    case ACTIONS.USE_COMBAT_REACTION: {
      if (!state.combatState) return state;

      return {
        ...state,
        combatState: {
          ...state.combatState,
          turnState: {
            ...state.combatState.turnState,
            reactionUsed: true,
          },
        },
      };
    }

    case ACTIONS.USE_COMBAT_MOVEMENT: {
      if (!state.combatState) return state;

      const { moveCost } = action.payload;

      return {
        ...state,
        combatState: {
          ...state.combatState,
          movementRemaining: Math.max(0, state.combatState.movementRemaining - moveCost), // Negative moveCost adds movement
          turnState: {
            ...state.combatState.turnState,
            movementUsed: state.combatState.turnState.movementUsed + Math.max(0, moveCost), // Only count positive costs
          },
        },
      };
    }

    case ACTIONS.USE_FREE_OBJECT_INTERACTION: {
      if (!state.combatState) return state;

      return {
        ...state,
        combatState: {
          ...state.combatState,
          turnState: {
            ...state.combatState.turnState,
            freeObjectUsed: true,
          },
        },
      };
    }

    case ACTIONS.RESET_COMBAT_TURN_STATE: {
      if (!state.combatState) return state;

      const currentCombatant = state.combatState.turnOrder[state.combatState.currentTurnIndex];
      const moveDistance =
        currentCombatant?.character?.moveDistance || currentCombatant?.enemy?.moveDistance || 6;

      return {
        ...state,
        combatState: {
          ...state.combatState,
          movementRemaining: moveDistance * 5,
          turnState: {
            actionUsed: false,
            bonusActionUsed: false,
            reactionUsed: false, // Reactions reset at start of YOUR turn, not others'
            movementUsed: 0,
            freeObjectUsed: false,
            attacksMade: 0,
            conditions: state.combatState.turnState.conditions.filter(
              c => c.duration !== 'end_of_turn'
            ),
            readyAction: null,
          },
        },
      };
    }

    case ACTIONS.SET_COMBAT_TURN_STATE: {
      if (!state.combatState) return state;

      return {
        ...state,
        combatState: {
          ...state.combatState,
          turnState: {
            ...state.combatState.turnState,
            ...action.payload,
          },
        },
      };
    }

    case ACTIONS.INCREMENT_ATTACK_COUNT: {
      if (!state.combatState) return state;

      return {
        ...state,
        combatState: {
          ...state.combatState,
          turnState: {
            ...state.combatState.turnState,
            attacksMade: state.combatState.turnState.attacksMade + 1,
          },
        },
      };
    }

    case ACTIONS.ADD_COMBAT_CONDITION: {
      if (!state.combatState) return state;

      const { condition, duration, targetId, data } = action.payload;

      // If targetId specified, add to specific combatant
      if (targetId) {
        const updatedTurnOrder = state.combatState.turnOrder.map(combatant => {
          if (combatant.id === targetId) {
            return {
              ...combatant,
              conditions: [...(combatant.conditions || []), { type: condition, duration, data }],
            };
          }
          return combatant;
        });

        return {
          ...state,
          combatState: {
            ...state.combatState,
            turnOrder: updatedTurnOrder,
          },
        };
      }

      // Otherwise add to current combatant's turnState
      return {
        ...state,
        combatState: {
          ...state.combatState,
          turnState: {
            ...state.combatState.turnState,
            conditions: [
              ...state.combatState.turnState.conditions,
              { type: condition, duration, data },
            ],
          },
        },
      };
    }

    case ACTIONS.REMOVE_COMBAT_CONDITION: {
      if (!state.combatState) return state;

      const { condition, targetId } = action.payload;

      // If targetId specified, remove from specific combatant
      if (targetId) {
        const updatedTurnOrder = state.combatState.turnOrder.map(combatant => {
          if (combatant.id === targetId) {
            return {
              ...combatant,
              conditions: (combatant.conditions || []).filter(c => c.type !== condition),
            };
          }
          return combatant;
        });

        return {
          ...state,
          combatState: {
            ...state.combatState,
            turnOrder: updatedTurnOrder,
          },
        };
      }

      // Otherwise remove from current combatant's turnState
      return {
        ...state,
        combatState: {
          ...state.combatState,
          turnState: {
            ...state.combatState.turnState,
            conditions: state.combatState.turnState.conditions.filter(c => c.type !== condition),
          },
        },
      };
    }

    case ACTIONS.SET_READY_ACTION: {
      if (!state.combatState) return state;

      const { actionType, trigger, data } = action.payload;

      return {
        ...state,
        combatState: {
          ...state.combatState,
          turnState: {
            ...state.combatState.turnState,
            readyAction: {
              actionType,
              trigger,
              data,
            },
          },
        },
      };
    }

    case ACTIONS.TRIGGER_READY_ACTION: {
      if (!state.combatState || !state.combatState.turnState.readyAction) return state;

      // Ready action is triggered - clear it and mark reaction as used
      return {
        ...state,
        combatState: {
          ...state.combatState,
          turnState: {
            ...state.combatState.turnState,
            readyAction: null,
            reactionUsed: true,
          },
        },
      };
    }

    case ACTIONS.CLEAR_COMBAT_ANIMATION: {
      if (!state.combatState) return state;
      return {
        ...state,
        combatState: {
          ...state.combatState,
          pendingAnimation: null,
        },
      };
    }

    case ACTIONS.UPDATE_COMBATANT_HP: {
      if (!state.combatState) return state;

      const { combatantId, newHP } = action.payload;

      const updatedTurnOrder = state.combatState.turnOrder.map(c => {
        if (c.id === combatantId) {
          logger.combat.debug('HP updated', {
            combatant: c.name,
            oldHP: c.currentHP,
            newHP,
            maxHP: c.maxHP,
          });

          // HP is stored in turnOrder as single source of truth
          // Character/Enemy HP will be synced when combat ends
          return {
            ...c,
            currentHP: newHP,
          };
        }
        return c;
      });

      return {
        ...state,
        combatState: {
          ...state.combatState,
          turnOrder: updatedTurnOrder,
        },
      };
    }

    default:
      return null; // Action not handled by this reducer
  }
}
