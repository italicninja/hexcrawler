# D&D Hexcrawl Generator

A web-based hexcrawl map generator for D&D and other tabletop RPGs. Generate beautiful hex maps with terrain, weather, encounters, and points of interest.

## Current Features

### Core Map Generation
- ✅ Configurable hex grid size (5-50 width/height)
- ✅ 8 terrain types (grassland, forest, mountains, desert, swamp, water, tundra, hills)
- ✅ Procedural terrain generation with adjustable variety
- ✅ Seeded random generation for reproducible maps
- ✅ Beautiful D&D-themed UI with parchment and leather aesthetics

### Points of Interest
- ✅ Random POI generation (dungeons, settlements, ruins, towers, caves, shrines, camps)
- ✅ Adjustable POI frequency (0-20%)
- ✅ Weighted POI distribution
- ✅ Visual POI icons on hexes

### Encounters & Weather
- ✅ Terrain-specific encounter tables
- ✅ Dynamic weather generation per terrain type
- ✅ Weather effects that impact gameplay (visibility, travel difficulty, etc.)

### Interactive Features
- ✅ Hover to preview hex information
- ✅ Click to pin/unpin hex details
- ✅ Compact floating info panel on canvas
- ✅ Toggle between fixed position and mouse-following popup
- ✅ Visual terrain legend
- ✅ Hex highlighting on selection

### Persistence & Export
- ✅ Save maps to browser localStorage
- ✅ Load previously saved maps
- ✅ Export to PNG image

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

### Generating a Map
1. Adjust grid size (width/height)
2. Set or randomize the seed for reproducible maps
3. Adjust terrain variety slider (1-10)
4. Set POI frequency (0-20%)
5. Click "Generate Map"

### Exploring the Map
- **Hover** over hexes to preview their information
- **Click** a hex to pin its details (click again to unpin)
- Toggle "Popup follows mouse" for a floating info panel
- Use the legend to identify terrain types

### Saving & Exporting
- Click **Save** to store your map in browser storage
- Click **Load** to restore a saved map
- Click **Export PNG** to download the map as an image

## Tech Stack

- Vite - Fast build tool and dev server
- Vanilla JavaScript - No framework dependencies
- HTML5 Canvas - Hex rendering
- CSS3 - Custom D&D-themed styling

## TODO

### High Priority
- [ ] Add travel mechanics calculator
  - Movement rates based on terrain difficulty
  - Travel time estimation
  - Difficulty modifiers from weather
- [ ] Improve terrain generation algorithm
  - Better Perlin noise implementation
  - More realistic terrain clusters
  - Biome transitions
- [ ] Hex coordinate labels toggle
- [ ] Zoom/pan controls for large maps

### Medium Priority
- [ ] Settlement/faction system
  - Named settlements with population sizes
  - Faction territories and influence zones
  - Faction relationships (allied, neutral, hostile)
  - Trade routes between settlements
- [ ] Enhanced POI details
  - POI descriptions
  - Danger levels
  - Treasure/rewards
  - Quest hooks
- [ ] Custom terrain types
  - User-defined terrains
  - Custom colors and difficulty
- [ ] PDF export with detailed hex information

### Low Priority / Future Enhancements
- [ ] Random name generator for settlements
- [ ] Resource generation (minerals, lumber, etc.)
- [ ] Roads and paths between settlements
- [ ] Rivers and coastlines
- [ ] Elevation visualization
- [ ] Season/time-of-day variants
- [ ] Multiple map layers (political, resources, danger)
- [ ] Shareable map URLs (encode map data in URL)
- [ ] Import/export to JSON
- [ ] Print-friendly view
- [ ] Mobile-responsive improvements
- [ ] Undo/redo functionality
- [ ] Hex editing mode (manually change terrain/POI)

### Code Improvements
- [ ] Add unit tests
- [ ] Improve hex collision detection performance
- [ ] Add TypeScript for better type safety
- [ ] Modularize terrain generation
- [ ] Add JSDoc comments

## Contributing

Feel free to fork and submit pull requests! This is a learning project and contributions are welcome.

## License

MIT
