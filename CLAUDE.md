# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A web-based hexcrawl RPG for D&D 5e featuring procedurally generated hex maps, turn-based movement, party management, and D&D 5e character mechanics built with React 19.0.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (opens on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture Overview

### State Management Pattern

The application uses **React Context API + useReducer** for centralized state management, NOT Redux or other external libraries:

- **GameStateContext** (`src/contexts/GameStateContext.jsx`): Central game state including player position, character data, party composition, map data, explored hexes, and scene routing
- **SettingsContext** (`src/contexts/SettingsContext.jsx`): User preferences and settings (persisted to localStorage)

### Component Architecture

**Scene-based routing** implemented via conditional rendering in `App.jsx`:
- `TitleScene` - Main menu with New Game/Continue
- `OverworldScene` - Main gameplay scene with hex grid exploration

**Component Structure:**
```
src/
├── App.jsx                      # Root component, context providers, scene router
├── main.jsx                     # React entry point
├── contexts/
│   ├── GameStateContext.jsx     # Game state + reducer + auto-save logic
│   └── SettingsContext.jsx      # Settings state + localStorage sync
├── hooks/
│   ├── useGameLoop.js           # Custom hook for game loops
│   └── useEventListener.js      # Custom hook for DOM events
├── components/
│   ├── scenes/
│   │   ├── TitleScene.jsx       # Title screen UI
│   │   └── OverworldScene.jsx   # Main game UI + canvas
│   ├── ui/                      # UI components (tabs, stats, logs)
│   └── canvas/
│       └── HexGridCanvas.jsx    # HTML5 canvas hex rendering
├── game/                        # Pure JS game logic modules
│   ├── Character.js             # D&D 5e character model
│   ├── Party.js                 # Party management (1 player + 3 NPCs)
│   └── GameState.js             # Standalone save/load utilities
├── terrainGenerator.js          # Procedural terrain generation
├── terrainAlgorithms.js         # 4 terrain algorithms (Biome, Multi-Octave, Simple, Island)
├── riverGenerator.js            # Realistic river generation
├── encounters.js                # Encounter tables + difficulty calculation
├── poiRenderer.js               # POI icon rendering on canvas
└── noise.js                     # Perlin/Simplex noise utilities
```

### Key Design Patterns

**Hybrid React + Vanilla JS Architecture:**
- React components handle UI rendering and state management
- Pure JavaScript modules (`terrainGenerator.js`, `encounters.js`, etc.) contain game logic
- Canvas rendering uses refs and effects to bridge React and imperative canvas APIs

**State Flow:**
1. User interacts with UI (click, input)
2. Component dispatches action to GameStateContext
3. Reducer updates state immutably
4. Components re-render with new state
5. Auto-save effect writes to localStorage

**Data Persistence:**
- All game state auto-saves to `localStorage` on every state change
- Save format: `{ version, timestamp, playerPosition, playerCharacter, party, mapSeed, exploredHexes, mapData }`
- Character and Party classes have `toJSON()` and `fromJSON()` methods for serialization

## Critical Implementation Details

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

### Character System

**D&D 5e mechanics:**
- Ability scores (STR, DEX, CON, INT, WIS, CHA) with modifiers
- HP (current/max), AC, Proficiency Bonus
- Currently only Paladin class implemented
- Character class has methods: `damage()`, `heal()`, `levelUp()`, `toJSON()`, `fromJSON()`

### Party System

**Party composition:**
- 1 player character (PC)
- 3 NPC slots (currently stubbed with placeholders)
- Party class tracks: `player`, `npcs[]`, `getLivingMembers()`, `getDeadMembers()`

## Important Gotchas

### Canvas Rendering with React

The hex grid uses HTML5 Canvas via `HexGridCanvas.jsx`:
- Canvas updates are **imperative**, not declarative
- Use `useEffect` hooks to trigger redraws when state changes
- Store canvas context in ref, not state
- Mouse interactions require manual coordinate translation (screen → hex)

### State Immutability

GameStateContext reducer MUST return new objects:
- `exploredHexes` is a Set - always create new Set when updating
- Spread operator for nested state updates: `{ ...state, key: newValue }`
- DO NOT mutate `state.exploredHexes.add()` - creates new Set instead

### localStorage Limitations

- ~5-10MB limit per domain
- `mapData` object can be large (30x20 grid = 600 hexes with POI/weather data)
- Try/catch all localStorage operations (quota errors possible)

### Scene Transitions

Scene changes happen via `SET_CURRENT_SCENE` action:
- Changes `state.currentScene` which triggers conditional render in `App.jsx`
- Use `NEW_GAME` action to initialize game state AND transition to overworld
- Scenes don't unmount/remount - they conditionally render

## Testing & Debugging

Currently **no test suite** exists. When adding tests:
- Test pure functions first (terrain generation, hex distance calculations)
- Mock localStorage for state persistence tests
- Use React Testing Library for component tests
- Consider Vitest (already using Vite)

**Manual testing workflow:**
1. `npm run dev`
2. Test New Game → generates map with seed
3. Test movement → click/double-click hexes
4. Test Continue → localStorage persistence
5. Test fog of war → explored hexes persist across sessions

## Common Modifications

### Adding a New UI Component

1. Create component in `src/components/ui/`
2. Import and use in `OverworldScene.jsx` or `TitleScene.jsx`
3. Access state via `useGameState()` hook
4. Dispatch actions via `dispatch({ type: ACTIONS.X, payload: ... })`

### Adding New Game State

1. Add to `initialState` in `GameStateContext.jsx`
2. Create action type in `ACTIONS` constant
3. Add case to `gameStateReducer`
4. Update auto-save logic in `useEffect` if needed
5. Update load logic in `helpers.loadGame()` if needed

### Adding a New Character Class

1. Update `Character.js` constructor to handle new class
2. Add class-specific stat allocation
3. Add class features/abilities
4. Update character creation UI in `TitleScene.jsx`

### Modifying Terrain Generation

- Terrain types defined in `terrainGenerator.js:8-18`
- Colors, difficulty, and names centralized there
- Algorithms in `terrainAlgorithms.js` (Biome, Multi-Octave, Simple, Island)
- River generation is separate pass in `riverGenerator.js`

## Code Style Notes

- **Functional components only** - no class components
- **Hooks over HOCs** - use `useContext`, `useReducer`, `useEffect`
- **Pure JS modules** for game logic - no React dependencies
- **Destructure props/context** - `const { state, dispatch } = useGameState()`
- **Explicit action types** - use `ACTIONS.SET_X` constants, not string literals

## Future Feature Hooks

The codebase has several **stubbed systems** ready for implementation:

- **NPC Generation**: `Party.createPlaceholderNPCs()` creates empty slots - replace with real NPCs
- **Combat System**: Character has `damage()`/`heal()` - need encounter trigger and combat UI
- **Multiple Classes**: Character supports any class - add Fighter, Wizard, etc.
- **Inventory System**: Character data structure ready - need Item class and UI
- **Fog of War Visualization**: Explored hexes tracked - need canvas rendering of unexplored areas
- **Movement Costs**: Terrain has `difficulty` - implement movement point system
