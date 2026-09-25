# Hexcrawler Development Log

A running record of how the project evolves: what changed, why, and the route we
took to get there. There is one entry per commit, newest at the bottom. Images live in
`docs/devlog/<date>-<slug>/`. We keep the version we settled on plus a few
rejected ones, so the log shows how each decision was reached.

## Before this log (Jan - Sep 2026)

The log starts at commit ~255. By then Hexcrawler was a React 19 + TypeScript
D&D 5e hexcrawl with:
- canvas rendering for the overworld, interiors and combat
- eight domain reducers
- behaviour-tree enemy AI
- procedural caves, dungeons, ruins, towers and towns
- an SRD monster database for CR 1/8-5
- Barbarian as the reference class implementation

Git history covers the details before this point.

---

## 2026-09-25: Terrain texture overhaul, exploration

**What:** a standalone preview harness (`texture-previews/`) that renders the
current `HexTextureGenerator` next to four replacement art directions. The
previews use the same sample map, plus real layouts from the game's interior
generators.

**Why:** the current textures have several structural problems:
- Each terrain is a single 32-40px repeating tile anchored to the canvas origin,
  so decorations get sliced at hex edges.
- Water has no shoreline, and rivers are just blue hexes.
- Interiors, towns and combat maps fall back to flat colours.

**Route:**
1. Bundled the live generator with esbuild so the baseline is pixel-exact, not
   a reimplementation.
2. Built four candidates, each drawn per hex with world-space noise, river
   channels that connect across hex edges, and neighbour-aware coastlines:
   - A. Painted Relief: per-pixel hillshade
   - B. Ink & Parchment Atlas
   - C. 16-bit Pixel Art: ordered dithering and lit sprites
   - D. Tabletop Tiles: flat vector
3. Picked C for a deeper pass. Extended it to interiors with per-POI themes
   (dungeon, cave, ruins, tower, town) and a 3/4 wall-face trick. Added torch
   and mushroom lighting quantised to 4 levels.
4. Rejected along the way:
   - The first dungeon pass: floor and wall tops were too close in tone to tell
     rooms apart. Fixed with dark wall tops, bright brick faces and warmer floors.
   - A river wobble strong enough to fold the distance field. It produced a
     smeared ink wedge at the banks.

| Current (baseline) | A. Painted Relief |
| --- | --- |
| ![current](docs/devlog/2026-09-25-texture-overhaul/00-current.png) | ![relief](docs/devlog/2026-09-25-texture-overhaul/01-painted-relief.png) |
| **B. Ink & Parchment Atlas** | **D. Tabletop Tiles** |
| ![atlas](docs/devlog/2026-09-25-texture-overhaul/02-ink-atlas.png) | ![tabletop](docs/devlog/2026-09-25-texture-overhaul/04-tabletop-tiles.png) |

**Front-runner: C. 16-bit Pixel Art**

![pixel overworld](docs/devlog/2026-09-25-texture-overhaul/03-pixel-16bit.png)

| Dungeon | Cave |
| --- | --- |
| ![dungeon](docs/devlog/2026-09-25-texture-overhaul/10-pixel-dungeon.png) | ![cave](docs/devlog/2026-09-25-texture-overhaul/11-pixel-cave.png) |
| **Ruins** | **Tower** |
| ![ruins](docs/devlog/2026-09-25-texture-overhaul/12-pixel-ruins.png) | ![tower](docs/devlog/2026-09-25-texture-overhaul/13-pixel-tower.png) |

![town](docs/devlog/2026-09-25-texture-overhaul/14-pixel-town.png)

**Open:** final style choice, then port into `src/utils/hexTextureGenerator.ts`.
Interiors will need an offscreen canvas per floor because wall faces depend on
neighbouring hexes. Once the style is final, trim the rejected images here to a
representative few.

## 2026-09-25 — Auto-merge PRs when CI passes

**What:** Added an `auto-merge` job to `.github/workflows/qa-tests.yml`. On a
same-repo PR it merges with a merge commit and deletes the branch, but only after
`checks` (typecheck, lint, unit) and both `qa-tests` browsers succeed.

**Why:** For now, a green CI run is enough review to land a PR.

**Route:** The test workflow already existed, so this is one new job, not a new
workflow. It depends on `checks` and `qa-tests` directly rather than on
`qa-summary`, because `qa-summary` runs with `if: always()` and reports success
when `qa-tests` is skipped. Merging directly in the job avoids needing GitHub's
repo-level auto-merge setting. Fork PRs are skipped because their token is read-only.
