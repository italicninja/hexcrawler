# Hexcrawler - Consolidated TODO

**Last Updated:** June 10, 2026
**Current Completeness:** ~92% (Core gameplay complete, TypeScript migration done)
**Focus:** Code quality + remaining polish

---

## DONE - Completed Since Last TODO Update

The following items from the previous TODO were completed as part of v0.5.0 and related work:

- [x] **Delete dead code** - `GameStateContext.tsx` is 361 lines, cleanly delegates to `src/contexts/reducers/`
- [x] **Delete backup files** - No `.backup`/`.bak`/`.bak2` files remain
- [x] **Add ESLint + Prettier** - `.eslintrc.cjs`, `.prettierrc` exist; `lint`/`format` scripts in `package.json`
- [x] **TypeScript migration** - Entire codebase migrated to `.ts`/`.tsx` (v0.5.0)
- [x] **Code splitting** - `App.tsx` uses `lazy()` + `Suspense` for all 4 scenes
- [x] **CI/CD pipeline** - `.github/workflows/qa-tests.yml` runs Playwright E2E on push/PR
- [x] **Rations system** - `SurvivalManager.ts` (319 lines), full exhaustion/foraging implemented
- [x] **Party AI** - `src/game/ai/` directory with `AIEngine.ts`, `scorers.ts`, `conditions.ts`, `actions.ts` (1,264 lines total)
- [x] **Full combat UI** - `src/components/ui/combat/` has 11 components; no auto-resolve
- [x] **All 12 character classes** - Fighter, Wizard, Rogue, Cleric, Paladin, Barbarian, Bard, Druid, Monk, Ranger, Sorcerer, Warlock all in `Character.ts`
- [x] **Combat.ts audit** - No `autoResolveCombat` or `processAutoTurn` found; fully turn-based
- [x] **24. Fix hero attack roll modifier** - `DiceRoller.ts:138` reads `character.abilities?.[ability] ?? 10`; was reading `character[ability]` (always undefined). Fixed in v0.7.1.
- [x] **25. Add starting equipment loadouts by class** - `Character.applyStartingLoadout(className)` assigns 2024 Basic Rules starting gear per class. Fixed in v0.7.1.

---

## CRITICAL

### 1. Remove `// @ts-nocheck` Suppressions

**Priority:** High | **Time:** 8-12 hours | **Status:** IN PROGRESS (83 files remaining, down from 100)

**Problem:** `tsconfig.json` has `strict: true` enabled, but the majority of source files begin with `// @ts-nocheck`, which completely bypasses TypeScript checking. The TypeScript migration is structurally complete but type safety is not enforced.

**Scope:** `App.tsx`, `OverworldScene.tsx`, `Combat.ts`, all `ai/` files, most `hooks/`, `contexts/reducers/` files, canvas components.

**Approach:**

1. Remove `// @ts-nocheck` one file at a time, starting with smallest/simplest files
2. Run `npm run typecheck` after each removal
3. Fix errors before moving to the next file
4. Recommended order: `utils/` → `game/` pure classes → `contexts/reducers/` → `hooks/` → `components/`

**Commit pattern:** `chore: Remove @ts-nocheck from [filename], fix type errors`

**Done so far (v0.7.x):** Pure/leaf game + utils modules — `DiceRoller`, `LineOfSight`, `Spell`, `Character` (keystone — its fields were leaking 22 errors into already-checked reducers), `OpportunityAttack`, `Pathfinding`, `EncounterPositions`, `HazardGenerator`, `Enemy`, `Party`, `SpellManager`, `TreasureGenerator`, `QuestGenerator` (+ `Quest`), `NPCGenerator`, `Shop`, `LootGenerator`, and `utils/regionDebug`. Typecheck holds at **0 errors** after every removal.

Bugs surfaced and fixed along the way: `Character.gainXP()` → `awardXP()` (3 reducers, would `TypeError` on every XP award); missing `logger` import in `inventoryReducer`; dead `CONSUME_WATER`/`FIND_WATER` reducer cases referencing the removed `water` field; and quest difficulty `level` silently dropped because `QuestConfig` had no `level` field.

**Remaining (~83):** the React components (`components/**`), hooks, the larger scenes (`OverworldScene` etc.), remaining generators (`Dungeon`/`Cave`/`Tower`/`Ruins`/`Town`/`Interior`), AI (`game/ai/**`), `Combat.ts`, and top-level map/terrain modules. Recommended to keep going game/utils → reducers → hooks → components.

---

### 2. Test Save/Load System

**Priority:** High | **Time:** 2 hours

**Why:** Recent commits show save/load bug fixes (quest/shop/explorationState reconstruction) — regression risk is real.

**Test Cases:**

- [ ] Save to slots 1-3
- [ ] Load from each slot
- [ ] Auto-save triggers on scene change
- [ ] Save metadata displays correctly (playtime, character name, level)
- [ ] Delete save slot
- [ ] Version mismatch handling
- [ ] Set reconstruction (exploredHexes, discoveredPOIs)

**Edge Cases:**

- Save during combat
- Save in interior/dungeon
- Save with full inventory
- Character with exhaustion levels

---

## TECHNICAL DEBT

### 3. Split OverworldScene.tsx

**Priority:** High | **Time:** 12-16 hours

`OverworldScene.tsx` is **1,960 lines** — the largest file and the primary maintainability problem. It currently handles overworld movement, interior exploration, combat rendering, all UI panel rendering, and survival/AI logic. This grew from the estimated 1,648 lines in the previous TODO.

**Current responsibilities to extract:**

| Responsibility                                        | Target File                        | Estimated Lines |
| ----------------------------------------------------- | ---------------------------------- | --------------- |
| Interior exploration logic + rendering                | `InteriorScene.tsx`                | ~400            |
| Combat orchestration (AI turns, action handlers)      | `CombatSceneWrapper.tsx`           | ~300            |
| Overworld movement + keyboard controls                | `useOverworldInput.ts` (hook)      | ~200            |
| Combat state management                               | `useCombatOrchestration.ts` (hook) | ~200            |
| Core OverworldScene (hex grid, fog of war, UI panels) | `OverworldScene.tsx`               | ~600            |

**Steps:**

1. Extract `InteriorScene.tsx` (interior canvas + related state)
2. Extract `CombatSceneWrapper.tsx` (combatState rendering branch + AI useEffects)
3. Extract `useCombatOrchestration.ts` hook (AI turn processing logic)
4. Extract `useOverworldInput.ts` hook (keyboard handling)
5. Clean up remaining `OverworldScene.tsx`

**Commits:**

- `refactor: Extract InteriorScene from OverworldScene`
- `refactor: Extract CombatSceneWrapper from OverworldScene`
- `refactor: Extract combat hooks from OverworldScene`
- `refactor: Cleanup OverworldScene (1960 → ~600 lines)`

---

### 4. Add Vitest Unit Testing

**Priority:** High | **Time:** 6-8 hours

**Current state:** Playwright E2E tests exist (`.github/workflows/qa-tests.yml`), but there is no unit test framework. Game logic has no coverage at the unit level.

**Install:**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Create `vitest.config.ts`:**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', '*.config.ts', 'src/main.tsx'],
    },
  },
});
```

**Create `tests/setup.ts`:**

```typescript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);
afterEach(() => cleanup());
```

**Priority test files:**

1. `tests/game/DiceRoller.test.ts`
2. `tests/game/Character.test.ts`
3. `tests/utils/hexMath.test.ts`
4. `tests/utils/HexGrid.test.ts`
5. `tests/game/SurvivalManager.test.ts`
6. `tests/contexts/reducers/combatReducer.test.ts`

**Add to `package.json` scripts:**

```json
"test:unit": "vitest",
"test:unit:ui": "vitest --ui",
"test:unit:coverage": "vitest --coverage"
```

**Goal:** 60%+ coverage on `src/game/` and `src/utils/`

**Commit:** `test: Add Vitest unit testing framework and initial tests`

---

### 5. Add Git Pre-commit Hooks

**Priority:** Low | **Time:** 1 hour

**BLOCKER:** `npm run lint` is currently broken project-wide — ESLint v9 is installed but the repo only has a legacy `.eslintrc.cjs` (ESLint v9 requires flat config `eslint.config.js`). Migrate the config to flat format before wiring lint into pre-commit hooks, otherwise the hook will fail on every commit. Note that ~91 files still carry `@ts-nocheck` and use `any`, so expect a large lint baseline — relax `--max-warnings 0` to a known baseline until item #1 is further along.

ESLint and Prettier are installed but not enforced at commit time.

**Install:**

```bash
npm install -D husky lint-staged
npx husky init
```

**Create `.husky/pre-commit`:**

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx lint-staged
```

**Add to `package.json`:**

```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{css,md}": ["prettier --write"]
}
```

**Commit:** `chore: Add husky pre-commit hooks with lint-staged`

---

### 6. Upgrade Dependencies

**Priority:** Low | **Time:** 2-3 hours

| Package                | Current       | Latest     | Notes                                    |
| ---------------------- | ------------- | ---------- | ---------------------------------------- |
| `vite`                 | `^5.0.0`      | 7.x        | Major version bump, check config changes |
| `@vitejs/plugin-react` | `^4.2.1`      | 5.x        | Goes with Vite upgrade                   |
| `typescript`           | `^6.0.0-beta` | 6.0 stable | Pin to stable when released              |

**Note:** Tailwind v4 has breaking changes — defer.

**Steps:**

1. Branch: `chore/upgrade-vite-v7`
2. Upgrade Vite + plugin-react
3. Update `vite.config.ts` as needed
4. `npm run build` + `npm run dev` smoke test
5. Run Playwright suite

**Commit:** `chore: Upgrade Vite to v7 and plugin-react to v5`

---

## PERFORMANCE & POLISH

### 7. Canvas Rendering Optimization

**Priority:** Medium | **Time:** 4-5 hours

**Files:**

- `src/components/canvas/HexGridCanvas.tsx` (393 lines)
- `src/components/canvas/CombatCanvas.tsx` (702 lines)
- `src/components/canvas/InteriorHexCanvas.tsx` (543 lines)

**Optimizations:**

1. Cache hex positions (avoid recalculating per-frame)
2. Debounce canvas redraws to ~60fps cap
3. Memoize `hexTextureGenerator` results
4. Dirty-flag pattern: only redraw hexes that changed

**Commit:** `perf: Optimize canvas rendering with caching and dirty flags`

---

### 8. Weather Effects on Gameplay

**Priority:** Low | **Time:** 2-3 hours

Weather system (`WeatherSystem.ts`) generates conditions but they don't affect gameplay mechanics.

**Files to Modify:**

- `src/contexts/reducers/gameReducer.ts`
- `src/components/scenes/OverworldScene.tsx`

**Features:**

- Rain: ranged attack disadvantage, double movement cost
- Snow: difficult terrain, cold damage (Constitution save)
- Fog: reduced vision distance
- Storm: no long rest, lightning damage

**Commit:** `feat: Add weather gameplay effects`

---

### 9. Movement Costs by Terrain

**Priority:** Low | **Time:** 3-4 hours

**Files to Modify:**

- `src/contexts/reducers/gameReducer.ts`
- `src/terrainGenerator.ts`

**Features:**

- Water: 3 movement (raft/boat required)
- Mountains: 2 movement
- Hills/Forest: 1.5 movement
- Grassland/Desert: 1 movement
- Road: 0.5 movement
- Travel pace (Slow/Normal/Fast)

**Commit:** `feat: Add terrain-based movement costs`

---

### 10. Minimap & Navigation

**Priority:** Low | **Time:** 4-5 hours

**Files to Create:**

- `src/components/ui/Minimap.tsx`

**Features:**

- Small canvas showing explored area
- Player position marker
- POI markers
- Fog of war overlay
- Click to center map view

**Commit:** `feat: Add minimap navigation`

---

### 11. Status Effects & Conditions

**Priority:** Medium | **Time:** 8-10 hours

D&D 5e conditions exist partially (exhaustion is implemented via SurvivalManager) but a general condition system is missing.

**Files to Create:**

- `src/game/StatusEffect.ts`

**Files to Modify:**

- `src/game/Character.ts`
- `src/game/Enemy.ts`
- `src/game/Combat.ts`

**Features:**

- D&D 5e conditions: blinded, charmed, frightened, paralyzed, poisoned, prone, restrained, stunned
- Duration tracking (rounds / until rest)
- Effect application (disadvantage, speed reduction, auto-fail saves)
- Visual indicators in combat UI

**Commit:** `feat: Add D&D 5e status effects and conditions`

---

### 12. Party Management UI Improvements

**Priority:** Low | **Time:** 2-3 hours

**File:** `src/components/ui/PartyList.tsx`

**Features:**

- Expandable NPC entries showing full stat block
- Equipment and inventory view per party member
- Personality/background display
- Party summary stats (total HP, avg level, composition)

**Commit:** `feat: Improve party management UI`

---

## CLASS IMPLEMENTATION BACKLOG

All classes except Barbarian are currently **disabled** in character creation (see `DISABLED_CLASSES` in `CharacterCreationScene.tsx`). Each class needs its unique mechanics fully designed and implemented before being re-enabled. Remove the class from `DISABLED_CLASSES` once complete.

The Barbarian serves as the reference implementation. All classes share the base `Character.ts` stat block, hit die, proficiencies, and saving throw setup — what needs fleshing out is the **unique gameplay loop** each class creates in the hexcrawl context.

---

### 13. Fighter — Flesh Out & Enable

**Priority:** High | **Estimated Time:** 3-4 hours

**Design Questions to Resolve:**

- Second Wind: short-rest heal (1d10 + level) — how does short rest work on the overworld?
- Action Surge: extra action in combat — what actions does it unlock specifically?
- Fighting Style: which styles to implement (Archery, Defense, Dueling, Great Weapon, Protection, Two-Weapon)?
- Martial Archetypes at level 3: Champion (crit on 19-20) vs Battle Master (maneuvers) — scope?

**Mechanics to Implement:**

- [ ] Second Wind ability (short rest recovery on overworld)
- [ ] Action Surge (extra combat action, 1/short rest)
- [ ] Fighting Style passive bonuses applied to attack/damage rolls
- [ ] Extra Attack at level 5 (multiattack)

**Files to Modify:** `src/game/Character.ts`, `src/game/Combat.ts`, `src/components/ui/combat/`

**Commit:** `feat: Implement Fighter class mechanics and re-enable`

---

### 14. Rogue — Flesh Out & Enable

**Priority:** High | **Estimated Time:** 4-5 hours

**Design Questions to Resolve:**

- Sneak Attack: trigger conditions (ally adjacent, target has disadvantage) — how to detect in combat?
- Cunning Action: Dash/Disengage/Hide as bonus action — is bonus action system implemented?
- Expertise: double proficiency on two skills — which overworld skills benefit most (Stealth, Perception)?
- Thieves' Tools: trap disarming at POIs — tie into interior/dungeon system?

**Mechanics to Implement:**

- [ ] Sneak Attack damage dice (1d6 per 2 levels) with trigger detection
- [ ] Cunning Action bonus action (Dash, Disengage, Hide)
- [ ] Expertise on selected skills
- [ ] Uncanny Dodge (halve damage once per round, reaction)
- [ ] Evasion at level 7 (Dex save: no damage on success, half on fail)

**Files to Modify:** `src/game/Character.ts`, `src/game/Combat.ts`, combat UI components

**Commit:** `feat: Implement Rogue class mechanics and re-enable`

---

### 15. Ranger — Flesh Out & Enable

**Priority:** High | **Estimated Time:** 4-5 hours

**Design Questions to Resolve:**

- Favored Enemy: bonus to tracking/recall vs specific creature types — which enemy types exist in the game?
- Natural Explorer: ignore difficult terrain, no getting lost, double food from foraging — how does foraging interact?
- Spellcasting: half-caster (spell slots at level 2) — is the spell system ready for half-casters?
- Hunter's Mark: concentration spell — how is concentration tracked in combat?
- Fighting Style: subset of Fighter styles (Archery, Defense, Dueling, Two-Weapon)

**Mechanics to Implement:**

- [ ] Favored Enemy type selection at creation + combat/skill bonuses
- [ ] Natural Explorer terrain bonus (tie into `SurvivalManager.ts` foraging)
- [ ] Ranger spell list (Hunter's Mark, Cure Wounds, Goodberry, Spike Growth, etc.)
- [ ] Hunter's Mark concentration tracking in combat
- [ ] Colossus Slayer / Hunter's Prey features at level 3

**Files to Modify:** `src/game/Character.ts`, `src/game/SurvivalManager.ts`, `src/game/Combat.ts`, spell system

**Commit:** `feat: Implement Ranger class mechanics and re-enable`

---

### 16. Paladin — Flesh Out & Enable

**Priority:** High | **Estimated Time:** 5-6 hours

**Design Questions to Resolve:**

- Divine Smite: expend spell slot on hit for radiant damage — how does slot selection work mid-combat?
- Lay on Hands: HP pool (5 × level), cure disease/poison — is disease/poison tracked?
- Aura of Protection: +CHA modifier to all saves within 10ft — does party proximity matter in combat?
- Sacred Oath at level 3: Devotion vs Ancients vs Vengeance — scope for v1?
- Half-caster: spell slots at level 2, Paladin spell list

**Mechanics to Implement:**

- [ ] Lay on Hands pool (heal or cure poison/disease, tracked separately from HP)
- [ ] Divine Smite (post-hit slot expenditure for 2d8 radiant + 1d8 per extra slot level)
- [ ] Aura of Protection (party saving throw bonus in combat)
- [ ] Divine Sense (detect undead/fiends within 60ft at POIs)
- [ ] Channel Divinity options (Sacred Weapon, Turn the Unholy)

**Files to Modify:** `src/game/Character.ts`, `src/game/Combat.ts`, `src/components/ui/combat/`

**Commit:** `feat: Implement Paladin class mechanics and re-enable`

---

### 17. Cleric — Flesh Out & Enable

**Priority:** Medium | **Estimated Time:** 5-6 hours

**Design Questions to Resolve:**

- Divine Domain at level 1: which domains to support? (Life, Light, War, Trickery, Knowledge, Nature, Tempest)
- Life Domain: Disciple of Life (bonus healing), Preserve Life channel divinity — is this the default domain?
- Channel Divinity: Turn Undead — how does it interact with undead enemy types in the encounter system?
- Spellcasting: full caster (spell slots from level 1), Cleric spell list
- Ritual Casting: can cast ritual spells without expending a slot — what ritual spells exist?

**Mechanics to Implement:**

- [ ] Divine Domain selection at character creation (start with Life + War domains)
- [ ] Channel Divinity: Turn Undead (undead Wisdom save or flee for 1 minute)
- [ ] Channel Divinity: Domain-specific (e.g., Preserve Life for healing pool)
- [ ] Cleric spell list (Cure Wounds, Guiding Bolt, Sacred Flame, Bless, Shield of Faith, etc.)
- [ ] Ritual casting flag on applicable spells

**Files to Modify:** `src/game/Character.ts`, `src/game/Combat.ts`, spell system, character creation UI

**Commit:** `feat: Implement Cleric class mechanics and re-enable`

---

### 18. Druid — Flesh Out & Enable

**Priority:** Medium | **Estimated Time:** 6-8 hours

**Design Questions to Resolve:**

- Wild Shape: transform into CR 1/4 beast (level 2) — how does beast form work in combat? Separate stat block?
- Wild Shape overworld use: scouting (Eagle for flight, Fish for swim) — interact with fog-of-war/movement?
- Druidic Circle at level 2: Circle of the Land vs Circle of the Moon — Moon gives better Wild Shape forms
- Spellcasting: full caster, Druid spell list (Entangle, Moonbeam, Conjure Animals, etc.)
- No metal armor restriction — enforce or skip?

**Mechanics to Implement:**

- [ ] Wild Shape transformation (combat: temporary beast stat block overlay on character)
- [ ] Beast form HP pool (separate from regular HP, revert at 0)
- [ ] Wild Shape overworld scouting (expanded view distance, river crossing as fish, etc.)
- [ ] Druid spell list (Healing Word, Entangle, Faerie Fire, Spike Growth, Moonbeam, Call Lightning)
- [ ] Wildshape forms list by CR and environment type

**Files to Modify:** `src/game/Character.ts`, `src/game/Combat.ts`, `src/game/Enemy.ts` (reuse for beast forms), overworld movement

**Commit:** `feat: Implement Druid class mechanics (Wild Shape + spells) and re-enable`

---

### 19. Bard — Flesh Out & Enable

**Priority:** Medium | **Estimated Time:** 5-6 hours

**Design Questions to Resolve:**

- Bardic Inspiration: d6 die given to ally, used on attack/ability/save — how does ally AI use it?
- Jack of All Trades: +half proficiency to non-proficient checks — which overworld checks does this affect?
- Bard College at level 3: College of Lore (extra skills, Cutting Words) vs College of Valor (combat buffs)
- Song of Rest: extra HD recovery during short rest — short rest system needed
- Spellcasting: full caster, Bard spell list (Charm Person, Healing Word, Vicious Mockery, Hypnotic Pattern, etc.)
- Expertise: double proficiency on two skills (same as Rogue)

**Mechanics to Implement:**

- [ ] Bardic Inspiration die (pool = CHA modifier, recharge on long rest)
- [ ] Inspiration die used by allies in combat (reaction or AI-triggered)
- [ ] Jack of All Trades half-proficiency on all untrained skills
- [ ] Bard spell list with focus on crowd control and support
- [ ] Cutting Words (College of Lore): reaction to impose penalty on enemy attack/check

**Files to Modify:** `src/game/Character.ts`, `src/game/Combat.ts`, party AI (`src/game/ai/`), spell system

**Commit:** `feat: Implement Bard class mechanics and re-enable`

---

### 20. Monk — Flesh Out & Enable

**Priority:** Medium | **Estimated Time:** 5-6 hours

**Design Questions to Resolve:**

- Ki points: fuel for Flurry of Blows, Patient Defense, Step of the Wind — recharge on short rest
- Martial Arts: unarmed strike as bonus action, unarmed die scales by level (d4→d6→d8→d10)
- Unarmored Defense: AC = 10 + DEX + WIS — does this already apply in Character.ts?
- Stunning Strike: spend 1 ki on hit, target CON save or stunned — is stunned condition implemented?
- Monastic Tradition at level 3: Way of the Open Hand vs Way of Shadow vs Way of the Four Elements

**Mechanics to Implement:**

- [ ] Ki point pool (= level, recharge on short rest)
- [ ] Flurry of Blows (2 unarmed strikes as bonus action, 1 ki)
- [ ] Patient Defense (Dodge as bonus action, 1 ki)
- [ ] Step of the Wind (Dash/Disengage as bonus action, 1 ki; jump distance doubled)
- [ ] Martial Arts unarmed die progression
- [ ] Stunning Strike (1 ki, CON save or stunned until end of next turn)
- [ ] Slow Fall (reaction, reduce fall damage by 5 × level) — if fall damage exists

**Files to Modify:** `src/game/Character.ts`, `src/game/Combat.ts`, `StatusEffect.ts` (stunned condition)

**Commit:** `feat: Implement Monk class mechanics and re-enable`

---

### 21. Sorcerer — Flesh Out & Enable

**Priority:** Low | **Estimated Time:** 5-6 hours

**Design Questions to Resolve:**

- Sorcery Points: fuel for Metamagic and slot conversion — separate resource pool needed
- Metamagic options: Careful, Distant, Empowered, Extended, Heightened, Quickened, Subtle, Twinned — which to implement first?
- Quickened Spell: cast spell as bonus action — requires bonus action system
- Twinned Spell: target second creature with single-target spell — how to select second target in combat UI?
- Sorcerous Origin at level 1: Draconic Bloodline vs Wild Magic — Wild Magic surge table is complex
- Spellcasting: full caster, Sorcerer spell list (overlap with Wizard but more charisma-flavored)

**Mechanics to Implement:**

- [ ] Sorcery Points pool (= level, recharge on long rest)
- [ ] Font of Magic: convert slots to sorcery points and vice versa
- [ ] Metamagic: Empowered Spell (reroll damage dice, 1 point) and Quickened Spell (bonus action cast, 2 points) as starting two
- [ ] Draconic Bloodline: Draconic Resilience (AC 13 + DEX unarmored), damage affinity with chosen element
- [ ] Sorcerer spell list

**Files to Modify:** `src/game/Character.ts`, `src/game/Combat.ts`, spell system, combat UI

**Commit:** `feat: Implement Sorcerer class mechanics and re-enable`

---

### 22. Warlock — Flesh Out & Enable

**Priority:** Low | **Estimated Time:** 5-6 hours

**Design Questions to Resolve:**

- Pact Magic: short-rest spell slot recharge (only 1-2 slots, always highest level) — different from standard spellcasting
- Eldritch Blast: cantrip that scales with level, can be modified by Invocations — is it a standard cantrip or special-cased?
- Invocations at level 2: Agonizing Blast (+CHA to EB damage), Devil's Sight, Fiendish Vigor, etc. — select 2 at level 2
- Otherworldly Patron at level 1: The Fiend vs The Great Old One vs The Archfey — Fiend is simplest (temp HP on kill)
- Pact Boon at level 3: Pact of the Blade (melee), Pact of the Chain (familiar), Pact of the Tome (extra cantrips)

**Mechanics to Implement:**

- [ ] Pact Magic slot system (short-rest recharge, all slots are highest level)
- [ ] Eldritch Blast as signature cantrip (1d10 force, +1 beam per 5 levels)
- [ ] Eldritch Invocations selection at level 2 (start with Agonizing Blast + one other)
- [ ] The Fiend patron: Dark One's Blessing (temp HP = CHA mod + level on kill)
- [ ] Warlock spell list (Hex, Armor of Agathys, Hunger of Hadar, Banishment, etc.)

**Files to Modify:** `src/game/Character.ts`, `src/game/Combat.ts`, spell system

**Commit:** `feat: Implement Warlock class mechanics and re-enable`

---

### 23. Wizard — Flesh Out & Enable

**Priority:** Low | **Estimated Time:** 5-6 hours

**Design Questions to Resolve:**

- Spellbook: starts with 6 spells, copies spells found as loot — is there a loot-spellbook interaction at POIs?
- Arcane Recovery: recover spell slots on short rest (slots whose total level ≤ half wizard level, rounded up)
- Arcane Tradition at level 2: which schools to implement? (Evocation is most combat-relevant)
- Evocation Savant: halve gold/time to copy Evocation spells — relevant if spellbook economy exists
- Sculpt Spells: exclude allies from Evocation AoE — how does AoE targeting work in combat?
- Signature Spells at level 18: always prepared, cast once free per rest — long-term feature

**Mechanics to Implement:**

- [ ] Spellbook system (known spells list, copy mechanic at POIs/loot)
- [ ] Arcane Recovery (short rest: recover slots up to half level total)
- [ ] Prepared spells = INT modifier + wizard level (choose subset of spellbook each long rest)
- [ ] Evocation Tradition: Sculpt Spells (protect allies in AoE), Potent Cantrip (damage on save)
- [ ] Wizard spell list (Magic Missile, Shield, Fireball, Counterspell, Fly, Wish — level-gated)

**Files to Modify:** `src/game/Character.ts`, `src/game/Combat.ts`, spell system, POI interaction for spellbook

**Commit:** `feat: Implement Wizard class mechanics and re-enable`

---

## UNTRACKED IN-CODE TODOs

The following `TODO` comments exist in source files but are not yet captured as formal backlog items. Resolve or promote to a numbered item when the relevant phase begins.

| File                                         | Line               | Comment                                                           | Related Item                                                                                                                           |
| -------------------------------------------- | ------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/scenes/ExplorationScene.tsx` | 124                | `TODO: Implement full combat system`                              | Combat is in OverworldScene — this stub may be dead code; confirm and remove or wire up during item #3                                 |
| `src/components/ui/InteriorHexDetails.tsx`   | 50                 | `TODO: Real combat system`                                        | Same as above — review during item #3 split                                                                                            |
| `src/components/ui/RestMenu.tsx`             | 103                | `TODO: Trigger random encounter here`                             | Not tracked — add random encounter on rest as a future feature item                                                                    |
| `src/game/EnemyMovement.ts`                  | 219, 246, 274, 310 | Enemy movement activation, pathfinding wiring, patrol loop        | System is stubbed but entirely inactive; wire up to `Pathfinding.ts → findPath()` and `handleInteriorHexDoubleClick` when activating   |
| `src/game/TreasureGenerator.ts`              | 41–174             | 8 stub TODOs for CR bracket lookup, coin/gem/art/magic item rolls | Full treasure generation is unimplemented; partially tracked via `GameTableData.ts:828` (`TODO: Implement full magic item generation`) |
| `src/game/data/GameTableData.ts`             | 828                | `TODO: Implement full magic item generation`                      | Promote to a numbered item when spell/item system work begins                                                                          |

**Note:** The ~25 `// TODO: Add proper TypeScript types` comments across `src/game/` and `src/utils/` are intentional migration markers for item #1 (Remove `@ts-nocheck`). Leave them in place — they guide the file-by-file type work.

---

## EXECUTION CHECKLIST

### Now (High Priority)

- [ ] 1. Remove `// @ts-nocheck` suppressions (file by file)
- [ ] 2. Test save/load system thoroughly
- [ ] 3. Split OverworldScene.tsx (1,960 lines)
- [ ] 4. Add Vitest unit testing
- [ ] 13. Fighter — implement & re-enable
- [ ] 14. Rogue — implement & re-enable
- [ ] 15. Ranger — implement & re-enable
- [ ] 16. Paladin — implement & re-enable

### Soon (Medium Priority)

- [ ] 5. Add git pre-commit hooks
- [ ] 6. Upgrade Vite to v7
- [ ] 7. Canvas rendering optimization
- [ ] 11. Status effects & conditions
- [ ] 17. Cleric — implement & re-enable
- [ ] 18. Druid — implement & re-enable
- [ ] 19. Bard — implement & re-enable
- [ ] 20. Monk — implement & re-enable

### Later (Low Priority / Polish)

- [ ] 8. Weather gameplay effects
- [ ] 9. Movement costs by terrain
- [ ] 10. Minimap navigation
- [ ] 12. Party management UI improvements
- [ ] 21. Sorcerer — implement & re-enable
- [ ] 22. Warlock — implement & re-enable
- [ ] 23. Wizard — implement & re-enable

---

## SUCCESS METRICS

**Technical Health:**

- [ ] Zero `// @ts-nocheck` suppressions
- [ ] All files <600 lines (OverworldScene.tsx is 1,960 — primary blocker)
- [x] ESLint/Prettier configured
- [ ] 60%+ unit test coverage on game logic
- [x] TypeScript strict mode configured (`tsconfig.json`)
- [x] CI/CD pipeline (Playwright E2E on push/PR)

**Gameplay Completeness:**

- [x] All core systems functional
- [x] Save/load implemented (reliability testing needed)
- [x] AI system (`src/game/ai/` — AIEngine + behavior trees)
- [x] Full turn-based combat UI (11 combat components)
- [ ] All 12 D&D 5e base classes implemented (Barbarian done; 11 classes in backlog #13-23)
- [x] Survival system (rations, foraging, exhaustion)

**Performance:**

- [ ] Canvas rendering optimized (dirty-flag redraw)
- [ ] 60fps combat canvas target
- [x] Code splitting (lazy scene loading)

---

## KNOWN ARCHITECTURE NOTES

- **No `CombatScene` file** — combat is an embedded rendering branch inside `OverworldScene.tsx` (triggered when `state.combatState?.battlefield` is truthy)
- **Water survival removed** — `SurvivalManager.ts` notes water system was deprecated; only rations remain
- **Playwright for E2E, nothing for unit tests** — `tests/qa-agent/` uses Playwright, not Vitest/Jest
- **`src/scenes/` and `src/ui/` are empty** — scenes live in `src/components/scenes/`, UI in `src/components/ui/`
- **AGENTS.md is outdated** — references `.jsx`/`.js` and `Character.js`, but codebase is fully `.ts`/`.tsx`

---

**Total Estimated Remaining Time:** 45-60 hours
**Timeline:** 3-4 weeks part-time
**Status:** Solid foundation, primary work is quality/refactor
