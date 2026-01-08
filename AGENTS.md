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
7. **ALWAYS** check for null/undefined before accessing nested properties
8. **ALWAYS** use `actions.ACTION_NAME` constants, not string literals
9. **ALWAYS** create new Set/Array when updating collections in state

## Additional Resources

- **CLAUDE.md** - Comprehensive project overview and architecture details
- **package.json** - Full dependency list and npm scripts
- **vite.config.js** - Build configuration and git info injection
