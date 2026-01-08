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
```

**Note:** No test suite currently exists. For testing guidance, see CLAUDE.md.

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

**Seeded random generation** ensures reproducible maps:
- Seed stored in `mapSeed` state
- Same seed = same map every time
- 4 terrain algorithms available (see `terrainAlgorithms.js`)
- Rivers generated after terrain using `riverGenerator.js`
- POIs placed with terrain-appropriate logic

## Common Pitfalls

1. **DO NOT** use emojis in code unless explicitly requested
2. **DO NOT** mutate state directly in reducers
3. **DO NOT** import React in `.js` game logic files
4. **DO NOT** use class components
5. **DO NOT** store canvas context in state (use refs)
6. **DO NOT** use routing libraries (use scene-based navigation)
7. **DO NOT** create modal dialogs or popups - use GameLog for all feedback
8. **DO NOT** use EventInfoBox (removed system) - use GameLog
9. **ALWAYS** check for null/undefined before accessing nested properties
10. **ALWAYS** use `actions.ACTION_NAME` constants, not string literals
11. **ALWAYS** create new Set/Array when updating collections in state
12. **ALWAYS** log user actions and outcomes to GameLog

## Additional Resources

- **CLAUDE.md** - Comprehensive project overview and architecture details
- **package.json** - Full dependency list and npm scripts
- **vite.config.js** - Build configuration and git info injection
