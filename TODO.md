# Hexcrawler - Consolidated TODO

**Last Updated:** June 12, 2026
**Current Completeness:** ~93% (Core gameplay complete, quality infrastructure done)
**Focus:** Class implementations (#13-23) + remaining polish

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

**Priority:** High | **Time:** 8-12 hours | **Status:** ✅ COMPLETE — 0 of 100 files carry `@ts-nocheck`; `tsc --noEmit` passes clean and all 269 tests pass.

**Problem (resolved):** `tsconfig.json` has `strict: true` enabled, but every source file began with `// @ts-nocheck`, which completely bypassed TypeScript checking. The TypeScript migration was structurally complete but type safety was not enforced. It now is — every file is type-checked under strict mode.

**Scope:** `App.tsx`, `OverworldScene.tsx`, `Combat.ts`, all `ai/` files, most `hooks/`, `contexts/reducers/` files, canvas components.

**Approach:**

1. Remove `// @ts-nocheck` one file at a time, starting with smallest/simplest files
2. Run `npm run typecheck` after each removal
3. Fix errors before moving to the next file
4. Recommended order: `utils/` → `game/` pure classes → `contexts/reducers/` → `hooks/` → `components/`

**Commit pattern:** `chore: Remove @ts-nocheck from [filename], fix type errors`

**Done so far (v0.7.x):** Pure/leaf game + utils modules — `DiceRoller`, `LineOfSight`, `Spell`, `Character` (keystone — its fields were leaking 22 errors into already-checked reducers), `OpportunityAttack`, `Pathfinding`, `EncounterPositions`, `HazardGenerator`, `Enemy`, `Party`, `SpellManager`, `TreasureGenerator`, `QuestGenerator` (+ `Quest`), `NPCGenerator`, `Shop`, `LootGenerator`, and `utils/regionDebug`. Typecheck holds at **0 errors** after every removal.

Bugs surfaced and fixed along the way: `Character.gainXP()` → `awardXP()` (3 reducers, would `TypeError` on every XP award); missing `logger` import in `inventoryReducer`; dead `CONSUME_WATER`/`FIND_WATER` reducer cases referencing the removed `water` field; quest difficulty `level` silently dropped because `QuestConfig` had no `level` field; `DiceRoller`'s `LogCallback` typed `type?: string` instead of `LogMessageType` (blocked every `addMessage`→`DiceRoller` call site); a latent `isTown` `ReferenceError` in `HexDetails`' dead quest-giver modal (out-of-scope closure var); and ~150 lines of dead/unreachable code removed (`HexDetails` quest-giver + shop modals, `useHexInteraction.handleStairTransition` superseded by `OverworldScene`).

**Type debt to reconcile:** `state.activeQuests`/`completedQuests`/etc. are typed with the lightweight `game/game.ts` `Quest` interface, but at runtime hold `game/Quest.ts` `Quest` **class** instances (methods + `QuestObjective[]`). `QuestLog` casts at the boundary (`as unknown as Quest[]`); reconcile by switching the state types to the class when the quest reducers are migrated.

**Remaining:** none — the migration is complete across all 100 files.

---

### 2. Test Save/Load System

**Priority:** High | **Time:** 2 hours | **Status:** ✅ COMPLETE — `tests/utils/SaveManager.test.ts` (32 tests) covers slot round-trips, slot independence/deletion, version mismatch, corrupt JSON, QuotaExceededError, metadata, quicksave rotation, and the full save→load→`LOAD_GAME` reconstruction pipeline (Sets/Maps/Character/Party/Quest/Shop instances, combat/interior reset on load).

Found & fixed along the way: `LOAD_GAME`'s "don't restore combat" comment only nulled the (dead) legacy combat fields — loading a save mid-combat kept the stale combat overlay. It now resets `combatState`/`combatLog` like `NEW_GAME` does.

---

## TECHNICAL DEBT

### 3. Split OverworldScene.tsx

**Priority:** High | **Time:** 12-16 hours | **Status:** ✅ COMPLETE — `OverworldScene.tsx` went from 2,317 to **553 lines** across four verified steps:

| Extracted | File |
| --- | --- |
| Combat orchestration (victory/defeat, initiative log, AI turn system, combat handlers) | `hooks/useCombatOrchestration.ts` |
| Combat render branches (battlefield canvas + action/turn-order panel) | `components/scenes/CombatSceneWrapper.tsx` (`CombatCanvasPane`/`CombatActionPane`) |
| Interior navigation (map resolution, stairs/loot/lazy floors, buildings) | `hooks/useInteriorNavigation.ts` |
| Overworld movement, foraging, POI combat engagement | `hooks/useOverworldActions.ts` |
| Keyboard routing + F5 quicksave | `hooks/useOverworldInput.ts` |

Deviation from the original plan: no separate `InteriorScene.tsx` — interior logic went to a hook and the two small interior render branches stayed inline; the orchestration hook is instantiated once in OverworldScene so its effects stay mounted scene-wide (zero behavior change). Shared scene types live in `types/scene.ts`.

---

### 4. Add Vitest Unit Testing

**Priority:** High | **Time:** 6-8 hours | **Status:** ✅ Framework + core suites COMPLETE — 12 test files, 368 tests, all green and gating CI: DiceRoller, Character, SurvivalManager, hexMath, HexGrid, **Combat (65 tests)**, **SaveManager (32 tests)**, character/inventory reducers, and three combat UI components.

**Remaining (open):** the 60%+ coverage goal on `src/game/`/`src/utils/` is not met yet. Untested high-value targets, roughly in priority order: `Enemy.ts`, `Quest.ts`/`QuestGenerator`, `Pathfinding.ts`, `LineOfSight.ts`, `OpportunityAttack.ts`, the terrain/interior generators, `combatReducer` direct cases beyond action economy.

---

### 5. Add Git Pre-commit Hooks

**Priority:** Low | **Time:** 1 hour

**Blocker resolved:** ESLint has been migrated to v9 flat config (`eslint.config.js`, typescript-eslint installed) and `npm run lint` passes with `--max-warnings 0`. Lint also runs in CI's `checks` job. Baseline notes: the React-Compiler-era react-hooks rules (`static-components`, `immutability`, `purity`, `set-state-in-effect`) and `exhaustive-deps` are OFF with documented rationale in the config — re-enable them incrementally as components are refactored. Loose-`any` boundaries use file-level disables (SurvivalManager, RestManager, EnemyMovement, Combat, combatReducer, SaveManager, generators).

ESLint and Prettier are installed and CI-enforced, but not enforced at commit time.

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

## KNOWN COMBAT-LAYER BUGS (dormant, found while writing Combat.test.ts)

These don't bite today because the live combat path goes through `combatReducer`'s
turn-order shape and OverworldScene's XP path, but they will bite when enemy AI
gains abilities/spells or when `Combat`'s own helpers are reused:

- [ ] **Null-deref on enemy combatants** — reducer-built turn-order entries have `character: null` for enemies (`combatReducer.ts:131`), but `Combat.processAbility` (`Combat.ts:1088`, `1095`), `processSpell` (`Combat.ts:1144`), `processDodge` (`Combat.ts:1206`), and `processDash` (`Combat.ts:1227`) dereference `combatant.character.…` unguarded → TypeError if an enemy ever uses these actions.
- [ ] **Constructor-built combatant shape mismatch** — `Combat`'s constructor stores the Enemy instance as `character` on enemy combatants (`Combat.ts:145-153`), but `processAttack` distinguishes enemies via `.enemy` (`Combat.ts:747`). Only works today because the reducer overwrites `combat.turnOrder` with its own shape.
- [ ] **`combat.enemies` overwritten with non-Enemy objects** — `combatReducer.ts:179` replaces `combat.enemies` with turn-order entries lacking `.cr`, so `Combat._calculateXP()` and `getAverageCR()` silently return 0/NaN after combat starts (live XP path in OverworldScene uses `getXPForCR` instead, so no player impact yet).
- [ ] **`Enemy.isDead` flag never set by `processAttack`** — it writes `currentHP` directly (`Combat.ts:799-803`) instead of calling `takeDamage()`; `checkIsDead()` still works via `currentHP <= 0`, but the persisted `isDead` flag stays false (affects `Enemy.toJSON()`/saves).

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

**Note:** The `// TODO: Add proper TypeScript types` migration markers have all been removed — item #1 (Remove `@ts-nocheck`) is complete and every file is type-checked under strict mode.

---

## EXECUTION CHECKLIST

### Now (High Priority)

- [x] 1. Remove `// @ts-nocheck` suppressions (file by file) — DONE, 0 remain
- [x] 2. Test save/load system thoroughly — DONE, 32 unit tests
- [x] 3. Split OverworldScene.tsx — DONE, 2,317 → 553 lines
- [x] 4. Add Vitest unit testing — DONE (368 tests in CI; 60% coverage goal still open)
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

- [x] Zero `// @ts-nocheck` suppressions
- [ ] All files <600 lines (OverworldScene done at 553; remaining >1,000: SpellList 1,899, Combat 1,366, CombatCanvas 1,312, Character 1,239, combatReducer 1,076, GameTableData 1,062 — mostly data-heavy, lower priority)
- [x] ESLint/Prettier configured — flat config, `npm run lint` passes, CI-enforced
- [ ] 60%+ unit test coverage on game logic (368 tests; core systems covered, generators/Enemy/Quest still open)
- [x] TypeScript strict mode configured (`tsconfig.json`)
- [x] CI/CD pipeline (typecheck + lint + unit tests gate the Playwright E2E matrix)

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

- **Combat is an overlay, not a route** — triggered when `state.combatState?.battlefield` is truthy; rendered via `CombatSceneWrapper.tsx` panes, orchestrated by `hooks/useCombatOrchestration.ts` (instantiated once in `OverworldScene`)
- **QA agent creates a Barbarian** — the only enabled class (`DISABLED_CLASSES` gates the rest); update `tests/qa-agent/config.js` when more classes ship
- **Water survival removed** — `SurvivalManager.ts` notes water system was deprecated; only rations remain
- **Playwright for E2E (`tests/qa-agent/`), Vitest for unit tests (`tests/**/*.test.ts`)** — both run in CI (`qa-tests.yml`: `checks` job runs typecheck/lint/unit, then the browser matrix)

---

**Total Estimated Remaining Time:** 45-60 hours
**Timeline:** 3-4 weeks part-time
**Status:** Solid foundation, primary work is quality/refactor
