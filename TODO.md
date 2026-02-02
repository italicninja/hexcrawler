# Hexcrawler - Consolidated TODO

**Last Updated:** January 17, 2026  
**Current Completeness:** ~85% (Core gameplay complete)  
**Focus:** Technical debt cleanup + remaining features

---

## 🚨 CRITICAL - Must Do Immediately

### 1. Delete Dead Code ⚠️ BLOCKING
**Priority:** 🔴 Highest | **Time:** 2 hours

**File:** `src/contexts/GameStateContext.jsx`

**Task:**
- Delete lines 178-1298 (legacy monolithic reducer - 1,120 lines)
- Already replaced by modular reducers in `src/contexts/reducers/`
- Remove unused imports

**Validation:**
```bash
npm run dev
# Test: New game, movement, combat, shops, quests, save/load
```

**Commit:** `refactor: Remove legacy monolithic reducer (1120 lines)`

---

### 2. Delete Backup Files
**Priority:** 🟡 Medium | **Time:** 15 minutes

**Files to Delete:**
- `src/contexts/GameStateContext.jsx.backup`
- `src/contexts/GameStateContext.jsx.bak2`

**Update `.gitignore`:**
```gitignore
# Backup files
*.backup
*.bak
*.bak2
*.old
*~
```

**Commit:** `chore: Remove backup files and update .gitignore`

---

### 3. Test Save/Load System ⚠️ CRITICAL
**Priority:** 🔴 Highest | **Time:** 2 hours

**Why Critical:** Data corruption = lost progress

**Test Cases:**
- [ ] Save to slots 1-3
- [ ] Load from each slot
- [ ] Auto-save triggers on state changes
- [ ] Save metadata displays correctly
- [ ] Playtime increments
- [ ] Delete save slot
- [ ] Version mismatch handling
- [ ] localStorage quota exceeded
- [ ] Complex object serialization (Character, Party, Combat)
- [ ] Set reconstruction (exploredHexes, discoveredPOIs)

**Edge Cases:**
- Save during combat
- Save in interior/dungeon
- Save with full inventory
- Character at max level
- Character dead/unconscious

---

## 🔧 TECHNICAL DEBT - Code Quality

### 4. Add ESLint + Prettier
**Priority:** 🔴 High | **Time:** 3 hours

**Install:**
```bash
npm install -D eslint @eslint/js eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-refresh prettier eslint-config-prettier
```

**Create `.eslintrc.cjs`:**
```javascript
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'prettier'
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'react/prop-types': 'warn',
    'no-unused-vars': 'warn',
    'no-console': 'off'
  },
}
```

**Create `.prettierrc`:**
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "avoid"
}
```

**Add to `package.json`:**
```json
{
  "scripts": {
    "lint": "eslint src --ext .js,.jsx,.ts,.tsx --max-warnings 0",
    "lint:fix": "eslint src --ext .js,.jsx,.ts,.tsx --fix",
    "format": "prettier --write 'src/**/*.{js,jsx,ts,tsx,css,md}'",
    "format:check": "prettier --check 'src/**/*.{js,jsx,ts,tsx,css,md}'"
  }
}
```

**Steps:**
1. Install dependencies
2. Create config files
3. Run `npm run format` (auto-fix)
4. Run `npm run lint` (review warnings)
5. Commit: `chore: Add ESLint and Prettier`

---

### 5. Add Git Hooks (Pre-commit)
**Priority:** 🟢 Low | **Time:** 1 hour

**Install:**
```bash
npm install -D husky lint-staged
npx husky init
```

**Create `.husky/pre-commit`:**
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

**Add to `package.json`:**
```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{css,md}": ["prettier --write"]
  }
}
```

**Commit:** `chore: Add pre-commit hooks`

---

### 6. Split Large Files
**Priority:** 🔴 High | **Time:** 16-20 hours

#### 6.1: Split OverworldScene.jsx (1,648 → 400 lines)
**Time:** 8-10 hours

**New Structure:**
```
src/components/scenes/
├── OverworldScene.jsx (400 lines) - Overworld hex grid only
├── InteriorScene.jsx (400 lines) - Interior exploration
├── CombatSceneWrapper.jsx (200 lines) - Combat scene container
└── SceneManager.jsx (150 lines) - Scene routing

src/hooks/
├── useOverworldLogic.js (150 lines)
├── useInteriorLogic.js (150 lines)
└── useSceneTransitions.js (100 lines)
```

**Steps:**
1. Extract InteriorScene
2. Extract CombatSceneWrapper
3. Extract SceneManager
4. Cleanup OverworldScene

**Commits:**
- `refactor: Extract InteriorScene from OverworldScene`
- `refactor: Extract CombatSceneWrapper from OverworldScene`
- `refactor: Extract SceneManager for scene routing`
- `refactor: Cleanup OverworldScene (1648 → ~400 lines)`

#### 6.2: Split CombatScene.jsx (1,218 → 400 lines)
**Time:** 8-10 hours

**New Structure:**
```
src/components/scenes/
├── CombatScene.jsx (400 lines)
└── combat/
    ├── CombatController.jsx (300 lines)
    ├── CombatUI.jsx (300 lines)
    └── CombatEventHandler.jsx (200 lines)

src/hooks/
└── useCombatState.js (200 lines)
```

**Steps:**
1. Extract CombatController
2. Extract CombatUI
3. Extract CombatEventHandler
4. Cleanup CombatScene

**Commits:**
- `refactor: Extract CombatController from CombatScene`
- `refactor: Extract CombatUI from CombatScene`
- `refactor: Extract CombatEventHandler from CombatScene`
- `refactor: Cleanup CombatScene (1218 → ~400 lines)`

#### 6.3: Audit Combat.js (1,010 lines)
**Time:** 2 hours

**Task:**
- Search for legacy auto-combat references
- Determine if lines 63-505 are still used
- If unused: Delete legacy code
- If used: Split into `LegacyCombat.js` and `TacticalCombat.js`

**Check:**
```bash
grep -r "autoResolveCombat" src/
grep -r "processAutoTurn" src/
```

**Commit:** `refactor: Remove/split legacy combat code`

---

## 🧪 TESTING & QUALITY

### 7. Add Vitest Unit Testing
**Priority:** 🔴 High | **Time:** 6-8 hours

**Install:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Create `vitest.config.js`:**
```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', '*.config.js', 'src/main.jsx']
    }
  }
});
```

**Create `tests/setup.js`:**
```javascript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);
afterEach(() => cleanup());
```

**Priority Test Files:**
1. `tests/game/DiceRoller.test.js`
2. `tests/game/Character.test.js`
3. `tests/utils/hexMath.test.js`
4. `tests/utils/HexGrid.test.js`
5. `tests/contexts/reducers/gameReducer.test.js`

**Add to `package.json`:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

**Goal:** 60%+ coverage on core game logic

**Commit:** `test: Add Vitest and initial unit tests`

---

### 8. Enable TypeScript Strict Mode
**Priority:** 🟡 Medium | **Time:** 4-6 hours

**Current Status:** 40% migrated (infrastructure complete)

**Update `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

**Steps:**
1. Enable `"strict": true`
2. Run `npm run typecheck`
3. Fix errors incrementally (utils → game → components)
4. Add `// @ts-expect-error` for unavoidable errors

**Commit:** `chore: Enable TypeScript strict mode`

---

### 9. Add CI/CD Pipeline
**Priority:** 🟡 Medium | **Time:** 3-4 hours

**Create `.github/workflows/ci.yml`:**
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run format:check
      - run: npm run test -- --run
      - run: npm run build
```

**Commit:** `ci: Add CI/CD pipeline`

---

## 🎮 GAMEPLAY FEATURES

### 10. Rations & Water System
**Priority:** 🟡 Medium | **Time:** 4-6 hours | **Depends:** Item System

**Files to Create:**
- `src/game/SurvivalManager.js`

**Files to Modify:**
- `src/game/Character.js` - Add `rations`, `water`, `daysWithoutFood`, `daysWithoutWater`
- `src/contexts/reducers/characterReducer.ts` - Add `CONSUME_RATIONS`, `CONSUME_WATER`, `FORAGE`, `FIND_WATER`
- `src/components/ui/CharacterStats.jsx` - Show rations/water count
- `src/components/scenes/OverworldScene.jsx` - Add Forage/Find Water buttons

**Features:**
- Consume 1 ration + 1 water per long rest
- Starvation/dehydration tracking (exhaustion levels)
- Foraging with Survival checks
- Find water in appropriate terrain

**Commit:** `feat: Add rations and water survival system`

---

### 11. Party AI for Combat
**Priority:** 🟡 Medium | **Time:** 6-8 hours | **Depends:** Combat System, NPC Generation

**Files to Create:**
- `src/game/CombatAI.js`

**Files to Modify:**
- `src/game/Combat.js` - Integrate NPC AI into turn order

**Features:**
- AI selects targets (Warriors: lowest HP, Healers: heal <50% allies, Ranged: distance attacks)
- NPCs act automatically during their turn
- NPC death handling
- Actions logged to combat log

**Commit:** `feat: Add party AI for combat`

---

### 12. Party Management UI
**Priority:** 🟢 Low | **Time:** 2-3 hours | **Depends:** NPC Generation

**Files to Modify:**
- `src/components/ui/PartyList.jsx`

**Features:**
- Expandable NPC entries
- Full stat block when expanded
- Equipment and inventory view
- Personality and background display
- Party stats summary (total HP, average level, composition)

**Commit:** `feat: Add party management UI`

---

### 13. Full Combat UI (Replace Auto-Resolve)
**Priority:** 🟡 Medium | **Time:** 16-20 hours | **Depends:** Combat System

**Status:** Currently uses auto-resolve. Combat scene exists but UI incomplete.

**Files to Create:**
- `src/components/scenes/CombatScene.jsx` (refactor existing)

**Features:**
- Turn-based tactical combat interface
- Initiative tracker
- Action selection (Attack, Defend, Use Item, Flee)
- Target selection
- Combat log
- Turn order display
- Action animations (optional)

**Commit:** `feat: Implement full combat UI`

---

### 14. Additional Character Classes
**Priority:** 🟢 Low | **Time:** 6-8 hours each

**Current Status:** Only Paladin implemented

**Classes to Add:**
1. Fighter (Action Surge, Second Wind)
2. Wizard (Spell system, spellbook)
3. Rogue (Sneak Attack, Cunning Action)
4. Cleric (Healing spells, Channel Divinity)

**Files to Modify:**
- `src/game/Character.js`
- `src/components/scenes/TitleScene.jsx`

**Commits:**
- `feat: Add Fighter class`
- `feat: Add Wizard class and spell system`
- `feat: Add Rogue class`
- `feat: Add Cleric class`

---

## ⚡ PERFORMANCE & POLISH

### 15. Code Splitting (Lazy Loading)
**Priority:** 🔴 High | **Time:** 4-6 hours

**Update `src/App.jsx`:**
```javascript
import { lazy, Suspense } from 'react';

const TitleScene = lazy(() => import('./components/scenes/TitleScene'));
const OverworldScene = lazy(() => import('./components/scenes/OverworldScene'));
const CombatScene = lazy(() => import('./components/scenes/CombatScene'));

function LoadingScreen() {
  return <div className="loading-screen">Loading...</div>;
}

function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      {/* Scene rendering */}
    </Suspense>
  );
}
```

**Expected:** 30-40% reduction in initial bundle size

**Commit:** `perf: Add code splitting for scenes`

---

### 16. Canvas Rendering Optimization
**Priority:** 🟡 Medium | **Time:** 4-5 hours

**Files to Optimize:**
- `src/components/canvas/HexGridCanvas.jsx`
- `src/components/canvas/CombatCanvas.jsx`
- `src/components/canvas/InteriorHexCanvas.jsx`

**Optimizations:**
1. Cache hex positions
2. Debounce canvas redraws (~60fps)
3. Memoize texture generator
4. Only redraw changed hexes

**Commit:** `perf: Optimize canvas rendering`

---

### 17. Upgrade Dependencies
**Priority:** 🟢 Low | **Time:** 3-4 hours

**Major Upgrades Available:**
- Vite: 5.4.21 → 7.3.1
- @vitejs/plugin-react: 4.7.0 → 5.1.2

**Note:** Defer Tailwind CSS upgrade (v4 has breaking changes)

**Steps:**
1. Create branch: `feat/upgrade-vite-v7`
2. Upgrade Vite and plugin-react
3. Update `vite.config.js` if needed
4. Test dev server and production build
5. Run full test suite

**Commit:** `chore: Upgrade Vite to v7`

---

## 🎯 ADVANCED FEATURES (Lower Priority)

### 18. Movement Costs by Terrain
**Priority:** 🟢 Low | **Time:** 3-4 hours

**Files to Modify:**
- `src/contexts/reducers/gameReducer.ts`
- `src/terrainGenerator.js`

**Features:**
- Water: 3 movement (boats needed)
- Mountains: 2 movement
- Hills/Forest: 1.5 movement
- Grassland/Desert: 1 movement
- Road: 0.5 movement
- Travel pace (Slow/Normal/Fast)

**Commit:** `feat: Add terrain-based movement costs`

---

### 19. Weather Effects on Gameplay
**Priority:** 🟢 Low | **Time:** 2-3 hours

**Files to Modify:**
- `src/contexts/reducers/gameReducer.ts`
- `src/terrainGenerator.js`

**Features:**
- Rain: ranged attack disadvantage, double movement cost
- Snow: difficult terrain, cold damage
- Fog: reduced vision
- Storm: no long rest, lightning damage

**Commit:** `feat: Add weather gameplay effects`

---

### 20. Minimap & Navigation
**Priority:** 🟢 Low | **Time:** 4-5 hours

**Files to Create:**
- `src/components/ui/Minimap.jsx`

**Features:**
- Small canvas showing explored area
- Player position marker
- POI markers
- Fog of war
- Click to navigate

**Commit:** `feat: Add minimap navigation`

---

### 21. Status Effects & Conditions
**Priority:** 🟡 Medium | **Time:** 8-10 hours

**Files to Create:**
- `src/game/StatusEffect.js`

**Files to Modify:**
- `src/game/Character.js`
- `src/game/Enemy.js`
- `src/game/Combat.js`

**Features:**
- D&D 5e conditions (blinded, charmed, frightened, poisoned, etc.)
- Duration tracking
- Effect application (disadvantage, speed reduction)
- Visual indicators

**Commit:** `feat: Add D&D 5e status effects and conditions`

---

## 📋 EXECUTION CHECKLIST

### Pre-Work
- [ ] Review consolidated TODO
- [ ] Create feature branch: `git checkout -b refactor/cleanup`
- [ ] Backup: `git tag pre-cleanup-backup`

### Phase 1: Critical Cleanup (Week 1)
- [ ] 1. Delete dead code (GameStateContext.jsx)
- [ ] 2. Delete backup files
- [ ] 3. Test save/load system
- [ ] 4. Add ESLint + Prettier
- [ ] 5. Add Git hooks

### Phase 2: Code Quality (Weeks 2-3)
- [ ] 6. Split OverworldScene
- [ ] 6. Split CombatScene
- [ ] 6. Audit Combat.js
- [ ] 7. Add Vitest testing (60%+ coverage)
- [ ] 8. Enable TypeScript strict mode
- [ ] 9. Add CI/CD pipeline

### Phase 3: Remaining Features (Weeks 4-5)
- [ ] 10. Rations & Water System
- [ ] 11. Party AI for Combat
- [ ] 12. Party Management UI
- [ ] 13. Full Combat UI
- [ ] 14. Additional Character Classes

### Phase 4: Performance (Week 6)
- [ ] 15. Code Splitting
- [ ] 16. Canvas Optimization
- [ ] 17. Upgrade Dependencies

### Phase 5: Polish (Optional)
- [ ] 18. Movement Costs
- [ ] 19. Weather Effects
- [ ] 20. Minimap
- [ ] 21. Status Effects

---

## 📊 SUCCESS METRICS

**Technical Health:**
- ✅ Zero dead code
- ✅ All files <600 lines
- ✅ ESLint/Prettier passing
- ✅ 60%+ test coverage
- ✅ TypeScript strict mode
- ✅ CI/CD green

**Gameplay Completeness:**
- ✅ All core systems functional
- ✅ Save/load reliable
- ✅ Party AI working
- ✅ Full combat UI
- ✅ All 5 base classes

**Performance:**
- ✅ <100KB initial bundle (gzipped)
- ✅ 60fps canvas rendering
- ✅ <1s load time

---

## 🎯 PRIORITY SUMMARY

**MUST DO (This Week):**
1. Delete dead code (2 hrs)
2. Test save/load (2 hrs)
3. Add ESLint + Prettier (3 hrs)
4. Split large files (16-20 hrs)

**SHOULD DO (Next 2 Weeks):**
- Add unit tests (6-8 hrs)
- TypeScript strict mode (4-6 hrs)
- CI/CD pipeline (3-4 hrs)
- Rations & Water (4-6 hrs)
- Party AI (6-8 hrs)

**NICE TO HAVE (Later):**
- Full combat UI
- Additional classes
- Performance optimization
- Advanced features

---

**Total Estimated Time:** 80-100 hours  
**Timeline:** 6-8 weeks part-time  
**Status:** Ready for execution ✅
