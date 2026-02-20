# Survival, Exploration & Time System

## Overview

The survival and exploration systems model the resource-management layer of overland D&D 5e play: tracking game time, consuming rations, exhaustion from starvation, foraging for food, resting to recover, and managing the quest lifecycle.

---

## Time System

**File:** `src/game/TimeManager.ts`

Game time is stored as `GameTime: { day: number, hour: number, minute: number }`. The clock starts at **Day 1, 08:00**.

### Time Functions

| Function                         | Behavior                                                           |
| -------------------------------- | ------------------------------------------------------------------ |
| `createGameTime()`               | Returns `{ day: 1, hour: 8, minute: 0 }`                           |
| `advanceTime(gameTime, minutes)` | Immutable; handles minute/hour/day rollover                        |
| `formatTime(gameTime)`           | Returns `"Day 5, 14:30"`                                           |
| `isNight(hour)`                  | True if `hour >= 20 \|\| hour < 6`                                 |
| `getTimeOfDay(hour)`             | `'dawn'` (6–8), `'day'` (8–18), `'dusk'` (18–20), `'night'` (20–6) |
| `getCombatDuration()`            | 5–10 minutes (random)                                              |
| `getExplorationDuration()`       | 60–120 minutes (random)                                            |
| `getTimeUntilDawn(gameTime)`     | Minutes until 6:00 AM                                              |
| `getTimeUntilDusk(gameTime)`     | Minutes until 20:00                                                |

### Time Costs (ACTION → minutes consumed)

| Action         | Minutes            |
| -------------- | ------------------ |
| Move 1 hex     | 1,440 (1 full day) |
| Combat         | 5–10               |
| Short Rest     | 60                 |
| Long Rest      | 480 (8 hours)      |
| Search         | 30                 |
| Forage         | 240 (4 hours)      |
| Exploration    | 60–120             |
| Camp Setup     | 30                 |
| Camp Breakdown | 15                 |

**Important:** Overland hex movement costs 1 full game-day per hex. This means each move increments the survival day counter and triggers ration consumption and starvation checks.

---

## Survival System

**File:** `src/game/SurvivalManager.ts`

Pure TypeScript functions (no class). Operates on `Character` instances — callers must use the `fromJSON(toJSON())` immutable copy pattern before calling these functions.

### Ration Consumption

Called after each hex move (1 game-day passes):

```typescript
consumeRations(character);
```

- If `character.rations > 0`: decrements `rations`
- If `character.rations === 0`: increments `daysWithoutFood`

### Starvation

```typescript
applyStarvation(character);
```

- Starvation kicks in when: `daysWithoutFood >= (3 + CON modifier)`
- When threshold exceeded: `exhaustionLevel` increments by 1
- Exhaustion capped at 6 (level 6 = death)

### Exhaustion Effects

| Level | Description                                    | Mechanical Penalties         |
| ----- | ---------------------------------------------- | ---------------------------- |
| 0     | None                                           | —                            |
| 1     | Disadvantage on ability checks                 | `disadvantage_checks`        |
| 2     | Speed halved                                   | `speed_halved`               |
| 3     | Disadvantage on attack rolls and saving throws | `disadvantage_attacks_saves` |
| 4     | HP maximum halved                              | `hp_max_halved`              |
| 5     | Speed reduced to 0                             | `speed_zero`                 |
| 6     | Death                                          | —                            |

`getExhaustionEffects(level)` and `getActiveExhaustionPenalties(character)` return structured penalty data.

### Exhaustion Recovery

- One level of exhaustion is removed by a successful long rest **with food**: `SurvivalManager.reduceExhaustion(character)` (called from `RestManager.longRest()` if character ate that day).

### Water System

Water tracking was removed from the active systems. All water-related functions (`consumeWater`, `findWater`, `applyDehydration`) are deprecated stubs that return no-ops.

---

## Foraging

```typescript
forage(character, hexes, diceRoller, currentDay);
```

The player spends 4 hours (240 minutes) foraging nearby hexes.

### Skill Check

Wisdom (Survival) check vs a DC derived from surrounding terrain:

| Terrain Type        | DC  |
| ------------------- | --- |
| Grassland, Forest   | 10  |
| Hills, Swamp, River | 12  |
| Mountains, Tundra   | 15  |
| Desert, Water       | 20  |

The DC is calculated as the **average** of all provided surrounding hexes' terrain DCs.

### Success

If the check succeeds:

- Rations gained = `rollDice(4) + goodHexCount` (where `goodHexCount` = count of hexes with DC ≤ 12)
- Results auto-logged: `"Survival 10+3=13 vs DC 12: Success"` then `"Found 9 rations (6 rich hexes)"`

### Failure

- Action consumed; no rations gained
- Logged appropriately

### Already Foraged

- `character.foragedHexes` tracks hex keys already foraged today
- Re-foraging the same hex on the same day is not allowed

---

## Rest System

**File:** `src/game/RestManager.ts`

All methods are static — `RestManager` is used as a namespace.

### Short Rest (1 hour)

```typescript
RestManager.shortRest(character, hitDiceToSpend);
```

- Requires: `character.hitDiceRemaining > 0`
- For each hit die spent: recover `floor(hitDie / 2) + 1 + CON modifier` HP (minimum 1)
- Calls `recoverShortRestAbilities(character)` — restores ability uses with `recoverOn: 'short'`
- `hitDiceRemaining` decremented per die spent
- Advances game time by 60 minutes

### Long Rest (8 hours)

```typescript
RestManager.longRest(character, currentGameTime);
```

- **Enforces 24-hour cooldown:** `canLongRest(character, currentGameTime)` returns false if fewer than 24 game-hours have elapsed since `character.lastLongRest`
- Full HP restoration
- Recover `max(1, floor(level / 2))` hit dice
- Resets all ability uses and spell slots via `recoverLongRestAbilities(character)`
- Updates `character.lastLongRest` to current game-hours
- If character has food: `SurvivalManager.reduceExhaustion(character)` called
- Advances game time by 480 minutes

### Rest Interruption

Terrain and difficulty can interrupt long rests:

```typescript
RestManager.isRestInterrupted(terrainType, difficulty);
```

Base interruption chance: 10%

- Each difficulty tier above 1 adds +5%
- Swamp/mountain terrain adds +15%
- Maximum chance: 30%

If interrupted, the rest must be started over (no partial recovery).

### Inn Rest

```typescript
RestManager.innRest(character, party, costPerPerson, currentGameTime);
```

- Guaranteed full recovery (no interruption chance)
- Costs `livingMembers.length * costPerPerson` gold
- Deducted from `character.gold`
- Requires `character.currentHP < character.maxHP` (must need healing to pay)
- Advances game time by 480 minutes

---

## Exploration System

### Interior Exploration

When the player enters a dungeon, cave, tower, ruins, or other explorable POI, the `ENTER_EXPLORATION` action transitions to the `'exploration'` scene.

Interior maps are generated by the appropriate generator:

| POI Type        | Generator             |
| --------------- | --------------------- |
| Dungeon         | `DungeonGenerator.ts` |
| Cave            | `CaveGenerator.ts`    |
| Tower           | `TowerGenerator.ts`   |
| Ruins           | `RuinsGenerator.ts`   |
| Town (interior) | `TownGenerator.ts`    |

`InteriorGenerator.ts` orchestrates which generator to use.

### Exploration State

```typescript
state.explorationState: {
  searchedPOIs: Set<string>,        // POI hexes already searched
  clearedEncounters: Set<string>,   // Encounters already defeated
  collectedLoot: Set<string>,       // Loot already picked up
  triggeredHazards: Set<string>,    // Hazards already triggered
}
```

### Hazards

**File:** `src/game/HazardGenerator.ts`

Interior maps include environmental hazards drawn from SRD trap data (`GameTableData.ts`). Hazard DCs scale with the dungeon CR. Triggered hazards are tracked in `explorationState.triggeredHazards` to prevent re-triggering.

### Searching

The player can spend 30 minutes searching a POI hex:

- `SEARCH_POI` action
- Returns loot, reveals hidden doors, or finds traps
- DiceRoller Investigation check vs DC
- `searchedPOIs` tracks which hexes have been searched

---

## Quest System

**Files:** `src/game/Quest.ts`, `src/game/QuestGenerator.ts`

### Quest Types

| Type      | Objective                            | Reward Scaling  |
| --------- | ------------------------------------ | --------------- |
| `kill`    | Defeat N enemies of a specific type  | By CR and count |
| `collect` | Gather N items from terrain          | By item rarity  |
| `explore` | Visit an unexplored hex              | By distance     |
| `deliver` | Transport item to another settlement | By distance     |

### Quest Status Lifecycle

```
pending → active → completed
              ↓
           failed
```

### Quest State in GameStateContext

| Field               | Description                            |
| ------------------- | -------------------------------------- |
| `availableQuests[]` | Quests on the board, not yet accepted  |
| `activeQuests[]`    | Quests accepted and in progress        |
| `completedQuests[]` | Successfully finished quests           |
| `failedQuests[]`    | Failed or abandoned quests             |
| `townQuests{}`      | Quests keyed by town hex (`"col,row"`) |

### Quest Generation

`QuestGenerator.generateQuest(level, location, questGiverName, nearbyTerrain)`:

1. Rolls quest type randomly
2. Scales difficulty (enemy CR, item count, distance) to party level
3. Selects terrain-appropriate enemies/locations:
   - `selectEnemyForLevel(difficulty, nearbyTerrain)` — biases toward creatures matching nearby terrain type
4. Generates descriptive narrative text using `questGiverName`
5. Returns a `Quest` instance

`GENERATE_TOWN_QUESTS` dispatches quest generation when the party enters a settlement. Quest pools refresh over time via `REFRESH_QUESTS`.

### Accepting a Quest

`ACCEPT_QUEST` moves a quest from `availableQuests[]` to `activeQuests[]`.

### Progress Tracking

`UPDATE_QUEST_PROGRESS` is dispatched when:

- An enemy matching the quest target is killed
- An item matching the quest is collected
- A target hex is visited

When all objectives are met, `COMPLETE_QUEST` awards XP and gold rewards.

---

## Shops

**File:** `src/game/Shop.ts`

Settlements of Village tier and above have shops. Shop inventory is generated by `GENERATE_SHOP_INVENTORY` when the player enters a town.

Shop contents scale with settlement tier:

- Camp: Basic supplies (rations, rope, torches)
- Village: Basic supplies + simple weapons
- Town: Weapons, armor, adventuring gear
- City+: All items + uncommon magic items

`BUY_ITEM` deducts gold and adds item to inventory.
`SELL_ITEM` adds gold at 50% item value and removes item from inventory.

Shop inventories are cached in `state.shopInventories{}` (keyed by hex) and persist between visits during the same session.

---

## Dice Rolling System

**File:** `src/game/DiceRoller.ts`

All skill checks, saving throws, attack rolls, and damage rolls route through `DiceRoller`. This ensures consistent logging to the GameLog.

### Creating a DiceRoller

```javascript
// Gameplay rolls — logs to GameLog
import { useGameLog } from '../../contexts/GameLogContext';
const { addMessage } = useGameLog();
const diceRoller = new DiceRoller(null, addMessage);

// Procedural generation — no logging, seeded
const diceRoller = new DiceRoller(mapSeed);
```

### Key Methods

| Method                                                           | Logs Automatically                       |
| ---------------------------------------------------------------- | ---------------------------------------- |
| `skillCheck(char, ability, proficient, dc, rollType, skillName)` | Yes (when dc > 0 and skillName provided) |
| `perceptionCheck(char, dc, rollType)`                            | Yes                                      |
| `investigationCheck(char, dc, rollType)`                         | Yes                                      |
| `savingThrow(char, ability, dc, rollType)`                       | Yes                                      |
| `attackRoll(char, attackType, targetAC, weaponName)`             | Yes                                      |
| `damageRoll(diceString, damageType)`                             | Yes (when damageType provided)           |
| `rollD20()`                                                      | No                                       |
| `rollDice(sides, count)`                                         | No                                       |

### DC = 0 Special Case

Passing `dc = 0` to `skillCheck` suppresses auto-logging. Use this for manual threshold checks (e.g., POI search where you compare the roll result yourself).

---

## GameLog (User Feedback)

**File:** `src/contexts/GameLogContext.tsx`

All user-visible feedback goes to the GameLog — never modal dialogs or popups.

```javascript
import { useGameLog } from '../../contexts/GameLogContext';
const { addMessage } = useGameLog();
addMessage('Moved to forest hex (15, 23)', 'action');
```

### Message Types

| Type              | Color   | Usage                        |
| ----------------- | ------- | ---------------------------- |
| `info`            | Neutral | General information          |
| `success`         | Green   | Positive outcomes, gains     |
| `warning`         | Yellow  | Cautions, blocked actions    |
| `error`           | Red     | Failures, critical issues    |
| `action`          | Blue    | Player actions, movement     |
| `discovery`       | Purple  | New locations, POIs found    |
| `encounter`       | Orange  | Combat events                |
| `system`          | Gray    | Save/load, generation events |
| `poi-interaction` | Teal    | Shrine, search, POI actions  |
