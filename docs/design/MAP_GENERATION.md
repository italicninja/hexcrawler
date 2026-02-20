# Map Generation System

## Overview

Map generation is a multi-stage pipeline that runs once during new-game setup. A single numeric `mapSeed` drives all randomness, guaranteeing the same seed always produces the same map.

**Orchestrator:** `src/terrainGenerator.ts` — `class TerrainGenerator`

**Pipeline:**

```
mapSeed
  ↓
1. RegionGenerator  → Voronoi regions (biomes, climate)
2. WeatherSystem    → Per-region weather patterns + fronts
3. TerrainAlgorithm → Per-hex terrain type from region biome
4. RiverGenerator   → River hex placement (post-terrain pass)
5. POISystem        → Points of interest (terrain + CR aware)
  ↓
state.hexGrid[][]   (2D array of hex objects)
state.regions[]     (region metadata)
state.hexToRegion   (Map: "col,row" → regionIndex)
state.weatherSystem (live WeatherSystem instance)
```

---

## Terrain Types

9 terrain types with associated rendering color, movement difficulty, and generation constraints:

| Key         | Display Name | Hex Color | Movement Difficulty | Notes                   |
| ----------- | ------------ | --------- | ------------------- | ----------------------- |
| `water`     | Deep Water   | #4682B4   | 4                   | Impassable without boat |
| `river`     | River        | #5B9BD5   | 2                   | Impassable without raft |
| `swamp`     | Swamp        | #4F7942   | 3                   | High rest interruption  |
| `grassland` | Grassland    | #90EE90   | 1                   | Easiest traversal       |
| `forest`    | Forest       | #228B22   | 2                   | Common shrines/camps    |
| `hills`     | Hills        | #8B7355   | 2                   | Common towers/ruins     |
| `mountains` | Mountains    | #696969   | 3                   | Caves, high CR          |
| `desert`    | Desert       | #EDC9AF   | 2                   | Poor foraging DC        |
| `tundra`    | Tundra       | #E0E0E0   | 2                   | Cold damage weather     |

Movement difficulty adds to travel time and is used by `EncounterManager.getTravelDifficulty()`.

---

## Stage 1: Region Generation

**File:** `src/RegionGenerator.ts` — `class RegionGenerator`

### Voronoi Partitioning

The map is divided into large coherent geographic regions using a Voronoi algorithm:

1. **Auto-size** — Number of regions scales with map area: `clamp(5, 15, floor(totalHexes / 60))`, targeting 40–80 hexes per region.
2. **Scatter centers** — Region centers placed with minimum spacing enforcement (`sqrt(area/n) * 0.6`) to avoid clustering.
3. **Voronoi assignment** — Each hex is assigned to the nearest region center (Euclidean distance in cube coordinates).
4. **Characterize** — Three independent Perlin noise layers sample elevation, moisture, and temperature for each region center.
5. **Biome determination** — Climate matrix maps the three values to a biome type.
6. **Boundary tracking** — Hexes that border a different region are flagged.

### Region Types (7 Biomes)

| Biome            | Primary Terrains         | Moisture | Temp (°C) |
| ---------------- | ------------------------ | -------- | --------- |
| Temperate Forest | forest, grassland, hills | 6–8      | 10–20     |
| Tropical Jungle  | forest, swamp, grassland | 8–10     | 25–35     |
| Arid Desert      | desert, grassland, hills | 1–3      | 20–40     |
| Arctic Tundra    | tundra, mountains, hills | 2–5      | -10–5     |
| Alpine Highlands | mountains, hills, tundra | 4–7      | 0–15      |
| Wetlands         | swamp, forest, grassland | 7–10     | 15–25     |
| Coastal          | grassland, water, swamp  | 5–8      | 10–20     |

### Climate Classification Logic

```
Temperature < 30%:
  Elevation > 60% → Alpine Highlands
  Else            → Arctic Tundra

Temperature > 70%:
  Moisture < 40%  → Arid Desert
  Else            → Tropical Jungle

Temperate (30–70%):
  Moisture < 30%              → Arid Desert
  Moisture > 70%              → Wetlands
  Low elevation + moderate    → Coastal
  Default                     → Temperate Forest
```

### Region Data Structure

```typescript
{
  id: string,                    // e.g. "region_5"
  centerHex: { col, row },       // Region center point
  radius: number,                // Influence radius in hexes
  biome: RegionType,             // Biome classification object
  climate: string,               // "temperate" | "tropical" | etc.
  elevation: number,             // 0–10 scale
  moisture: number,              // 0–10 scale
  temperature: number,           // Degrees Celsius
  boundaries: Set<string>        // Hex keys ("col,row") on region border
}
```

### Output

`RegionGenerator.generate()` returns `{ regions[], hexToRegion: Map<string, number> }`. Both are stored in game state and queried per-hex during terrain selection and weather lookup.

---

## Stage 2: Weather System Initialization

**File:** `src/WeatherSystem.ts` — `class WeatherSystem`

Weather is initialized immediately after regions are created. Each region gets a base weather pattern rolled from its biome's weather probability table.

### Weather Types and Gameplay Effects

| Weather    | Visibility Mod | Movement Cost Mod | Special Effects                       |
| ---------- | -------------- | ----------------- | ------------------------------------- |
| Clear      | 0              | 0                 | None                                  |
| Light Rain | -1             | +0.5              | Perception -1                         |
| Rain       | -2             | +1                | Perception -2, Survival -1            |
| Heavy Rain | -4             | +2                | Perception -4, Survival -2            |
| Storm      | -6             | +3                | Lightning strike risk                 |
| Light Snow | -1             | +0.5              | Temperature -5°C                      |
| Snow       | -3             | +2                | Temperature -10°C                     |
| Blizzard   | -8             | +4                | Temperature -20°C, 1d4 cold damage/hr |
| Mist       | -2             | 0                 | Perception -2                         |
| Fog        | -5             | +1                | Perception -5, Survival -2            |
| Dense Fog  | -8             | +2                | Perception -8, Survival -3            |
| Wind       | -1             | +1                | Ranged attacks disadvantage           |
| Sandstorm  | -7             | +3                | 1d4 damage/hr                         |
| Heatwave   | -1             | +1                | CON -2, 3x water                      |
| Aurora     | +2             | 0                 | Cosmetic / night only                 |

### Regional Weather Probabilities by Biome

| Biome            | Most Common Weathers                          |
| ---------------- | --------------------------------------------- |
| Temperate Forest | Clear 60%, Rain 25%, Fog 10%, Storm 5%        |
| Tropical Jungle  | Clear 40%, Rain 40%, Storm 15%, Fog 5%        |
| Arid Desert      | Clear 80%, Sandstorm 15%, Heatwave 5%         |
| Arctic Tundra    | Clear 40%, Snow 30%, Blizzard 20%, Aurora 10% |
| Alpine Highlands | Clear 50%, Wind 25%, Snow 15%, Storm 10%      |
| Wetlands         | Fog 40%, Rain 35%, Clear 20%, Mist 5%         |
| Coastal          | Clear 50%, Rain 25%, Fog 15%, Storm 10%       |

### Dynamic Weather Fronts

Weather fronts are moving weather systems that override regional weather when they pass through:

```typescript
WeatherFront {
  position: { col, row },   // Current hex position
  radius: number,           // Area of effect in hexes
  duration: number,         // Hours until expiration (6–48)
  movement: { dx, dy },     // Hexes per game-hour
  weather: WeatherPattern   // Weather type + effects
}
```

- Fronts spawn at map edges or region centers (10% chance per `update()` call)
- `WeatherSystem.update(hoursElapsed)` is called on every `ADVANCE_TIME` action
- A front overrides a region's base weather for all hexes within its radius
- Expired fronts are removed; new fronts can spawn randomly

### Current Weather Lookup

```typescript
weatherSystem.getCurrentWeather(col, row);
// 1. Check all active fronts — first match wins
// 2. Fall back to hex's region base weather
```

---

## Stage 3: Terrain Selection Per Hex

**File:** `src/terrainGenerator.ts` — `generateRegionBasedTerrain()`

Each hex is assigned a terrain type based on its region and local elevation noise.

### Zone-Based Blending

Each hex is classified into one of three zones based on its distance from the region center, normalized to the region radius (edge factor):

| Zone | Edge Factor | Behavior                                         |
| ---- | ----------- | ------------------------------------------------ |
| Core | < 0.4       | Dominant biome terrain only                      |
| Mid  | 0.4–0.7     | Biome terrain with elevation variation           |
| Edge | > 0.7       | Blends primary biome + neighboring region biomes |

### Elevation Bands per Terrain Type

`selectByElevation(biomeTypes, elevation, zone)` maps elevation (0–1) to terrain:

| Elevation Range | Preferred Terrain    |
| --------------- | -------------------- |
| 0.00–0.20       | water                |
| 0.15–0.35       | swamp                |
| 0.20–0.60       | grassland            |
| 0.35–0.70       | forest               |
| 0.55–0.80       | hills                |
| 0.70–1.00       | mountains            |
| 0.40–0.80       | desert (hot biomes)  |
| 0.60–1.00       | tundra (cold biomes) |

### Terrain Algorithms

**File:** `src/terrainAlgorithms.ts`

Four noise-based algorithms available (selected in map settings):

| Algorithm    | Description                                                |
| ------------ | ---------------------------------------------------------- |
| Biome        | Multi-layer noise with temperature/moisture axes (default) |
| Multi-Octave | Layered Perlin noise, varied scale/amplitude               |
| Simple       | Single-octave noise, fastest                               |
| Island       | Radial falloff to force ocean at map edges                 |

---

## Stage 4: River Generation

**File:** `src/riverGenerator.ts`

Rivers are generated as a post-terrain pass. River generation:

1. Identifies candidate river sources — mountain or high-elevation hexes
2. Traces downhill paths using elevation gradient with noise variation
3. Rivers terminate at water hexes or map edges
4. Hexes along the river path are re-typed as `river`
5. Rivers avoid looping back on themselves

Rivers divide the map and require rafts to cross. They affect:

- Foraging DC (+2 for river hexes)
- POI placement (camps prefer river adjacency)

---

## Stage 5: POI Placement

**File:** `src/poiSystem.ts` — `class POISystem`

Points of Interest (POIs) are placed across the map after terrain and rivers are finalized.

### POI Types

| Type       | Visible Without Discovery  | Interaction                                  |
| ---------- | -------------------------- | -------------------------------------------- |
| Camp       | Yes                        | Rest, shop (basic supplies)                  |
| Village    | Yes                        | Rest, shop, quests (25% chance)              |
| Town       | Yes                        | Rest, inn, shop, quests (50% chance)         |
| City       | Yes                        | Rest, inn, full shop, quests (75% chance)    |
| Metropolis | Yes                        | Rest, inn, full shop, quests (90%), services |
| Ruins      | Yes                        | Loot, optional combat                        |
| Cave       | Yes                        | Exploration, optional combat                 |
| Tower      | Yes                        | Exploration, optional combat                 |
| Shrine     | Yes                        | Piety increase, blessings                    |
| Dungeon    | No (hidden until adjacent) | Full interior exploration                    |
| Encounter  | No (hidden)                | Forced combat                                |

### Terrain-to-POI Preferences

| Terrain   | Preferred POI Types            |
| --------- | ------------------------------ |
| Mountains | Cave, Tower, Ruins, Dungeon    |
| Hills     | Tower, Ruins, Camp             |
| Forest    | Shrine, Camp, Ruins, Encounter |
| Swamp     | Ruins, Shrine, Encounter       |
| Desert    | Ruins, Camp, Encounter         |
| Tundra    | Cave, Camp, Encounter          |
| Grassland | Camp, Encounter, Ruins         |
| River     | Camp, Encounter                |

### CR Distance Scaling

Encounter and dungeon difficulty scales with distance from the player's starting hex:

| Distance (hexes) | Base CR |
| ---------------- | ------- |
| 0–2              | 0       |
| 3–5              | 0–1     |
| 6–10             | 1–3     |
| 11–15            | 3–5     |
| 16–20            | 5–8     |
| 21+              | 8–12    |

Terrain difficulty adds `floor(difficulty / 2)` to the base CR, making mountain dungeons harder than grassland encounters at the same distance.

### Settlement Naming

Pre-built name pools per settlement tier ensure readable, evocative location names:

- 15 names each for camps, villages, towns, cities
- 10 metropolis names
- 8 dungeon names
- 5 description variants per settlement tier

---

## Hex Data Structure

Each cell in `state.hexGrid[row][col]` contains:

```typescript
{
  col: number,
  row: number,
  terrain: {
    key: string,          // e.g. "forest"
    name: string,         // Display name
    color: string,        // Hex color
    difficulty: number,   // 1–4 movement difficulty
  },
  elevation: number,      // 0–1 local elevation (noise value)
  regionId: number,       // Index into state.regions[]
  weatherPattern: {       // Copied from region on generation
    type: string,
    effects: { visibility, movementCost, skillChecks, ... }
  },
  poi: POIObject | null,  // Point of interest data, if any
  hasRiver: boolean,      // Adjacent river hex flag
}
```

---

## Fog of War

- `state.exploredHexes: Set<"col,row">` — All hexes the player has visited
- `state.discoveredPOIs: Set<"col,row">` — POIs the player has seen
- Hexes within `playerCharacter.viewDistance` hexes of the player are visible
- Hidden POI types (dungeons, encounters) are only revealed when adjacent
- `isHexVisible(col, row)` — Returns whether a hex should be rendered fully or dimmed

---

## Determinism

The entire map generation pipeline is deterministic given the same `mapSeed`:

- All randomness flows from seeded LCG RNG (`sin(seed) * 10000` pattern in `BaseGenerator`)
- Perlin noise uses the seed to set initial permutation table
- Same seed → same regions, same terrain, same rivers, same POIs, same initial weather
- Weather evolution after game start is time-based but still seeded

Old saves regenerate region data on load if the region data is missing (backward compatibility), since the same seed always produces the same result.
