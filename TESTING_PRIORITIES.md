# Testing Priorities - Critical Areas Before TypeScript Migration

**Created:** January 9, 2026  
**Purpose:** Document critical testing areas before Phase 4 TypeScript migration  
**Status:** Pre-TypeScript baseline testing requirements

---

## 🔴 CRITICAL - Must Test Before Production

These areas handle core game state and data integrity. Bugs here will corrupt saves or crash the game.

### 1. Save/Load System ⚠️ HIGHEST PRIORITY
**Why Critical:** Data corruption = lost progress

**Files:**
- `src/utils/SaveManager.js`
- `src/contexts/GameStateContext.jsx` (LOAD_GAME action)

**Test Cases:**
- [ ] Save game to slot 1-3
- [ ] Load game from each slot
- [ ] Auto-save triggers correctly (every state change)
- [ ] Save metadata displays correctly (name, level, location, time)
- [ ] Playtime increments correctly
- [ ] Timestamps format properly ("5 minutes ago")
- [ ] Delete save slot
- [ ] Load after delete (should show empty slot)
- [ ] Version mismatch handling (old saves don't crash)
- [ ] LocalStorage quota exceeded handling
- [ ] Serialization of complex objects (Character, Party, Combat)
- [ ] Set reconstruction (exploredHexes, discoveredPOIs)

**Edge Cases:**
- Save during combat
- Save in interior/dungeon
- Save with full inventory
- Save with active quests
- Character at max level
- Character dead/unconscious

### 2. Modular Reducer System ⚠️ HIGHEST PRIORITY
**Why Critical:** All state changes flow through reducers. Broken reducer = broken game.

**Files:**
- `src/contexts/reducers/*.js` (all 8 reducers)
- `src/contexts/reducers/index.js` (combined reducer)

**Test Cases:**
- [ ] Each reducer handles its actions correctly
- [ ] Unhandled actions return null (don't crash)
- [ ] State immutability (no mutations)
- [ ] Set/Map recreation (exploredHexes, discoveredPOIs)
- [ ] Character instance preservation (toJSON/fromJSON)
- [ ] Party instance preservation
- [ ] Action delegation works (combinedReducer)

**Critical Actions to Test:**
- `NEW_GAME` - Creates fresh state
- `LOAD_GAME` - Reconstructs complex state
- `SET_MAP_DATA` - Creates HexGrid spatial index
- `START_COMBAT` - Initializes combat state
- `END_COMBAT` - Cleans up combat state
- `AWARD_XP` - Updates character level correctly
- `COMPLETE_QUEST` - Awards rewards correctly
- `BUY_ITEM` / `SELL_ITEM` - Gold transactions
- `UPDATE_CHARACTER` - Preserves character data

### 3. HexGrid Spatial Index ⚠️ HIGH PRIORITY
**Why Critical:** Used everywhere for O(1) lookups. Wrong data = desynced game state.

**Files:**
- `src/utils/HexGrid.js`

**Test Cases:**
- [ ] `get(col, row)` returns correct hex
- [ ] `getNeighbors(col, row)` returns 6 hexes (or fewer at edges)
- [ ] `getInRadius(col, row, radius)` returns correct hexes
- [ ] `getBounds()` returns correct map boundaries
- [ ] `set(hex)` updates grid and bounds
- [ ] Handles offset coordinate system correctly
- [ ] Edge row parity (even/odd rows)

**Edge Cases:**
- Map edges (fewer than 6 neighbors)
- Empty map
- Single hex
- Large maps (performance)
- Negative coordinates

### 4. Character System 🟡 MEDIUM-HIGH PRIORITY
**Why Important:** Core game mechanics. Bugs affect gameplay balance.

**Files:**
- `src/game/Character.js`

**Test Cases:**
- [ ] XP gain and leveling
- [ ] HP management (damage, healing, death)
- [ ] Ability score modifiers
- [ ] Proficiency bonus calculation
- [ ] Inventory management
- [ ] Equipment slots
- [ ] Ration/water consumption
- [ ] Exhaustion levels
- [ ] Death saves
- [ ] Serialization (toJSON/fromJSON)

**Edge Cases:**
- Level 20 (max level)
- 0 HP (unconscious)
- Negative HP (instant death)
- 6 exhaustion levels (death)
- Full inventory
- Invalid ability scores

---

## 🟡 IMPORTANT - Should Test Before Deployment

These areas affect gameplay but won't corrupt saves.

### 5. Combat System 🟡 MEDIUM PRIORITY
**Why Important:** Complex state machine. Bugs break encounters.

**Files:**
- `src/game/Combat.js`
- `src/contexts/reducers/combatReducer.js`
- `src/components/scenes/CombatScene.jsx`

**Test Cases:**
- [ ] Initiative rolling and order
- [ ] Turn advancement
- [ ] Movement within range
- [ ] Attack rolls (hit/miss/crit)
- [ ] Damage calculation
- [ ] Death/unconscious handling
- [ ] Flee mechanics
- [ ] Victory/defeat conditions
- [ ] XP rewards

**Edge Cases:**
- All enemies dead
- All allies dead
- Simultaneous deaths
- Flee on first turn
- Combat at 0 HP

### 6. Map Generation & Exploration 🟡 MEDIUM PRIORITY
**Why Important:** Deterministic generation. Same seed = same map.

**Files:**
- `src/terrainGenerator.js`
- `src/riverGenerator.js`
- `src/hooks/useMapGeneration.js`
- `src/hooks/useInfiniteTerrainExpansion.js`

**Test Cases:**
- [ ] Same seed generates same map
- [ ] Map expansion works in all directions
- [ ] Fog of war reveals correctly
- [ ] POI discovery
- [ ] Terrain traversability
- [ ] River generation

**Edge Cases:**
- Map edge expansion
- Very long playtime (large maps)
- Seed collision

### 7. Quest System 🟡 MEDIUM PRIORITY
**Why Important:** Progress tracking. Bugs lose quest state.

**Files:**
- `src/game/Quest.js`
- `src/contexts/reducers/questReducer.js`

**Test Cases:**
- [ ] Quest generation
- [ ] Quest acceptance
- [ ] Progress tracking
- [ ] Completion rewards (gold, XP, items)
- [ ] Failure conditions
- [ ] Quest expiration

---

## 🟢 NICE TO HAVE - Test When Possible

Lower risk areas or cosmetic issues.

### 8. Shop System 🟢 LOW PRIORITY
**Files:**
- `src/game/Shop.js`
- `src/contexts/reducers/shopReducer.js`

**Test Cases:**
- [ ] Inventory generation by town size
- [ ] Buy/sell transactions
- [ ] Gold balance
- [ ] Item removal from shop

### 9. Interior/Dungeon Generation 🟢 LOW PRIORITY
**Files:**
- `src/game/DungeonGenerator.js`
- `src/game/CaveGenerator.js`
- `src/game/TowerGenerator.js`
- `src/game/RuinsGenerator.js`
- `src/game/TownGenerator.js`

**Test Cases:**
- [ ] Interior maps generate correctly
- [ ] Encounters spawn correctly
- [ ] Exit/entrance placement

### 10. UI Components 🟢 LOW PRIORITY
**Files:**
- All React components in `src/components/`

**Test Cases:**
- [ ] Render without crashing
- [ ] Props validation
- [ ] Event handlers work
- [ ] Accessibility

---

## 🧪 Testing Strategy

### Manual Testing Checklist (Required Before Production)

**New Game Flow:**
1. Start new game
2. Create character
3. Move around map (test fog of war)
4. Forage for food
5. Enter combat (test full combat flow)
6. Rest (short and long)
7. Enter town (test shops, quests)
8. Enter dungeon (test interior exploration)
9. Save game
10. Load game (verify state)
11. Repeat with different character classes

**Edge Case Testing:**
1. Save during combat
2. Load during combat (should exit combat)
3. Character death
4. Starvation (0 rations)
5. Map expansion (move to edge)
6. Full inventory
7. Quest completion
8. Level up
9. Long rest interruption

### Automated Testing (Future - Phase 3.5)

**Unit Tests (Vitest):**
- `Character.js` - XP, HP, abilities
- `Combat.js` - Initiative, attacks, damage
- `HexGrid.js` - Spatial queries
- `hexMath.js` - Distance calculations
- All reducers - State transitions

**Integration Tests:**
- Save/load cycle
- Combat flow (start → turns → end)
- Quest flow (accept → progress → complete)
- Character creation → gameplay

**Performance Tests:**
- HexGrid with 10,000 hexes
- Combat with 20 combatants
- Map expansion (stress test)
- Save/load with large state

---

## 🚨 Known Issues (Document Before TypeScript)

**Current Known Bugs:**
1. None currently documented

**Potential Issues to Watch:**
1. Combat scene render loop (fixed 378731b)
2. Forage cooldown tracking across save/load
3. HexGrid boundary tracking with map expansion
4. Character instance methods after deserialization

**Type Safety Risks:**
1. Dynamic POI generation (terrain-specific rules)
2. Enemy.parseCreatureString() (string parsing)
3. Item slot names (string literals)
4. Action type strings (now constants, but still strings)

---

## 📋 Pre-TypeScript Migration Checklist

Before starting TypeScript conversion:

- [ ] Document all known bugs in this file
- [ ] Run manual test flow at least once
- [ ] Verify save/load works
- [ ] Verify combat works end-to-end
- [ ] Verify map generation is deterministic
- [ ] Verify character creation works
- [ ] Note any suspicious behavior
- [ ] Commit working baseline

**TypeScript will catch:**
- Type mismatches
- Missing properties
- Invalid function signatures
- Null/undefined issues

**TypeScript won't catch:**
- Logic errors
- State mutation bugs
- Incorrect calculations
- Race conditions

---

## 🎯 Testing Priority Summary

**MUST TEST (Before TypeScript):**
1. ✅ Save/load cycle (full game state)
2. ✅ Character creation
3. ✅ Map generation (same seed = same map)
4. ✅ Movement and fog of war
5. ✅ Combat (start → end)
6. ✅ Reducers (all critical actions)

**SHOULD TEST (Before Deployment):**
7. Quest flow
8. Shop transactions
9. Interior exploration
10. Rest mechanics
11. Foraging

**NICE TO TEST:**
12. All edge cases
13. Performance under load
14. Accessibility
15. Browser compatibility

---

**Next Steps:**
1. Run manual testing checklist
2. Document any bugs found
3. Fix critical bugs
4. Commit working baseline
5. Begin TypeScript migration
