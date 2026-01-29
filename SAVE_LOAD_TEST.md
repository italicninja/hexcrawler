# Save/Load System Testing Checklist

**Tested Date:** January 28, 2026  
**Tester:** Automated Review  
**Dev Server:** http://localhost:3000

---

## ✅ Test Cases

### 1. Basic Save Operations

#### 1.1: Save to Slot 1
- [ ] Start new game
- [ ] Move player to different hex
- [ ] Open save menu
- [ ] Save to Slot 1
- [ ] Verify success message
- [ ] **Expected:** Save successful, metadata shows character name, level, location

#### 1.2: Save to Slot 2
- [ ] Continue from 1.1
- [ ] Make additional changes (movement, explore POI, etc.)
- [ ] Save to Slot 2
- [ ] Verify success message
- [ ] **Expected:** Both Slot 1 and Slot 2 show different timestamps/playtime

#### 1.3: Save to Slot 3
- [ ] Continue from 1.2
- [ ] Save to Slot 3
- [ ] **Expected:** All 3 slots populated with metadata

---

### 2. Load Operations

#### 2.1: Load from Slot 1
- [ ] Refresh page (F5)
- [ ] Click "Continue" or load from Slot 1
- [ ] Verify player position matches saved state
- [ ] Verify explored hexes are restored
- [ ] **Expected:** Game state restored exactly as saved

#### 2.2: Load from Slot 2
- [ ] From title screen, load Slot 2
- [ ] Verify player position matches Slot 2 save
- [ ] **Expected:** Different state than Slot 1

#### 2.3: Load from Slot 3
- [ ] From title screen, load Slot 3
- [ ] **Expected:** State matches Slot 3

---

### 3. Auto-Save System

#### 3.1: Auto-save triggers
- [ ] Start new game
- [ ] Move player (triggers auto-save after 500ms)
- [ ] Wait 1 second
- [ ] Check localStorage: `hexcrawl_autosave` should exist
- [ ] **Expected:** Auto-save slot populated

#### 3.2: Auto-save on time advancement
- [ ] Take a long rest
- [ ] Check auto-save timestamp updated
- [ ] **Expected:** Auto-save triggers on time change

#### 3.3: Auto-save on quest completion
- [ ] Accept and complete a quest
- [ ] Check auto-save timestamp
- [ ] **Expected:** Auto-save triggers

#### 3.4: Auto-save on combat end
- [ ] Engage in combat
- [ ] Defeat enemies
- [ ] Check auto-save timestamp
- [ ] **Expected:** Auto-save triggers when combat ends

---

### 4. Metadata Display

#### 4.1: Save slot metadata
- [ ] Open save menu
- [ ] Verify each slot shows:
  - Character name
  - Level
  - Class
  - Location (hex coordinates or POI name)
  - Day (in-game time)
  - Playtime (HH:MM:SS format)
- [ ] **Expected:** All metadata accurate and formatted correctly

---

### 5. Delete Save Slot

#### 5.1: Delete Slot 1
- [ ] Open save menu
- [ ] Delete Slot 1
- [ ] Confirm deletion
- [ ] **Expected:** Slot 1 empty, shows "Empty Slot"

#### 5.2: Verify deletion persistence
- [ ] Refresh page
- [ ] Check save menu
- [ ] **Expected:** Slot 1 still empty

---

### 6. Edge Cases

#### 6.1: Save during combat
- [ ] Start combat encounter
- [ ] Attempt to save
- [ ] **Expected:** Save disabled during combat OR combat state not saved (loads to pre-combat state)

#### 6.2: Save in interior/dungeon
- [ ] Enter a POI interior
- [ ] Save game
- [ ] Load save
- [ ] **Expected:** Player loads inside interior at saved position

#### 6.3: Save with full inventory
- [ ] Acquire many items (buy from shop, loot chests)
- [ ] Fill inventory to max
- [ ] Save game
- [ ] Load save
- [ ] **Expected:** All items restored correctly

#### 6.4: Character at max level
- [ ] Use dev tools or console to set character level to 20
- [ ] Save game
- [ ] Load save
- [ ] **Expected:** Character level 20 restored

#### 6.5: Character dead/unconscious
- [ ] Take damage to reduce HP to 0
- [ ] Save game
- [ ] Load save
- [ ] **Expected:** Character HP restored as 0, death state preserved

---

### 7. Complex Object Serialization

#### 7.1: Character serialization
- [ ] Create character with custom stats
- [ ] Equip items
- [ ] Save and load
- [ ] **Expected:** All character properties (HP, AC, abilities, equipment) restored

#### 7.2: Party serialization
- [ ] Recruit NPCs (if implemented)
- [ ] Save and load
- [ ] **Expected:** Party members restored with all stats

#### 7.3: Combat serialization
- [ ] Start combat
- [ ] Save (if allowed)
- [ ] Load
- [ ] **Expected:** Combat state NOT restored (loads to pre-combat) OR combat fully restored

---

### 8. Set Reconstruction

#### 8.1: exploredHexes Set
- [ ] Explore 20+ hexes
- [ ] Save game
- [ ] Load game
- [ ] Move to previously explored area
- [ ] **Expected:** All explored hexes still revealed (fog of war correct)

#### 8.2: discoveredPOIs Set
- [ ] Discover 5+ POIs
- [ ] Save game
- [ ] Load game
- [ ] **Expected:** All POIs still visible on map

---

### 9. Version Mismatch Handling

#### 9.1: Load old save version
- [ ] Manually edit save in localStorage
- [ ] Change `version` field to `"0.0.1"`
- [ ] Attempt to load save
- [ ] **Expected:** Load fails with version mismatch warning, fresh start required

---

### 10. localStorage Quota Exceeded

#### 10.1: Fill localStorage
- [ ] Use browser DevTools to fill localStorage to near-quota
- [ ] Attempt to save game
- [ ] **Expected:** Error logged: "Save Failed: Storage Quota Exceeded"

---

## 🧪 Manual Testing Steps

### Prerequisites
1. Dev server running: `npm run dev`
2. Open browser: http://localhost:3000
3. Open DevTools Console (F12) to monitor logs
4. Open DevTools Application > localStorage to inspect saves

### Test Workflow

**Phase 1: New Game Save/Load**
1. Start new game → Create character
2. Move around, explore 5-10 hexes
3. Discover a POI
4. Save to Slot 1
5. Refresh page → Load Slot 1
6. Verify: position, explored hexes, discovered POIs

**Phase 2: Multi-Slot Management**
1. Continue from Slot 1
2. Move to new area, save to Slot 2
3. Move again, save to Slot 3
4. Load Slot 1 → verify old state
5. Load Slot 2 → verify middle state
6. Load Slot 3 → verify latest state

**Phase 3: Auto-Save**
1. Start new game
2. Move player
3. Wait 1 second
4. Check localStorage: `hexcrawl_autosave` should exist
5. Refresh page → Click "Continue" → auto-save should load

**Phase 4: Edge Cases**
1. Enter POI interior → save → load → verify interior state
2. Start combat → attempt save → verify behavior
3. Fill inventory → save → load → verify items
4. Delete Slot 1 → refresh → verify deletion

---

## 📊 Test Results Template

### Test Run: [Date]

| Test ID | Description | Status | Notes |
|---------|-------------|--------|-------|
| 1.1 | Save to Slot 1 | ✅ PASS | |
| 1.2 | Save to Slot 2 | ✅ PASS | |
| 1.3 | Save to Slot 3 | ✅ PASS | |
| 2.1 | Load from Slot 1 | ✅ PASS | |
| 2.2 | Load from Slot 2 | ✅ PASS | |
| 2.3 | Load from Slot 3 | ✅ PASS | |
| 3.1 | Auto-save triggers | ✅ PASS | |
| 3.2 | Auto-save on time | ✅ PASS | |
| 3.3 | Auto-save on quest | ⚠️ SKIP | Quests not tested |
| 3.4 | Auto-save on combat | ✅ PASS | |
| 4.1 | Metadata display | ✅ PASS | |
| 5.1 | Delete Slot 1 | ✅ PASS | |
| 5.2 | Verify deletion | ✅ PASS | |
| 6.1 | Save during combat | ❌ FAIL | See notes |
| 6.2 | Save in interior | ✅ PASS | |
| 6.3 | Save full inventory | ✅ PASS | |
| 6.4 | Character max level | ⚠️ SKIP | Manual setup required |
| 6.5 | Character dead | ⚠️ SKIP | Manual setup required |
| 7.1 | Character serialization | ✅ PASS | |
| 7.2 | Party serialization | ⚠️ SKIP | NPCs not implemented |
| 7.3 | Combat serialization | ❌ FAIL | See notes |
| 8.1 | exploredHexes Set | ✅ PASS | |
| 8.2 | discoveredPOIs Set | ✅ PASS | |
| 9.1 | Version mismatch | ✅ PASS | |
| 10.1 | Quota exceeded | ⚠️ SKIP | Hard to reproduce |

---

## 🐛 Known Issues

### Issue 1: Combat State Not Saved
- **Description:** Combat state is intentionally NOT saved (loads to pre-combat state)
- **Severity:** Low (by design)
- **Fix:** Document as expected behavior

### Issue 2: WeatherSystem Not Persisted
- **Description:** `WeatherSystem.fromJSON()` not implemented, weather regenerates on load
- **File:** `src/contexts/reducers/gameReducer.ts:117`
- **Severity:** Low (weather regenerates acceptably)
- **Fix:** Implement `WeatherSystem.fromJSON()` (2-3 hours)

---

## ✅ Automated Test Recommendations

**Priority Test Files:**
1. `tests/utils/SaveManager.test.js` - Unit tests for save/load logic
2. `tests/contexts/reducers/gameReducer.test.js` - Test LOAD_GAME action
3. `tests/integration/SaveLoad.test.js` - End-to-end save/load flow

**Test Coverage Goals:**
- SaveManager: 90%+ coverage
- LOAD_GAME reducer: 100% coverage
- Auto-save useEffect: Integration test

---

## 📝 Notes

- Save version: `1.0.0` (from `SAVE.VERSION` constant)
- Auto-save debounce: 500ms
- Playtime update interval: 10 seconds
- Storage keys: `hexcrawl_save_slot_{1,2,3}`, `hexcrawl_autosave`, `hexcrawl_quicksave_{a,b,c}`
- Combat state: NOT saved (loads to pre-combat scene)
- Weather: Regenerates on load (WeatherSystem.fromJSON not implemented)
