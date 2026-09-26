# Milestone 1 Review: "Slay the Level-5 Boss"

**Date:** 2026-09-25 · **Scope:** top-down review of what stands between a new player and the
first win condition. The first quest board they reach hands them a quest to kill a boss built for
a level-5 party; killing it wins the milestone.

Everything below was checked against the code (file:line refs as of `813477a`). The town
redesign landed alongside this review; see the DEVLOG entry of the same date.

---

## TL;DR: the loop is broken in six places

| # | Break | Where | Effect today |
|---|---|---|---|
| 1 | Quest board opens the player's **journal**, not a quest giver | `useInteriorNavigation` → `openPanel('quests')` | No quest can ever be obtained. `QuestGenerator` and `QuestGiverUI` are never imported |
| 2 | **Interior encounters never start combat** | nothing dispatches `START_COMBAT` inside interiors; `EnemyMovement.tick` is never called (`EnemyMovement.ts:274`) | Dungeon/tower bosses (`isBoss`, `DungeonGenerator.ts:204`) are scenery |
| 3 | `DEFEAT_ENCOUNTER` matches `e.id`, but encounters have no id | `explorationReducer.ts:123` | A boss could not be marked dead even if fought |
| 4 | Boss creature strings don't resolve to monsters | `"Boss: CR 5 dungeon lord"` → generic `Enemy` fallback (`Enemy.ts:952`) | Bosses would be stat-blob placeholders |
| 5 | **No victory state**; the scene union is title/creation/overworld/gameover | `types/state.ts:19`, `App.tsx:44` | Nothing to win |
| 6 | Quest reducers are half-wired | `ACCEPT_QUEST` never sets `status='active'` (`questReducer.ts:21`); `COMPLETE_QUEST` spreads the class into a plain object, losing `getProgress()` (`:72`), which the Completed tab then calls | Accept → complete → view would crash |

Fix those six and the milestone is playable. Everything else in this doc is about making it *good*.

---

## 1. Milestone design (proposal)

**Hook.** Every settlement now has a quest board on its plaza (camps included; see the town
redesign). The first time the player uses *any* board, it offers the main quest:

> *"Bounty: the warlord in <Lair name>, <N> hexes <direction>. 500 gp and the town's gratitude."*

**Target.** One guaranteed **boss lair** POI, placed at world-gen time 14–18 hexes from spawn.
That puts it in the CR 4–6 band of `POISystem.calculateCR` (`poiSystem.ts:316`), so the
approach naturally ramps. Make it a 2–3 floor dungeon (reuse `DungeonGenerator`'s boss floor,
`:100-216`) with a hand-authored boss:

- **Boss:** a named SRD stat block at CR 5 for a solo level-5 character, or CR 4 plus 2 minions
  for a party. Good candidates already in `SrdMonsters`: Troll, Hill Giant, Orc War Chief-style
  leader. Author it as a real `Enemy` entry, not a `"Boss: CR 5 …"` string.
- The quest objective is `kill` targeting the boss **encounter id**, not a creature name. Kill
  quests matching on names already can't work: `"Goblin"` vs `"Goblin scouts"`,
  `QuestGenerator.ts:210`.

**Pacing to level 5 (6,500 XP).** Today a fight near spawn gives ~25 XP, and the only repeatable
source is **re-fighting the same POI**: `END_COMBAT` never clears it (`combatReducer.ts:787`,
`useOverworldActions.ts:350`). Target 2–3 hours:

| Level | XP | Source mix |
|---|---|---|
| 1→2 | 300 | 3–4 fights near spawn + 1 board side quest |
| 2→3 | 900 | side quests (100–300 XP each) + CR 1–2 POIs |
| 3→4 | 2,700 | CR 2–4 POIs 10–15 hexes out |
| 4→5 | 6,500 | lair outskirts + 2 side quests |

Required:
- Clear a POI on victory (and stop the farm).
- Real side quests from the board: `QuestGenerator.generateTownQuests` exists, needs wiring.
- Give companions XP. Today they get none and dilute the player's share (`useCombatOrchestration.ts:89-114`).

**Win.** Boss dies → `COMPLETE_QUEST` → new `victory` scene (stats, playtime, "continue
exploring"). Don't reuse `GameOverScene`, which deletes every save slot (`GameOverScene.tsx:7`).

## 2. P0: blockers (in build order)

1. **Interior combat.** On stepping adjacent to an encounter hex, dispatch `START_COMBAT` with its
   creatures; on victory, `DEFEAT_ENCOUNTER` keyed by `poiKey + col,row`, written to
   `clearedEncounters` (already saved and loaded). Skip `EnemyMovement.tick` for now; static
   encounters are enough.
2. **Quest board → `QuestGiverUI`.** Board opens the giver UI with `state.availableQuests` for that
   settlement. Generate them on first board use, seeded by POI key. Fix `ACCEPT_QUEST` status and
   `COMPLETE_QUEST` class-stripping. Reconcile the `Quest` interface-vs-class type debt
   (TODO.md #1 note).
3. **Objective progress hooks.** Combat victory → kill objectives; `DISCOVER_POI` / interior entry →
   explore objectives. `Quest.updateObjectivesByTarget` exists and is unused.
4. **Boss lair POI + authored boss** (above).
5. **Victory scene.**
6. **POI cleared on victory** (anti-farm, and makes the map feel changed by the player).

## 3. P1: needed for the boss fight to be fair

- **Level 3–5 class features.** `levelUp` grants only Barbarian L2/L7 and Rogue L2
  (`Character.ts:937-985`). A level-5 Barbarian needs L3 subclass (Berserker), L4 ASI, and
  **L5 Extra Attack + Fast Movement**. Without Extra Attack a CR 5 boss is a coin flip at best.
- **Automatic level-up prompt.** `awardXP` only adds XP, and the level-up is a pulsing button the
  player can miss; `leveledUp` is always false (`characterReducer.ts:102`).
- **Shops work.** `ShopUI` dispatches `{poiKey, shopType, level}` but the reducer expects
  `{townName, townSize}`, and buy/sell payloads mismatch too (`shopReducer.ts:20-88`). Gold has no
  sink, and the player can't buy potions before the boss. The town doorsteps are ready; each
  building type just needs a panel.
- **Temple service:** paid healing / remove condition. Cheap, and it gives a reason to walk back to town.
- **Treasure.** `TreasureGenerator` returns placeholder hoards (`:46-78`), so the boss hoard is
  placeholder too.

## 4. P2: world and feel

- Settlements beyond the initial 60×60 are **camps only** (`poiSystem.ts:346`). Fine for
  milestone 1, since the lair sits inside the initial map. Needed for anything after.
- There's no minimum spacing between settlements (`terrainGenerator.ts:650`).
- An interrupted wild rest just cancels; no encounter spawns (`RestMenu.tsx:106` TODO). Wire it to
  `START_COMBAT` so camping far from town carries real risk.
- Interior arrow keys step row±1/col±1, which zigzags on odd-r (`useInteriorNavigation.ts:41`).
  Map them to the six hex directions.
- Town NPCs: none exist. A named keeper on each doorstep panel is enough; no walking NPCs needed.
- Towns follow-up: city/metropolis yards could be paved or gardened (they read as lawn), and a
  little layout jitter (skipping a street segment, a diagonal lane) would break the grid.

## 5. P3: dead code and debt (delete or revive)

- **Delete:** `ExplorationScene.tsx/.css`, `InteriorHexDetails.tsx/.css`, `useCombatHandler.ts`,
  `src/encounters.ts`, the unused `interiorExitReady` state, `ENTER_TOWN`/`EXIT_TOWN`, which are
  byte-identical to `ENTER_EXPLORATION`/`EXIT_EXPLORATION`, and the stale `'exploration'`/`'town'`
  autosave scenes (`GameStateContext.tsx:120`). `TownScene` is already deleted in this change.
- **Revive, don't delete:** `QuestGenerator`, `QuestGiverUI`, `ShopUI`, `Shop`.
- Loot pickup is duplicated in `useInteriorNavigation.ts:236` and `useOverworldInput.ts:113`.
- `poiGenerationHelper.ts:89` passes `playerLevel, partySize` into `generatePOI`'s
  `startCol, startRow` slots.
- `tests/qa-agent/GameDriver.js` clicks "Rest (10g)", but the button reads "Stay at Inn (N gold)".
  `enterTown` waits for a `town` scene that no longer exists.
- Shop inventories and settlement flavor text use `Math.random` while everything else is seeded.

## 6. Suggested order of work

1. Interior combat + `DEFEAT_ENCOUNTER` by position (unblocks every dungeon, not just the boss).
2. Board → QuestGiverUI → accept/complete fixed, kill objectives hooked to combat.
3. POI cleared on victory, companion XP.
4. Barbarian L3–L5 features.
5. Boss lair + authored boss + main quest on first board.
6. Victory scene.
7. Shops/temple panels behind the existing doorsteps.

Steps 1–3 are also the foundation for every later milestone, so they're worth doing properly.
