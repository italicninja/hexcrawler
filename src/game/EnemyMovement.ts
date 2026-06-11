// @ts-nocheck
/**
 * EnemyMovement — Framework for interior dungeon enemy AI and movement.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DESIGN OVERVIEW
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every time the player takes a step inside a POI interior, each alive
 * encounter on the same floor takes its own "turn". This is NOT the full
 * tactical D&D 5e grid-combat system — it is the overworld-interior stalking
 * phase that happens before combat is engaged.
 *
 * Phase flow:
 *
 *   1. Player double-clicks a hex  (handleInteriorHexDoubleClick)
 *   2. Player moves to new position (SET_INTERIOR_PLAYER_POSITION dispatched)
 *   3. **EnemyMovement.tick() is called** with the updated world state
 *   4. Each living encounter calls its BehaviourState machine:
 *        IDLE  → ALERTED  → HUNTING  → ADJACENT (triggers combat)
 *   5. Encounters that moved dispatch SET_ENCOUNTER_POSITION actions
 *   6. Canvas re-renders with enemies at new positions
 *   7. If any encounter is now adjacent to the player → START_COMBAT
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * STATE MODEL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Each encounter in `interiorMap.encounters[]` gains two new runtime fields
 * (not persisted to save files — reset on re-entry):
 *
 *   encounter.position  { col: number, row: number }
 *     Current hex position. Starts at encounter.col / encounter.row (the
 *     generator-placed home position). Updated by SET_ENCOUNTER_POSITION.
 *
 *   encounter.behaviour  BehaviourState (see enum below)
 *     Current AI state. Starts as IDLE. Not persisted.
 *
 *   encounter.alertRange  number  (default = 4 hexes for normal, 6 for boss)
 *     Distance at which the enemy notices the player and transitions IDLE→ALERTED.
 *
 *   encounter.chaseRange  number  (default = 8 hexes)
 *     Distance at which a HUNTING enemy gives up and returns to patrol.
 *
 *   encounter.homePosition  { col, row }
 *     Copy of the original col/row — used to return to patrol after losing the player.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BEHAVIOUR STATE MACHINE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ┌──────────┐  player enters alertRange  ┌──────────────┐
 *  │   IDLE   │ ─────────────────────────► │   ALERTED    │
 *  │  (patrol)│                            │  (1 turn     │
 *  └──────────┘                            │   hesitation)│
 *       ▲                                  └──────┬───────┘
 *       │  player exits chaseRange                │ next tick
 *       │  (or wall blocks LOS)                   ▼
 *       │                                  ┌──────────────┐
 *       └──────────────────────────────────│   HUNTING    │
 *                                          │  (moves 1    │
 *                                          │   hex/turn   │
 *                                          │   toward     │
 *                                          │   player)    │
 *                                          └──────┬───────┘
 *                                                 │ distance == 1
 *                                                 ▼
 *                                          ┌──────────────┐
 *                                          │   ADJACENT   │
 *                                          │ → START_COMBAT│
 *                                          └──────────────┘
 *
 *  IDLE patrol: enemy moves 1 hex per N player steps along a patrol path
 *  (or stays still — configurable per encounter type).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PATHFINDING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Enemy movement uses the existing `findPath` from src/game/Pathfinding.ts.
 * The same hex-grid pathfinder used for overworld movement works on the
 * interior grid — walkable tiles are passable, walls are not.
 *
 * For HUNTING state: find path from enemy.position → playerPosition, take
 * only the first step.
 *
 * For IDLE patrol: cycle through a short patrol path (2-4 waypoints chosen
 * at generation time, stored in encounter.patrolPath).
 *
 * For ALERTED: stay still for 1 tick (gives the player a warning window).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LINE-OF-SIGHT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * IDLE → ALERTED transition only fires if there is clear line-of-sight
 * between the enemy and the player (no wall tiles blocking the line).
 *
 * Use Bresenham's line algorithm on the hex grid:
 *   hasLineOfSight(grid, from, to) → boolean
 *
 * Without LOS, enemies cannot detect the player even within alertRange.
 * This creates around-the-corner stealth opportunities.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * REDUX ACTIONS REQUIRED (to be added to GameStateContext + explorationReducer)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   SET_ENCOUNTER_POSITION
 *     payload: { poiKey, encounterKey: "col,row", position: { col, row } }
 *     Updates encounter.position in interiorMaps[poiKey].encounters[].
 *
 *   SET_ENCOUNTER_BEHAVIOUR
 *     payload: { poiKey, encounterKey, behaviour: BehaviourState }
 *     Updates encounter.behaviour.
 *
 *   RESET_ENCOUNTER_POSITIONS
 *     payload: { poiKey }
 *     Called on EXIT_EXPLORATION — resets all encounter positions and
 *     behaviours back to their generator-placed home positions.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * INTEGRATION POINT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * In OverworldScene.tsx → handleInteriorHexDoubleClick:
 *
 *   // After the player move is dispatched:
 *   dispatch({ type: actions.SET_INTERIOR_PLAYER_POSITION, payload: newPos });
 *
 *   // FUTURE: tick enemy movement
 *   // const combatTriggered = EnemyMovement.tick({
 *   //   interiorMap,
 *   //   playerPosition: newPos,
 *   //   poiKey,
 *   //   dispatch,
 *   //   actions,
 *   //   addMessage,
 *   //   startCombat,  // callback to trigger START_COMBAT
 *   // });
 *   // if (combatTriggered) return; // don't process loot etc if combat started
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CANVAS RENDERING CHANGES REQUIRED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Currently, encounter tokens are drawn at their GENERATOR position (col/row
 * from the encounter object). When movement is implemented, the canvas must
 * read encounter.position (the runtime position) instead of encounter.col/row.
 *
 * In InteriorHexCanvas.tsx → drawHex():
 *   // FUTURE: use encounter.position?.col ?? encounter.col
 *   // and render the token at the MOVED position, not the original hex.
 *   // The original hex should no longer have content='encounter' drawn there.
 *
 * This requires a separate "enemy layer" draw pass after all terrain hexes,
 * similar to how drawPlayer() is called after drawHex() for all hexes.
 *
 * Proposed draw order:
 *   1. drawHex() for all hexes  (terrain + static content: loot, stairs, exit)
 *   2. drawEnemyTokens()        (iterate interiorMap.encounters, draw at .position)
 *   3. drawPlayer()             (always on top)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * COMBAT BRIDGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * When an enemy reaches distance 1 from the player (ADJACENT state):
 *
 *   1. Log: "The {creatures} attacks!"
 *   2. Build enemy combatants: Enemy.parseCreatureString(enc.creatures, enc.cr, diceRoller)
 *   3. Dispatch START_COMBAT with those combatants
 *   4. On combat resolution (RESOLVE_COMBAT):
 *        - If player wins → dispatch DEFEAT_ENCOUNTER (mark enc.defeated = true)
 *        - The encounter token grays out on canvas
 *        - Encounter no longer ticks
 *   5. DEFEAT_ENCOUNTER reducer (currently broken — needs fixing):
 *        - Match by `${enc.col},${enc.row}` key (not by enc.id)
 *        - Update state.interiorMaps[poiKey].encounters[] (not legacy interiorMap)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type BehaviourState = 'idle' | 'alerted' | 'hunting' | 'adjacent';

export interface EnemyState {
  /** Current runtime position (may differ from generator home) */
  position: { col: number; row: number };
  /** AI state machine */
  behaviour: BehaviourState;
  /** Original home position (for patrol return) */
  homePosition: { col: number; row: number };
  /** Distance at which enemy notices player (if LOS clear) */
  alertRange: number;
  /** Distance at which hunting enemy gives up */
  chaseRange: number;
  /** Patrol waypoints (optional — enemies without patrol stay still when IDLE) */
  patrolPath?: Array<{ col: number; row: number }>;
  /** Index into patrolPath */
  patrolIndex?: number;
}

export interface TickContext {
  interiorMap: any;
  playerPosition: { col: number; row: number };
  poiKey: string;
  dispatch: (action: any) => void;
  actions: Record<string, string>;
  addMessage: (msg: string, type: string) => void;
  startCombat: (encounter: any) => void;
}

// ─── Stub: hasLineOfSight ────────────────────────────────────────────────────

/**
 * Returns true if there are no wall tiles between `from` and `to`.
 * Uses Bresenham's line algorithm adapted for square hex grid columns.
 *
 * TODO: Implement when enemy movement is activated.
 */
export function hasLineOfSight(
  hexes: any[],
  from: { col: number; row: number },
  to: { col: number; row: number }
): boolean {
  // STUB — always true until implemented
  // Real implementation: walk the line from→to, check each cell for walls
  return true;
}

// ─── Stub: getHexDistanceLocal ───────────────────────────────────────────────

function dist(a: { col: number; row: number }, b: { col: number; row: number }): number {
  // Offset-grid Chebyshev distance (matches hexMath.getHexDistance)
  const dc = Math.abs(a.col - b.col);
  const dr = Math.abs(a.row - b.row);
  return Math.max(dc, dr);
}

// ─── Stub: stepToward ───────────────────────────────────────────────────────

/**
 * Returns the next walkable hex position on a path from `from` toward `to`.
 * Falls back to naive step if pathfinding is unavailable.
 *
 * TODO: Wire up to src/game/Pathfinding.ts → findPath() when activating.
 */
function stepToward(
  hexes: any[],
  from: { col: number; row: number },
  to: { col: number; row: number }
): { col: number; row: number } | null {
  // STUB — naive one-step toward target (ignores walls)
  // Real implementation: findPath(hexes, from, to)?.[1] ?? null
  const dc = to.col - from.col;
  const dr = to.row - from.row;
  const nextCol = from.col + (dc === 0 ? 0 : dc > 0 ? 1 : -1);
  const nextRow = from.row + (dr === 0 ? 0 : dr > 0 ? 1 : -1);
  const target = hexes.find(h => h.col === nextCol && h.row === nextRow);
  if (target?.terrain?.walkable && target.content !== 'encounter') {
    return { col: nextCol, row: nextRow };
  }
  return null;
}

// ─── Main tick function (STUB — not yet called) ──────────────────────────────

/**
 * Called once per player movement step.
 * Iterates all living encounters and advances their AI state machine.
 *
 * Returns true if combat was triggered (caller should stop processing).
 *
 * TODO: Call this from handleInteriorHexDoubleClick in OverworldScene.tsx
 *       after SET_INTERIOR_PLAYER_POSITION is dispatched.
 */
export function tick(ctx: TickContext): boolean {
  const { interiorMap, playerPosition, poiKey, dispatch, actions, addMessage, startCombat } = ctx;

  if (!interiorMap?.encounters) return false;

  const livingEncounters = interiorMap.encounters.filter((e: any) => !e.defeated);

  for (const enc of livingEncounters) {
    // Initialise runtime state the first time we see this encounter
    if (!enc.position) {
      enc.position = { col: enc.col, row: enc.row };
      enc.homePosition = { col: enc.col, row: enc.row };
      enc.behaviour = 'idle';
      enc.alertRange = enc.isBoss ? 6 : 4;
      enc.chaseRange = enc.isBoss ? 12 : 8;
    }

    const d = dist(enc.position, playerPosition);

    // ── State transitions ────────────────────────────────────────────────────
    switch (enc.behaviour as BehaviourState) {
      case 'idle':
        if (
          d <= enc.alertRange &&
          hasLineOfSight(interiorMap.hexes, enc.position, playerPosition)
        ) {
          enc.behaviour = 'alerted';
          addMessage(`The ${enc.creatures || 'enemy'} notices you!`, 'warning');
          dispatch({
            type: actions.SET_ENCOUNTER_BEHAVIOUR,
            payload: { poiKey, encounterKey: `${enc.col},${enc.row}`, behaviour: 'alerted' },
          });
        } else {
          // TODO: Patrol movement (cycle enc.patrolPath)
        }
        break;

      case 'alerted':
        // One turn hesitation before hunting
        enc.behaviour = 'hunting';
        dispatch({
          type: actions.SET_ENCOUNTER_BEHAVIOUR,
          payload: { poiKey, encounterKey: `${enc.col},${enc.row}`, behaviour: 'hunting' },
        });
        break;

      case 'hunting': {
        if (d > enc.chaseRange) {
          // Lost the player — return to idle
          enc.behaviour = 'idle';
          dispatch({
            type: actions.SET_ENCOUNTER_BEHAVIOUR,
            payload: { poiKey, encounterKey: `${enc.col},${enc.row}`, behaviour: 'idle' },
          });
          break;
        }

        if (d === 1) {
          // Adjacent — trigger combat
          enc.behaviour = 'adjacent';
          dispatch({
            type: actions.SET_ENCOUNTER_BEHAVIOUR,
            payload: { poiKey, encounterKey: `${enc.col},${enc.row}`, behaviour: 'adjacent' },
          });
          addMessage(`${enc.creatures || 'The enemy'} attacks!`, 'danger');
          startCombat(enc);
          return true; // Combat started — stop processing remaining enemies
        }

        // Move one step toward player
        const next = stepToward(interiorMap.hexes, enc.position, playerPosition);
        if (next) {
          enc.position = next;
          dispatch({
            type: actions.SET_ENCOUNTER_POSITION,
            payload: { poiKey, encounterKey: `${enc.col},${enc.row}`, position: next },
          });
        }
        break;
      }

      case 'adjacent':
        // Should have triggered combat already — this state is transient
        break;
    }
  }

  return false;
}

export const EnemyMovement = { tick, hasLineOfSight };
export default EnemyMovement;
