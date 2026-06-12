# CLAUDE.md — Architecture & Development Guide

Hexcrawler is a web-based D&D 5e hexcrawl RPG: React 19 + TypeScript (strict) + Vite,
HTML5 canvas rendering, Context API + useReducer state, localStorage persistence.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` — must stay at 0 errors (strict mode, no `@ts-nocheck`) |
| `npm run lint` | ESLint v9 flat config (`eslint.config.js`) — must pass with 0 warnings |
| `npm run test:unit:run` | Vitest unit suite (`tests/**/*.test.ts`) |
| `npm run test:smoke` | Playwright boot check (needs `npm run preview` on :4173) |
| `npm run test:qa` | Playwright QA agent E2E suites (`tests/qa-agent/`) |

CI (`.github/workflows/qa-tests.yml`): a fast `checks` job (typecheck + lint + unit
tests) gates the Playwright browser matrix (chromium + firefox).

## Layout

```
src/
  game/          Pure game logic — NO React imports allowed here
    ai/          Behavior-tree enemy AI (AIEngine, scorers, conditions, actions)
    data/        Static tables (GameTableData)
  contexts/      GameStateContext (ACTIONS + provider), GameLogContext, SettingsContext
    reducers/    8 domain reducers composed in reducers/index.ts
  hooks/         Scene-level hooks (see OverworldScene section below)
  components/
    scenes/      TitleScene, CharacterCreationScene, OverworldScene, TownScene,
                 ExplorationScene, GameOverScene, CombatSceneWrapper
    canvas/      HexGridCanvas, InteriorHexCanvas, CombatCanvas
    ui/          Panels and widgets (combat/ holds the combat UI)
  types/         state.ts (GameState, CombatStateData), game.ts, scene.ts
  utils/         hexMath, HexGrid, SaveManager, logger, renderers
tests/           Vitest unit tests (mirrors src/), qa-agent/ (Playwright), smoke-test.js
```

Layering rule: `src/game/` and `src/utils/` never import from `contexts/` or
`components/`. Hex math comes from `utils/hexMath` (GameStateContext re-exports it
for components, but game code imports the util directly).

## State management

- `GameStateContext` exposes `{ state, dispatch, actions, ...helpers }`. All action
  types live in the `ACTIONS` map there.
- `contexts/reducers/index.ts` composes 8 domain reducers (game, map, character,
  inventory, combat, quest, shop, exploration). A reducer returns `null` for actions
  it doesn't handle, letting the next one try.
- Combat state lives ONLY in `state.combatState` (`CombatStateData`). There are no
  legacy top-level combat fields.
- Saves: `utils/SaveManager` (3 slots + autosave + quicksave rotation, version
  checking, quota handling). `LOAD_GAME` in `gameReducer` reconstructs Sets/Maps and
  class instances (`Character`, `Party`, `Quest`, `Shop`) and deliberately resets
  combat and interior state.

### The clone-then-mutate pattern (important)

Characters in state are class instances. The house pattern for updates:

```ts
const updated = state.playerCharacter.clone(); // JSON round-trip deep copy
updated.gold += 50;                            // mutate the clone freely
dispatch({ type: actions.UPDATE_CHARACTER, payload: updated });
```

`SurvivalManager` and `RestManager` functions MUTATE the character passed to them —
always hand them a clone, never the instance state currently references. `Item` has
the same `clone()` method.

## OverworldScene

The overworld is the main in-game scene. It was split (June 2026) into a ~550-line
component plus four hooks — keep it that way:

- `hooks/useCombatOrchestration` — victory/defeat detection, initiative logging, the
  AI turn system (turn tokens + timers), combat click/end-turn handlers. Instantiated
  once in OverworldScene so its effects stay mounted scene-wide; rendered through
  `CombatSceneWrapper`'s `CombatCanvasPane` / `CombatActionPane`.
- `hooks/useInteriorNavigation` — active interior map, interior movement (stairs,
  lazy floor generation, loot), building interactions.
- `hooks/useOverworldActions` — hex movement (terrain checks, rations, POI
  discovery), foraging + cooldowns, engaging POI combat.
- `hooks/useOverworldInput` — unified keyboard routing (overworld vs interior) and
  F5 quicksave.

Combat is an overlay on the overworld (`state.combatState?.battlefield` truthy), not
a separate route.

## Lint/type baseline

- Zero `@ts-nocheck`. `any` is allowed only at documented loose boundaries via
  file-level `eslint-disable @typescript-eslint/no-explicit-any` (combat, generators,
  save serialization, SurvivalManager/RestManager/EnemyMovement).
- `eslint.config.js` turns OFF the React-Compiler-era react-hooks rules
  (`static-components`, `immutability`, `purity`, `set-state-in-effect`) and
  `exhaustive-deps` as a baseline — the codebase predates them. Re-enable
  incrementally when refactoring a component; don't silence new violations of
  `rules-of-hooks`, which stays on.
- Don't name plain functions with a `use` prefix (lint treats them as hooks).

## Conventions

- Commits: conventional prefixes (`feat:`, `fix:`, `refactor:`, `chore:`, `test:`,
  `docs:`, `ci:`), small and focused, imperative subject.
- Logging: always through `utils/logger` categories (`logger.combat.debug(...)`),
  never bare `console.log`.
- Constants belong in `constants/gameConstants.ts` (XP tables, time costs, feature
  flags like `FEATURES.SURVIVAL_ENABLED`).
- See [TODO.md](./TODO.md) for the prioritized backlog (class implementations are the
  main feature track; Barbarian is the reference implementation).
