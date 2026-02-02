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

import { Combat } from '../../game/Combat';
import { CombatTerrainGenerator } from '../../game/CombatTerrainGenerator';
import { EncounterPositions } from '../../game/EncounterPositions';
import { COMBAT } from '../../constants/gameConstants';
import logger from '../../utils/logger.js';

export function combatReducer(state, action, ACTIONS) {
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
      const { allies, enemies, encounterName, encounterType, terrainType } = action.payload;

      console.log('[START_COMBAT] Payload:', {
        allies,
        enemies,
        encounterName,
        encounterType,
        terrainType,
      });

      if (!allies || !enemies) {
        console.error('START_COMBAT requires allies and enemies');
        return state;
      }

      if (allies.length === 0) {
        console.error('START_COMBAT: allies array is empty');
        return state;
      }

      if (enemies.length === 0) {
        console.error('START_COMBAT: enemies array is empty');
        return state;
      }

      console.log('[START_COMBAT] Generating battlefield...', {
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

      console.log('[START_COMBAT] Battlefield generated:', {
        width: battlefield.width,
        height: battlefield.height,
        hexCount: battlefield.hexes.length,
      });

      // Create combat instance
      const combat = new Combat(allies, enemies, battlefield);

      // Roll initiative
      const initiativeOrder = combat.rollInitiative();

      // Transform initiative order into combat-ready format
      // rollInitiative() returns { type, combatant, initiative, roll }
      // We need { id, name, currentHP, maxHP, isAlly, character/enemy, position }
      const turnOrder = initiativeOrder.map((init, index) => {
        const isAlly = init.type === 'character';
        const combatant = init.combatant;

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
          console.error('Failed to place combatant:', combatant.name);
          return { ...combatant, position: { col: 0, row: 0 } }; // Fallback position
        }

        return { ...combatant, position: placed.position };
      });

      console.log(
        '[START_COMBAT] Turn order created:',
        updatedTurnOrder.map(c => ({
          name: c.name,
          position: c.position,
          isAlly: c.isAlly,
          currentHP: c.currentHP,
          maxHP: c.maxHP,
        }))
      );

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

      console.log('[START_COMBAT] Combat state created:', {
        hasBattlefield: !!newCombatState.battlefield,
        hasHexes: !!newCombatState.battlefield?.hexes,
        hexCount: newCombatState.battlefield?.hexes?.length,
        turnOrderCount: newCombatState.turnOrder.length,
        firstCombatant: firstCombatant?.name,
        firstIsAlly: firstCombatant?.isAlly,
        waitingForPlayer: waitingForPlayer,
      });

      console.log('[START_COMBAT] Combat initialized (staying on overworld scene)');

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

      if (victory) {
        // Award XP
        const xp = state.combat.calculateXPReward();
        if (state.playerCharacter) {
          state.playerCharacter.gainXP(xp);
        }
      }

      return updates;
    }

    case ACTIONS.PROCESS_COMBAT_MOVEMENT: {
      if (!state.combatState) return state;

      const { path, cost } = action.payload;

      if (!path || path.length === 0) {
        console.warn('[PROCESS_COMBAT_MOVEMENT] No path provided');
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
        console.error('[PROCESS_COMBAT_MOVEMENT] Invalid destination:', destination);
        return state;
      }

      // Update current combatant's position in turnOrder
      const currentCombatant = state.combatState.turnOrder[state.combatState.currentTurnIndex];
      if (!currentCombatant) {
        console.warn(
          '[PROCESS_COMBAT_MOVEMENT] No current combatant at index:',
          state.combatState.currentTurnIndex
        );
        return state;
      }

      console.log('[PROCESS_COMBAT_MOVEMENT] Updating position:', {
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
          console.log(
            '[PROCESS_COMBAT_MOVEMENT] Updating combatant:',
            combatant.name,
            'from',
            combatant.position,
            'to',
            destination
          );
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

      const newCombatState = {
        ...state.combatState,
        turnOrder: updatedTurnOrder,
        movementRemaining: Math.max(0, state.combatState.movementRemaining - cost),
      };

      console.log('[PROCESS_COMBAT_MOVEMENT] New combat state:', {
        turnOrderCount: newCombatState.turnOrder.length,
        updatedCombatant: newCombatState.turnOrder[state.combatState.currentTurnIndex],
        movementRemaining: newCombatState.movementRemaining,
      });

      return {
        ...state,
        combatState: newCombatState,
      };
    }

    case ACTIONS.PROCESS_COMBAT_ACTION: {
      if (!state.combatState) return state;

      const { actionType, attacker, target, ability, spell, spellLevel } = action.payload;

      console.log('[PROCESS_COMBAT_ACTION] Called', { actionType, attacker, target });

      if (actionType === 'attack') {
        // Process attack action
        const attackerChar = attacker.character || attacker.enemy;
        const targetChar = target.character || target.enemy;

        console.log('[PROCESS_COMBAT_ACTION] Attack processing', {
          attackerChar: attackerChar?.name,
          targetChar: targetChar?.name,
          hasAttackerChar: !!attackerChar,
          hasTargetChar: !!targetChar,
          attackerObj: attacker,
          targetObj: target,
        });

        if (!attackerChar || !targetChar) {
          console.error('[PROCESS_COMBAT_ACTION] Invalid attacker or target', { attacker, target });
          return state;
        }

        // Get weapon info
        let weaponDamage = '1d6';
        let damageType = 'slashing';
        let attackBonus = 0;
        let damageBonus = 0;
        let weaponRange = 1;

        if (attackerChar.equipment && attackerChar.equipment.mainHand) {
          const weapon = attackerChar.equipment.mainHand;
          weaponDamage = weapon.damage || '1d6';
          damageType = weapon.damageType || 'slashing';
          weaponRange = weapon.range || 1;
          if (weapon.effects) {
            attackBonus = weapon.effects.attackBonus || 0;
            damageBonus = weapon.effects.damageBonus || 0;
          }
        }

        // Determine attack type and ability modifier
        const attackType = weaponRange > 1 ? 'ranged' : 'melee';
        const abilityMod =
          attackType === 'melee'
            ? Math.floor((attackerChar.abilities.strength - 10) / 2)
            : Math.floor((attackerChar.abilities.dexterity - 10) / 2);

        // Roll attack
        const attackRoll = Math.floor(Math.random() * 20) + 1;
        const profBonus = attackerChar.proficiencyBonus || 2;
        const attackTotal = attackRoll + abilityMod + profBonus + attackBonus;

        // Get target AC
        const targetAC = targetChar.armorClass || targetChar.ac || 10;

        // Check for Dodge condition
        const targetDodging = target.conditions?.some(c => c.type === 'Dodging');
        const effectiveAC = targetDodging ? targetAC + 2 : targetAC;

        const hit = attackRoll === 20 || (attackRoll !== 1 && attackTotal >= effectiveAC);
        const critical = attackRoll === 20;

        let damage = 0;
        let updatedTurnOrder = state.combatState.turnOrder;

        if (hit) {
          // Parse damage dice (e.g., "2d6+3")
          const match = weaponDamage.match(/(\d+)d(\d+)([+-]\d+)?/);
          if (match) {
            const count = parseInt(match[1]);
            const sides = parseInt(match[2]);
            const bonus = match[3] ? parseInt(match[3]) : 0;

            // Roll damage
            let baseDamage = 0;
            for (let i = 0; i < count; i++) {
              baseDamage += Math.floor(Math.random() * sides) + 1;
            }
            damage = baseDamage + bonus + abilityMod + damageBonus;

            // Double dice damage on crit
            if (critical) {
              let critDamage = 0;
              for (let i = 0; i < count; i++) {
                critDamage += Math.floor(Math.random() * sides) + 1;
              }
              damage += critDamage;
            }
          }

          // Apply damage to target
          updatedTurnOrder = state.combatState.turnOrder.map(c => {
            if (c.id === target.id) {
              const newHP = Math.max(0, c.currentHP - damage);
              logger.combat.info('Damage applied', {
                target: c.name,
                oldHP: c.currentHP,
                damage,
                newHP,
              });
              return {
                ...c,
                currentHP: newHP,
              };
            }
            return c;
          });

          // Log attack result
          if (critical) {
            logger.combat.info('CRITICAL HIT!', {
              attacker: attackerChar.name,
              target: targetChar.name,
              roll: attackRoll,
              total: attackTotal,
              ac: effectiveAC,
              damage,
              damageType,
            });
          } else {
            logger.combat.info('Attack hit', {
              attacker: attackerChar.name,
              target: targetChar.name,
              roll: attackRoll,
              modifier: abilityMod + profBonus + attackBonus,
              total: attackTotal,
              ac: effectiveAC,
              damage,
              damageType,
            });
          }
        } else {
          logger.combat.info('Attack missed', {
            attacker: attackerChar.name,
            target: targetChar.name,
            roll: attackRoll,
            modifier: abilityMod + profBonus + attackBonus,
            total: attackTotal,
            ac: effectiveAC,
          });
        }

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
            turnOrder: updatedTurnOrder,
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
          console.error('[PROCESS_COMBAT_ACTION] Invalid ability action', { user, ability });
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

          // Determine action type (action, bonus action, reaction)
          const abilityActionType = ability.actionType || 'action';

          return {
            ...state,
            combatState: {
              ...state.combatState,
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

      if (actionType === 'spell') {
        // Process spell action
        const caster = attacker;
        const casterChar = caster.character || caster.enemy;

        if (!casterChar || !spell) {
          console.error('[PROCESS_COMBAT_ACTION] Invalid spell action', { caster, spell });
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

      const nextIndex =
        (state.combatState.currentTurnIndex + 1) % state.combatState.turnOrder.length;
      const nextCombatant = state.combatState.turnOrder[nextIndex];

      // Increment round if we've wrapped back to index 0
      const newRound = nextIndex === 0 ? state.combatState.round + 1 : state.combatState.round;

      // Reset movement for new turn
      const moveDistance =
        nextCombatant?.character?.moveDistance || nextCombatant?.enemy?.moveDistance || 6;

      // Set waitingForPlayerAction based on whether next combatant is an ally
      const waitingForPlayer = nextCombatant?.isAlly || false;

      console.log('[ADVANCE_COMBAT_TURN]', {
        nextIndex,
        nextCombatant: nextCombatant?.name,
        isAlly: nextCombatant?.isAlly,
        waitingForPlayer,
        newRound,
      });

      return {
        ...state,
        combatState: {
          ...state.combatState,
          currentTurnIndex: nextIndex,
          round: newRound,
          movementRemaining: moveDistance * 5, // Convert hexes to feet
          waitingForPlayerAction: waitingForPlayer,
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
      const { victory, fled } = action.payload;

      return {
        ...state,
        combatState: null,
        // No scene transition - already on overworld
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
