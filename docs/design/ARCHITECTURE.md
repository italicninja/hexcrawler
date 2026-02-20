# Architecture Overview

**Hexcrawler — D&D 5e Web RPG**

## Technology Stack

| Layer            | Technology                                      |
| ---------------- | ----------------------------------------------- |
| UI Framework     | React 19.0 (functional components + hooks)      |
| Language         | TypeScript (game logic) + JSX (components)      |
| State Management | React Context API + `useReducer`                |
| Rendering        | HTML5 Canvas (hex grid) + React DOM (UI panels) |
| Build Tool       | Vite                                            |
| Styling          | Tailwind CSS + custom CSS                       |
| Persistence      | `localStorage` (auto-save + manual slots)       |

---

## High-Level Architecture

The project uses a **hybrid React + Vanilla JS** design: React handles declarative UI and state orchestration, while pure TypeScript/JavaScript modules handle game logic (character math, map generation, combat simulation, etc.) with zero React dependencies.

```
┌─────────────────────────────────────────────────────────┐
│                     React Layer                          │
│  App.tsx → Scene Router → Scenes → UI Components        │
│                    ↑          ↓                          │
│              useGameState() / dispatch()                 │
│                    ↓                                     │
│           GameStateContext (single root store)           │
│           combinedReducer → domain sub-reducers          │
└──────────────┬──────────────────────────────────────────┘
               │ calls
┌──────────────▼──────────────────────────────────────────┐
│                   Game Logic Layer                       │
│  Character  Party  Combat  Enemy  DiceRoller             │
│  SurvivalManager  RestManager  TimeManager               │
│  LootGenerator  QuestGenerator  NPCGenerator             │
│  TerrainGenerator  RegionGenerator  WeatherSystem        │
│  POISystem  RiverGenerator  SpellManager  Item           │
└─────────────────────────────────────────────────────────┘
               │ persisted via
┌──────────────▼──────────────────────────────────────────┐
│                  Persistence Layer                       │
│  SaveManager → localStorage (JSON serialization)        │
│  Character.toJSON/fromJSON, Party.toJSON/fromJSON        │
└─────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
src/
├── App.tsx                        # Root component; context providers; scene router
├── main.tsx                       # React entry point
│
├── contexts/
│   ├── GameStateContext.tsx        # Central game state + useReducer + auto-save
│   ├── GameLogContext.tsx          # In-game message log (separate context)
│   ├── SettingsContext.tsx         # User settings (localStorage-synced)
│   └── reducers/                  # Domain-specific sub-reducers
│       ├── index.ts               # combinedReducer dispatcher
│       ├── combatReducer.ts       # All combat state transitions
│       ├── characterReducer.ts    # Character/party updates
│       ├── mapReducer.ts          # Hex grid, POI, exploration
│       ├── questReducer.ts        # Quest lifecycle
│       ├── shopReducer.ts         # Shop buy/sell
│       └── restReducer.ts         # Rest mechanics
│
├── components/
│   ├── scenes/                    # Full-page scene components
│   │   ├── TitleScene.jsx         # Main menu
│   │   ├── OverworldScene.jsx     # Primary exploration UI
│   │   ├── CombatScene.jsx        # Tactical combat UI
│   │   └── ExplorationScene.jsx   # Interior dungeon/POI exploration
│   ├── ui/                        # Reusable UI panels and widgets
│   │   ├── combat/                # Combat-specific panels
│   │   └── ...                    # HexDetails, CharacterStats, GameLog, etc.
│   └── canvas/
│       └── HexGridCanvas.jsx      # HTML5 Canvas hex map renderer
│
├── game/                          # Pure game logic (no React)
│   ├── Character.ts               # D&D 5e character entity
│   ├── Party.ts                   # Party container (1 PC + 3 NPCs)
│   ├── Enemy.ts                   # Monster entity with CR stat tables
│   ├── Combat.ts                  # Full turn-based combat engine
│   ├── DiceRoller.ts              # Dice rolling + GameLog wiring
│   ├── Item.ts                    # Equipment/inventory item entity
│   ├── Spell.ts                   # Spell entity (data-driven)
│   ├── SpellManager.ts            # Spell catalog + slot tracking
│   ├── AbilityEffects.ts          # Class ability effect resolution
│   ├── SurvivalManager.ts         # Food/rations/exhaustion
│   ├── RestManager.ts             # Short/long/inn rest mechanics
│   ├── TimeManager.ts             # In-game calendar and time costs
│   ├── LootGenerator.ts           # CR-scaled treasure generation
│   ├── QuestGenerator.ts          # Procedural quest generation
│   ├── NPCGenerator.ts            # NPC companion generation
│   ├── Quest.ts                   # Quest entity + status enums
│   ├── Shop.ts                    # Shop entity + inventory
│   ├── Pathfinding.ts             # A* pathfinding on hex grid
│   ├── LineOfSight.ts             # LoS checks for combat
│   ├── OpportunityAttack.ts       # OA detection + resolution
│   ├── EnemyAI.ts                 # Decision tree for enemy turns
│   ├── ai/                        # AI config loader + engine
│   ├── BaseGenerator.ts           # Shared seeded random base class
│   ├── HazardGenerator.ts         # Environmental hazard generation
│   ├── DungeonGenerator.ts        # Procedural dungeon maps
│   ├── CaveGenerator.ts           # Procedural cave maps
│   ├── TowerGenerator.ts          # Tower interior maps
│   ├── RuinsGenerator.ts          # Ruins interior maps
│   ├── TownGenerator.ts           # Town interior maps
│   ├── InteriorGenerator.ts       # Interior map orchestrator
│   ├── TreasureGenerator.ts       # Treasure hoard tables
│   └── data/
│       └── GameTableData.ts       # SRD treasure/trap data tables
│
├── terrainGenerator.ts            # Map generation orchestrator
├── terrainAlgorithms.ts           # 4 terrain noise algorithms
├── RegionGenerator.ts             # Voronoi biome region system
├── WeatherSystem.ts               # Regional dynamic weather
├── riverGenerator.ts              # Realistic river placement
├── poiSystem.ts                   # POI generation and management
├── encounters.ts                  # Encounter tables (legacy)
├── noise.ts                       # Perlin/Simplex noise utilities
├── poiRenderer.ts                 # POI icon canvas rendering
│
├── types/                         # TypeScript type definitions
│   └── game.ts                    # Shared game types (GameTime, etc.)
├── constants/                     # Game constants
│   └── gameConstants.ts           # DND rules, GAME_DEFAULTS, XP_TABLE
├── hooks/                         # Custom React hooks
│   ├── useGameLoop.js             # Game loop hook
│   └── useEventListener.js        # DOM event hook
└── utils/
    └── logger.ts                  # Categorized dev logging utility
```

---

## Scene System

Scenes are top-level React components rendered conditionally based on `state.currentScene`. There is no routing library — transitions happen via the `SET_CURRENT_SCENE` action.

```
'title'               → TitleScene.jsx
'character-creation'  → CharacterCreationScene.jsx
'overworld'           → OverworldScene.jsx
'combat'              → CombatScene.jsx
'exploration'         → ExplorationScene.jsx
'town'                → TownScene.jsx
```

Scene transitions:

- New Game → `NEW_GAME` action → `'character-creation'` → `'overworld'`
- Enter dungeon → `ENTER_EXPLORATION` action → `'exploration'`
- Encounter → `START_COMBAT` action → `'combat'`
- Combat ends → `END_COMBAT` action → `'overworld'`

---

## State Flow

```
User Interaction
      ↓
React Component
      ↓
dispatch({ type: actions.ACTION_NAME, payload: {...} })
      ↓
combinedReducer (routes to domain sub-reducer)
      ↓
New immutable state object returned
      ↓
React re-renders affected components
      ↓
Auto-save effect → SaveManager.saveToSlot() → localStorage
```

**Immutability rule:** All state updates return new objects. Character and Party class instances must be copied with `Character.fromJSON(character.toJSON())` before mutation. Sets must be recreated: `new Set([...state.exploredHexes, newHex])`.

---

## Canvas Rendering

The hex map is rendered on an HTML5 Canvas element inside `HexGridCanvas.jsx`. Canvas updates are **imperative** and driven by `useEffect` hooks that fire when relevant state changes (player position, explored hexes, selected hex, etc.).

```
State change (playerPosition, exploredHexes, ...)
      ↓
useEffect in HexGridCanvas.jsx
      ↓
ctx.clearRect() → draw all hexes → draw rivers → draw POI icons
      ↓
Mouse click → screen coords → offset coords → hex coords
      ↓
dispatch SET_SELECTED_HEX / SET_PLAYER_POSITION
```

Hex coordinate system: **offset coordinates** (col, row) stored in state; internally converted to **cube coordinates** for distance and pathfinding calculations.

---

## Development Logging

All development logging goes through the categorized `logger` utility (`src/utils/logger.ts`). Direct `console.*` calls are forbidden. Logger output is stripped at production build time (zero runtime cost).

```javascript
import logger from '../utils/logger.js';
logger.combat.info('Combat started', { allies, enemies });
logger.movement.debug('Path calculated', { from, to, cost });
logger.state.error('Invalid action', action.type);
```

Categories: `combat`, `mapgen`, `movement`, `state`, `storage`, `render`, `items`, `general`

---

## Data Persistence

Save format (localStorage):

```json
{
  "version": "0.x.x",
  "timestamp": 1234567890,
  "playerPosition": { "col": 10, "row": 5 },
  "playerCharacter": {
    /* Character.toJSON() */
  },
  "party": {
    /* Party.toJSON() */
  },
  "mapSeed": "abc123",
  "exploredHexes": ["10,5", "11,5"],
  "discoveredPOIs": ["12,7"],
  "hexGrid": [
    /* 2D array of terrain+POI data */
  ],
  "regions": [
    /* region objects */
  ],
  "gameTime": { "day": 3, "hour": 14, "minute": 30 },
  "playtime": 18000000
}
```

- Auto-save fires 500ms after scene changes to `overworld`, `exploration`, or `town`
- Slots: `AUTOSAVE`, `SLOT_1`, `SLOT_2`, `SLOT_3`
- Sets serialized as arrays; WeatherSystem and Combat instances reconstructed on load

---

## Key Architectural Decisions

| Decision                  | Rationale                                                      |
| ------------------------- | -------------------------------------------------------------- |
| Context API over Redux    | Simpler for this scale; avoids external dependency             |
| Pure JS/TS game modules   | Enables testing without React; clean separation of concerns    |
| Scene-based routing       | Simpler than a routing library; scenes don't unmount           |
| Canvas for hex grid       | Performance for large grids; fine-grained render control       |
| Seeded random generation  | Same seed always reproduces the same map                       |
| GameLog over modals       | Non-blocking; keeps UI clean; supports scrollback              |
| `fromJSON/toJSON` pattern | Enables class instances in React state without direct mutation |
