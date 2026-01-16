# AGENTS.md

Agent-focused development guide for the Hexcrawler D&D 5e RPG project.

## Project Overview

A web-based hexcrawl RPG for D&D 5e featuring procedurally generated hex maps, turn-based movement, party management, and D&D 5e character mechanics built with React 19.0.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Development server (auto-opens browser, defaults to port 3000)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Version management
npm run version:patch   # 0.1.0 -> 0.1.1 (bug fixes, small changes)
npm run version:minor   # 0.1.0 -> 0.2.0 (new features, improvements)
npm run version:major   # 0.1.0 -> 1.0.0 (breaking changes, major rewrites)
```

**Important:** Before starting the dev server, make sure no other dev servers are running on ports 3000-3009. If you encounter "port in use" errors, kill lingering processes:

```bash
# Windows: Find and kill processes on port 3000-3009
netstat -ano | findstr :300 | findstr LISTENING
taskkill //F //PID <process_id>

# WARNING: Do NOT use `taskkill //F //IM node.exe` as it will kill ALL node processes,
# including AI agents and other background services. Only kill specific PIDs for the dev server.
```

**Note:** No test suite currently exists. For testing guidance, see CLAUDE.md.

## Version Management

The project uses semantic versioning (SemVer) in the format `MAJOR.MINOR.PATCH` (e.g., `0.1.0`).

**When to increment versions:**
- **Patch (0.0.1)**: Bug fixes, typos, small tweaks, minor adjustments
- **Minor (0.1.0)**: New features, improvements, enhancements, non-breaking changes
- **Major (1.0.0)**: Breaking changes, major rewrites, significant architectural changes

**Workflow:**
1. Make your changes and test them
2. Run the appropriate version command: `npm run version:patch|minor|major`
3. Commit all changes including the updated `package.json`
4. Push to repository

**Example:**
```bash
# Fixed POI spawning on water/rivers
npm run version:patch
git add .
git commit -m "Fix: Prevent POIs from spawning on water/rivers (v0.1.1)"
git push
```

## Code Style & Conventions

### File Organization

**Component Files (`.jsx`):**
- React components in `src/components/`
- Scenes in `src/components/scenes/`
- UI components in `src/components/ui/`
- Canvas components in `src/components/canvas/`

**Game Logic Files (`.js`):**
- Pure JavaScript modules in `src/game/`
- Utility functions in `src/utils/`
- No React dependencies in `.js` files

### Import Guidelines

**Order:**
1. React imports
2. Third-party libraries
3. Context/hooks
4. Components
5. Game logic modules
6. Utilities
7. CSS files

**Example:**
```javascript
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useGameState } from '../../contexts/GameStateContext';
import CharacterStats from '../ui/CharacterStats';
import { Character } from '../../game/Character.js';
import { formatTime } from '../../game/TimeManager';
import './MyComponent.css';
```

**Import Rules:**
- Use `.js` extension for game logic imports: `import { Character } from '../game/Character.js'`
- Named exports for utilities and classes: `export class Character { }`
- Default exports for React components: `export default MyComponent`

### Component Structure

**Functional components only** - no class components.

**Standard component pattern:**
```javascript
import PropTypes from 'prop-types';

function MyComponent({ prop1, prop2 }) {
  // 1. Hooks (useContext, useState, useEffect, etc.)
  const { state, dispatch } = useGameState();
  const [localState, setLocalState] = useState(null);

  // 2. Event handlers
  const handleClick = () => {
    // logic here
  };

  // 3. Render helpers
  const renderSection = () => {
    // complex rendering logic
  };

  // 4. Return JSX
  return (
    <div>
      {renderSection()}
    </div>
  );
}

MyComponent.propTypes = {
  prop1: PropTypes.string.isRequired,
  prop2: PropTypes.number
};

export default MyComponent;
```

### State Management

**Use Context API + useReducer**, NOT Redux.

**Accessing state:**
```javascript
const { state, dispatch, actions } = useGameState();
```

**Dispatching actions:**
```javascript
dispatch({
  type: actions.SET_PLAYER_POSITION,
  payload: { col: 5, row: 10 }
});
```

**CRITICAL - Immutability rules:**
- Always return new objects from reducers
- Use spread operator: `{ ...state, key: newValue }`
- Sets must be recreated: `new Set([...state.exploredHexes, newHex])`
- **NEVER** mutate state directly: `state.exploredHexes.add()` is WRONG

### Naming Conventions

**Files:**
- Components: `PascalCase.jsx` (e.g., `CharacterStats.jsx`)
- Game logic: `PascalCase.js` (e.g., `Character.js`)
- Utilities: `camelCase.js` (e.g., `hexRenderer.js`)
- Contexts: `PascalCaseContext.jsx` (e.g., `GameStateContext.jsx`)

**Variables:**
- React components: `PascalCase`
- Functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `ACTIONS`, `POI_TYPES`)
- Private methods: prefix with `_` (e.g., `_calculateDistance()`)

**Functions:**
- Event handlers: `handleEventName` (e.g., `handleClick`, `handleMoveToHex`)
- Render helpers: `renderSectionName` (e.g., `renderEncounterInfo`)
- Utility functions: descriptive verbs (e.g., `calculateHexDistance`, `formatTime`)

### PropTypes

**Always define PropTypes** for all components receiving props.

```javascript
MyComponent.propTypes = {
  hex: PropTypes.shape({
    col: PropTypes.number.isRequired,
    row: PropTypes.number.isRequired,
    terrain: PropTypes.object.isRequired
  }),
  onMoveClick: PropTypes.func
};
```

### Error Handling

**localStorage operations:**
```javascript
try {
  localStorage.setItem('key', JSON.stringify(data));
} catch (error) {
  console.error('Failed to save:', error);
  // Handle quota exceeded, etc.
}
```

**State validation:**
```javascript
if (!state.playerCharacter) {
  console.error('No player character found');
  return;
}
```

**Canvas operations:**
```javascript
const canvas = canvasRef.current;
if (!canvas) return;
```

### Comments & Documentation

**Use JSDoc for exported functions:**
```javascript
/**
 * Calculate hex distance using cube coordinates
 * @param {number} col1 - Starting column
 * @param {number} row1 - Starting row
 * @param {number} col2 - Target column
 * @param {number} row2 - Target row
 * @returns {number} Distance in hexes
 */
export function getHexDistance(col1, row1, col2, row2) {
  // implementation
}
```

**Inline comments for complex logic:**
```javascript
// Convert offset coordinates to cube coordinates
const x1 = col1 - Math.floor(row1 / 2);
const z1 = row1;
const y1 = -x1 - z1;
```

### Development Logging

**CRITICAL: Use the logger utility for ALL development logging** - Never use `console.*` directly.

The project uses a categorized logging system that is **automatically enabled in dev mode** and **completely removed in production builds** (zero runtime cost).

**Importing the logger:**
```javascript
import logger from '../utils/logger.js';
```

**Log Categories:**

| Category | Color | Usage |
|----------|-------|-------|
| `combat` | 🔴 Red | Combat flow, AI decisions, turn order, attack calculations |
| `mapgen` | 🟢 Green | Terrain generation, room placement, POI spawning, dungeon creation |
| `movement` | 🔵 Blue | Player movement, pathfinding, hex distance calculations |
| `state` | 🟡 Yellow | GameState reducer actions, state transitions, context updates |
| `storage` | 🟣 Purple | Save/load operations, localStorage, serialization |
| `render` | 🟠 Orange | Canvas redraws, React renders, performance metrics |
| `items` | 🟢 Teal | Inventory changes, equipment, loot generation |
| `general` | ⚪ Gray | Uncategorized logs, utilities, misc operations |

**Log Levels:**
- `debug()` - Detailed diagnostics (shown by default in dev)
- `info()` - General information
- `warn()` - Warnings, recoverable issues
- `error()` - Errors, failures, exceptions

**Basic Logging Examples:**

```javascript
// Combat logging
logger.combat.info('Starting combat', { allies: 1, enemies: 3 });
logger.combat.debug('AI selecting target', { 
  enemyId: enemy.id, 
  possibleTargets: targets.length,
  chosen: selectedTarget.id 
});
logger.combat.warn('No valid targets found, skipping turn');

// MapGen logging
logger.mapgen.info('Generating terrain', { seed: mapSeed, algorithm: 'perlin' });
logger.mapgen.debug('Placing POI', { type: 'ruins', hex: [col, row], cr: 3 });
logger.mapgen.warn('Failed to place river, retrying with new path');

// Movement logging
logger.movement.info('Player moved', { from: [10,5], to: [11,5], terrain: 'forest' });
logger.movement.debug('Calculating path', { start, end, distance: hexDist });
logger.movement.warn('Destination too far', { distance: 5, maxMove: 3 });

// State logging (reducer actions)
logger.state.info('SET_PLAYER_POSITION', { payload: { col, row } });
logger.state.debug('State updated', { exploredHexes: state.exploredHexes.size });
logger.state.error('Invalid action type', action.type);

// Storage logging
logger.storage.info('Saving game', { slot: 1, characterName: player.name });
logger.storage.debug('Serializing state', { stateSize: JSON.stringify(state).length });
logger.storage.error('Save failed', error);

// Render logging
logger.render.debug('Canvas redraw triggered', { width, height });
logger.render.warn('Canvas ref not ready, skipping draw');

// Items logging
logger.items.info('Item equipped', { item: item.name, slot: 'mainHand' });
logger.items.debug('Generated loot', { items: loot.length, totalValue: totalGold });
logger.items.warn('Inventory full, cannot add item');

// General logging (fallback for uncategorized)
logger.general.info('Game initialized');
logger.general.error('Unexpected error', error);
```

**Performance Timing:**

Use `time()` and `timeEnd()` to measure performance of expensive operations:

```javascript
// Time a single operation
logger.mapgen.time('terrain-generation');
generateTerrain(mapSeed, algorithm);
logger.mapgen.timeEnd('terrain-generation');
// Output: [mapgen] terrain-generation: 45.2ms

// Time canvas rendering
logger.render.time('hex-canvas-draw');
drawHexGrid();
logger.render.timeEnd('hex-canvas-draw');
// Output: [render] hex-canvas-draw: 8.3ms
```

**Grouped Logging:**

For related log messages, use `group()` or `groupCollapsed()`:

```javascript
logger.combat.group('Turn Processing', () => {
  logger.combat.info('Current combatant:', combatant.name);
  logger.combat.debug('Available actions:', actions);
  logger.combat.debug('Target selection:', targetInfo);
});

// Collapsed by default (useful for large data dumps)
logger.state.groupCollapsed('Full State Dump', () => {
  logger.state.debug('Player:', state.playerCharacter);
  logger.state.debug('Party:', state.party);
  logger.state.debug('Map:', state.hexGrid);
});
```

**Table Logging:**

Display arrays or objects as tables for easy inspection:

```javascript
logger.combat.table(turnOrder); // Show turn order as table
logger.items.table(inventory);  // Show inventory as table
```

**Best Practices:**

1. **Log at decision points** - Help future debugging by logging why something happened:
   ```javascript
   logger.combat.debug('Target selected', { 
     reason: 'lowest HP', 
     targetHP: target.hp,
     allTargets: enemies.map(e => ({ id: e.id, hp: e.hp }))
   });
   ```

2. **Include context** - Always log relevant identifiers and values:
   ```javascript
   // Good
   logger.movement.info('Movement blocked', { 
     from: [10,5], 
     to: [11,5], 
     reason: 'water', 
     hasRaft: false 
   });
   
   // Bad
   logger.movement.info('Cannot move');
   ```

3. **Use structured data** - Pass objects instead of concatenating strings:
   ```javascript
   // Good
   logger.mapgen.debug('Room placed', { col, row, width, height, type: 'corridor' });
   
   // Bad
   logger.mapgen.debug('Room placed at ' + col + ',' + row + ' size ' + width + 'x' + height);
   ```

4. **Performance timing for expensive operations** - Always time operations that might be slow:
   ```javascript
   logger.mapgen.time('dungeon-generation');
   const dungeon = generateDungeon(width, height, cr);
   logger.mapgen.timeEnd('dungeon-generation');
   ```

5. **Log errors with full context** - Include the error object and relevant state:
   ```javascript
   try {
     saveGame(state);
   } catch (error) {
     logger.storage.error('Save failed', { 
       error, 
       slot: saveSlot, 
       stateSize: JSON.stringify(state).length 
     });
   }
   ```

6. **Never use `console.*` directly** - Always use the logger:
   ```javascript
   // ❌ WRONG
   console.log('Player moved');
   console.error('Save failed', error);
   
   // ✅ CORRECT
   logger.movement.info('Player moved', { from, to });
   logger.storage.error('Save failed', { error, slot });
   ```

**Migration Guide:**

When updating existing code, replace `console.*` calls with appropriate logger calls:

| Old Code | New Code |
|----------|----------|
| `console.log(...)` | `logger.general.info(...)` or category-specific |
| `console.warn(...)` | `logger.category.warn(...)` |
| `console.error(...)` | `logger.category.error(...)` |
| `console.debug(...)` | `logger.category.debug(...)` |

**Environment Control:**

- **Dev mode (`npm run dev`)**: All logs enabled by default at `debug` level
- **Production (`npm run build`)**: All logs completely removed (tree-shaken)
- **URL override**: Add `?logLevel=info` to URL to change log level on-the-fly
- **Environment variable**: Set `VITE_LOG_LEVEL=info` to change default level

**Logger Configuration:**

Check logger config in console:
```javascript
logger.logConfig();
// Outputs:
// Dev mode: true
// Log level: debug
// Categories: combat, mapgen, movement, state, storage, render, items, general
// Tip: Add ?logLevel=info to URL to change log level
```

## Critical Architecture Patterns

### Canvas + React Integration

**Canvas refs, not state:**
```javascript
const canvasRef = useRef(null);
const ctx = canvasRef.current?.getContext('2d');
```

**Redraw on state changes:**
```javascript
useEffect(() => {
  draw();
}, [playerPosition, selectedHex]);
```

### Scene Management

Scenes change via `SET_CURRENT_SCENE` action, NOT routing libraries.

```javascript
dispatch({
  type: actions.SET_CURRENT_SCENE,
  payload: 'overworld'
});
```

### User Notifications & Feedback

**CRITICAL: Use GameLog for ALL user feedback** - Never create modal dialogs, popups, or blocking UI.

**Accessing GameLog:**
```javascript
import { useGameLog } from '../../contexts/GameLogContext';

const { addMessage } = useGameLog();
addMessage('Your message here', 'info');
```

**Message Types:**
- `'info'` - General information, neutral events
- `'success'` - Positive outcomes, achievements, gains
- `'warning'` - Cautions, restrictions, blocked actions
- `'error'` - Failures, errors, critical issues
- `'action'` - Player actions, movement, interactions
- `'discovery'` - Finding new locations, POIs, secrets
- `'encounter'` - Combat events, enemy interactions
- `'system'` - Meta game events, saves, loads, generation
- `'poi-interaction'` - POI-specific actions (pray, search, etc.)

**Best Practices:**
1. **Log immediately** - Don't queue or delay feedback
2. **Be concise** - Keep messages under 100 chars when possible
3. **Use appropriate types** - Helps player scan log quickly
4. **Multi-line for complex data** - Use `\n` for structured info
5. **Always log user actions** - Movement, searches, interactions
6. **Log outcomes** - Success/failure, rewards, consequences
7. **Put dice rolls first** - Always show roll results at the start of messages (e.g., `Survival 10+3=13 vs DC 12: Found 9 rations`)

**Examples:**
```javascript
// Movement
addMessage('Moved to forest hex (15, 23)', 'action');

// Discovery
addMessage('Discovered: Ancient Ruins (CR 3)', 'discovery');

// POI interaction
addMessage('Prayed at Shrine of Pelor. +1 Piety', 'poi-interaction');

// Skill check with result (dice rolls FIRST)
addMessage('Survival 10+3=13 vs DC 12: Found 9 rations (6 rich hexes)', 'success');

// Search result (multi-line with roll first)
addMessage(
  `Perception 18+2=20 vs DC 15: Success\n\nChallenge Rating: 3\nExpect goblins and traps\nEstimated size: 15x10 hexes`,
  'info'
);

// Combat
addMessage('Attack 15+5=20 vs AC 16: Hit! 8 damage', 'success');

// Failed check (dice rolls FIRST)
addMessage('Stealth 3+2=5 vs DC 12: Failed! Guards are alerted', 'warning');

// Blocked action
addMessage('You need a raft to cross the river!', 'warning');

// Error
addMessage('Failed to save game: Storage quota exceeded', 'error');
```

**FORBIDDEN:**
- ❌ **EventInfoBox** (removed from codebase)
- ❌ **Toast notifications** (Sonner unused, may be removed)
- ❌ **Modal dialogs or popups**
- ❌ **window.alert() or window.confirm()** (deprecated)
- ❌ **Blocking UI overlays** (except combat)
- ❌ **Message queues that delay feedback**

**POI Interactions:**
- All POI actions are triggered via **buttons in HexDetails panel** when player is standing on the hex
- Spacebar triggers the default action for the POI type
- Results are logged to GameLog immediately
- No confirmation dialogs or choice popups

### Data Serialization

Classes must implement `toJSON()` and `fromJSON()` for localStorage persistence.

```javascript
toJSON() {
  return {
    name: this.name,
    level: this.level,
    // ... all properties
  };
}

static fromJSON(data) {
  const character = new Character(data.name, data.class);
  Object.assign(character, data);
  return character;
}
```

### Hex Grid Coordinate System

Uses **cube coordinates** converted to offset coordinates:
- Hex distance calculation in `GameStateContext.jsx:112-122`
- Movement validation checks hex distance ≤ character's `moveDistance`
- Vision/fog of war checks hex distance ≤ character's `viewDistance`

### Map Generation

**Region-based generation** creates coherent biomes and weather:
- **Regions** (`RegionGenerator.js`): 8-15 large regions per map using Voronoi partitioning
- **Biome clustering**: Hexes within regions share biome types (temperate forest, desert, tundra, etc.)
- **Regional weather** (`WeatherSystem.js`): Weather patterns affect entire regions, not individual hexes
- **Weather fronts**: Moving weather systems that cross region boundaries over time
- **Seeded random**: Same seed = same regions, biomes, and initial weather
- Rivers generated after terrain using `riverGenerator.js`
- POIs placed with terrain-appropriate logic

**Region Types:**
- Temperate Forest, Tropical Jungle, Arid Desert, Arctic Tundra, Alpine Highlands, Wetlands, Coastal

**Data structures:**
- `state.regions`: Array of region objects with biome, climate, elevation, moisture, temperature
- `state.hexToRegion`: Map of hex coordinates to region IDs
- `state.weatherSystem`: WeatherSystem instance managing regional weather patterns

## Common Pitfalls

1. **DO NOT** use emojis in code unless explicitly requested
2. **DO NOT** mutate state directly in reducers
3. **DO NOT** import React in `.js` game logic files
4. **DO NOT** use class components
5. **DO NOT** store canvas context in state (use refs)
6. **DO NOT** use routing libraries (use scene-based navigation)
7. **DO NOT** create modal dialogs or popups - use GameLog for all feedback
8. **DO NOT** use EventInfoBox (removed system) - use GameLog
9. **DO NOT** use `console.*` directly - use the logger utility for all dev logging
10. **ALWAYS** check for null/undefined before accessing nested properties
11. **ALWAYS** use `actions.ACTION_NAME` constants, not string literals
12. **ALWAYS** create new Set/Array when updating collections in state
13. **ALWAYS** log user actions and outcomes to GameLog
14. **ALWAYS** import and use logger for development debugging

## Additional Resources

- **CLAUDE.md** - Comprehensive project overview and architecture details
- **package.json** - Full dependency list and npm scripts
- **vite.config.js** - Build configuration and git info injection

## D&D 5e Rules Reference

**System Reference Document (SRD) v5.2.1** - `docs/SRD_CC_v5.2.1.pdf`

The SRD contains official D&D 5e rules and mechanics that this project implements:

- **Character Creation** - Classes, races, backgrounds, ability scores
- **Combat Rules** - Attack rolls, saving throws, damage types, conditions
- **Spells** - Spell lists, spell descriptions, spell slots
- **Magic Items** - Item rarities, properties, attunement rules
- **Monsters** - Creature stat blocks, challenge ratings
- **Treasure** - Treasure tables (Individual and Hoard by CR)
- **Traps** - Official trap types with scaling by character level
- **Environmental Rules** - Travel, exploration, resting, time tracking

**Note:** This file is excluded from version control (.gitignore) due to licensing.

**Using the SRD:**
- Extract text using `pdftotext`: `pdftotext -f <page> -l <page> docs/SRD_CC_v5.2.1.pdf -`
- Search for rules: `pdftotext docs/SRD_CC_v5.2.1.pdf - | grep -i "keyword"`
- Reference page numbers from the Table of Contents (page 3-5)

**Key Sections for Game Development:**
- **Pages 199-202**: Traps (8 official trap types with level scaling)
- **Pages 133-144**: Treasure Tables (Individual & Hoard by CR 0-4, 5-10, 11-16, 17+)
- **Pages 134-135**: Gemstones and Art Objects tables
- **Pages 144-149**: Magic Item Tables (A through I)
- **Pages 192-202**: Gameplay Toolbox (travel, environments, hazards)

**Implementation Status:**
- ✅ Treasure Hoard Tables - Implemented in `src/game/data/GameTableData.js`
- ✅ SRD Traps - Implemented in `src/game/data/GameTableData.js`
- 🚧 Magic Items - Tables stored, not yet implemented
- 📋 Spells - Planned for future magic system
- 📋 Monster Stat Blocks - Planned for combat system
