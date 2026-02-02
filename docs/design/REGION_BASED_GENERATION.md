# Region-Based Biome and Weather System

**Design Document**

## Overview

Transform the current per-hex terrain generation into a coherent region-based system where biomes cluster naturally and weather patterns span entire regions rather than individual hexes.

---

## Current System Issues

1. **Random Per-Hex Terrain**: Each hex is generated independently using noise, leading to unrealistic "checkerboard" patterns
2. **Independent Weather**: Every hex has its own weather, ignoring regional patterns (storms, fronts, etc.)
3. **No Biome Coherence**: Deserts next to tundra, forests scattered randomly
4. **Disconnected POI Placement**: POIs don't respect biome boundaries or regional characteristics

---

## Proposed Architecture

### 1. Region Generation (Macro Level)

**Regions** are large contiguous areas (5-15 hexes) that define the dominant biome and climate.

#### Region Properties
```javascript
{
  id: string,                    // Unique identifier
  centerHex: { col, row },       // Region center point
  radius: number,                // Influence radius in hexes
  biome: BiomeType,              // Primary biome (see below)
  climate: ClimateType,          // Climate classification
  weatherPattern: WeatherPattern,// Current weather affecting region
  elevation: number,             // Base elevation (0-10)
  moisture: number,              // Base moisture level (0-10)
  temperature: number,           // Base temperature (-10 to 40°C)
  boundaries: Set<string>        // Hex keys on region border
}
```

#### Region Generation Algorithm

1. **Voronoi-Based Partitioning**
   - Scatter 8-15 region centers across map using seeded random
   - Each hex assigned to nearest region center
   - Creates natural, irregular boundaries

2. **Region Characterization**
   - Use noise layers to assign elevation, moisture, temperature to each region
   - Combine values to determine biome type
   - Add transition zones at region boundaries (blend hexes)

3. **Region Types**
   ```javascript
   const REGION_TYPES = {
     TEMPERATE_FOREST: { biomes: ['forest', 'grassland'], moisture: 6-8, temp: 10-20 },
     TROPICAL_JUNGLE: { biomes: ['forest', 'swamp'], moisture: 8-10, temp: 25-35 },
     ARID_DESERT: { biomes: ['desert', 'grassland'], moisture: 1-3, temp: 20-40 },
     ARCTIC_TUNDRA: { biomes: ['tundra', 'mountains'], moisture: 2-5, temp: -10-5 },
     ALPINE_HIGHLANDS: { biomes: ['mountains', 'hills'], moisture: 4-7, temp: 0-15 },
     WETLANDS: { biomes: ['swamp', 'forest'], moisture: 7-10, temp: 15-25 },
     COASTAL: { biomes: ['grassland', 'water'], moisture: 5-8, temp: 10-20 }
   };
   ```

---

### 2. Biome Assignment (Micro Level)

Within each region, hexes get specific terrain based on:
- Region's dominant biome
- Local elevation variation (noise)
- Distance from region center
- Proximity to water/rivers

#### Biome Distribution Rules

```javascript
// Example: TEMPERATE_FOREST region
function assignHexTerrain(hex, region, localElevation, distanceFromCenter) {
  const baseElevation = region.elevation + localElevation;
  const edgeFactor = distanceFromCenter / region.radius;
  
  // Core region hexes (< 50% radius)
  if (edgeFactor < 0.5) {
    if (baseElevation < 3) return 'grassland';
    if (baseElevation < 6) return 'forest';
    return 'hills';
  }
  
  // Edge hexes (transition zones)
  // Blend with neighboring regions
  return blendWithNeighborRegions(hex, region, baseElevation);
}
```

#### Transition Zones

Border hexes between regions should blend biomes:
- Weighted average of adjacent region biomes
- Gradual elevation/moisture changes
- Natural-looking boundaries (not hard lines)

---

### 3. Weather System (Regional)

Weather affects entire regions, not individual hexes.

#### Weather Pattern Structure

```javascript
{
  type: WeatherType,           // CLEAR, RAIN, STORM, SNOW, FOG, etc.
  intensity: number,           // 0-10 (light to severe)
  duration: number,            // Hours remaining
  affectedRegions: Set<id>,    // Regions under this pattern
  movement: { dx, dy },        // Weather front direction/speed
  effects: {                   // Gameplay effects
    visibility: modifier,
    movementCost: modifier,
    skillChecks: { survival: -2, perception: -5 },
    damage: { type: 'cold', amount: '1d4 per hour' }
  }
}
```

#### Weather Generation Rules

1. **Initial Weather**: Each region starts with weather based on climate
   ```javascript
   TEMPERATE_FOREST → 60% clear, 25% rain, 10% fog, 5% storm
   ARID_DESERT → 80% clear, 15% sandstorm, 5% heat wave
   ARCTIC_TUNDRA → 40% clear, 30% snow, 20% blizzard, 10% aurora
   ```

2. **Weather Fronts**: Weather patterns move across regions
   - Fronts spawn at map edges or region centers
   - Move in consistent direction (using noise for variation)
   - Affect multiple adjacent regions
   - Duration: 6-48 hours

3. **Regional Weather Coherence**
   - Adjacent regions with similar climates share weather more often
   - Extreme climate boundaries create weather conflicts (storms)
   - Mountain regions create rain shadows

4. **Time-Based Weather Evolution**
   - Weather changes every 4-12 hours (seeded random)
   - Smooth transitions (clear → overcast → rain → storm)
   - Seasonal variations (if implemented later)

---

### 4. Implementation Plan

#### Phase 1: Region Generator
- Create `RegionGenerator.js` class
- Implement Voronoi partitioning algorithm
- Assign regions to hexes
- Define region boundaries

#### Phase 2: Biome Assignment
- Modify `TerrainGenerator.js` to use regions
- Implement region-aware terrain selection
- Add transition zone blending
- Update `terrainAlgorithms.js` with region support

#### Phase 3: Regional Weather
- Create `WeatherSystem.js` class
- Replace per-hex weather with regional patterns
- Implement weather front movement
- Add time-based weather evolution

#### Phase 4: Integration
- Update `GameStateContext.jsx` to store regions
- Modify save/load to persist region data
- Update canvas rendering to visualize region boundaries (debug mode)
- Adjust POI placement to respect regions

---

## Data Flow

```
Map Seed
  ↓
Region Generator
  ├─ Scatter region centers (Voronoi)
  ├─ Assign hexes to regions
  ├─ Characterize regions (climate, elevation, moisture)
  └─ Define boundaries
  ↓
Terrain Generator
  ├─ For each hex:
  │   ├─ Get assigned region
  │   ├─ Calculate local elevation (noise)
  │   ├─ Apply biome distribution rules
  │   └─ Blend transition zones
  └─ Rivers flow within/across regions
  ↓
Weather System
  ├─ Initialize regional weather patterns
  ├─ Spawn weather fronts
  ├─ Move fronts across regions (time-based)
  └─ Apply effects to all hexes in region
  ↓
POI Placement
  ├─ Use region properties for POI types
  │   (e.g., desert regions → ruins, oases)
  └─ Cluster settlements within regions
```

---

## Example: TEMPERATE_FOREST Region

```javascript
// Region definition
{
  id: 'region_5',
  centerHex: { col: 15, row: 10 },
  radius: 7,
  biome: REGION_TYPES.TEMPERATE_FOREST,
  climate: 'temperate',
  elevation: 4,      // Rolling hills
  moisture: 7,       // High moisture
  temperature: 15,   // Mild
  weatherPattern: {
    type: 'LIGHT_RAIN',
    intensity: 3,
    duration: 8,  // hours
    effects: {
      visibility: -2,
      movementCost: +0.5,
      skillChecks: { perception: -2 }
    }
  }
}

// Resulting hexes in region
Core hexes (0-3 hexes from center):
  - 60% Forest
  - 30% Grassland
  - 10% Hills

Mid hexes (4-5 hexes from center):
  - 40% Forest
  - 40% Grassland
  - 20% Hills

Edge hexes (6-7 hexes, near boundary):
  - Blend with adjacent ALPINE_HIGHLANDS region
  - 20% Forest
  - 30% Grassland
  - 40% Hills
  - 10% Mountains (from neighbor influence)

Weather affects ALL hexes in region uniformly:
  "Light rain falls across the temperate forest. Visibility reduced, ground slippery."
```

---

## Technical Considerations

### Performance
- **Region lookup**: Store `hexToRegion` map for O(1) access
- **Weather updates**: Only recalculate when time advances (not every render)
- **Transition blending**: Pre-compute during generation (not runtime)

### Determinism
- All random generation uses seeded RNG
- Same seed → same regions, biomes, initial weather
- Weather evolution is time-based but still seeded

### Backwards Compatibility
- New saves include region data
- Old saves can regenerate regions on load (same seed = same regions)
- Fallback to per-hex weather if regions missing

### Debugging
- Add debug overlay to render region boundaries
- Color-code regions by type
- Display current weather patterns
- Toggle in dev mode only

---

## Future Enhancements

1. **Seasonal Weather**: Different patterns for spring/summer/fall/winter
2. **Extreme Events**: Hurricanes, droughts, wildfires that affect multiple regions
3. **Player Influence**: Settlements alter local climate/weather
4. **Dynamic Regions**: Regions change over in-game years (forest → grassland from deforestation)
5. **Faction Territories**: Political boundaries aligned with geographic regions

---

## Example Implementation Snippets

### Region Generator
```javascript
class RegionGenerator {
  constructor(seed, width, height) {
    this.seed = seed;
    this.width = width;
    this.height = height;
    this.noise = new PerlinNoise(seed);
  }

  generate(numRegions = 10) {
    // 1. Scatter region centers
    const centers = this.scatterCenters(numRegions);
    
    // 2. Voronoi partitioning
    const hexToRegion = this.assignHexesToRegions(centers);
    
    // 3. Characterize each region
    const regions = this.characterizeRegions(centers, hexToRegion);
    
    return { regions, hexToRegion };
  }

  scatterCenters(numRegions) {
    const centers = [];
    const random = () => {
      const x = Math.sin(this.seed++) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < numRegions; i++) {
      centers.push({
        col: Math.floor(random() * this.width),
        row: Math.floor(random() * this.height)
      });
    }
    return centers;
  }

  assignHexesToRegions(centers) {
    const map = new Map();
    
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        // Find nearest center
        let minDist = Infinity;
        let nearestRegion = 0;
        
        centers.forEach((center, idx) => {
          const dist = this.hexDistance(col, row, center.col, center.row);
          if (dist < minDist) {
            minDist = dist;
            nearestRegion = idx;
          }
        });
        
        map.set(`${col},${row}`, nearestRegion);
      }
    }
    
    return map;
  }

  characterizeRegions(centers, hexToRegion) {
    return centers.map((center, idx) => {
      // Use noise to determine region properties
      const elevation = this.noise.noise2D(center.col / 10, center.row / 10);
      const moisture = this.noise.noise2D(center.col / 10 + 100, center.row / 10 + 100);
      const temp = this.noise.noise2D(center.col / 10 + 200, center.row / 10 + 200);
      
      // Map to region type
      const biome = this.determineRegionType(elevation, moisture, temp);
      
      return {
        id: `region_${idx}`,
        centerHex: center,
        radius: this.calculateRadius(idx, hexToRegion),
        biome,
        elevation: ((elevation + 1) / 2) * 10,
        moisture: ((moisture + 1) / 2) * 10,
        temperature: temp * 25,
        weatherPattern: this.initialWeather(biome)
      };
    });
  }

  determineRegionType(elevation, moisture, temp) {
    const e = (elevation + 1) / 2;
    const m = (moisture + 1) / 2;
    const t = (temp + 1) / 2;
    
    // Cold regions
    if (t < 0.3) {
      return e > 0.6 ? REGION_TYPES.ALPINE_HIGHLANDS : REGION_TYPES.ARCTIC_TUNDRA;
    }
    
    // Hot regions
    if (t > 0.7) {
      return m < 0.4 ? REGION_TYPES.ARID_DESERT : REGION_TYPES.TROPICAL_JUNGLE;
    }
    
    // Temperate regions
    if (m < 0.3) return REGION_TYPES.ARID_DESERT;
    if (m > 0.7) return REGION_TYPES.WETLANDS;
    
    return e > 0.5 ? REGION_TYPES.ALPINE_HIGHLANDS : REGION_TYPES.TEMPERATE_FOREST;
  }
}
```

### Weather System
```javascript
class WeatherSystem {
  constructor(regions, seed) {
    this.regions = regions;
    this.seed = seed;
    this.weatherFronts = [];
  }

  initializeWeather() {
    // Each region gets initial weather based on climate
    this.regions.forEach(region => {
      region.weatherPattern = this.rollWeather(region.biome.weatherTable);
    });
  }

  advanceTime(hours) {
    // Move weather fronts
    this.weatherFronts.forEach(front => {
      front.position.col += front.movement.dx * hours;
      front.position.row += front.movement.dy * hours;
      front.duration -= hours;
    });
    
    // Remove expired fronts
    this.weatherFronts = this.weatherFronts.filter(f => f.duration > 0);
    
    // Spawn new fronts randomly
    if (this.random() < 0.1 * hours) {
      this.spawnWeatherFront();
    }
    
    // Update region weather based on fronts
    this.updateRegionalWeather();
  }

  updateRegionalWeather() {
    this.regions.forEach(region => {
      // Check if any front affects this region
      const affectingFront = this.weatherFronts.find(front => 
        this.hexDistance(front.position, region.centerHex) < front.radius
      );
      
      if (affectingFront) {
        region.weatherPattern = affectingFront.weather;
      } else {
        // Natural weather evolution
        region.weatherPattern = this.evolveWeather(region);
      }
    });
  }

  rollWeather(weatherTable) {
    const roll = this.random();
    let cumulative = 0;
    
    for (const [weather, probability] of Object.entries(weatherTable)) {
      cumulative += probability;
      if (roll < cumulative) {
        return this.createWeatherPattern(weather);
      }
    }
  }
}
```

---

## Summary

This system creates:
- **Coherent biomes** that cluster naturally using Voronoi regions
- **Regional weather** that affects multiple hexes and moves dynamically
- **Realistic transitions** between different biome types
- **Improved immersion** with weather patterns that make geographic sense

The implementation preserves determinism (seeded generation) while adding depth to exploration and environmental storytelling.
