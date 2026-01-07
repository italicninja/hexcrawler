# RAPID DEVELOPMENT TODO - D&D 5e Hexcrawler
## Multi-Agent Task Breakdown

**Last Updated:** 2026-01-07
**Current Completeness:** ~85%
**Target Completeness:** 100% (Full MVP)

---

## TASK ORGANIZATION

Tasks are organized by:
- **Priority:** P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
- **Complexity:** S (Small, <4 hrs), M (Medium, 4-8 hrs), L (Large, 8-16 hrs), XL (Extra Large, 16+ hrs)
- **Dependencies:** Listed explicitly
- **Agent Assignment:** Can be parallelized unless dependencies exist

---

## PHASE 1: COMPLETE CORE GAMEPLAY LOOP (P0)
**Goal:** Make exploration → loot → combat → progression work end-to-end
**Status:** 6/6 tasks complete (100%) ✅ PHASE COMPLETE!

### TASK 1.1: Item & Inventory System [P0, M, No Dependencies] ✅ COMPLETE
**Agent:** `item-inventory-agent`
**Completed:** 2026-01-06

**Objective:** Create Item class and integrate with character inventory

**Subtasks:**
1. Create `src/game/Item.js` class
   - Properties: id, name, description, type, rarity, slot, effects, weight, value
   - Types: weapon, armor, consumable, quest, misc
   - Rarity: common, uncommon, rare, very rare, legendary
   - Effects: { ac: +2, str: +1, hp: +5, etc. }
   - Methods: `toJSON()`, `fromJSON(json)`

2. Update Character class (`src/game/Character.js`)
   - Add `addItem(item)` method
   - Add `removeItem(itemId)` method
   - Add `equipItem(itemId, slot)` method
   - Add `unequipItem(slot)` method
   - Add `getEquippedItems()` method
   - Add `getInventoryItems()` method
   - Add `calculateEffectiveStats()` - apply equipment effects to AC, abilities, etc.
   - Update `toJSON()` to serialize items

3. Create item instances from LootGenerator
   - Update `LootGenerator.generateLoot()` to return Item objects, not strings
   - Create item data tables (weapons, armor, consumables)
   - Map rarity to item power level

4. Update GameStateContext
   - Add `ADD_ITEM` action
   - Add `REMOVE_ITEM` action
   - Add `EQUIP_ITEM` action
   - Add `UNEQUIP_ITEM` action

**Acceptance Criteria:**
- Item class fully functional with serialization
- Character can add/remove items from inventory
- Character can equip/unequip items to slots
- Equipment effects apply to character stats
- LootGenerator creates Item instances

**Files to Modify:**
- `src/game/Item.js` (NEW)
- `src/game/Character.js`
- `src/game/LootGenerator.js`
- `src/contexts/GameStateContext.jsx`

---

### TASK 1.2: Loot Collection UI [P0, S, Depends: 1.1]
**Agent:** `loot-ui-agent`

**Objective:** Allow players to collect loot in ExplorationScene

**Subtasks:**
1. Update `InteriorHexDetails.jsx`
   - Implement "Collect Loot" button handler
   - Call `dispatch({ type: ACTIONS.COLLECT_LOOT, payload: { col, row, loot } })`
   - Remove stub message
   - Show collected items notification

2. Update GameStateContext
   - Implement `COLLECT_LOOT` action
   - Add items to character inventory
   - Mark loot as collected in `explorationState.collectedLoot`
   - Prevent re-collecting same loot

3. Update `InteriorHexCanvas.jsx`
   - Show visual indicator for collected loot (grayed out or removed icon)

4. Add inventory notification
   - Use EventInfoBox or toast to show "Collected: [item names]"
   - Show gold amount added

**Acceptance Criteria:**
- Clicking "Collect Loot" adds items to inventory
- Collected loot cannot be re-collected
- Visual feedback shows loot was collected
- Player sees notification of what was collected

**Files to Modify:**
- `src/components/ui/InteriorHexDetails.jsx`
- `src/contexts/GameStateContext.jsx`
- `src/components/canvas/InteriorHexCanvas.jsx`

---

### TASK 1.3: Equipment UI Improvements [P0, M, Depends: 1.1] ✅ COMPLETE
**Agent:** `equipment-ui-agent`
**Completed:** 2026-01-06

**Objective:** Display equipped items and inventory with equip/unequip functionality

**Subtasks:**
1. Update `Equipment.jsx`
   - Display equipped items in each slot (show item name, not empty)
   - Show item tooltips on hover (description, effects)
   - Add "Unequip" button for each slot
   - Show inventory below equipment slots
   - Add "Equip" button for each inventory item
   - Filter inventory items by compatible slot
   - Show item rarity with color coding

2. Implement equip/unequip handlers
   - Call `dispatch({ type: ACTIONS.EQUIP_ITEM, payload: { itemId, slot } })`
   - Call `dispatch({ type: ACTIONS.UNEQUIP_ITEM, payload: { slot } })`
   - Validate slot compatibility
   - Handle two-handed weapons

3. Add item tooltips
   - Show item stats and effects
   - Show rarity color
   - Show weight and value

**Acceptance Criteria:**
- Equipped items show in equipment slots
- Can equip items from inventory
- Can unequip items to inventory
- Tooltips show item details
- Rarity colors displayed correctly

**Files to Modify:**
- `src/components/ui/Equipment.jsx`
- `src/contexts/GameStateContext.jsx`

---

### TASK 1.4: Auto-Resolve Combat System [P0, L, Depends: 1.1]
**Agent:** `combat-autoresolve-agent`

**Objective:** Implement basic combat with dice rolls, no complex UI

**Subtasks:**
1. Create `src/game/Enemy.js` class
   - Properties: name, hp, ac, cr, attacks, abilities
   - Methods: `takeDamage()`, `isDead()`, `rollAttack()`, `rollDamage()`
   - Create enemy stat tables by CR (CR 0-11)
   - Map encounter names to enemy stats

2. Create `src/game/Combat.js` class
   - Methods:
     - `rollInitiative(characters, enemies)` - determine turn order
     - `simulateRound(characters, enemies)` - auto-resolve 1 round
     - `simulateCombat(characters, enemies)` - full combat to completion
     - `generateCombatLog()` - detailed combat narrative
   - Use DiceRoller for all rolls
   - Apply character/enemy abilities and effects
   - Track HP changes
   - Determine victory/defeat/flee

3. Update GameStateContext
   - Add `START_COMBAT` action (stores combat state)
   - Add `RESOLVE_COMBAT` action (applies results)
   - Store combat log in state

4. Update `InteriorHexDetails.jsx`
   - "Engage Combat" button calls combat simulation
   - Show combat results in EventInfoBox
   - Apply damage to party
   - Award XP on victory
   - Mark encounter as defeated

5. Update `useHexInteraction.js` for overworld encounters
   - Handle active event combat triggers
   - Use same combat system
   - Show combat results

**Acceptance Criteria:**
- Engaging combat triggers simulation
- Combat log shows all attacks and damage
- Party HP updated after combat
- XP awarded on victory
- Defeated encounters marked and removed from map
- Flee option reduces combat to 1-2 rounds then escapes

**Files to Create:**
- `src/game/Enemy.js`
- `src/game/Combat.js`

**Files to Modify:**
- `src/contexts/GameStateContext.jsx`
- `src/components/ui/InteriorHexDetails.jsx`
- `src/hooks/useHexInteraction.js`

---

### TASK 1.5: XP & Leveling System [P0, M, Depends: 1.4] ✅ COMPLETE
**Agent:** `xp-leveling-agent`
**Completed:** 2026-01-06

**Objective:** Track XP, award from encounters, trigger level-ups

**Subtasks:**
1. Update Character class
   - Add `xp` and `xpToNextLevel` properties
   - Add `awardXP(amount)` method
   - Add `shouldLevelUp()` method - check if xp >= xpToNextLevel
   - Calculate XP thresholds by level (standard D&D progression)
   - Update `levelUp()` to reset XP threshold

2. Create XP award table
   - Map CR to XP value (standard D&D 5e)
   - CR 0 = 10 XP, CR 1 = 200 XP, CR 5 = 1800 XP, etc.

3. Update Combat system
   - Award XP on enemy defeat
   - Split XP among living party members
   - Call `character.awardXP(amount)` for each character

4. Update GameStateContext
   - Add `AWARD_XP` action
   - Add `LEVEL_UP_CHARACTER` action
   - Trigger level-up notification when threshold reached

5. Add level-up UI
   - Show notification in EventInfoBox when character can level up
   - Button to trigger level-up
   - Show XP progress bar in CharacterStats

**Acceptance Criteria:**
- XP awarded after combat victory
- XP tracked per character
- Level-up triggered automatically when threshold reached
- Level-up notification shown
- XP progress visible in character stats

**Files to Modify:**
- `src/game/Character.js`
- `src/game/Combat.js`
- `src/contexts/GameStateContext.jsx`
- `src/components/ui/CharacterStats.jsx`

---

### TASK 1.6: Interior Types - Ruins, Towers, Dungeons [P1, L, No Dependencies] ✅ COMPLETE
**Agent:** `interior-types-agent`
**Completed:** 2026-01-06

**Objective:** Implement other interior generation types beyond caves

**Subtasks:**
1. Create `src/game/RuinsGenerator.js`
   - Extend `InteriorGenerator`
   - Generate structured ruins with rooms and corridors
   - Room-based layout (3-7 rooms)
   - Crumbling walls and rubble
   - Place encounters in rooms (1-3 based on CR)
   - Place loot in hidden corners (1-2 based on CR)
   - Place hazards in corridors (20-30%)

2. Create `src/game/TowerGenerator.js`
   - Extend `InteriorGenerator`
   - Generate vertical tower with 3-5 floors
   - Circular or square rooms per floor
   - Stairs connecting floors
   - Boss encounter on top floor
   - Place encounters on middle floors (1-2 per floor)
   - Place loot in treasure room (top floor, 2-4 items)
   - Place hazards on stairs and entrances

3. Create `src/game/DungeonGenerator.js`
   - Extend `InteriorGenerator`
   - Generate BSP dungeon with rooms and corridors
   - 5-10 rooms with varying sizes
   - Boss encounter in final room
   - Place encounters in rooms (1-2 per room)
   - Place loot in treasure chests (2-5 based on CR)
   - Place hazards in corridors and treasure rooms (30-40%)

4. Update `useHexInteraction.js`
   - Route POI type to correct generator
   - 'cave' → CaveGenerator
   - 'ruins' → RuinsGenerator
   - 'tower' → TowerGenerator
   - 'dungeon' → DungeonGenerator

5. Add interior type metadata
   - Each type has unique flavor text
   - Each type has unique encounter tables (optional)
   - Boss encounters for towers and dungeons

**Acceptance Criteria:**
- Ruins generate with room-based layout
- Towers generate with multi-floor vertical structure
- Dungeons generate with BSP algorithm
- Each type has appropriate encounter/loot/hazard placement
- Players can explore all four interior types

**Files to Create:**
- `src/game/RuinsGenerator.js`
- `src/game/TowerGenerator.js`
- `src/game/DungeonGenerator.js`

**Files to Modify:**
- `src/hooks/useHexInteraction.js`

---

## PHASE 2: REST & RESOURCE MANAGEMENT (P1)
**Goal:** Add rest mechanics and resource consumption
**Status:** 2/3 tasks complete (67%)

### TASK 2.1: Rest System [P1, M, No Dependencies] ✅ COMPLETE
**Agent:** `rest-system-agent`
**Completed:** 2026-01-06

**Objective:** Implement short rest and long rest mechanics

**Subtasks:**
1. Create `src/game/RestManager.js`
   - Methods:
     - `shortRest(character)` - recover half hit dice, limited abilities
     - `longRest(character)` - full HP, all abilities, all spell slots
     - `canShortRest(character)` - check hit dice availability
     - `canLongRest(party)` - check time and safety requirements

2. Update Character class
   - Add `hitDiceRemaining` property
   - Add `lastLongRest` timestamp
   - Add `spellSlotsUsed` property (for future spell system)
   - Add `recoverHitDice(count)` method
   - Add `useHitDice(count)` method
   - Update `toJSON()` for new properties

3. Update GameStateContext
   - Add `SHORT_REST` action
   - Add `LONG_REST` action
   - Track last rest time
   - Validate rest requirements (safety, time since last rest)

4. Add rest UI in OverworldScene
   - Add "Rest" tab or button in main UI
   - Show "Short Rest" and "Long Rest" buttons
   - Show rest requirements and effects
   - Show hit dice remaining
   - Confirm dialog for long rest (takes 8 hours)

5. Add rest interruption chance
   - Random encounter chance during long rest (10-20%)
   - Use terrain difficulty to scale chance
   - Interrupt rest and trigger combat

**Acceptance Criteria:**
- Short rest recovers half hit dice worth of HP
- Long rest recovers full HP and all abilities
- Hit dice tracking works
- Rest UI shows current status
- Rest interruptions can occur

**Files to Create:**
- `src/game/RestManager.js`

**Files to Modify:**
- `src/game/Character.js`
- `src/contexts/GameStateContext.jsx`
- `src/components/scenes/OverworldScene.jsx`

---

### TASK 2.2: Rations & Water System [P1, M, Depends: 1.1]
**Agent:** `rations-water-agent`

**Objective:** Track food and water consumption, implement starvation/dehydration

**Subtasks:**
1. Update Character class
   - Add `rations` property (number of days food)
   - Add `water` property (number of days water)
   - Add `daysWithoutFood` counter
   - Add `daysWithoutWater` counter

2. Create `src/game/SurvivalManager.js`
   - Methods:
     - `consumeRations(character)` - consume 1 ration per day
     - `consumeWater(character)` - consume 1 water per day
     - `applyStarvation(character)` - apply exhaustion for lack of food
     - `applyDehydration(character)` - apply exhaustion for lack of water
     - `forage(character, terrain)` - attempt to find food (survival check)
     - `findWater(terrain)` - attempt to find water source

3. Update GameStateContext
   - Add `CONSUME_RATIONS` action (trigger on rest or new day)
   - Add `CONSUME_WATER` action
   - Add `FORAGE` action
   - Add `FIND_WATER` action

4. Add survival UI
   - Show rations and water count in CharacterStats
   - Add "Forage" button in OverworldScene
   - Add "Find Water" button
   - Show survival check results

5. Add starvation/dehydration effects
   - Track exhaustion levels
   - Apply penalties to ability checks
   - Death at exhaustion level 6

**Acceptance Criteria:**
- Rations and water consumed on rest
- Starvation/dehydration tracked
- Foraging works with survival checks
- Water can be found in appropriate terrain
- UI shows current rations/water

**Files to Create:**
- `src/game/SurvivalManager.js`

**Files to Modify:**
- `src/game/Character.js`
- `src/contexts/GameStateContext.jsx`
- `src/components/ui/CharacterStats.jsx`
- `src/components/scenes/OverworldScene.jsx`

---

### TASK 2.3: Time Tracking System [P1, S, No Dependencies] ✅ COMPLETE
**Agent:** `time-tracking-agent`
**Completed:** 2026-01-06

**Objective:** Track days, hours, and time passage

**Subtasks:**
1. Update GameStateContext
   - Add `gameTime` state: { day: 1, hour: 8, minute: 0 }
   - Add `ADVANCE_TIME` action
   - Add `SET_TIME` action

2. Create `src/game/TimeManager.js`
   - Methods:
     - `advanceTime(minutes)` - advance time and handle day transitions
     - `formatTime(gameTime)` - display "Day 5, 14:30"
     - `isNight(hour)` - check if nighttime (20:00 - 06:00)
     - `isDawn(hour)`, `isDusk(hour)`, etc.

3. Trigger time advancement
   - Movement costs 10 minutes per hex
   - Combat costs 5-10 minutes
   - Short rest costs 1 hour
   - Long rest costs 8 hours
   - Search action costs 30 minutes
   - Exploration costs 1-2 hours

4. Add time display in UI
   - Show current day and time in OverworldScene header
   - Show time cost for actions (hover tooltip)

5. Add day/night cycle effects (optional)
   - Night: reduced vision, increased encounter chance
   - Dawn/Dusk: special events

**Acceptance Criteria:**
- Time tracked in days, hours, minutes
- Actions advance time appropriately
- Time displayed in UI
- Day transitions work correctly

**Files to Create:**
- `src/game/TimeManager.js`

**Files to Modify:**
- `src/contexts/GameStateContext.jsx`
- `src/components/scenes/OverworldScene.jsx`

---

## PHASE 3: PARTY & NPC SYSTEM (P1)
**Goal:** Generate NPCs and fill party slots
**Status:** 1/3 tasks complete (33%)

### TASK 3.1: NPC Generation [P1, M, No Dependencies] ✅ COMPLETE
**Agent:** `npc-generation-agent`
**Completed:** 2026-01-06

**Objective:** Generate random NPCs with stats, classes, and personalities

**Subtasks:**
1. Create `src/game/NPCGenerator.js`
   - Methods:
     - `generateNPC(level, classType)` - create random NPC
     - `generateName()` - random fantasy names
     - `generatePersonality()` - personality traits
     - `generateBackground()` - backstory snippets
   - Name tables (male, female, neutral)
   - Personality traits (brave, cautious, greedy, loyal, etc.)
   - Background snippets (former soldier, merchant, scholar, etc.)

2. Update Party class
   - Replace `createPlaceholderNPCs()` with real generation
   - Generate 3 NPCs with different classes on new game
   - Ensure class diversity (no duplicates)

3. Update GameStateContext
   - Generate NPCs on NEW_GAME action
   - Serialize NPCs in save data

4. Add NPC display in PartyList
   - Show NPC name, class, level
   - Show NPC HP and status
   - Show personality trait
   - Click to view full NPC stats

**Acceptance Criteria:**
- 3 NPCs generated on new game
- NPCs have unique names and personalities
- NPCs use different classes
- NPCs displayed in PartyList
- NPCs have proper D&D 5e stats

**Files to Create:**
- `src/game/NPCGenerator.js`

**Files to Modify:**
- `src/game/Party.js`
- `src/contexts/GameStateContext.jsx`
- `src/components/ui/PartyList.jsx`

---

### TASK 3.2: Party AI for Combat [P1, M, Depends: 1.4, 3.1]
**Agent:** `party-ai-agent`

**Objective:** NPCs participate in combat automatically

**Subtasks:**
1. Create `src/game/CombatAI.js`
   - Methods:
     - `selectTarget(npc, enemies)` - pick enemy to attack
     - `selectAction(npc, enemies, allies)` - choose best action
     - `executeTurn(npc, enemies, allies)` - perform NPC turn
   - AI strategies:
     - Warriors: attack lowest HP enemy
     - Healers: heal lowest HP ally if below 50%
     - Ranged: attack from distance
     - Defensive: protect player character

2. Update Combat.js
   - Integrate NPC AI into turn order
   - NPCs act automatically during their turn
   - Log NPC actions to combat log

3. Add NPC death handling
   - Mark NPC as dead when HP = 0
   - Remove from combat
   - Show death message
   - Persist death state

**Acceptance Criteria:**
- NPCs act in combat automatically
- NPCs use appropriate tactics for their class
- NPC actions logged in combat log
- NPC death handled properly

**Files to Create:**
- `src/game/CombatAI.js`

**Files to Modify:**
- `src/game/Combat.js`

---

### TASK 3.3: Party Management UI [P2, S, Depends: 3.1]
**Agent:** `party-ui-agent`

**Objective:** View party member details and manage party

**Subtasks:**
1. Update PartyList.jsx
   - Expandable NPC entries
   - Show full stat block when expanded
   - Show equipment and inventory
   - Show personality and background
   - Add "Remove from Party" button (optional)

2. Add party stats summary
   - Total party HP
   - Average level
   - Party composition (classes)

3. Add NPC recruitment (optional)
   - Find NPCs in towns
   - Recruit to empty slots
   - Dismiss NPCs

**Acceptance Criteria:**
- Can view full NPC details in PartyList
- Party summary shows useful info
- UI is clean and readable

**Files to Modify:**
- `src/components/ui/PartyList.jsx`

---

## PHASE 4: TOWN & QUEST SYSTEMS (P1)
**Goal:** Make towns functional with shops, quests, and services
**Status:** 4/4 tasks complete (100%) ✅ PHASE COMPLETE!

### TASK 4.1: Quest System [P1, L, Depends: 1.1] ✅ COMPLETE
**Agent:** `quest-system-agent`
**Completed:** 2026-01-07

**Objective:** Create quest tracking and quest generation

**Subtasks:**
1. Create `src/game/Quest.js` class
   - Properties: id, title, description, objectives, rewards, status, questGiver
   - Objectives: { type, target, count, completed }
   - Objective types: 'kill', 'collect', 'explore', 'deliver', 'talk'
   - Status: 'available', 'active', 'completed', 'failed'
   - Methods:
     - `updateObjective(type, value)` - update progress
     - `checkCompletion()` - see if all objectives done
     - `complete()` - mark as complete and award rewards
     - `toJSON()`, `fromJSON()`

2. Create `src/game/QuestGenerator.js`
   - Generate random quests
   - Quest templates:
     - "Clear the [dungeon]" - kill all enemies in POI
     - "Retrieve the [item]" - collect specific item from POI
     - "Explore [location]" - discover and map POI
     - "Deliver [item] to [town]" - travel quest
   - Scale rewards by difficulty
   - Assign quest givers (NPC names)

3. Update GameStateContext
   - Add `quests` state array
   - Add `ADD_QUEST` action
   - Add `UPDATE_QUEST` action
   - Add `COMPLETE_QUEST` action
   - Trigger quest objective updates from combat, loot, exploration

4. Create Quest Log UI (`src/components/ui/QuestLog.jsx`)
   - List of active quests
   - Quest details with objectives and progress
   - Completed quests section
   - Quest rewards display

5. Add quest log tab to OverworldScene
   - New tab "Quests" in main UI

**Acceptance Criteria:**
- Quests can be generated and accepted
- Quest objectives track progress automatically
- Quest completion awards rewards (XP, gold, items)
- Quest log UI shows all quests
- Quests persist in save data

**Files to Create:**
- `src/game/Quest.js`
- `src/game/QuestGenerator.js`
- `src/components/ui/QuestLog.jsx`

**Files to Modify:**
- `src/contexts/GameStateContext.jsx`
- `src/components/scenes/OverworldScene.jsx`

---

### TASK 4.2: Town Services - Shops [P1, M, Depends: 1.1] ✅ COMPLETE
**Agent:** `shop-system-agent`
**Completed:** 2026-01-07

**Objective:** Buy and sell items in towns

**Subtasks:**
1. Create `src/game/Shop.js` class
   - Properties: inventory (Item[]), gold, shopType
   - Shop types: 'general', 'blacksmith', 'alchemist', 'magic'
   - Methods:
     - `generateInventory(level, shopType)` - stock shop with items
     - `buy(item, character)` - sell item to character
     - `sell(item, character)` - buy item from character
     - `getPrice(item, isBuying)` - calculate price with markup/markdown

2. Create shop UI (`src/components/ui/ShopUI.jsx`)
   - Two-column layout: shop inventory vs player inventory
   - Buy/Sell buttons
   - Price display
   - Gold counter
   - Item tooltips

3. Update town interaction
   - Add "Visit Shop" option to town EventInfoBox
   - Open shop UI in modal/overlay
   - Generate shop inventory on first visit
   - Persist shop inventory

4. Update GameStateContext
   - Add `towns` state with shop data
   - Add `BUY_ITEM` action
   - Add `SELL_ITEM` action
   - Track character gold

**Acceptance Criteria:**
- Towns have shops with generated inventory
- Can buy items from shops
- Can sell items to shops
- Prices use markup (buy = 100%, sell = 50%)
- Gold tracked correctly

**Files to Create:**
- `src/game/Shop.js`
- `src/components/ui/ShopUI.jsx`

**Files to Modify:**
- `src/hooks/useHexInteraction.js`
- `src/contexts/GameStateContext.jsx`

---

### TASK 4.3: Town Services - Inn & Rest [P1, S, Depends: 2.1] ✅ COMPLETE
**Agent:** `inn-system-agent`
**Completed:** 2026-01-07

**Objective:** Allow resting at inns for safety

**Subtasks:**
1. Add "Visit Inn" option to town interactions
   - Cost: 5 gold per night
   - Guaranteed safe long rest (no interruptions)
   - Full HP and ability recovery
   - Optional: buy rations and water

2. Update town interaction UI
   - Show inn option
   - Show cost
   - Confirm dialog

3. Update GameStateContext
   - Deduct gold on inn rest
   - Trigger long rest with no interruption

**Acceptance Criteria:**
- Can rest at inn for 5 gold
- Inn rest is guaranteed safe
- Gold deducted correctly

**Files to Modify:**
- `src/hooks/useHexInteraction.js`
- `src/contexts/GameStateContext.jsx`

---

### TASK 4.4: Town Services - Quest Givers [P1, M, Depends: 4.1] ✅ COMPLETE
**Agent:** `quest-giver-agent`
**Completed:** 2026-01-07

**Objective:** NPCs in towns offer quests

**Subtasks:**
1. Add "Talk to Locals" option in towns
   - Generate 1-3 available quests
   - Show quest previews (title, reward)
   - Accept quest button

2. Update town state
   - Track available quests per town
   - Mark quests as accepted
   - Refresh quests periodically (after X days)

3. Add quest turn-in
   - Return to quest giver town
   - Show "Turn In Quest" option for completed quests
   - Award rewards

**Acceptance Criteria:**
- Towns generate available quests
- Can accept quests from towns
- Can turn in completed quests
- Rewards awarded correctly

**Files to Modify:**
- `src/hooks/useHexInteraction.js`
- `src/contexts/GameStateContext.jsx`

---

### TASK 4.5: Town Expansion - Services & NPCs [P2, M, Depends: 3.1]
**Agent:** `town-expansion-agent`

**Objective:** Add more town features and NPCs

**Subtasks:**
1. Add blacksmith service
   - Repair damaged equipment
   - Upgrade equipment (add +1, +2, etc.)
   - Craft custom items

2. Add temple/cleric service
   - Remove curses
   - Cure diseases
   - Resurrect dead party members (expensive)

3. Add town NPCs
   - Generate 5-10 NPCs per town
   - Random names and roles (merchant, guard, farmer, etc.)
   - Dialogue snippets
   - Some offer quests

4. Add town descriptions
   - Population size
   - Government type
   - Notable features
   - Faction alignment

**Acceptance Criteria:**
- Blacksmith services functional
- Temple services functional
- Town NPCs generated and interactive
- Town feels alive

**Files to Create:**
- `src/game/TownGenerator.js`

**Files to Modify:**
- `src/poiSystem.js`
- `src/hooks/useHexInteraction.js`

---

## PHASE 5: FULL COMBAT UI (P2)
**Goal:** Replace auto-resolve with turn-based tactical combat

### TASK 5.1: Combat Scene & UI [P2, XL, Depends: 1.4]
**Agent:** `combat-ui-agent`

**Objective:** Create full turn-based combat interface

**Subtasks:**
1. Create `src/components/scenes/CombatScene.jsx`
   - Three-column layout: Party, Combat Area, Enemies
   - Initiative tracker at top
   - Current turn highlight
   - Action buttons (Attack, Defend, Use Item, Flee)
   - Target selection UI
   - Combat log

2. Update GameStateContext
   - Add combat state (combatActive, turnOrder, currentTurn, enemies)
   - Add `INITIALIZE_COMBAT` action
   - Add `NEXT_TURN` action
   - Add `EXECUTE_ACTION` action
   - Add `END_COMBAT` action

3. Create combat flow
   - Trigger combat → switch to CombatScene
   - Roll initiative for all combatants
   - Display turn order
   - On player/NPC turn: show action buttons
   - On enemy turn: auto-execute AI
   - Track HP for all combatants
   - End combat on victory/defeat/flee
   - Return to previous scene

4. Implement actions
   - Attack: select target, roll attack, roll damage, apply
   - Defend: increase AC until next turn
   - Use Item: select item, apply effects
   - Flee: make flee check, escape on success

5. Add combat animations (optional)
   - Attack swoosh
   - Damage numbers
   - Hit/miss indicators

**Acceptance Criteria:**
- Combat transitions to dedicated scene
- Turn order displays correctly
- Player can select actions and targets
- Actions execute with proper dice rolls
- Combat resolves correctly
- Returns to previous scene after combat

**Files to Create:**
- `src/components/scenes/CombatScene.jsx`

**Files to Modify:**
- `src/contexts/GameStateContext.jsx`
- `src/App.jsx`
- `src/hooks/useHexInteraction.js`

---

### TASK 5.2: Enemy AI Improvements [P2, M, Depends: 5.1]
**Agent:** `enemy-ai-agent`

**Objective:** Smarter enemy behavior in combat

**Subtasks:**
1. Update CombatAI.js
   - Add enemy behavior types (aggressive, defensive, tactical, cowardly)
   - Aggressive: always attack lowest HP target
   - Defensive: defend when below 50% HP
   - Tactical: use terrain, target weakest AC
   - Cowardly: flee when below 25% HP

2. Assign AI types to enemies
   - Map enemy types to AI behavior
   - Goblins: cowardly
   - Dragons: tactical
   - Zombies: aggressive
   - Guards: defensive

3. Add special enemy abilities (optional)
   - Multi-attack for high CR enemies
   - Spellcasting for magic enemies
   - Status effects (poison, paralyze, etc.)

**Acceptance Criteria:**
- Enemies use appropriate tactics
- AI feels intelligent and challenging
- Enemy abilities add variety

**Files to Modify:**
- `src/game/CombatAI.js`
- `src/game/Enemy.js`

---

## PHASE 6: ADDITIONAL CHARACTER CLASSES (P2)
**Goal:** Implement Fighter, Wizard, Rogue, Cleric

### TASK 6.1: Fighter Class [P2, M, No Dependencies]
**Agent:** `fighter-class-agent`

**Objective:** Implement Fighter with class features

**Subtasks:**
1. Update Character.js
   - Add Fighter stat allocation (STR/CON focus)
   - AC 16 (chain mail + shield)
   - HD d10
   - Class features:
     - Fighting Style (Defense, Dueling, Great Weapon Fighting)
     - Second Wind (heal 1d10 + level, 1/short rest)
     - Action Surge (extra action, 1/short rest)

2. Add fighter to character creation
   - TitleScene class selection

3. Implement class features in combat
   - Second Wind button in combat
   - Action Surge button

**Acceptance Criteria:**
- Fighter class selectable
- Fighter stats correct
- Class features functional

**Files to Modify:**
- `src/game/Character.js`
- `src/components/scenes/TitleScene.jsx`

---

### TASK 6.2: Wizard Class [P2, L, No Dependencies]
**Agent:** `wizard-class-agent`

**Objective:** Implement Wizard with spell system

**Subtasks:**
1. Create basic spell system
   - Spell class: name, level, school, damage, effect
   - Spell slots by level
   - Spell preparation
   - Spell save DC

2. Update Character.js
   - Add Wizard stat allocation (INT focus)
   - AC 12 (no armor)
   - HD d6
   - Spell slots
   - Prepared spells
   - Spellbook

3. Implement basic spells
   - Cantrips: Fire Bolt, Ray of Frost, Mage Hand
   - 1st level: Magic Missile, Shield, Burning Hands
   - 2nd level: Scorching Ray, Misty Step
   - 3rd level: Fireball, Lightning Bolt

4. Add spell casting in combat
   - Spell selection UI
   - Cast spell action
   - Consume spell slot
   - Apply spell effects

**Acceptance Criteria:**
- Wizard class functional
- Spell system works
- Can cast spells in combat
- Spell slots track correctly

**Files to Create:**
- `src/game/Spell.js`

**Files to Modify:**
- `src/game/Character.js`
- `src/components/scenes/TitleScene.jsx`
- `src/components/scenes/CombatScene.jsx` (if exists)

---

### TASK 6.3: Rogue Class [P2, M, No Dependencies]
**Agent:** `rogue-class-agent`

**Objective:** Implement Rogue with sneak attack

**Subtasks:**
1. Update Character.js
   - Add Rogue stat allocation (DEX focus)
   - AC 14 (leather armor)
   - HD d8
   - Class features:
     - Sneak Attack (extra damage when advantage)
     - Cunning Action (bonus action dash/disengage/hide)
     - Expertise (double proficiency on selected skills)

2. Implement sneak attack in combat
   - Detect advantage conditions
   - Add sneak attack damage dice
   - Scale with level (1d6 per 2 levels)

3. Add rogue skills
   - Thieves' tools proficiency
   - Expertise in Stealth and Sleight of Hand
   - Trap disarming ability

**Acceptance Criteria:**
- Rogue class functional
- Sneak attack triggers correctly
- Cunning action works

**Files to Modify:**
- `src/game/Character.js`
- `src/components/scenes/TitleScene.jsx`

---

### TASK 6.4: Cleric Class [P2, L, Depends: 6.2 (spell system)]
**Agent:** `cleric-class-agent`

**Objective:** Implement Cleric with healing spells

**Subtasks:**
1. Update Character.js
   - Add Cleric stat allocation (WIS focus)
   - AC 15 (scale mail)
   - HD d8
   - Spell slots (WIS-based)
   - Class features:
     - Channel Divinity (Turn Undead)
     - Divine Domain (Life, War, etc.)

2. Implement cleric spells
   - Cantrips: Sacred Flame, Guidance
   - 1st level: Cure Wounds, Bless, Shield of Faith
   - 2nd level: Spiritual Weapon, Prayer of Healing
   - 3rd level: Revivify, Spirit Guardians

3. Add healing mechanics
   - Heal allies in combat
   - Prayer of Healing out of combat
   - Revivify for resurrection

**Acceptance Criteria:**
- Cleric class functional
- Healing spells work
- Channel Divinity works

**Files to Modify:**
- `src/game/Character.js`
- `src/game/Spell.js`
- `src/components/scenes/TitleScene.jsx`

---

## PHASE 7: ADVANCED FEATURES (P3)
**Goal:** Polish and additional content

### TASK 7.1: Travel Mechanics - Movement Costs [P2, S, Depends: 2.3]
**Agent:** `movement-cost-agent`

**Objective:** Different terrain costs different movement

**Subtasks:**
1. Update terrain difficulty to movement cost
   - Water: 3 (boats needed)
   - Mountains: 2
   - Hills/Forest: 1.5
   - Grassland/Desert: 1
   - Road: 0.5

2. Track movement points
   - Base movement = character speed (30 ft = 6 hexes per day)
   - Deduct movement cost from pool
   - Show remaining movement
   - Reset daily

3. Add travel pace
   - Slow: half speed, +5 to perception
   - Normal: standard speed
   - Fast: double speed, -5 to perception, exhaustion risk

**Acceptance Criteria:**
- Movement costs terrain-appropriate
- Can't move through difficult terrain without enough points
- Travel pace affects speed and perception

**Files to Modify:**
- `src/contexts/GameStateContext.jsx`
- `src/terrainGenerator.js`

---

### TASK 7.2: Weather Effects on Gameplay [P3, S, No Dependencies]
**Agent:** `weather-effects-agent`

**Objective:** Weather impacts movement and combat

**Subtasks:**
1. Apply weather effects
   - Rain: disadvantage on ranged attacks, double movement cost
   - Snow: difficult terrain, cold damage risk
   - Fog: reduced vision (1 hex)
   - Storm: no long rest possible, lightning damage risk

2. Update combat with weather
   - Ranged attack disadvantage in rain/fog
   - Movement penalties in snow/mud

3. Update travel with weather
   - Movement cost modifiers
   - Survival checks in extreme weather

**Acceptance Criteria:**
- Weather has mechanical effects
- Weather displayed in UI
- Effects applied correctly

**Files to Modify:**
- `src/contexts/GameStateContext.jsx`
- `src/terrainGenerator.js`

---

### TASK 7.3: Minimap & Navigation [P2, M, No Dependencies]
**Agent:** `minimap-agent`

**Objective:** Add minimap for navigation

**Subtasks:**
1. Create `src/components/ui/Minimap.jsx`
   - Small canvas showing explored area
   - Player position marker
   - POI markers
   - Fog of war

2. Add minimap to OverworldScene
   - Position in corner
   - Click to center camera
   - Zoom in/out

3. Add compass/coordinates
   - Show current hex coordinates
   - Show cardinal directions

**Acceptance Criteria:**
- Minimap shows explored area
- Player position visible
- Can click to navigate

**Files to Create:**
- `src/components/ui/Minimap.jsx`

**Files to Modify:**
- `src/components/scenes/OverworldScene.jsx`

---

### TASK 7.4: Status Effects & Conditions [P2, L, Depends: 1.4]
**Agent:** `status-effects-agent`

**Objective:** Implement D&D 5e conditions

**Subtasks:**
1. Create `src/game/StatusEffect.js`
   - Conditions: blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious
   - Duration tracking
   - Effect application (disadvantage, speed reduction, etc.)

2. Update Character/Enemy classes
   - Add `statusEffects` array
   - Add `addStatusEffect(effect)` method
   - Add `removeStatusEffect(effectId)` method
   - Add `hasStatusEffect(type)` method

3. Apply effects in combat
   - Status icons displayed
   - Effects modify rolls and actions
   - Duration decremented each turn

4. Add sources of status effects
   - Poison from traps
   - Spells (Hold Person = paralyzed)
   - Enemy abilities

**Acceptance Criteria:**
- All D&D 5e conditions implemented
- Status effects track duration
- Effects applied to rolls
- Visual indicators shown

**Files to Create:**
- `src/game/StatusEffect.js`

**Files to Modify:**
- `src/game/Character.js`
- `src/game/Enemy.js`
- `src/game/Combat.js`

---

### TASK 7.5: Save/Load Improvements [P3, S, No Dependencies]
**Agent:** `save-improvements-agent`

**Objective:** Multiple save slots and cloud saves

**Subtasks:**
1. Add multiple save slots
   - 3 save slots
   - Slot selection UI
   - Save metadata (character name, level, day, location)

2. Add export/import saves
   - Export save to JSON file
   - Import save from JSON file
   - Share saves between devices

3. Add auto-save settings
   - Enable/disable auto-save
   - Auto-save frequency

**Acceptance Criteria:**
- 3 save slots available
- Can export/import saves
- Auto-save configurable

**Files to Modify:**
- `src/contexts/GameStateContext.jsx`
- `src/components/scenes/TitleScene.jsx`

---

### TASK 7.6: Achievements & Statistics [P3, M, No Dependencies]
**Agent:** `achievements-agent`

**Objective:** Track player achievements and stats

**Subtasks:**
1. Create achievement system
   - Achievement definitions (kill 100 enemies, explore 50 hexes, etc.)
   - Achievement progress tracking
   - Achievement unlocks

2. Track statistics
   - Total hexes explored
   - Total enemies defeated
   - Total gold earned
   - Total quests completed
   - Total days traveled
   - Total damage dealt/taken

3. Add achievements UI
   - Achievement list
   - Progress bars
   - Unlock notifications

**Acceptance Criteria:**
- Achievements track progress
- Statistics recorded
- UI shows achievements

**Files to Create:**
- `src/game/AchievementSystem.js`
- `src/components/ui/Achievements.jsx`

**Files to Modify:**
- `src/contexts/GameStateContext.jsx`

---

## PHASE 8: TESTING & POLISH (P1)
**Goal:** Bug fixes, performance, and UX improvements

### TASK 8.1: Add Unit Tests [P1, L, No Dependencies]
**Agent:** `testing-agent`

**Objective:** Test coverage for game logic

**Subtasks:**
1. Set up Vitest
   - Configure test runner
   - Add test scripts to package.json

2. Test pure game logic
   - Character.js tests (damage, healing, level-up)
   - DiceRoller.js tests (all roll types)
   - Combat.js tests (damage calculation, victory conditions)
   - Item.js tests (effects, serialization)
   - Quest.js tests (objective tracking, completion)

3. Test generators
   - TerrainGenerator (seeded consistency)
   - POISystem (placement rules)
   - InteriorGenerator (connectivity, valid layouts)

4. Aim for 60%+ coverage on game logic

**Acceptance Criteria:**
- Test suite runs with `npm test`
- 60%+ code coverage on game logic
- All tests pass

**Files to Create:**
- `src/game/__tests__/` (test files)

---

### TASK 8.2: Performance Optimization [P2, M, No Dependencies]
**Agent:** `performance-agent`

**Objective:** Optimize rendering and state updates

**Subtasks:**
1. Optimize canvas rendering
   - Only redraw changed hexes
   - Use offscreen canvas for static elements
   - Throttle mouse move events

2. Optimize state updates
   - Use useMemo for expensive computations
   - Use useCallback for event handlers
   - Batch state updates where possible

3. Optimize map data
   - Lazy load distant hexes
   - Virtual scrolling for large maps

4. Add performance monitoring
   - FPS counter (dev mode)
   - Render time tracking

**Acceptance Criteria:**
- 60 FPS on maps with 1000+ hexes
- Smooth scrolling and zooming
- No lag on state updates

**Files to Modify:**
- `src/components/canvas/HexGridCanvas.jsx`
- `src/contexts/GameStateContext.jsx`

---

### TASK 8.3: Accessibility Improvements [P2, M, No Dependencies]
**Agent:** `accessibility-agent`

**Objective:** Improve keyboard navigation and screen reader support

**Subtasks:**
1. Add keyboard shortcuts
   - Arrow keys: move camera
   - Tab: cycle through UI elements
   - Enter: select hex
   - Space: rest
   - I: inventory
   - C: character sheet
   - Q: quests

2. Add ARIA labels
   - Label all interactive elements
   - Describe hex contents for screen readers
   - Announce state changes

3. Add high contrast mode
   - Toggle for colorblind users
   - Ensure text readable on all backgrounds

4. Add text scaling
   - Support browser zoom
   - Responsive font sizes

**Acceptance Criteria:**
- Can play entire game with keyboard
- Screen readers announce all info
- High contrast mode works
- Passes WCAG 2.1 AA standards

**Files to Modify:**
- All UI components
- `src/components/scenes/OverworldScene.jsx`

---

### TASK 8.4: Tutorial System [P2, M, No Dependencies]
**Agent:** `tutorial-agent`

**Objective:** Onboarding for new players

**Subtasks:**
1. Create tutorial steps
   - Welcome message
   - "Click hex to move"
   - "Explore to reveal map"
   - "Find towns to rest"
   - "Fight encounters for XP"
   - "Collect loot in POIs"
   - "Manage inventory"

2. Add tutorial UI
   - Highlight elements
   - Tooltip overlays
   - Next/Skip buttons

3. Track tutorial progress
   - Mark steps complete
   - Save tutorial state
   - Option to disable

**Acceptance Criteria:**
- Tutorial guides new players
- Can skip tutorial
- Tutorial completion tracked

**Files to Create:**
- `src/components/ui/Tutorial.jsx`

**Files to Modify:**
- `src/contexts/GameStateContext.jsx`

---

## PHASE 9: CONTENT EXPANSION (P3)
**Goal:** More content for replayability

### TASK 9.1: More POI Types [P3, M, No Dependencies]
**Agent:** `poi-expansion-agent`

**Objective:** Add 5+ new POI types

**Subtasks:**
1. Add new POI types:
   - **Graveyard** - undead encounters, loot in tombs
   - **Bandit Camp** - social encounters, potential recruitment or combat
   - **Ancient Temple** - puzzle-based exploration, divine rewards
   - **Wizard Tower** - magical hazards, spellbook loot
   - **Abandoned Mine** - ore collection, cave-ins, miners' treasures
   - **Mysterious Obelisk** - lore fragments, magical effects
   - **Dragon Lair** - boss encounter, massive treasure hoard

2. Create generators for each
   - Unique interior layouts
   - Type-specific encounters
   - Type-specific loot tables

3. Add to POI placement system

**Acceptance Criteria:**
- 7 new POI types functional
- Each has unique gameplay
- Properly integrated into world generation

**Files to Modify:**
- `src/poiSystem.js`
- Create new generator files

---

### TASK 9.2: Random Events [P3, M, Depends: 2.3]
**Agent:** `random-events-agent`

**Objective:** Random events during travel

**Subtasks:**
1. Create event system
   - Chance per hex moved (5-10%)
   - Event tables by terrain
   - Event types: combat, social, treasure, hazard, lore

2. Example events:
   - "You find a wounded traveler..."
   - "A mysterious merchant offers a deal..."
   - "You discover ancient ruins..."
   - "A sudden storm approaches..."
   - "Wild animals block your path..."

3. Add event resolution
   - Choice-based outcomes
   - Skill checks
   - Rewards or penalties

**Acceptance Criteria:**
- Events trigger during travel
- Events appropriate for terrain
- Events have meaningful outcomes

**Files to Create:**
- `src/game/RandomEventSystem.js`

---

### TASK 9.3: Factions & Reputation [P3, L, No Dependencies]
**Agent:** `faction-system-agent`

**Objective:** Faction relationships affect gameplay

**Subtasks:**
1. Create faction system
   - Factions: Kingdom, Thieves Guild, Mages Circle, Church, Mercenaries
   - Reputation scale: -100 (hostile) to +100 (exalted)
   - Reputation affects: prices, quest availability, NPC reactions

2. Track reputation changes
   - Complete quests for faction: +10-20
   - Kill faction members: -20-50
   - Donate to faction: +5 per 100 gold

3. Add faction UI
   - Reputation display
   - Faction bonuses/penalties

4. Faction-specific content
   - Faction quests
   - Faction rewards (unique items, abilities)
   - Faction conflicts (can't be friendly with all)

**Acceptance Criteria:**
- Faction reputation tracked
- Reputation affects gameplay
- Faction quests available

**Files to Create:**
- `src/game/FactionSystem.js`
- `src/components/ui/Factions.jsx`

---

### TASK 9.4: Legendary Items & Artifacts [P3, M, Depends: 1.1]
**Agent:** `legendary-items-agent`

**Objective:** Unique powerful items with special abilities

**Subtasks:**
1. Create legendary item definitions
   - Each with unique name and lore
   - Special abilities beyond stat bonuses
   - Example: "Sword of the Flame Lord" - casts Fireball 1/day
   - Example: "Cloak of Shadows" - turn invisible 1/short rest
   - Example: "Ring of Wishes" - 3 charges, any spell

2. Add legendary item drops
   - Only from boss encounters
   - Very rare (1% chance)
   - Quest rewards for major quests

3. Add legendary item UI
   - Special visual treatment
   - Ability activation buttons
   - Charge tracking

**Acceptance Criteria:**
- 10+ legendary items defined
- Items have unique abilities
- Abilities functional in combat

**Files to Modify:**
- `src/game/Item.js`
- `src/game/LootGenerator.js`

---

## DEPENDENCIES GRAPH

```
Phase 1: Core Gameplay Loop
  1.1 Item System (no deps)
    └─> 1.2 Loot Collection UI
    └─> 1.3 Equipment UI
    └─> 1.4 Auto-Resolve Combat
          └─> 1.5 XP & Leveling
  1.6 Interior Types (no deps)

Phase 2: Rest & Resources
  2.1 Rest System (no deps)
    └─> 2.2 Rations & Water
  2.3 Time Tracking (no deps)

Phase 3: Party & NPCs
  3.1 NPC Generation (no deps)
    └─> 3.2 Party AI (needs 1.4)
    └─> 3.3 Party UI

Phase 4: Towns & Quests
  4.1 Quest System (needs 1.1)
  4.2 Shop System (needs 1.1)
  4.3 Inn System (needs 2.1)
  4.4 Quest Givers (needs 4.1)
  4.5 Town Expansion (needs 3.1)

Phase 5: Full Combat UI
  5.1 Combat Scene (needs 1.4)
    └─> 5.2 Enemy AI

Phase 6: Character Classes
  6.1 Fighter (no deps)
  6.2 Wizard (no deps)
    └─> 6.4 Cleric
  6.3 Rogue (no deps)

Phase 7: Advanced Features
  7.1 Movement Costs (needs 2.3)
  7.2 Weather Effects (no deps)
  7.3 Minimap (no deps)
  7.4 Status Effects (needs 1.4)
  7.5 Save Improvements (no deps)
  7.6 Achievements (no deps)

Phase 8: Testing & Polish
  8.1 Unit Tests (no deps)
  8.2 Performance (no deps)
  8.3 Accessibility (no deps)
  8.4 Tutorial (no deps)

Phase 9: Content Expansion
  9.1 More POIs (no deps)
  9.2 Random Events (needs 2.3)
  9.3 Factions (no deps)
  9.4 Legendary Items (needs 1.1)
```

---

## PARALLEL EXECUTION STRATEGY

### Sprint 1 (Week 1-2): Foundation
**Can run in parallel:**
- 1.1 Item System
- 1.6 Interior Types
- 2.1 Rest System
- 2.3 Time Tracking
- 3.1 NPC Generation

**Total: 5 agents in parallel**

### Sprint 2 (Week 2-3): Integration
**Can run in parallel:**
- 1.2 Loot Collection (after 1.1)
- 1.3 Equipment UI (after 1.1)
- 1.4 Combat System (after 1.1)
- 2.2 Rations & Water (after 1.1)
- 3.3 Party UI (after 3.1)

**Total: 5 agents in parallel**

### Sprint 3 (Week 3-4): Progression
**Can run in parallel:**
- 1.5 XP & Leveling (after 1.4)
- 3.2 Party AI (after 1.4, 3.1)
- 4.1 Quest System (after 1.1)
- 4.2 Shop System (after 1.1)

**Total: 4 agents in parallel**

### Sprint 4 (Week 4-5): Towns & Classes
**Can run in parallel:**
- 4.3 Inn System
- 4.4 Quest Givers (after 4.1)
- 4.5 Town Expansion (after 3.1)
- 6.1 Fighter
- 6.2 Wizard
- 6.3 Rogue

**Total: 6 agents in parallel**

### Sprint 5 (Week 5-6): Combat & Polish
**Can run in parallel:**
- 5.1 Combat Scene (after 1.4)
- 6.4 Cleric (after 6.2)
- 7.2 Weather Effects
- 7.3 Minimap
- 7.5 Save Improvements
- 8.1 Unit Tests

**Total: 6 agents in parallel**

### Sprint 6 (Week 6-7): Advanced Features
**Can run in parallel:**
- 5.2 Enemy AI (after 5.1)
- 7.1 Movement Costs
- 7.4 Status Effects
- 7.6 Achievements
- 8.2 Performance
- 8.3 Accessibility
- 8.4 Tutorial

**Total: 7 agents in parallel**

### Sprint 7 (Week 7-8): Content Expansion
**Can run in parallel:**
- 9.1 More POIs
- 9.2 Random Events
- 9.3 Factions
- 9.4 Legendary Items

**Total: 4 agents in parallel**

---

## TASK PRIORITY SUMMARY

### P0 - Critical (Must Have for MVP):
- 1.1, 1.2, 1.3, 1.4, 1.5 (Items, loot, equipment, combat, XP)

### P1 - High (Core Features):
- 1.6 (Interior types)
- 2.1, 2.2, 2.3 (Rest, resources, time)
- 3.1, 3.2 (NPCs, party AI)
- 4.1, 4.2, 4.3, 4.4 (Quests, shops, services)
- 8.1 (Testing)

### P2 - Medium (Enhanced Features):
- 3.3 (Party UI)
- 4.5 (Town expansion)
- 5.1, 5.2 (Full combat UI)
- 6.1, 6.2, 6.3, 6.4 (Character classes)
- 7.1, 7.3, 7.4 (Movement costs, minimap, status effects)
- 8.2, 8.3, 8.4 (Performance, accessibility, tutorial)

### P3 - Low (Polish & Expansion):
- 7.2, 7.5, 7.6 (Weather effects, save improvements, achievements)
- 9.1, 9.2, 9.3, 9.4 (Content expansion)

---

## DEVELOPMENT TIMELINE

**Estimated Timeline:** 7-8 weeks with 6-7 parallel agents

**Week 1-2:** Phase 1 Foundation (5 agents)
**Week 2-3:** Phase 1 Integration (5 agents)
**Week 3-4:** Phase 2 Progression (4 agents)
**Week 4-5:** Phase 3 Towns & Classes (6 agents)
**Week 5-6:** Phase 4 Combat & Polish (6 agents)
**Week 6-7:** Phase 5 Advanced Features (7 agents)
**Week 7-8:** Phase 6 Content Expansion (4 agents)

---

## COMPLETION METRICS

**Current State:** ~40% complete
**After Phase 1:** ~60% complete (Core gameplay loop works)
**After Phase 2:** ~70% complete (Resource management added)
**After Phase 3:** ~80% complete (Party system functional)
**After Phase 4:** ~85% complete (Towns and quests functional)
**After Phase 5:** ~90% complete (Full combat and classes)
**After Phase 6:** ~95% complete (Advanced features)
**After Phase 7:** 100% complete (MVP with content expansion)

---

## AGENT EXECUTION NOTES

Each agent should:
1. **Read this TODO** to understand their task
2. **Check dependencies** to ensure prerequisites are complete
3. **Read relevant files** mentioned in "Files to Modify"
4. **Implement the feature** according to subtasks
5. **Test manually** to verify acceptance criteria
6. **Update this TODO** to mark task complete
7. **Document any issues** or blockers

When spawning agents, use:
```
Task tool with subagent_type='general-purpose'
Description: "[Task ID] - [Task Name]"
Prompt: "Implement task [ID] from TODO_RAPID_DEVELOPMENT.md. Read the task details, implement according to acceptance criteria, and test functionality."
```

---

## END OF TODO

**Next Steps:**
1. Review this TODO with team/user
2. Prioritize tasks based on goals
3. Spawn agents for Phase 1 tasks in parallel
4. Monitor progress and resolve blockers
5. Iterate through phases sequentially

**Questions?** Refer to the comprehensive analysis at the top of this document.
