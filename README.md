# Hexcrawler

A web-based hexcrawl RPG for D&D 5e. Explore procedurally generated hex maps with a party system, fog of war, turn-based movement, and D&D 5e character mechanics.

## Current Features

### RPG Gameplay
- ✅ **Character System**: Full D&D 5e character sheet with abilities, HP, AC
- ✅ **Party Management**: 1 player character + 3 NPC party members
- ✅ **Turn-Based Movement**: Move 1 hex per turn, view range of 2 hexes
- ✅ **Fog of War**: Only explored hexes are visible
- ✅ **Equipment System**: 10 equipment slots + inventory
- ✅ **Save/Load**: Persistent game state in localStorage
- ✅ **Game Log**: Real-time action and event logging

### Core Map Generation
- ✅ Configurable hex grid size (5-50 width/height)
- ✅ 9 terrain types (water, river, grassland, forest, mountains, desert, swamp, tundra, hills)
- ✅ Advanced Perlin noise terrain generation with 4 algorithms:
  - Biome-Based (realistic elevation + moisture)
  - Multi-Octave (detailed noise layers)
  - Simple (fast generation)
  - Island (island-shaped maps)
- ✅ Realistic river generation flowing from mountains to water
- ✅ Seeded random generation for reproducible maps
- ✅ Modern dark-themed UI inspired by Kobold+ Fight Club

### Points of Interest
- ✅ Smart settlement placement (near rivers, on good terrain)
- ✅ 7 POI types with custom-drawn icons (no emoji):
  - 🏰 Dungeons, 🏘️ Settlements, 🏛️ Ruins, 🗼 Towers
  - 🕳️ Caves, ⛩️ Shrines, ⛺ Camps
- ✅ Terrain-appropriate POI placement
- ✅ Adjustable POI frequency (0-20%)
- ✅ Weighted POI distribution

### Encounters & Weather
- ✅ Terrain-specific encounter tables (9 terrain types)
- ✅ Dynamic weather generation per terrain type
- ✅ Weather effects that impact difficulty
- ✅ Difficulty calculation (terrain + weather combined)
- ✅ Descriptive difficulty levels (Easy, Moderate, Difficult, etc.)

### Interactive Features
- ✅ **Canvas Rendering**: Smooth HTML5 canvas hex grid
- ✅ Click to select hex and view details
- ✅ Double-click to move (configurable setting)
- ✅ Movement validation (1 hex range)
- ✅ Visual hex highlighting on selection
- ✅ Player position marker with party size
- ✅ POI discovery and encounter notifications

### Customization
- ✅ Tabbed UI interface (Equipment, Party, Character, Hex Info, Config)
- ✅ Settings panel with game options
- ✅ Toggle double-click movement
- ✅ Modern dark theme UI matching Kobold+ Fight Club design

### Persistence
- ✅ Auto-save game state to localStorage
- ✅ Continue previous game from title screen
- ✅ Seeded map generation for reproducible worlds

### Code Architecture
- ✅ **React Components**: Functional components with hooks
- ✅ **Context API**: GameStateContext & SettingsContext for state management
- ✅ **Custom Hooks**: useGameState, useSettings, useGameLoop, useEventListener
- ✅ **Component Structure**:
  - `src/contexts/` - State management contexts
  - `src/hooks/` - Reusable custom hooks
  - `src/components/scenes/` - TitleScene, OverworldScene
  - `src/components/ui/` - UI components (GameLog, CharacterStats, PartyList, etc.)
  - `src/components/canvas/` - HexGridCanvas component
  - `src/` - Game logic modules (terrainGenerator, encounters, etc.)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Usage

### Starting a New Game
1. Enter a seed (or leave blank for random)
2. Click "New Game" to generate your world
3. Your character and party are automatically created

### Playing the Game
- **Click** a hex to view its details
- **Double-click** a hex to move there (if within range)
- **View** party members in the Party tab
- **Check** equipment in the Equipment tab
- **Monitor** the Game Log for events and discoveries

### Saving Your Progress
- Game state is auto-saved to localStorage
- Click "Continue" on the title screen to resume
- Each save includes: character, party, explored hexes, and position

## Tech Stack

- **React 19.0** - UI library with hooks
- **Vite 5.0** - Build tool and dev server
- **Context API + useReducer** - State management
- **HTML5 Canvas** - Hex rendering with React integration
- **CSS3** - Dark theme inspired by Kobold+ Fight Club
- **localStorage** - Game persistence

## Project Status & Roadmap

**Current Completeness:** ~85% (Core gameplay functional)  
**Focus:** Technical debt cleanup + remaining features

👉 **See [TODO.md](./TODO.md) for detailed task list**

### Recently Completed ✅
- ✅ Full D&D 5e combat system with action economy
- ✅ Item & Inventory system with equipment slots
- ✅ Quest system with quest givers in towns
- ✅ Shop system with buying/selling
- ✅ Region-based biome generation with weather
- ✅ TypeScript infrastructure (40% coverage)
- ✅ Modular reducer architecture

### Next Up (Priority Order)
1. 🔴 **Critical Cleanup** - Delete 1,120 lines of dead code
2. 🔴 **Code Quality** - Add ESLint, Prettier, and unit tests
3. 🔴 **Refactoring** - Split large files (3 files >1,000 lines)
4. 🟡 **Features** - Rations/Water system, Party AI, Full Combat UI
5. ⚡ **Performance** - Code splitting, canvas optimization

### Documentation
- **[TODO.md](./TODO.md)** - Consolidated task list with priorities and estimates
- **[CLAUDE.md](./CLAUDE.md)** - Architecture overview and development guide
- **[AGENTS.md](./AGENTS.md)** - Agent-focused development patterns
- **[GAME_GUIDE.md](./GAME_GUIDE.md)** - Player guide and gameplay mechanics

## Contributing

Feel free to fork and submit pull requests! This is a learning project and contributions are welcome.

## License

MIT
