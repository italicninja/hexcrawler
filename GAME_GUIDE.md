# hexcrawlers - Game Guide

## Overview
hexcrawlers is an interactive web-based RPG built on a hex grid system with D&D 5e-inspired mechanics. The game features click-based movement, procedural map generation with dynamic expansion, character progression, party management, and fog of war exploration.

## Current Implementation

### ✅ Core Architecture (React 19.0)

#### State Management
- **GameStateContext**: Centralized state with useReducer for player position, character, party, map data, explored hexes, and scene routing
- **SettingsContext**: User preferences (e.g., double-click movement toggle)
- **Auto-save**: Game state automatically saves to localStorage after every movement and state change
- **Scene Routing**: Conditional rendering in App.jsx switches between TitleScene and OverworldScene

#### Component Structure
```
src/
├── App.jsx                      # Root component with context providers
├── contexts/
│   ├── GameStateContext.jsx     # Game state + reducer + auto-save
│   └── SettingsContext.jsx      # Settings state + localStorage
├── components/
│   ├── scenes/
│   │   ├── TitleScene.jsx       # Main menu
│   │   └── OverworldScene.jsx   # Main game UI
│   ├── ui/                      # UI tabs (CharacterStats, PartyList, Equipment, etc.)
│   └── canvas/
│       └── HexGridCanvas.jsx    # HTML5 canvas hex rendering
├── game/
│   ├── Character.js             # D&D 5e character model
│   └── Party.js                 # Party management
└── [terrain/encounter modules]  # Pure JS game logic
```

### ✅ Character System (D&D 5e)

#### Character Class
Full D&D 5e implementation:
- **Ability Scores**: STR, DEX, CON, INT, WIS, CHA with calculated modifiers
- **Combat Stats**: HP (current/max), AC, Proficiency Bonus
- **Level System**: Level progression with automatic proficiency bonus scaling
- **Hit Dice**: Class-specific (d10 for Paladin)
- **Movement/Vision**: `moveDistance: 1` (can move 1 hex per turn), `viewDistance: 2` (can see 2 hexes away)

#### Paladin Class (Currently Implemented)
- **Stats**: STR 16, CHA 14, CON 14, WIS 12, DEX 10, INT 8
- **HP**: 10 + CON modifier = 12 HP at level 1
- **AC**: 18 (Chain Mail + Shield)
- **Proficiencies**: All armor, shields, simple/martial weapons
- **Class Features** (stubbed):
  - Divine Sense (4 uses)
  - Lay on Hands (5 HP pool)

### ✅ Party System
- **1 Player Character**: Main controllable character (Paladin)
- **3 NPC Slots**: Currently empty (ready for future implementation)
- **Party Tracking**: `getSize()`, `getLivingMembers()`, `isWiped()` methods
- **Serialization**: Full save/load support via `toJSON()` and `fromJSON()`

### ✅ Map Generation & Exploration

#### Procedural Terrain Generation
- **Initial Map Size**: 20 columns × 30 rows (600 hexes)
- **Seeded Generation**: Same seed = same map for reproducibility
- **9 Terrain Types**: Water, River, Grassland, Forest, Mountains, Desert, Swamp, Tundra, Hills
- **4 Generation Algorithms**: Biome-Based, Multi-Octave, Simple, Island
- **Rivers**: Realistic river generation flowing from mountains to water
- **POIs**: 7 types (Dungeons, Settlements, Ruins, Towers, Caves, Shrines, Camps) with terrain-appropriate placement

#### Dynamic Map Expansion
- **Auto-Expansion**: Map expands in chunks when player approaches edges
- **Expansion Threshold**: Triggers when within 5 hexes of map boundary
- **Chunk Size**: Adds 10 new rows/columns per expansion
- **Seamless**: Uses same seed for consistent terrain generation in expanded areas

#### Fog of War
- **Fully Implemented**: Unexplored hexes rendered in dark gray (#1a1a1a)
- **Exploration Tracking**: `exploredHexes` Set in game state
- **Auto-Reveal**: Moving to a hex reveals all hexes within 2-hex radius
- **Persistence**: Explored hexes saved and restored across sessions

### ✅ Movement System (Mouse-Based)

#### Controls
- **Click**: Select a hex to view details in Hex Info panel
- **Double-Click**: Move to the clicked hex (if within range and setting enabled)
- **Move Button**: Click "Move Here" button in Hex Info panel to move to selected hex

#### Movement Mechanics
- **Range Validation**: Can only move to hexes within 1 hex distance (character's `moveDistance`)
- **Hex Distance**: Uses cube coordinate conversion for accurate hex distance calculation
- **Visual Feedback**: Selected hex highlighted with red outline (#ff6b6b)
- **Smooth Animation**: Player marker smoothly animates between hexes (300ms ease-out cubic)
- **Camera Follow**: Camera smoothly follows player with lerp interpolation

#### Movement Features
- **Auto-Save**: Game saves after every move
- **Exploration**: Moving reveals hexes within 2-hex radius
- **POI Discovery**: Game log displays POI discoveries when entering a hex
- **Encounter Notifications**: Encounters shown in game log when entering a hex
- **Reachability Check**: Warns if trying to move to hex outside range

### ✅ UI Components

#### Main Interface Layout
Three-column layout:
1. **Left Column**:
   - Equipment tab (10 equipment slots)
   - Party/Character tabs (toggle between party roster and character sheet)
2. **Center**: Canvas with hex grid
3. **Right Column**: Hex Info / Config tabs

#### Game Log
- Real-time message feed at bottom of screen
- Message types: info, system, action, discovery, encounter, warning
- Auto-scrolls to latest message

#### Character Stats Panel
Displays full D&D 5e character sheet:
- Name, class, level
- All 6 abilities with modifiers
- AC, Proficiency Bonus, Initiative
- HP bar with visual indicator
- Hit Die information

#### Party Panel
Shows all party members:
- Player character slot
- 3 NPC slots (currently empty)
- HP indicators for each member

#### Hex Info Panel
Displays selected hex information:
- Terrain type and coordinates
- Weather conditions
- Difficulty rating
- POI details (if present)
- Encounter information (if present)
- "Move Here" button (if reachable)

#### Settings Panel
- **Double-Click Movement**: Toggle double-click to move (default: enabled)
- Future: Additional game options

### ✅ Canvas Rendering

#### Hex Grid Visualization
- **HTML5 Canvas**: Imperative rendering with React integration
- **Hex Size**: 30px radius
- **Offset Coordinates**: Even-row offset for hex layout
- **Terrain Colors**: Visual color coding for all 9 terrain types
- **POI Icons**: Custom-drawn icons (no emoji)
- **Player Marker**: Gold circle with party size number
- **Fog of War**: Unexplored hexes rendered dark with grid outline

#### Camera System
- **Auto-Center**: Camera centers on player initially
- **Smooth Follow**: Lerp-based smooth camera movement (10% lerp speed)
- **Coordinate Transform**: World space → screen space conversion for rendering
- **60 FPS Animation Loop**: Continuous rendering via requestAnimationFrame

#### Mouse Interaction
- **Hover Cursor**: Cursor changes to pointer when over a hex
- **Click Detection**: Point-in-polygon test for hex selection
- **Coordinate Mapping**: Screen coordinates → world coordinates → hex coordinates

### ✅ Save/Load System

#### Auto-Save
- **Trigger**: Saves after every state change (movement, character updates, etc.)
- **Storage**: localStorage with key `hexcrawl_save`
- **Format**: JSON with version, timestamp, full game state

#### Save Data
```json
{
  "version": "2.0",
  "timestamp": 1234567890,
  "playerPosition": { "col": 10, "row": 7 },
  "playerCharacter": { /* Character.toJSON() */ },
  "party": { /* Party.toJSON() */ },
  "currentScene": "overworld",
  "mapSeed": "12345",
  "exploredHexes": ["10,7", "11,7", ...],
  "mapData": [ /* Array of hex objects */ ]
}
```

#### Load Game
- **Continue Button**: Disabled if no save exists
- **Scene Transition**: Loads data and transitions to overworld
- **Map Regeneration**: Uses saved `mapSeed` to regenerate terrain
- **State Restoration**: Restores character, party, position, explored hexes

## Game Flow

### Starting a New Game
1. **Title Screen** appears on launch
2. (Optional) Enter a **World Seed** or leave blank for random
3. Click **"New Game"**
   - Prompts to confirm if save exists
   - Creates new Paladin character ("Hero")
   - Initializes party (1 player + 3 empty NPC slots)
   - Generates 20×30 hex map with seed
   - Places player at center (col: 10, row: 7)
   - Auto-saves
4. **Overworld Scene** loads:
   - Map renders on canvas
   - Player marker visible
   - 2-hex radius around player revealed
   - UI panels populated

### Exploration Gameplay
1. **Click** a hex to view details in Hex Info panel
2. **Double-click** or click "Move Here" to move (if within 1 hex range)
3. Player marker smoothly animates to new hex
4. Camera smoothly follows player
5. Hexes within 2-hex radius auto-revealed (fog of war)
6. Game log shows:
   - Movement confirmation with terrain type
   - POI discovery (if present)
   - Encounter notification (if present)
7. Map auto-expands when approaching edges (within 5 hexes of boundary)
8. Game auto-saves

### Saving & Loading
- **Auto-Save**: Happens automatically after every move/state change
- **No Manual Save**: No Shift+S or manual save button (auto-save only)
- **Continue**: Click "Continue" on title screen to restore last save
  - Restores character, party, position
  - Regenerates map from saved seed
  - Restores explored hexes
  - Returns to overworld scene

## Controls Reference

### Mouse Controls
- **Click**: Select hex and view details
- **Double-Click**: Move to hex (if within range and setting enabled)
- **Hover**: Cursor changes to pointer over hexes

### UI Interactions
- **Equipment Tab**: View character equipment slots
- **Party Tab**: View party roster
- **Character Tab**: View detailed character stats
- **Hex Info Tab**: View selected hex information
- **Config Tab**: Toggle game settings
- **Move Here Button**: Move to selected hex (in Hex Info panel)

### Keyboard Controls
**Currently NOT implemented** - All controls are mouse/click-based

## Technical Details

### Hex Coordinate System
- **Offset Coordinates**: Even-row offset layout
- **Cube Coordinates**: Converted for distance calculation
- **Distance Formula**: Max of absolute differences in cube coordinates
- **View Range**: 2 hexes (hard-coded in `character.viewDistance`)
- **Move Range**: 1 hex per turn (hard-coded in `character.moveDistance`)

### Terrain & Difficulty
Each terrain has:
- **Key**: Identifier (e.g., "grassland")
- **Name**: Display name
- **Color**: Hex color code
- **Difficulty**: Numeric value (1-4)
- **Encounter Table**: Terrain-specific encounters
- **Weather Table**: Terrain-specific weather effects

### Performance Optimizations
- **Continuous Rendering**: 60 FPS animation loop for smooth camera/player movement
- **Canvas Rendering**: Efficient imperative rendering
- **Lazy Map Generation**: Map only generated when needed
- **Chunk-Based Expansion**: Expands in 10-row/column chunks, not individual hexes
- **Set-Based Exploration**: Fast O(1) lookup for explored hexes

## Known Limitations

### Current Scope
- **Single Class**: Only Paladin implemented (Character supports any class)
- **No NPCs**: 3 NPC slots are empty placeholders
- **No Combat**: Encounters logged but not fought
- **No Inventory**: Equipment slots exist but no items
- **All Terrain Passable**: No impassable terrain or movement costs
- **No Level Progression**: XP/leveling system not implemented
- **No Keyboard Movement**: Mouse/click-based only

### Future Expansion Points (Stubbed/Ready)

#### 1. NPC Generation
- `Party.createPlaceholderNPCs()` - Replace with random NPC generation
- Add different classes, stats, names

#### 2. Combat System
- Character has `takeDamage()`, `heal()` methods
- Encounter data includes CR ratings
- Need: Combat UI, turn order, enemy stats

#### 3. Inventory & Equipment
- Equipment slots defined in Character
- Need: Item classes, loot system, equipment effects

#### 4. Movement Costs
- Terrain has `difficulty` property
- Need: Implement movement point system based on difficulty

#### 5. Additional Classes
- Character system supports any class
- Need: Class definitions for Fighter, Wizard, Rogue, etc.
- Need: Spell system

#### 6. Keyboard Movement
- Infrastructure exists (event listeners)
- Need: WASD/arrow/numpad movement handlers

## Development Notes

### Modular Design
- **Pure JS game logic**: Terrain, encounters, characters independent of React
- **React for UI**: Components handle rendering and user interaction
- **Context for state**: Centralized state management
- **Canvas for rendering**: Efficient hex grid visualization

### Save System
- **Version field**: Enables future migration if save format changes
- **Timestamp**: Track when game was last played
- **JSON serialization**: All classes have `toJSON()` / `fromJSON()` methods

### Map Expansion
- **Seamless**: Uses same seed for consistent generation
- **4-Directional**: Can expand north, south, east, west
- **Threshold-Based**: Expands before player reaches edge
- **Efficient**: Generates only new hexes, preserves existing map

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Run development server**
   ```bash
   npm run dev
   ```
   Opens at http://localhost:3000

3. **Build for production**
   ```bash
   npm run build
   ```

4. **Play the game**
   - Click "New Game" (optionally enter a seed)
   - Click hexes to explore
   - Double-click to move
   - Watch the game log for discoveries!

## Summary

This is a playable hexcrawl RPG prototype with:
- **React 19.0** architecture with Context API state management
- **Mouse-based controls** (click to select, double-click to move)
- **D&D 5e character system** (Paladin implemented)
- **Procedural map generation** with seeded reproducibility
- **Dynamic map expansion** for infinite exploration
- **Fog of war** with exploration tracking and visual rendering
- **Auto-save** system with localStorage persistence
- **Party management** (1 player + 3 NPC slots)
- **Encounter & weather** systems
- **Game log** for real-time feedback
- **Smooth canvas rendering** with animated camera and player movement

The codebase is modular and extensible, ready for combat, inventory, NPCs, additional classes, and more complex gameplay systems.
