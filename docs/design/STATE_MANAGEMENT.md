# State Management & Persistence

**Files:** `src/contexts/GameStateContext.tsx`, `src/contexts/reducers/`

## Overview

The entire game state lives in a single React Context powered by `useReducer`. There is no Redux or external state library. The reducer is split into domain-specific sub-reducers composed by a `combinedReducer` dispatcher.

---

## State Shape

```typescript
GameState {
  // === Scene ===
  currentScene: 'title' | 'character-creation' | 'overworld' |
                'combat' | 'exploration' | 'town',

  // === Player ===
  playerPosition: { col: number, row: number },
  playerCharacter: Character | null,
  party: Party | null,

  // === Map ===
  mapData: MapConfig | null,
  mapSeed: string,
  hexGrid: HexCell[][],            // 2D array [row][col]
  regions: Region[],               // RegionGenerator output
  hexToRegion: Map<string, number>,// "col,row" → regionIndex
  weatherSystem: WeatherSystem,    // Live instance

  // === Exploration ===
  exploredHexes: Set<string>,      // "col,row" keys
  discoveredPOIs: Set<string>,     // "col,row" keys
  interiorMap: InteriorMap | null, // Current dungeon/cave/etc.
  explorationState: {
    searchedPOIs: Set<string>,
    clearedEncounters: Set<string>,
    collectedLoot: Set<string>,
    triggeredHazards: Set<string>,
  },

  // === Time ===
  gameTime: { day: number, hour: number, minute: number },
  playtime: number,                // Real milliseconds played

  // === Combat ===
  combatState: CombatState | null,

  // === Quests ===
  activeQuests: Quest[],
  completedQuests: Quest[],
  failedQuests: Quest[],
  availableQuests: Quest[],
  townQuests: Record<string, Quest[]>, // Keyed by "col,row"

  // === Shopping ===
  currentShop: Shop | null,
  shopInventories: Record<string, Item[]>, // Keyed by "col,row"
}
```

---

## Context API

### Accessing State

```javascript
import { useGameState } from '../../contexts/GameStateContext';

function MyComponent() {
  const { state, dispatch, actions } = useGameState();
  // state: full GameState object
  // dispatch: React dispatch function
  // actions: ACTIONS constant object
}
```

### Helper Functions (memoized)

Available from `useGameState()`:

| Function                         | Description                                          |
| -------------------------------- | ---------------------------------------------------- |
| `isHexExplored(col, row)`        | True if hex is in `exploredHexes`                    |
| `isHexVisible(col, row)`         | True if within `viewDistance` of player              |
| `isHexReachable(col, row)`       | True if within `moveDistance` and passable           |
| `isPoiDiscovered(col, row)`      | True if POI hex is in `discoveredPOIs`               |
| `shouldShowPOI(col, row)`        | True if POI should render (visible + type allows it) |
| `isPoiSearched(col, row)`        | True if in `explorationState.searchedPOIs`           |
| `getHexDistance(c1, r1, c2, r2)` | Cube-coordinate hex distance                         |
| `hasSave()`                      | True if autosave slot exists                         |
| `loadGame()`                     | Loads state from autosave/slot1                      |
| `deleteSave()`                   | Clears all save slots                                |

---

## Reducer Architecture

```
dispatch(action)
  ↓
combinedReducer (src/contexts/reducers/index.ts)
  ↓ routes by action type group
  ├── combatReducer.ts      (combat state transitions)
  ├── characterReducer.ts   (character/party updates)
  ├── mapReducer.ts         (hex grid, POI, exploration)
  ├── questReducer.ts       (quest lifecycle)
  ├── shopReducer.ts        (buy/sell)
  └── restReducer.ts        (rest mechanics)
```

Each sub-reducer receives the full state and returns a new state. The combined reducer passes through in sequence, accumulating changes.

---

## Actions Reference

### Scene Management

| Action              | Payload                                  | Effect                                         |
| ------------------- | ---------------------------------------- | ---------------------------------------------- |
| `SET_CURRENT_SCENE` | `string` (scene name)                    | Changes active scene                           |
| `NEW_GAME`          | `{ character, party, mapSeed, mapData }` | Full initialization → transitions to overworld |
| `LOAD_GAME`         | `GameState`                              | Restores saved state                           |

### Map & Position

| Action                 | Payload                                                 | Effect                                     |
| ---------------------- | ------------------------------------------------------- | ------------------------------------------ |
| `SET_PLAYER_POSITION`  | `{ col, row }`                                          | Moves player; triggers fog-of-war reveal   |
| `SET_MAP_DATA`         | `{ hexGrid, regions, hexToRegion, weatherSystem, ... }` | Sets generated map                         |
| `ADD_EXPLORED_HEX`     | `{ col, row }`                                          | Adds hex to `exploredHexes`                |
| `REVEAL_AROUND_PLAYER` | `{ col, row, radius }`                                  | Batch-adds nearby hexes to `exploredHexes` |
| `DISCOVER_POI`         | `{ col, row }`                                          | Adds to `discoveredPOIs`                   |

### Character & Party

| Action                 | Payload      | Effect                                              |
| ---------------------- | ------------ | --------------------------------------------------- |
| `SET_PLAYER_CHARACTER` | `Character`  | Sets player character                               |
| `SET_PARTY`            | `Party`      | Sets full party                                     |
| `UPDATE_CHARACTER`     | `Character`  | Replaces `playerCharacter` (must be immutable copy) |
| `AWARD_XP`             | `{ amount }` | Adds XP; triggers level-up check                    |
| `LEVEL_UP_CHARACTER`   | —            | Calls `character.levelUp()`                         |

### Inventory

| Action         | Payload            | Effect                                      |
| -------------- | ------------------ | ------------------------------------------- |
| `ADD_ITEM`     | `Item`             | Appends to character inventory              |
| `REMOVE_ITEM`  | `{ itemId }`       | Removes item by id                          |
| `EQUIP_ITEM`   | `{ itemId, slot }` | Moves to equipment slot; recalculates stats |
| `UNEQUIP_ITEM` | `{ slot }`         | Returns to inventory; recalculates stats    |

### Time

| Action            | Payload       | Effect                                                  |
| ----------------- | ------------- | ------------------------------------------------------- |
| `ADVANCE_TIME`    | `{ minutes }` | Calls `advanceTime()`; updates `weatherSystem.update()` |
| `UPDATE_PLAYTIME` | `{ delta }`   | Adds real milliseconds to `playtime`                    |

### Survival

| Action             | Payload                            | Effect                                    |
| ------------------ | ---------------------------------- | ----------------------------------------- |
| `CONSUME_RATIONS`  | `{ character }`                    | Calls `SurvivalManager.consumeRations()`  |
| `FORAGE`           | `{ character, hexes, diceRoller }` | Calls `SurvivalManager.forage()`          |
| `APPLY_EXHAUSTION` | `{ character }`                    | Calls `SurvivalManager.applyStarvation()` |

### Rest

| Action       | Payload              | Effect                                                           |
| ------------ | -------------------- | ---------------------------------------------------------------- |
| `SHORT_REST` | `{ hitDiceToSpend }` | `RestManager.shortRest()` + advance time 60m                     |
| `LONG_REST`  | —                    | `RestManager.longRest()` + advance time 480m + reduce exhaustion |
| `INN_REST`   | `{ costPerPerson }`  | `RestManager.innRest()` + advance time 480m                      |

### Exploration

| Action              | Payload                    | Effect                                                  |
| ------------------- | -------------------------- | ------------------------------------------------------- |
| `ENTER_EXPLORATION` | `{ poi, interiorMap }`     | Sets `interiorMap`; transitions to `'exploration'`      |
| `EXIT_EXPLORATION`  | —                          | Clears `interiorMap`; returns to `'overworld'`          |
| `SEARCH_POI`        | `{ col, row, diceRoller }` | Investigation check; adds to `searchedPOIs`             |
| `DEFEAT_ENCOUNTER`  | `{ col, row }`             | Adds to `clearedEncounters`                             |
| `COLLECT_LOOT`      | `{ col, row, cr }`         | Generates and distributes loot; adds to `collectedLoot` |
| `TRIGGER_HAZARD`    | `{ col, row }`             | Marks hazard triggered; applies effects                 |

### Combat

| Action                    | Payload                                     | Effect                                                                            |
| ------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| `START_COMBAT`            | `{ enemies, encounterName, encounterType }` | Creates `Combat` instance; rolls initiative; transitions to `'combat'`            |
| `PROCESS_COMBAT_ACTION`   | `{ actionType, ... }`                       | Routes to specific combat action handler                                          |
| `PROCESS_COMBAT_MOVEMENT` | `{ path, moveCost }`                        | Updates combatant position in `turnOrder`                                         |
| `ADVANCE_COMBAT_TURN`     | —                                           | Increments `currentTurnIndex`; resets `turnState`; increments round when wrapping |
| `END_COMBAT`              | `{ outcome }`                               | Syncs character HP; awards XP; transitions to `'overworld'`                       |
| `UPDATE_COMBATANT_HP`     | `{ id, newHP }`                             | Updates HP in `turnOrder[].currentHP`                                             |
| `UPDATE_COMBAT_STATE`     | `{ updates }`                               | Partial update to `combatState` fields                                            |

### D&D 5e Action Economy (Combat)

| Action                        | Effect                                      |
| ----------------------------- | ------------------------------------------- |
| `USE_COMBAT_ACTION`           | Sets `turnState.actionUsed = true`          |
| `USE_COMBAT_BONUS_ACTION`     | Sets `turnState.bonusActionUsed = true`     |
| `USE_COMBAT_REACTION`         | Sets `turnState.reactionUsed = true`        |
| `USE_COMBAT_MOVEMENT`         | Adds to `turnState.movementUsed`            |
| `USE_FREE_OBJECT_INTERACTION` | Sets `turnState.freeObjectUsed = true`      |
| `INCREMENT_ATTACK_COUNT`      | Increments `turnState.attacksMade`          |
| `ADD_COMBAT_CONDITION`        | Pushes to `turnState.conditions[]`          |
| `REMOVE_COMBAT_CONDITION`     | Filters from `turnState.conditions[]`       |
| `SET_COMBAT_TURN_STATE`       | Partial update to `turnState` fields        |
| `RESET_COMBAT_TURN_STATE`     | Resets all `turnState` fields to defaults   |
| `SET_READY_ACTION`            | Sets `turnState.readyAction`                |
| `TRIGGER_READY_ACTION`        | Fires the readied action; consumes reaction |

### Quests

| Action                  | Payload                                      | Effect                                         |
| ----------------------- | -------------------------------------------- | ---------------------------------------------- |
| `GENERATE_TOWN_QUESTS`  | `{ hexKey, level, location, nearbyTerrain }` | Generates quests for a settlement              |
| `REFRESH_QUESTS`        | `{ hexKey }`                                 | Regenerates quest pool for a settlement        |
| `ACCEPT_QUEST`          | `{ questId }`                                | Moves from `availableQuests` to `activeQuests` |
| `UPDATE_QUEST_PROGRESS` | `{ questId, progress }`                      | Updates objective completion                   |
| `COMPLETE_QUEST`        | `{ questId }`                                | Awards XP + gold; moves to `completedQuests`   |
| `FAIL_QUEST`            | `{ questId }`                                | Moves to `failedQuests`                        |

### Shop

| Action                    | Payload              | Effect                                |
| ------------------------- | -------------------- | ------------------------------------- |
| `GENERATE_SHOP_INVENTORY` | `{ hexKey, tier }`   | Creates shop inventory for settlement |
| `BUY_ITEM`                | `{ itemId, hexKey }` | Deducts gold; adds item to inventory  |
| `SELL_ITEM`               | `{ itemId }`         | Removes item; adds 50% value in gold  |

---

## Immutability Rules

The reducer **must always return a new object**. Common patterns:

```javascript
// Simple field update
return { ...state, playerPosition: { col: 5, row: 10 } };

// Set update (always create new Set)
return {
  ...state,
  exploredHexes: new Set([...state.exploredHexes, '5,10']),
};

// Array update
return {
  ...state,
  activeQuests: [...state.activeQuests, newQuest],
};

// Nested object update
return {
  ...state,
  combatState: {
    ...state.combatState,
    turnOrder: updatedTurnOrder,
  },
};

// Character update (must use fromJSON/toJSON)
const updated = Character.fromJSON(character.toJSON());
updated.rations--;
return { ...state, playerCharacter: updated };
```

**Never** mutate `state.exploredHexes.add()` — this mutates the existing Set without triggering re-renders.

---

## Hex Coordinate System

The game uses **offset coordinates** (col, row) stored in state. Distance calculations internally convert to **cube coordinates**:

```javascript
// Offset → Cube
const x1 = col1 - Math.floor(row1 / 2);
const z1 = row1;
const y1 = -x1 - z1;

// Hex distance (cube coordinate Chebyshev)
const distance = Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
```

`getHexDistance(col1, row1, col2, row2)` is exported from `GameStateContext` for component use.

---

## Auto-Save System

Auto-save fires 500ms after `currentScene` changes to `'overworld'`, `'exploration'`, or `'town'`.

```javascript
useEffect(() => {
  if (['overworld', 'exploration', 'town'].includes(state.currentScene)) {
    const timeout = setTimeout(() => {
      SaveManager.saveToSlot(SAVE_SLOTS.AUTOSAVE, state);
    }, 500);
    return () => clearTimeout(timeout);
  }
}, [state.currentScene]);
```

### Save Slots

| Slot     | Key        | Description                      |
| -------- | ---------- | -------------------------------- |
| Autosave | `AUTOSAVE` | Automatic; fires on scene change |
| Slot 1   | `SLOT_1`   | Manual save                      |
| Slot 2   | `SLOT_2`   | Manual save                      |
| Slot 3   | `SLOT_3`   | Manual save                      |

Load priority: Autosave → Slot 1.

### Save Format

```json
{
  "version": "0.x.x",
  "timestamp": 1234567890,
  "playerPosition": { "col": 10, "row": 5 },
  "playerCharacter": {
    /* Character.toJSON() */
  },
  "party": {
    /* Party.toJSON() — includes all NPC Character.toJSON() */
  },
  "mapSeed": "abc123def456",
  "hexGrid": [
    /* 2D array serialized */
  ],
  "regions": [
    /* region objects */
  ],
  "exploredHexes": ["10,5", "11,5", "9,5"],
  "discoveredPOIs": ["12,7"],
  "gameTime": { "day": 3, "hour": 14, "minute": 30 },
  "playtime": 18000000,
  "activeQuests": [
    /* quest objects */
  ],
  "explorationState": {
    "searchedPOIs": [],
    "clearedEncounters": [],
    "collectedLoot": [],
    "triggeredHazards": []
  }
}
```

### Serialization Notes

- `Set` values → serialized as arrays; reconstructed as `new Set(array)` on load
- `Map` values (`hexToRegion`) → serialized as `[...map.entries()]`; reconstructed as `new Map(entries)` on load
- `WeatherSystem` → re-instantiated from `regions` data (state, not full instance)
- `Combat` → not persisted (combat state is lost if the page is reloaded mid-combat; this is expected behavior)
- All `Item` instances → round-tripped via `Item.toJSON()` / `Item.fromJSON()`
- All `Character` instances → round-tripped via `Character.toJSON()` / `Character.fromJSON()`

### localStorage Limits

- ~5–10 MB limit per domain
- Large maps (30×20 = 600 hexes) with full POI/weather data can approach this limit
- All `localStorage` calls are wrapped in try/catch to handle quota exceeded errors:

```javascript
try {
  localStorage.setItem(key, JSON.stringify(data));
} catch (error) {
  logger.storage.error('Save failed', { error, key });
}
```

---

## Settings Context

**File:** `src/contexts/SettingsContext.tsx`

Separate from game state. Stores user preferences and persists to its own localStorage key.

Settings include:

- Sound volume
- Music volume
- Animation speed
- Map display options (show grid, show coordinates, etc.)
- Accessibility options

Accessed via `useSettings()` hook (separate from `useGameState()`).

---

## Game Log Context

**File:** `src/contexts/GameLogContext.tsx`

The in-game message log is a separate context to avoid unnecessary re-renders of the full game state on every log message.

```javascript
import { useGameLog } from '../../contexts/GameLogContext';
const { addMessage, messages, clearLog } = useGameLog();

addMessage('Found ancient ruins!', 'discovery');
```

Message types: `info`, `success`, `warning`, `error`, `action`, `discovery`, `encounter`, `system`, `poi-interaction`

Messages are stored in a capped ring buffer (last N messages) to prevent unbounded memory growth.
