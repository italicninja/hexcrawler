// Bundles the CURRENT in-game texture generator so the preview page can render it verbatim.
import { HexTextureGenerator } from '../src/utils/hexTextureGenerator';
import { PerlinNoise } from '../src/noise';
(window as unknown as Record<string, unknown>).Baseline = { HexTextureGenerator, PerlinNoise };
