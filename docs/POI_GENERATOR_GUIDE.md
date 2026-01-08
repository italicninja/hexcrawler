# POI Generator Implementation Guide

This guide explains how to create walkable interior maps for different POI types using the existing generator framework.

## Overview

The town system demonstrates how to create immersive, walkable interior spaces for POIs. This same pattern can be applied to:
- **Camps** - Small settlements with traders and NPCs
- **Shrines** - Sacred spaces with altars and prayer areas
- **Markets** - Trading hubs with stalls and vendors
- **Forts** - Military outposts with barracks and armories

## Architecture

### Generator Hierarchy

```
InteriorGenerator (base class)
├── CaveGenerator (existing - organic dungeons)
├── RuinsGenerator (existing - procedural ruins)
├── TowerGenerator (existing - vertical dungeons)
├── DungeonGenerator (existing - classic dungeons)
└── TownGenerator (NEW - structured towns)
    └── Future generators can follow this pattern
```

### Key Components

1. **Generator Class** (`src/game/*Generator.js`)
   - Extends `InteriorGenerator`
   - Defines custom terrain types
   - Implements `generate(width, height, data)` method
   - Returns structured map data

2. **Context Integration** (`src/contexts/GameStateContext.jsx`)
   - Add action types (e.g., `ENTER_CAMP`, `EXIT_CAMP`)
   - Generate interior map in action reducer
   - Store map in `state.interiorMaps[poiKey]`

3. **Scene Component** (`src/components/scenes/*Scene.jsx`)
   - Use `InteriorHexCanvas` for rendering
   - Handle player movement and interactions
   - Implement POI-specific interaction logic

4. **Scene Routing** (`src/App.jsx`)
   - Add conditional render for new scene
   - Import scene component

## Creating a New POI Generator

### Step 1: Create Generator Class

```javascript
// src/game/CampGenerator.js
import { InteriorGenerator } from './InteriorGenerator.js';

export class CampGenerator extends InteriorGenerator {
  constructor() {
    super();
    
    // Define custom terrain types
    this.terrainTypes = {
      ...this.terrainTypes,
      campfire: {
        key: 'campfire',
        name: 'Campfire',
        color: '#ff6b35',
        walkable: true,
        isInteractive: true
      },
      tent: {
        key: 'tent',
        name: 'Tent',
        color: '#8b7355',
        walkable: false
      },
      tentEntrance: {
        key: 'tentEntrance',
        name: 'Tent Entrance',
        color: '#6b5d48',
        walkable: true,
        isInteractive: true
      }
    };
  }

  generate(width, height, campData) {
    // 1. Initialize grid
    const grid = this.initializeGrid(width, height, this.terrainTypes.grass);
    
    // 2. Place structures
    this.placeCampfire(grid);
    this.placeTents(grid);
    this.placeEntrance(grid);
    
    // 3. Convert to hex array
    const hexes = this.gridToHexes(grid);
    
    // 4. Return map data
    return {
      seed: this.seed,
      poiType: 'camp',
      width,
      height,
      hexes,
      structures: [], // Array of placed structures
      encounters: [],
      loot: [],
      hazards: [],
      entrance: this.findEntrance(grid)
    };
  }
  
  placeCampfire(grid) {
    // Implementation...
  }
  
  placeTents(grid) {
    // Implementation...
  }
}
```

### Step 2: Add Context Actions

```javascript
// In GameStateContext.jsx

// Add to ACTIONS
const ACTIONS = {
  // ... existing actions
  ENTER_CAMP: 'ENTER_CAMP',
  EXIT_CAMP: 'EXIT_CAMP'
};

// Add to initialState
const initialState = {
  // ... existing state
  currentCamp: null
};

// Add reducer cases
case ACTIONS.ENTER_CAMP: {
  const { col, row, poi } = action.payload;
  const poiKey = `${col},${row}`;
  
  let campInterior = state.interiorMaps[poiKey];
  
  if (!campInterior) {
    const generator = new CampGenerator();
    generator.setSeed(`camp-${poiKey}-${state.mapSeed}`);
    
    const width = 15;  // Smaller than towns
    const height = 12;
    campInterior = generator.generate(width, height, { name: poi.name });
    
    return {
      ...state,
      currentScene: 'camp',
      currentCamp: { col, row, poi },
      interiorMaps: {
        ...state.interiorMaps,
        [poiKey]: campInterior
      }
    };
  }
  
  return {
    ...state,
    currentScene: 'camp',
    currentCamp: { col, row, poi }
  };
}

case ACTIONS.EXIT_CAMP:
  return {
    ...state,
    currentScene: 'overworld',
    currentCamp: null
  };
```

### Step 3: Create Scene Component

```javascript
// src/components/scenes/CampScene.jsx
import { useState, useEffect } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import InteriorHexCanvas from '../canvas/InteriorHexCanvas';
// ... other imports

function CampScene() {
  const { state, actions, dispatch } = useGameState();
  const [playerPosition, setPlayerPosition] = useState(null);
  const [selectedHex, setSelectedHex] = useState(null);
  
  const { currentCamp, interiorMaps } = state;
  const poiKey = currentCamp ? `${currentCamp.col},${currentCamp.row}` : null;
  const campMap = poiKey ? interiorMaps[poiKey] : null;
  
  // Initialize player at entrance
  useEffect(() => {
    if (campMap?.entrance) {
      setPlayerPosition(campMap.entrance);
    }
  }, [campMap]);
  
  // Handle hex interactions
  const handleHexDoubleClick = (hex) => {
    // Movement logic
    // Interaction logic
  };
  
  return (
    <div className="camp-scene">
      {/* Similar layout to TownScene */}
      <InteriorHexCanvas
        interiorMap={campMap}
        playerPosition={playerPosition}
        selectedHex={selectedHex}
        onHexClick={setSelectedHex}
        onHexDoubleClick={handleHexDoubleClick}
      />
    </div>
  );
}
```

### Step 4: Update useHexInteraction

```javascript
// src/hooks/useHexInteraction.js

// Update getPassiveEventChoices
const getPassiveEventChoices = (poi) => {
  if (poi.type === 'camp') {
    return [
      { label: 'Enter Camp', action: 'enter_camp', style: 'primary' },
      { label: 'Leave', action: 'leave', style: '' }
    ];
  }
  // ... other POI types
};

// Update handlePassiveChoice
if (action === 'enter_camp') {
  dispatch({
    type: actions.ENTER_CAMP,
    payload: { col: hex.col, row: hex.row, poi: poi }
  });
  dismissEvent();
}
```

### Step 5: Add Scene Routing

```javascript
// src/App.jsx

import CampScene from './components/scenes/CampScene';

// In GameRouter component
{state.currentScene === 'camp' && (
  <ErrorBoundary>
    <CampScene />
  </ErrorBoundary>
)}
```

## POI-Specific Considerations

### Camps
- **Size**: 12-15 hexes wide/tall
- **Features**: Tents, campfire, trader stalls, guard posts
- **Interactions**: Trade with merchants, hire mercenaries, rest
- **Terrain**: Dirt paths, grass, campfire areas

### Shrines
- **Size**: 8-12 hexes wide/tall
- **Features**: Altar, prayer mats, offerings, sacred grounds
- **Interactions**: Pray for blessings, leave offerings, receive quests
- **Terrain**: Stone floors, sacred pools, meditation areas

### Markets
- **Size**: 16-20 hexes wide/tall
- **Features**: Market stalls, auction platforms, storage areas
- **Interactions**: Buy/sell goods, participate in auctions, trade contracts
- **Terrain**: Cobblestone, vendor stalls, display areas

### Forts
- **Size**: 18-24 hexes wide/tall
- **Features**: Walls, barracks, armory, training grounds, gate
- **Interactions**: Military services, training, requisitions
- **Terrain**: Stone walls, parade ground, fortifications

## Terrain Type Guidelines

Each POI type should define unique terrain types that make sense for the location:

```javascript
this.terrainTypes = {
  // Inherit base types (floor, wall, entrance)
  ...this.terrainTypes,
  
  // Add POI-specific types
  customFloor: {
    key: 'customFloor',
    name: 'Display Name',
    color: '#hexcolor',
    walkable: true|false,
    isInteractive: true|false  // Can player interact?
  }
};
```

### Interactive Terrain

Mark terrain as interactive when the player should be able to trigger events:
- Building entrances
- Altars/shrines
- Campfires
- Market stalls
- Quest boards

## Best Practices

1. **Seeded Generation**: Always use seeded RNG for reproducible maps
   ```javascript
   generator.setSeed(`${poiType}-${poiKey}-${mapSeed}`);
   ```

2. **Fixed Sizes**: Use consistent sizes for each POI type
   - Towns: 24x18
   - Camps: 15x12
   - Shrines: 10x10
   - Markets: 20x16

3. **Clear Entrances**: Always mark entrance/exit clearly
   - Use distinctive terrain color
   - Place at bottom or side edge
   - Set `content: 'entrance'`

4. **Structured Layouts**: Plan POI layouts logically
   - Central feature (town square, campfire, altar)
   - Roads/paths connecting areas
   - Distinct zones (residential, commercial, etc.)

5. **Interaction Hints**: Provide clear UI hints
   - Show "Double-click to interact" on interactive hexes
   - Display current location in right panel
   - Use color-coded legend

6. **Persistence**: Maps are stored in `interiorMaps` and persist across sessions
   - Don't regenerate if map already exists
   - Player progress (opened chests, etc.) is tracked separately

## Testing Checklist

- [ ] Generator produces consistent output with same seed
- [ ] All walkable areas are connected
- [ ] Entrance is clearly marked and accessible
- [ ] Interactive elements respond to double-click
- [ ] Player spawns at entrance on entry
- [ ] Exit returns to overworld at correct position
- [ ] Map persists across save/load
- [ ] No overlapping structures
- [ ] Terrain colors are visually distinct

## Future Enhancements

Consider adding:
- **NPC Placement**: Populate POIs with NPCs at fixed positions
- **Day/Night Variations**: Different layouts or NPCs based on time
- **Dynamic Events**: Random events that occur in POI interiors
- **Multi-Level POIs**: Towns with buildings you can enter (nested interiors)
- **Weather Effects**: Visual effects for rain, snow, etc. in outdoor POIs
