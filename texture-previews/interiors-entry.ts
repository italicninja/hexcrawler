// Bundles the real interior generators so the preview renders actual game layouts.
import { CaveGenerator } from '../src/game/CaveGenerator';
import { DungeonGenerator } from '../src/game/DungeonGenerator';
import { RuinsGenerator } from '../src/game/RuinsGenerator';
import { TowerGenerator } from '../src/game/TowerGenerator';
import { TownGenerator } from '../src/game/TownGenerator';
(window as unknown as Record<string, unknown>).Interiors = { CaveGenerator, DungeonGenerator, RuinsGenerator, TowerGenerator, TownGenerator };
