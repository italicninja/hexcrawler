# Hexcrawler Refactoring & Improvement Plan

**Created**: January 16, 2026  
**Status**: Planning Phase  
**Estimated Timeline**: 4-6 weeks

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Phase 1: Critical Cleanup](#phase-1-critical-cleanup-week-1)
3. [Phase 2: Architecture Refactoring](#phase-2-architecture-refactoring-weeks-2-3)
4. [Phase 3: Tooling & Quality](#phase-3-tooling--quality-week-4)
5. [Phase 4: Performance & Polish](#phase-4-performance--polish-weeks-5-6)
6. [Execution Checklist](#execution-checklist)
7. [Risk Mitigation](#risk-mitigation)

---

## Overview

### Goals
- **Reduce technical debt** by eliminating 1,120+ lines of dead code
- **Improve maintainability** by splitting monolithic files (1,000+ lines → 300-500 lines)
- **Enhance developer experience** with linting, formatting, and type safety
- **Increase code quality** with testing infrastructure
- **Optimize performance** with code splitting and memoization

### Success Metrics
- ✅ All files <600 lines (target: <500)
- ✅ TypeScript strict mode enabled
- ✅ 60%+ test coverage for core game logic
- ✅ ESLint + Prettier configured and passing
- ✅ CI/CD pipeline running on all PRs

---

## Phase 1: Critical Cleanup (Week 1)

**Goal**: Remove dead code, add essential tooling, prevent regressions

### Task 1.1: Delete Dead Code ⚠️ CRITICAL
**Priority**: 🔴 Highest  
**Estimated Time**: 2 hours

**Files to Modify**:
- `src/contexts/GameStateContext.jsx`

**Steps**:
1. ✅ Verify `combinedReducer` (line 173) is actively used
2. ✅ Confirm all action types are handled in modular reducers (`contexts/reducers/`)
3. ✅ Delete lines 178-1298 (legacy monolithic reducer)
4. ✅ Remove unused imports from legacy reducer
5. ✅ Test all game actions (movement, combat, rest, shop, quests)
6. ✅ Commit: `refactor: Remove legacy monolithic reducer (1120 lines)`

**Validation**:
```bash
npm run dev
# Test all major features:
# - New game creation
# - Movement and exploration
# - Combat system
# - Shop interactions
# - Quest acceptance
# - Save/load functionality
```

---

### Task 1.2: Delete Backup Files
**Priority**: 🟡 Medium  
**Estimated Time**: 15 minutes

**Files to Delete**:
- `src/contexts/GameStateContext.jsx.backup`
- `src/contexts/GameStateContext.jsx.bak2`

**Steps**:
1. ✅ Verify files are not referenced anywhere
2. ✅ Delete backup files
3. ✅ Update `.gitignore` to prevent future backups:
   ```gitignore
   # Backup files
   *.backup
   *.bak
   *.bak2
   *.old
   *~
   ```
4. ✅ Commit: `chore: Remove backup files and update .gitignore`

---

### Task 1.3: Add ESLint + Prettier
**Priority**: 🔴 High  
**Estimated Time**: 3 hours

**Dependencies to Install**:
```bash
npm install -D eslint @eslint/js eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-refresh prettier eslint-config-prettier
```

**Files to Create**:

**`.eslintrc.cjs`**:
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
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'react/prop-types': 'warn',
    'no-unused-vars': 'warn',
    'no-console': 'off' // Allow console in dev (logger handles production)
  },
}
```

**`.prettierrc`**:
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

**`.prettierignore`**:
```
node_modules
dist
build
coverage
*.log
```

**Update `package.json` scripts**:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext .js,.jsx,.ts,.tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint src --ext .js,.jsx,.ts,.tsx --fix",
    "format": "prettier --write 'src/**/*.{js,jsx,ts,tsx,css,md}'",
    "format:check": "prettier --check 'src/**/*.{js,jsx,ts,tsx,css,md}'",
    "typecheck": "tsc --noEmit"
  }
}
```

**Steps**:
1. ✅ Install dependencies
2. ✅ Create config files (`.eslintrc.cjs`, `.prettierrc`, `.prettierignore`)
3. ✅ Run `npm run format` (auto-fix formatting issues)
4. ✅ Run `npm run lint` (review warnings, fix critical issues)
5. ✅ Commit: `chore: Add ESLint and Prettier configuration`

**Expected Warnings**: 50-100 warnings initially (unused vars, PropTypes, etc.) - fix incrementally

---

### Task 1.4: Enable TypeScript Strict Mode (Gradual)
**Priority**: 🟡 Medium  
**Estimated Time**: 2 hours

**Update `tsconfig.json`**:
```json
{
  "compilerOptions": {
    "strict": false,  // Keep false initially
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,  // NEW: Safer array/object access
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

**Steps**:
1. ✅ Update `tsconfig.json` with safer options (not full strict yet)
2. ✅ Run `npm run typecheck` - fix any new errors
3. ✅ Commit: `chore: Enable stricter TypeScript checks`
4. 📋 Plan full strict mode migration for Phase 3

**Note**: Full `"strict": true` will be enabled in Phase 3 after file splitting

---

### Task 1.5: Add Git Hooks (Pre-commit)
**Priority**: 🟢 Low  
**Estimated Time**: 1 hour

**Dependencies**:
```bash
npm install -D husky lint-staged
npx husky init
```

**`.husky/pre-commit`**:
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

**`package.json` addition**:
```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{css,md}": [
      "prettier --write"
    ]
  }
}
```

**Steps**:
1. ✅ Install husky and lint-staged
2. ✅ Create pre-commit hook
3. ✅ Test: Make a small change and commit (should auto-lint)
4. ✅ Commit: `chore: Add pre-commit hooks for linting and formatting`

---

## Phase 2: Architecture Refactoring (Weeks 2-3)

**Goal**: Split monolithic files, improve modularity, reduce coupling

### Task 2.1: Split OverworldScene.jsx (1,648 → 400 lines)
**Priority**: 🔴 Critical  
**Estimated Time**: 8-10 hours

**Current Issues**:
- Handles 3 scene types (overworld, interior, combat)
- 47 imports
- Mixed responsibilities (rendering, state, event handling)

**New File Structure**:
```
src/components/scenes/
├── OverworldScene.jsx (400 lines) - Overworld hex grid only
├── InteriorScene.jsx (400 lines) - Interior exploration
├── CombatSceneWrapper.jsx (200 lines) - Combat scene container
└── SceneManager.jsx (150 lines) - Scene routing logic

src/hooks/
├── useOverworldLogic.js (150 lines) - Overworld-specific hooks
├── useInteriorLogic.js (150 lines) - Interior-specific hooks
└── useSceneTransitions.js (100 lines) - Scene switching logic
```

**Steps**:

**2.1.1: Extract InteriorScene**
1. ✅ Create `src/components/scenes/InteriorScene.jsx`
2. ✅ Move interior rendering logic from OverworldScene
3. ✅ Move interior-specific state and event handlers
4. ✅ Import InteriorHexCanvas, InteriorInfoPane
5. ✅ Test interior exploration (dungeon/POI entry)
6. ✅ Commit: `refactor: Extract InteriorScene from OverworldScene`

**2.1.2: Extract CombatSceneWrapper**
1. ✅ Create `src/components/scenes/CombatSceneWrapper.jsx`
2. ✅ Move combat initialization logic from OverworldScene
3. ✅ Render CombatScene component with props
4. ✅ Test combat entry from overworld and interior
5. ✅ Commit: `refactor: Extract CombatSceneWrapper from OverworldScene`

**2.1.3: Extract SceneManager**
1. ✅ Create `src/components/scenes/SceneManager.jsx`
2. ✅ Move scene routing logic (switch based on state.currentScene)
3. ✅ Handle scene transitions (overworld ↔ interior ↔ combat)
4. ✅ Update App.jsx to use SceneManager
5. ✅ Test all scene transitions
6. ✅ Commit: `refactor: Extract SceneManager for scene routing`

**2.1.4: Cleanup OverworldScene**
1. ✅ Remove interior and combat logic
2. ✅ Focus solely on overworld hex grid rendering
3. ✅ Reduce imports to <20
4. ✅ Extract custom hooks (useOverworldLogic)
5. ✅ Verify final line count <400
6. ✅ Commit: `refactor: Cleanup OverworldScene (1648 → ~400 lines)`

**Validation**:
```bash
# Test all scene transitions
npm run dev
# 1. New game → Overworld
# 2. Enter POI → Interior
# 3. Trigger encounter → Combat
# 4. Exit combat → Interior/Overworld
# 5. Exit interior → Overworld
```

---

### Task 2.2: Split CombatScene.jsx (1,218 → 400 lines)
**Priority**: 🔴 Critical  
**Estimated Time**: 8-10 hours

**Current Issues**:
- Mixed combat logic, UI, AI, and event handling
- 17 imports
- Complex state management with multiple hooks

**New File Structure**:
```
src/components/scenes/
├── CombatScene.jsx (400 lines) - Main combat scene coordinator
└── combat/
    ├── CombatController.jsx (300 lines) - Combat orchestration
    ├── CombatUI.jsx (300 lines) - Combat UI rendering
    └── CombatEventHandler.jsx (200 lines) - Action processing

src/hooks/
└── useCombatState.js (200 lines) - Combat state management
```

**Steps**:

**2.2.1: Extract CombatController**
1. ✅ Create `src/components/scenes/combat/CombatController.jsx`
2. ✅ Move combat turn management logic
3. ✅ Move AI processing logic (EnemyAI integration)
4. ✅ Export controller functions to CombatScene
5. ✅ Commit: `refactor: Extract CombatController from CombatScene`

**2.2.2: Extract CombatUI**
1. ✅ Create `src/components/scenes/combat/CombatUI.jsx`
2. ✅ Move rendering logic (ActionPanel, TurnOrder, CombatCanvas)
3. ✅ Move UI state (selected target, spell menu, ability menu)
4. ✅ Receive props from CombatScene
5. ✅ Commit: `refactor: Extract CombatUI from CombatScene`

**2.2.3: Extract CombatEventHandler**
1. ✅ Create `src/components/scenes/combat/CombatEventHandler.jsx`
2. ✅ Move action handlers (attack, spell, ability, movement)
3. ✅ Move keyboard event handlers
4. ✅ Move combat action validation
5. ✅ Commit: `refactor: Extract CombatEventHandler from CombatScene`

**2.2.4: Cleanup CombatScene**
1. ✅ Import CombatController, CombatUI, CombatEventHandler
2. ✅ Simplify to coordinator role (props passing, high-level logic)
3. ✅ Reduce imports to <15
4. ✅ Verify final line count <400
5. ✅ Commit: `refactor: Cleanup CombatScene (1218 → ~400 lines)`

**Validation**:
```bash
# Test combat system
npm run dev
# 1. Start combat (random encounter or POI)
# 2. Test player turn (move, attack, spell, ability)
# 3. Test enemy AI turn
# 4. Test turn order
# 5. Test combat end (victory/defeat)
```

---

### Task 2.3: Split Combat.js (1,010 → 500 lines)
**Priority**: 🟡 High  
**Estimated Time**: 6-8 hours

**Current Issues**:
- Lines 63-505: Legacy auto-combat (likely unused)
- Lines 544-1008: Hex-based tactical combat (active)
- Two combat systems in one file

**Decision Required**: 
- ❓ **Is legacy auto-combat still used?** (Check codebase references)
- If YES → Split into `LegacyCombat.js` and `TacticalCombat.js`
- If NO → Delete legacy code

**Steps**:

**2.3.1: Audit Legacy Combat Usage**
1. ✅ Search codebase for references to legacy combat methods
   ```bash
   grep -r "autoResolveCombat" src/
   grep -r "processAutoTurn" src/
   ```
2. ✅ Check if any POI or encounter uses auto-combat
3. ✅ Document findings in this plan

**2.3.2: Remove or Split Legacy Code**

**Option A: If Legacy Unused**
1. ✅ Delete lines 63-505 (legacy auto-combat)
2. ✅ Remove related imports and methods
3. ✅ Test tactical combat still works
4. ✅ Commit: `refactor: Remove unused legacy auto-combat system`

**Option B: If Legacy Used**
1. ✅ Create `src/game/LegacyCombat.js` (lines 63-505)
2. ✅ Create `src/game/TacticalCombat.js` (lines 544-1008)
3. ✅ Update Combat.js to import and delegate to appropriate system
4. ✅ Commit: `refactor: Split legacy and tactical combat systems`

**2.3.3: Cleanup Combat.js**
1. ✅ Verify final line count <600
2. ✅ Add JSDoc comments for public methods
3. ✅ Commit: `refactor: Cleanup Combat.js (~1010 → ~500 lines)`

---

### Task 2.4: Split Context Providers (Optional - Future)
**Priority**: 🟢 Low  
**Estimated Time**: 10-12 hours

**Goal**: Reduce re-renders by splitting monolithic GameStateContext

**Current Issue**:
- Every state change re-renders ALL consumers
- Moving one hex re-renders CharacterStats, PartyList, Equipment, etc.

**Proposed Structure**:
```
src/contexts/
├── GameStateContext.jsx (shared, rarely changes)
├── PlayerContext.jsx (player position, character)
├── MapContext.jsx (map data, explored hexes, regions)
├── CombatContext.jsx (combat state, turn order)
└── UIContext.jsx (menus, modals, settings)
```

**Note**: This is a **major refactor** - defer to Phase 4 or later sprint

---

## Phase 3: Tooling & Quality (Week 4)

**Goal**: Add testing, improve type safety, setup CI/CD

### Task 3.1: Add Vitest Unit Testing
**Priority**: 🔴 High  
**Estimated Time**: 6-8 hours

**Dependencies**:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Create `vitest.config.js`**:
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
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.js',
        'src/main.jsx'
      ]
    }
  }
});
```

**Create `tests/setup.js`**:
```javascript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
```

**Update `package.json` scripts**:
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

**Priority Test Files**:

**`tests/game/DiceRoller.test.js`** (Critical - core mechanic):
```javascript
import { describe, it, expect } from 'vitest';
import { DiceRoller } from '../../src/game/DiceRoller';

describe('DiceRoller', () => {
  it('should roll d20 within valid range', () => {
    const roller = new DiceRoller(12345);
    const roll = roller.rollD20();
    expect(roll).toBeGreaterThanOrEqual(1);
    expect(roll).toBeLessThanOrEqual(20);
  });

  it('should produce consistent rolls with same seed', () => {
    const roller1 = new DiceRoller(42);
    const roller2 = new DiceRoller(42);
    expect(roller1.rollD20()).toBe(roller2.rollD20());
  });

  it('should calculate skill check correctly', () => {
    const character = {
      abilities: { wisdom: 16 }, // +3 modifier
      proficiencyBonus: 2
    };
    const roller = new DiceRoller();
    const result = roller.skillCheck(character, 'wisdom', true, 15);
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('roll');
  });
});
```

**`tests/game/Character.test.js`**:
```javascript
import { describe, it, expect } from 'vitest';
import { Character } from '../../src/game/Character';

describe('Character', () => {
  it('should create character with default stats', () => {
    const char = new Character('TestHero', 'Fighter');
    expect(char.name).toBe('TestHero');
    expect(char.class).toBe('Fighter');
    expect(char.level).toBe(1);
  });

  it('should calculate ability modifiers correctly', () => {
    const char = new Character('Test', 'Fighter');
    char.abilities.strength = 16;
    expect(char.getAbilityModifier('strength')).toBe(3);
  });

  it('should handle damage correctly', () => {
    const char = new Character('Test', 'Fighter');
    const initialHP = char.currentHP;
    char.damage(10);
    expect(char.currentHP).toBe(initialHP - 10);
  });
});
```

**`tests/utils/hexMath.test.js`**:
```javascript
import { describe, it, expect } from 'vitest';
import { getHexDistance, isHexReachable } from '../../src/utils/hexMath';

describe('hexMath', () => {
  it('should calculate hex distance correctly', () => {
    expect(getHexDistance(0, 0, 1, 0)).toBe(1);
    expect(getHexDistance(0, 0, 0, 0)).toBe(0);
    expect(getHexDistance(0, 0, 2, 2)).toBe(4);
  });

  it('should determine hex reachability', () => {
    expect(isHexReachable(0, 0, 1, 0, 1)).toBe(true);
    expect(isHexReachable(0, 0, 3, 3, 2)).toBe(false);
  });
});
```

**Steps**:
1. ✅ Install Vitest and testing library
2. ✅ Create `vitest.config.js` and `tests/setup.js`
3. ✅ Write tests for DiceRoller, Character, hexMath
4. ✅ Run `npm run test` - verify all pass
5. ✅ Run `npm run test:coverage` - aim for 60%+ core logic
6. ✅ Commit: `test: Add Vitest and initial unit tests`

---

### Task 3.2: Enable TypeScript Strict Mode
**Priority**: 🟡 Medium  
**Estimated Time**: 4-6 hours

**Update `tsconfig.json`**:
```json
{
  "compilerOptions": {
    "strict": true,  // ENABLE STRICT MODE
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

**Steps**:
1. ✅ Enable `"strict": true` in `tsconfig.json`
2. ✅ Run `npm run typecheck` - expect 100+ errors initially
3. ✅ Fix errors incrementally (start with utils, then game logic, then components)
4. ✅ Add `// @ts-expect-error` with explanation for unavoidable errors
5. ✅ Commit: `chore: Enable TypeScript strict mode`

**Common Errors to Expect**:
- `Implicit 'any' type` - Add type annotations
- `Object is possibly 'null'` - Add null checks or `!` assertion
- `Property does not exist` - Fix typos or add optional chaining

---

### Task 3.3: Add CI/CD Pipeline
**Priority**: 🟡 Medium  
**Estimated Time**: 3-4 hours

**Create `.github/workflows/ci.yml`**:
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
    
    strategy:
      matrix:
        node-version: [20.x]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run TypeScript type checking
        run: npm run typecheck
      
      - name: Run ESLint
        run: npm run lint
      
      - name: Run Prettier check
        run: npm run format:check
      
      - name: Run unit tests
        run: npm run test -- --run
      
      - name: Build production bundle
        run: npm run build
      
      - name: Upload coverage reports
        if: success()
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage/coverage-final.json
          flags: unittests
          name: codecov-hexcrawler

  e2e-tests:
    runs-on: ubuntu-latest
    needs: build-and-test
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Run smoke tests
        run: npm run test:smoke
      
      - name: Run QA tests (headless)
        run: npm run test:qa:headless
```

**Steps**:
1. ✅ Create `.github/workflows/ci.yml`
2. ✅ Push to branch and verify CI runs
3. ✅ Fix any CI failures
4. ✅ Add status badge to README.md
5. ✅ Commit: `ci: Add comprehensive CI/CD pipeline`

---

### Task 3.4: Add Bundle Size Analysis
**Priority**: 🟢 Low  
**Estimated Time**: 1 hour

**Dependencies**:
```bash
npm install -D rollup-plugin-visualizer
```

**Update `vite.config.js`**:
```javascript
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: './dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true
    })
  ]
});
```

**Steps**:
1. ✅ Install rollup-plugin-visualizer
2. ✅ Update vite.config.js
3. ✅ Run `npm run build` - opens bundle analyzer
4. ✅ Review largest chunks (identify code splitting opportunities)
5. ✅ Commit: `chore: Add bundle size analysis tool`

---

## Phase 4: Performance & Polish (Weeks 5-6)

**Goal**: Optimize rendering, add code splitting, improve UX

### Task 4.1: Implement Code Splitting (Lazy Loading)
**Priority**: 🔴 High  
**Estimated Time**: 4-6 hours

**Update `src/App.jsx`**:
```javascript
import { lazy, Suspense } from 'react';

// Lazy load scenes
const TitleScene = lazy(() => import('./components/scenes/TitleScene'));
const OverworldScene = lazy(() => import('./components/scenes/OverworldScene'));
const CombatScene = lazy(() => import('./components/scenes/CombatScene'));
const TownScene = lazy(() => import('./components/scenes/TownScene'));
const CharacterCreationScene = lazy(() => import('./components/scenes/CharacterCreationScene'));

// Loading fallback
function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Loading...</p>
    </div>
  );
}

function App() {
  const { state } = useGameState();

  return (
    <Suspense fallback={<LoadingScreen />}>
      {state.currentScene === 'title' && <TitleScene />}
      {state.currentScene === 'character-creation' && <CharacterCreationScene />}
      {state.currentScene === 'overworld' && <OverworldScene />}
      {state.currentScene === 'combat' && <CombatScene />}
      {state.currentScene === 'town' && <TownScene />}
    </Suspense>
  );
}
```

**Steps**:
1. ✅ Convert scene imports to `lazy()`
2. ✅ Add `<Suspense>` wrapper with loading fallback
3. ✅ Test scene transitions (verify loading state shows)
4. ✅ Build and analyze bundle (verify code splitting worked)
5. ✅ Commit: `perf: Add code splitting for scenes`

**Expected Improvement**: 
- Initial bundle size reduction: ~30-40%
- Faster initial load time

---

### Task 4.2: Optimize Canvas Rendering
**Priority**: 🟡 Medium  
**Estimated Time**: 4-5 hours

**Files to Optimize**:
- `src/components/canvas/HexGridCanvas.jsx`
- `src/components/canvas/CombatCanvas.jsx`
- `src/components/canvas/InteriorHexCanvas.jsx`

**Optimizations**:

**4.2.1: Cache Hex Positions**
```javascript
// HexGridCanvas.jsx
const hexPositionCache = useRef(new Map());

const positionedHexes = useMemo(() => {
  return hexes.map(hex => {
    const key = `${hex.col},${hex.row}`;
    if (!hexPositionCache.current.has(key)) {
      const { x, y } = calculateHexPosition(hex.col, hex.row, hexSize);
      hexPositionCache.current.set(key, { ...hex, x, y });
    }
    return hexPositionCache.current.get(key);
  });
}, [hexes, hexSize]);
```

**4.2.2: Debounce Canvas Redraws**
```javascript
import { debounce } from 'lodash-es'; // or implement custom

const debouncedDraw = useMemo(
  () => debounce(draw, 16), // ~60fps
  [draw]
);

useEffect(() => {
  debouncedDraw();
  return () => debouncedDraw.cancel();
}, [playerPosition, selectedHex]);
```

**4.2.3: Memoize Texture Generator**
```javascript
const textureGenerator = useMemo(() => {
  const noise = new PerlinNoise(state.mapSeed || Date.now());
  return new HexTextureGenerator(noise);
}, [state.mapSeed]);
```

**Steps**:
1. ✅ Implement hex position caching
2. ✅ Add debounced canvas redraws
3. ✅ Memoize texture generator
4. ✅ Test rendering performance (should feel smoother)
5. ✅ Commit: `perf: Optimize canvas rendering with caching and debouncing`

---

### Task 4.3: Upgrade Dependencies
**Priority**: 🟢 Low  
**Estimated Time**: 3-4 hours

**Major Upgrades Available**:
- Vite: 5.4.21 → 7.3.1 (2 major versions)
- Tailwind CSS: 3.4.19 → 4.1.18 (breaking changes)
- @vitejs/plugin-react: 4.7.0 → 5.1.2

**Vite v7 Upgrade**:
```bash
npm install -D vite@latest @vitejs/plugin-react@latest
```

**Potential Issues**:
- Breaking changes in config format
- Plugin compatibility issues

**Steps**:
1. ✅ Create feature branch: `feat/upgrade-vite-v7`
2. ✅ Upgrade Vite and plugin-react
3. ✅ Update vite.config.js if needed
4. ✅ Test dev server: `npm run dev`
5. ✅ Test production build: `npm run build && npm run preview`
6. ✅ Run full test suite
7. ✅ Commit: `chore: Upgrade Vite to v7`

**Tailwind v4 Upgrade** (DEFER - breaking changes):
- Tailwind v4 is a complete rewrite
- Requires significant config changes
- Recommend deferring to separate sprint

---

### Task 4.4: Add Performance Monitoring
**Priority**: 🟢 Low  
**Estimated Time**: 2-3 hours

**Create `src/utils/performanceMonitor.js`**:
```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  start(label) {
    this.metrics.set(label, performance.now());
  }

  end(label) {
    const start = this.metrics.get(label);
    if (!start) return;
    
    const duration = performance.now() - start;
    this.metrics.delete(label);
    
    if (duration > 16) { // >16ms = <60fps
      console.warn(`[Performance] ${label} took ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }
}

export const perfMonitor = new PerformanceMonitor();
```

**Usage in Components**:
```javascript
import { perfMonitor } from '../../utils/performanceMonitor';

const draw = useCallback(() => {
  perfMonitor.start('hex-grid-draw');
  
  // ... drawing code ...
  
  perfMonitor.end('hex-grid-draw');
}, []);
```

**Steps**:
1. ✅ Create PerformanceMonitor utility
2. ✅ Add monitoring to canvas components
3. ✅ Add monitoring to expensive computations
4. ✅ Test and review console warnings
5. ✅ Commit: `perf: Add performance monitoring utility`

---

## Execution Checklist

### Pre-Work
- [ ] Create feature branch: `git checkout -b refactor/phase-1-cleanup`
- [ ] Backup current working state: `git tag pre-refactor-backup`
- [ ] Review this plan with team (if applicable)

### Phase 1: Critical Cleanup ✅
- [ ] Task 1.1: Delete dead code (GameStateContext lines 178-1298)
- [ ] Task 1.2: Delete backup files
- [ ] Task 1.3: Add ESLint + Prettier
- [ ] Task 1.4: Enable TypeScript strict checks (gradual)
- [ ] Task 1.5: Add Git hooks (pre-commit)
- [ ] Merge to main: Create PR, review, merge

### Phase 2: Architecture Refactoring 🔄
- [ ] Task 2.1: Split OverworldScene.jsx (1,648 → 400 lines)
  - [ ] 2.1.1: Extract InteriorScene
  - [ ] 2.1.2: Extract CombatSceneWrapper
  - [ ] 2.1.3: Extract SceneManager
  - [ ] 2.1.4: Cleanup OverworldScene
- [ ] Task 2.2: Split CombatScene.jsx (1,218 → 400 lines)
  - [ ] 2.2.1: Extract CombatController
  - [ ] 2.2.2: Extract CombatUI
  - [ ] 2.2.3: Extract CombatEventHandler
  - [ ] 2.2.4: Cleanup CombatScene
- [ ] Task 2.3: Split Combat.js (1,010 → 500 lines)
  - [ ] 2.3.1: Audit legacy combat usage
  - [ ] 2.3.2: Remove or split legacy code
  - [ ] 2.3.3: Cleanup Combat.js
- [ ] Merge to main: Create PR, review, merge

### Phase 3: Tooling & Quality 🧪
- [ ] Task 3.1: Add Vitest unit testing
  - [ ] Install Vitest and testing library
  - [ ] Write tests for DiceRoller, Character, hexMath
  - [ ] Achieve 60%+ test coverage for core logic
- [ ] Task 3.2: Enable TypeScript strict mode
- [ ] Task 3.3: Add CI/CD pipeline
- [ ] Task 3.4: Add bundle size analysis
- [ ] Merge to main: Create PR, review, merge

### Phase 4: Performance & Polish ⚡
- [ ] Task 4.1: Implement code splitting (lazy loading)
- [ ] Task 4.2: Optimize canvas rendering
  - [ ] Cache hex positions
  - [ ] Debounce canvas redraws
  - [ ] Memoize texture generator
- [ ] Task 4.3: Upgrade dependencies (Vite v7)
- [ ] Task 4.4: Add performance monitoring
- [ ] Merge to main: Create PR, review, merge

### Post-Work
- [ ] Update AGENTS.md and CLAUDE.md with new patterns
- [ ] Document refactoring decisions in REFACTORING_SUMMARY.md
- [ ] Celebrate! 🎉

---

## Risk Mitigation

### Risk 1: Breaking Changes During Refactoring
**Likelihood**: High  
**Impact**: High  
**Mitigation**:
- ✅ Create Git tags before each phase
- ✅ Use feature branches for all work
- ✅ Run full manual test suite after each major change
- ✅ Keep PRs small and reviewable (<500 lines changed)

### Risk 2: TypeScript Strict Mode Reveals Major Issues
**Likelihood**: Medium  
**Impact**: Medium  
**Mitigation**:
- ✅ Enable strict mode gradually (Phase 1 → Phase 3)
- ✅ Use `// @ts-expect-error` with explanations for unavoidable errors
- ✅ Fix errors incrementally (utils → game logic → components)
- ✅ Don't block on 100% strict compliance initially

### Risk 3: CI/CD Pipeline Slows Down Development
**Likelihood**: Low  
**Impact**: Medium  
**Mitigation**:
- ✅ Keep CI fast (<5 minutes)
- ✅ Use caching for npm dependencies
- ✅ Run E2E tests only on main/PR, not every commit
- ✅ Allow CI failures on warnings initially

### Risk 4: File Splitting Introduces Bugs
**Likelihood**: Medium  
**Impact**: High  
**Mitigation**:
- ✅ Test thoroughly after each file split
- ✅ Keep git commits granular (one file split per commit)
- ✅ Use Playwright E2E tests to catch regressions
- ✅ Maintain 100% backward compatibility with save files

### Risk 5: Team Availability (Solo Developer)
**Likelihood**: N/A  
**Impact**: Low  
**Mitigation**:
- ✅ Work in small increments (1-2 hours per task)
- ✅ Document progress in this plan (check off tasks)
- ✅ Use Git extensively (easy to pause and resume)

---

## Success Criteria

### Phase 1 Success ✅
- [ ] Zero dead code remaining
- [ ] ESLint and Prettier passing with <10 warnings
- [ ] Git hooks working (auto-lint on commit)
- [ ] All game features still functional

### Phase 2 Success 🔄
- [ ] All files <600 lines (ideally <500)
- [ ] Clear separation of concerns (scene logic, UI, state)
- [ ] No circular dependencies
- [ ] All game features still functional

### Phase 3 Success 🧪
- [ ] 60%+ test coverage for core game logic
- [ ] TypeScript strict mode enabled
- [ ] CI/CD pipeline green on all PRs
- [ ] Bundle size analysis available

### Phase 4 Success ⚡
- [ ] 30-40% reduction in initial bundle size (via code splitting)
- [ ] Smoother canvas rendering (60fps)
- [ ] Vite v7 upgraded successfully
- [ ] Performance monitoring in place

---

## Notes

- **Estimated Total Time**: 60-80 hours (4-6 weeks part-time)
- **Solo Developer Friendly**: Tasks broken into 1-3 hour increments
- **Rollback Strategy**: Git tags at each phase + feature branches
- **Testing Strategy**: Manual testing + Playwright E2E + Vitest unit tests

---

## Appendix: Useful Commands

### Development
```bash
npm run dev                  # Start dev server
npm run build               # Production build
npm run preview             # Preview production build
```

### Quality Checks
```bash
npm run lint                # Run ESLint
npm run lint:fix            # Auto-fix ESLint issues
npm run format              # Format code with Prettier
npm run format:check        # Check formatting
npm run typecheck           # Run TypeScript type checking
```

### Testing
```bash
npm run test                # Run unit tests (watch mode)
npm run test:coverage       # Run tests with coverage report
npm run test:smoke          # Run smoke tests
npm run test:qa:headless    # Run E2E tests (headless)
```

### Analysis
```bash
npm run build               # Generates bundle size report (dist/stats.html)
```

### Git Workflow
```bash
git checkout -b refactor/phase-1-cleanup
git add .
git commit -m "refactor: ..."
git push origin refactor/phase-1-cleanup
# Create PR on GitHub
```

---

**Last Updated**: January 16, 2026  
**Plan Version**: 1.0  
**Status**: Ready for execution
