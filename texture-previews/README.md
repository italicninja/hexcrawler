# Terrain texture candidates

Four replacement directions for `src/utils/hexTextureGenerator.ts`, each shown next to the current output.
Every style renders the same 11x8 sample map plus one tile per terrain.

| File | Style | Full-map render (uncached) |
| --- | --- | --- |
| `00-current.png` | Current generator, bundled from `src/` | ~30 ms |
| `01-painted-relief.png` | A. Painted Relief: per-pixel heightfields with hillshade | ~790 ms |
| `02-ink-atlas.png` | B. Ink & Parchment Atlas: watercolour wash plus inked symbols | ~1400 ms |
| `03-pixel-16bit.png` | C. 16-bit Pixel Art: Bayer dithering and lit sprites | ~65 ms |
| `04-tabletop-tiles.png` | D. Tabletop Tiles: flat vector tiles with bold icons | ~2 ms |

All four new styles fix the same structural problems in the current one:

- **Tiles are drawn per hex, not as a repeating pattern.** The current `createPattern(..., 'repeat')` tile is anchored to the canvas origin, so decorations get cut off at hex edges.
- **Rivers are channels.** Each one runs from the hex centre to the shared edge midpoint of every river or water neighbour, so it stays continuous across hexes and forks into deltas.
- **Coastlines exist.** A, B and C draw foam, beaches, or an inked shore where water meets land. This needs to know the neighbouring hexes' terrain.
- **World-space noise.** Noise is sampled in map coordinates, so texture flows from one hex into the next instead of repeating 4 variants.

## Style C interiors (`interiors.html`)

Real layouts from `CaveGenerator`, `DungeonGenerator`, `RuinsGenerator`, `TowerGenerator` and `TownGenerator`, called the way `useHexInteraction` calls them (CR 3, hex size 30). Each one sits next to a hand-built sampler room that covers every interior tile key.

| File | Theme | Floor / walls | Light |
| --- | --- | --- | --- |
| `10-pixel-dungeon.png` | dungeon | flagstones, brick | wall torches |
| `11-pixel-cave.png` | cave | cracked rock, layered rock | glowing mushrooms, exit daylight |
| `12-pixel-ruins.png` | ruins | mossy broken flagstones; overgrowth instead of void | daylight |
| `13-pixel-tower.png` | tower | planks, masonry; night sky outside | wall torches |
| `14-pixel-town.png` | town | cobbles, pavers, grass, fences; roofs + facades per building type | daylight |

- **3/4 depth:** a wall's top face is dark, and floor pixels just south of any wall or building show its brick face or timber facade, followed by a contact shadow. This is the change that makes rooms readable.
- **Themes:** the generators all emit the same `floor` / `wall` keys, so the look comes from `poiType`, which the map objects already carry. No generator changes are needed.
- **Lighting:** ambient light plus point lights, quantised to 4 levels with Bayer dithering. Markers such as chests, loot, encounters, torches and mushrooms are drawn after lighting so they stay readable. Light ignores line of sight; add a cheap raycast if bleed through walls matters.

Integration: a tile depends on its north neighbours because of the faces, so render each interior floor once to an offscreen canvas (under 100 ms at town size) and blit it. Re-render only when terrain changes. Hazards are left out of the preview because they stay hidden until found.

## Re-rendering

`baseline.js` is a frozen bundle of the retired `HexTextureGenerator` (the game now renders with
`src/utils/pixel*Renderer.ts`), so it can no longer be rebuilt from `src/`.

```sh
# After changing the interior generators, rebuild interiors.js from interiors-entry.ts:
<repo>/node_modules/esbuild/bin/esbuild texture-previews/interiors-entry.ts --bundle --format=iife   --outfile=texture-previews/interiors.js --define:import.meta.env.DEV=false --define:import.meta.env.VITE_LOG_LEVEL=undefined
PLAYWRIGHT_PATH=<repo>/node_modules/playwright node texture-previews/render.mjs
```

You can also open `index.html` directly in a browser (`?style=ink-atlas` shows a single style).

## Integration notes

- A and B are per-pixel, so they need a cached offscreen canvas per hex keyed by `col,row` (an LRU works for the infinite overworld). At radius 30 that is about 0.3 ms per hex, generated once when the hex is revealed. C and D are cheap enough to cache per terrain variant, just as the current generator does.
- Style C now covers interior and town keys (see above). The combat battlefield reuses the overworld keys or the POI type (`dungeon`, `cave`, ...), so it can map onto the same two tilesets.
