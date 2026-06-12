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
- ✅ **TypeScript strict mode**: 100% of source type-checked, zero `@ts-nocheck`
- ✅ **React Components**: Functional components with hooks
- ✅ **Context API**: GameStateContext (8 composed domain reducers), GameLogContext, SettingsContext
- ✅ **Scene hooks**: useCombatOrchestration, useInteriorNavigation, useOverworldActions, useOverworldInput
- ✅ **Component Structure**:
  - `src/game/` - Pure game logic, decoupled from React (Combat, Character, AI, generators)
  - `src/contexts/` + `src/contexts/reducers/` - State management
  - `src/hooks/` - Reusable custom hooks
  - `src/components/scenes/` - Title, CharacterCreation, Overworld, Town, Exploration scenes
  - `src/components/ui/` - UI components (combat UI lives in `ui/combat/`)
  - `src/components/canvas/` - HexGridCanvas, InteriorHexCanvas, CombatCanvas

👉 **See [CLAUDE.md](./CLAUDE.md) for the full architecture and development guide**

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
- **TypeScript (strict)** - Full type coverage, zero suppressions
- **Vite 5.0** - Build tool and dev server
- **Context API + useReducer** - State management
- **HTML5 Canvas** - Hex rendering with React integration
- **Vitest + Playwright** - Unit and E2E testing (both run in CI)
- **CSS3** - Dark theme inspired by Kobold+ Fight Club
- **localStorage** - Game persistence

## Project Status & Roadmap

**Current Completeness:** ~92% (Core gameplay complete; class implementations are the main feature track)  
**Focus:** D&D 5e class mechanics (Barbarian is the reference implementation)

👉 **See [TODO.md](./TODO.md) for detailed task list**

### Recently Completed ✅
- ✅ Full D&D 5e combat system with action economy and behavior-tree enemy AI
- ✅ TypeScript migration complete — strict mode, zero `@ts-nocheck`
- ✅ ESLint v9 flat config + Prettier; lint/typecheck/unit tests all gate CI
- ✅ Unit test suite (Vitest): Character, DiceRoller, Combat, SaveManager, Survival, reducers
- ✅ OverworldScene split into focused scene hooks (2,317 → ~550 lines)
- ✅ Item/Inventory, Quest, Shop, Survival (rations/foraging/exhaustion) systems

### Next Up (Priority Order)
1. 🔴 **Classes** - Fighter, Rogue, Ranger, Paladin mechanics (then the rest)
2. 🟡 **Status effects** - General D&D 5e condition system
3. 🟡 **Performance** - Canvas dirty-flag rendering
4. ⚡ **Polish** - Weather gameplay effects, terrain movement costs, minimap

### Documentation
- **[TODO.md](./TODO.md)** - Consolidated task list with priorities and estimates
- **[CLAUDE.md](./CLAUDE.md)** - Architecture overview and development guide
- **[GAME_GUIDE.md](./GAME_GUIDE.md)** - Player guide and gameplay mechanics

## Contributing

Feel free to fork and submit pull requests! This is a learning project and contributions are welcome.

## License

MIT
