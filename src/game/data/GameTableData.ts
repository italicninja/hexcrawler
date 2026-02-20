// @ts-nocheck
// TODO: Add proper TypeScript types
/**
 * GameTableData.js
 *
 * Comprehensive data tables for D&D 5e treasure generation and traps.
 * Implements DMG Treasure Hoard Tables and SRD v5.2.1 trap data.
 */

import logger from '../../utils/logger';

// =============================================================================
// TREASURE HOARD TABLES (by CR bracket)
// Based on DMG treasure tables for random treasure generation
// =============================================================================

export const TREASURE_HOARD_TABLES = {
  // Challenge 0-4
  CR_0_4: {
    coins: {
      cp: { dice: '6d6', multiplier: 100 },
      sp: { dice: '3d6', multiplier: 100 },
      gp: { dice: '2d6', multiplier: 10 },
    },
    gems_art: [
      { roll: [1, 6], type: 'none' },
      { roll: [7, 16], type: 'gems', value: 10, count: '2d6' },
      { roll: [17, 26], type: 'art', value: 25, count: '2d4' },
      { roll: [27, 36], type: 'gems', value: 50, count: '2d6' },
      {
        roll: [37, 44],
        type: 'gems',
        value: 10,
        count: '2d6',
        extraArt: { value: 25, count: '2d4' },
      },
      {
        roll: [45, 52],
        type: 'art',
        value: 25,
        count: '2d4',
        extraGems: { value: 50, count: '2d6' },
      },
      {
        roll: [53, 60],
        type: 'gems',
        value: 50,
        count: '2d6',
        extraArt: { value: 25, count: '2d4' },
      },
      {
        roll: [61, 65],
        type: 'gems',
        value: 10,
        count: '2d6',
        extraArt: { value: 250, count: '2d4' },
      },
      {
        roll: [66, 70],
        type: 'art',
        value: 25,
        count: '2d4',
        extraGems: { value: 100, count: '2d6' },
      },
      {
        roll: [71, 75],
        type: 'gems',
        value: 50,
        count: '2d6',
        extraArt: { value: 250, count: '2d4' },
      },
      { roll: [76, 78], type: 'gems', value: 10, count: '2d6', magicItems: ['A', 'B', 'C', 'F'] },
      { roll: [79, 80], type: 'art', value: 25, count: '2d4', magicItems: ['A', 'B', 'C', 'F'] },
      {
        roll: [81, 85],
        type: 'gems',
        value: 50,
        count: '2d6',
        magicItems: ['A', 'B', 'C', 'F', 'G'],
      },
      {
        roll: [86, 92],
        type: 'art',
        value: 25,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'F', 'G'],
      },
      {
        roll: [93, 97],
        type: 'gems',
        value: 50,
        count: '2d6',
        magicItems: ['A', 'B', 'C', 'F', 'G'],
      },
      { roll: [98, 99], type: 'art', value: 25, count: '2d4', magicItems: ['A', 'B', 'C', 'G'] },
      { roll: [100, 100], type: 'gems', value: 50, count: '2d6', magicItems: ['A', 'B', 'C', 'G'] },
    ],
  },

  // Challenge 5-10
  CR_5_10: {
    coins: {
      cp: { dice: '2d6', multiplier: 100 },
      sp: { dice: '2d6', multiplier: 1000 },
      gp: { dice: '6d6', multiplier: 100 },
      pp: { dice: '3d6', multiplier: 10 },
    },
    gems_art: [
      { roll: [1, 4], type: 'none' },
      { roll: [5, 10], type: 'art', value: 25, count: '2d4' },
      { roll: [11, 16], type: 'gems', value: 50, count: '3d6' },
      { roll: [17, 22], type: 'gems', value: 100, count: '3d6' },
      { roll: [23, 28], type: 'art', value: 250, count: '2d4' },
      {
        roll: [29, 32],
        type: 'art',
        value: 25,
        count: '2d4',
        extraGems: { value: 250, count: '2d4' },
      },
      {
        roll: [33, 36],
        type: 'gems',
        value: 50,
        count: '3d6',
        extraArt: { value: 250, count: '2d4' },
      },
      {
        roll: [37, 40],
        type: 'gems',
        value: 100,
        count: '3d6',
        extraArt: { value: 250, count: '2d4' },
      },
      {
        roll: [41, 44],
        type: 'art',
        value: 250,
        count: '2d4',
        extraGems: { value: 100, count: '3d6' },
      },
      {
        roll: [45, 49],
        type: 'art',
        value: 25,
        count: '2d4',
        extraGems: { value: 750, count: '2d4' },
      },
      {
        roll: [50, 54],
        type: 'gems',
        value: 50,
        count: '3d6',
        extraArt: { value: 750, count: '2d4' },
      },
      {
        roll: [55, 59],
        type: 'gems',
        value: 100,
        count: '3d6',
        extraArt: { value: 750, count: '2d4' },
      },
      {
        roll: [60, 63],
        type: 'art',
        value: 250,
        count: '2d4',
        extraGems: { value: 750, count: '2d4' },
      },
      {
        roll: [64, 66],
        type: 'art',
        value: 25,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'F', 'G'],
      },
      {
        roll: [67, 69],
        type: 'gems',
        value: 50,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'F', 'G'],
      },
      {
        roll: [70, 72],
        type: 'gems',
        value: 100,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'F', 'G'],
      },
      {
        roll: [73, 74],
        type: 'art',
        value: 250,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'F', 'G'],
      },
      {
        roll: [75, 76],
        type: 'art',
        value: 25,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'F', 'G', 'H'],
      },
      {
        roll: [77, 78],
        type: 'gems',
        value: 50,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'F', 'G', 'H'],
      },
      {
        roll: [79, 80],
        type: 'gems',
        value: 100,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'F', 'G', 'H'],
      },
      {
        roll: [81, 82],
        type: 'art',
        value: 250,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'F', 'G', 'H'],
      },
      {
        roll: [83, 85],
        type: 'art',
        value: 25,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'F', 'G', 'H'],
      },
      {
        roll: [86, 88],
        type: 'gems',
        value: 50,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'F', 'G', 'H'],
      },
      {
        roll: [89, 90],
        type: 'gems',
        value: 100,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'F', 'G', 'H'],
      },
      {
        roll: [91, 92],
        type: 'art',
        value: 250,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'F', 'G', 'H'],
      },
      {
        roll: [93, 94],
        type: 'art',
        value: 25,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'H'],
      },
      {
        roll: [95, 96],
        type: 'gems',
        value: 50,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'H'],
      },
      {
        roll: [97, 98],
        type: 'gems',
        value: 100,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'H'],
      },
      {
        roll: [99, 100],
        type: 'art',
        value: 250,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'H'],
      },
    ],
  },

  // Challenge 11-16
  CR_11_16: {
    coins: {
      gp: { dice: '4d6', multiplier: 1000 },
      pp: { dice: '5d6', multiplier: 100 },
    },
    gems_art: [
      { roll: [1, 3], type: 'none' },
      { roll: [4, 6], type: 'art', value: 250, count: '2d4' },
      { roll: [7, 9], type: 'art', value: 750, count: '2d4' },
      { roll: [10, 12], type: 'gems', value: 500, count: '3d6' },
      { roll: [13, 15], type: 'gems', value: 1000, count: '3d6' },
      {
        roll: [16, 19],
        type: 'art',
        value: 250,
        count: '2d4',
        extraGems: { value: 1000, count: '3d6' },
      },
      {
        roll: [20, 23],
        type: 'art',
        value: 750,
        count: '2d4',
        extraGems: { value: 1000, count: '3d6' },
      },
      {
        roll: [24, 26],
        type: 'gems',
        value: 500,
        count: '3d6',
        extraArt: { value: 750, count: '2d4' },
      },
      {
        roll: [27, 29],
        type: 'gems',
        value: 1000,
        count: '3d6',
        extraArt: { value: 750, count: '2d4' },
      },
      {
        roll: [30, 35],
        type: 'art',
        value: 250,
        count: '2d4',
        extraGems: { value: 2500, count: '2d4' },
      },
      {
        roll: [36, 40],
        type: 'art',
        value: 750,
        count: '2d4',
        extraGems: { value: 2500, count: '2d4' },
      },
      {
        roll: [41, 45],
        type: 'gems',
        value: 500,
        count: '3d6',
        extraArt: { value: 2500, count: '2d4' },
      },
      {
        roll: [46, 50],
        type: 'gems',
        value: 1000,
        count: '3d6',
        extraArt: { value: 2500, count: '2d4' },
      },
      {
        roll: [51, 54],
        type: 'art',
        value: 250,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      },
      {
        roll: [55, 58],
        type: 'art',
        value: 750,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      },
      {
        roll: [59, 62],
        type: 'gems',
        value: 500,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      },
      {
        roll: [63, 66],
        type: 'gems',
        value: 1000,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      },
      {
        roll: [67, 68],
        type: 'art',
        value: 250,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
      {
        roll: [69, 70],
        type: 'art',
        value: 750,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
      {
        roll: [71, 72],
        type: 'gems',
        value: 500,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
      {
        roll: [73, 74],
        type: 'gems',
        value: 1000,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
      {
        roll: [75, 76],
        type: 'art',
        value: 250,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
      {
        roll: [77, 78],
        type: 'art',
        value: 750,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
      {
        roll: [79, 80],
        type: 'gems',
        value: 500,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
      {
        roll: [81, 82],
        type: 'gems',
        value: 1000,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
      {
        roll: [83, 85],
        type: 'art',
        value: 250,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'H'],
      },
      {
        roll: [86, 88],
        type: 'art',
        value: 750,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'H'],
      },
      {
        roll: [89, 90],
        type: 'gems',
        value: 500,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'H'],
      },
      {
        roll: [91, 92],
        type: 'gems',
        value: 1000,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'H'],
      },
      {
        roll: [93, 94],
        type: 'art',
        value: 250,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'H', 'I'],
      },
      {
        roll: [95, 96],
        type: 'art',
        value: 750,
        count: '2d4',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'H', 'I'],
      },
      {
        roll: [97, 98],
        type: 'gems',
        value: 500,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'H', 'I'],
      },
      {
        roll: [99, 100],
        type: 'gems',
        value: 1000,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'H', 'I'],
      },
    ],
  },

  // Challenge 17+
  CR_17_PLUS: {
    coins: {
      gp: { dice: '12d6', multiplier: 1000 },
      pp: { dice: '8d6', multiplier: 1000 },
    },
    gems_art: [
      { roll: [1, 2], type: 'none' },
      { roll: [3, 5], type: 'gems', value: 1000, count: '3d6' },
      { roll: [6, 8], type: 'art', value: 2500, count: '1d10' },
      { roll: [9, 11], type: 'art', value: 7500, count: '1d4' },
      { roll: [12, 14], type: 'gems', value: 5000, count: '1d8' },
      {
        roll: [15, 22],
        type: 'gems',
        value: 1000,
        count: '3d6',
        extraArt: { value: 2500, count: '1d10' },
      },
      {
        roll: [23, 30],
        type: 'gems',
        value: 1000,
        count: '3d6',
        extraArt: { value: 7500, count: '1d4' },
      },
      {
        roll: [31, 38],
        type: 'gems',
        value: 1000,
        count: '3d6',
        extraGems: { value: 5000, count: '1d8' },
      },
      {
        roll: [39, 46],
        type: 'art',
        value: 2500,
        count: '1d10',
        extraGems: { value: 5000, count: '1d8' },
      },
      {
        roll: [47, 52],
        type: 'art',
        value: 7500,
        count: '1d4',
        extraGems: { value: 5000, count: '1d8' },
      },
      {
        roll: [53, 54],
        type: 'gems',
        value: 1000,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      },
      {
        roll: [55, 56],
        type: 'art',
        value: 2500,
        count: '1d10',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      },
      {
        roll: [57, 58],
        type: 'art',
        value: 7500,
        count: '1d4',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      },
      {
        roll: [59, 60],
        type: 'gems',
        value: 5000,
        count: '1d8',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      },
      {
        roll: [61, 62],
        type: 'gems',
        value: 1000,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
      {
        roll: [63, 64],
        type: 'art',
        value: 2500,
        count: '1d10',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
      {
        roll: [65, 66],
        type: 'art',
        value: 7500,
        count: '1d4',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
      {
        roll: [67, 68],
        type: 'gems',
        value: 5000,
        count: '1d8',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
      {
        roll: [69, 69],
        type: 'gems',
        value: 1000,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
      {
        roll: [70, 70],
        type: 'art',
        value: 2500,
        count: '1d10',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
      {
        roll: [71, 71],
        type: 'art',
        value: 7500,
        count: '1d4',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
      {
        roll: [72, 72],
        type: 'gems',
        value: 5000,
        count: '1d8',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      },
      {
        roll: [73, 74],
        type: 'gems',
        value: 1000,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'H'],
      },
      {
        roll: [75, 76],
        type: 'art',
        value: 2500,
        count: '1d10',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'H'],
      },
      {
        roll: [77, 78],
        type: 'art',
        value: 7500,
        count: '1d4',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'H'],
      },
      {
        roll: [79, 80],
        type: 'gems',
        value: 5000,
        count: '1d8',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'H'],
      },
      {
        roll: [81, 85],
        type: 'gems',
        value: 1000,
        count: '3d6',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'H', 'I'],
      },
      {
        roll: [86, 90],
        type: 'art',
        value: 2500,
        count: '1d10',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'H', 'I'],
      },
      {
        roll: [91, 95],
        type: 'art',
        value: 7500,
        count: '1d4',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'H', 'I'],
      },
      {
        roll: [96, 100],
        type: 'gems',
        value: 5000,
        count: '1d8',
        magicItems: ['A', 'B', 'C', 'D', 'E', 'H', 'I'],
      },
    ],
  },
};

// =============================================================================
// GEMSTONE TABLES (by value)
// =============================================================================

export const GEMSTONE_TABLES = {
  10: [
    'Azurite (opaque mottled deep blue)',
    'Banded agate (translucent striped brown/blue/white/red)',
    'Blue quartz (transparent pale blue)',
    'Eye agate (translucent circles of gray/white/brown/blue/green)',
    'Hematite (opaque gray-black)',
    'Lapis lazuli (opaque light and dark blue with yellow flecks)',
    'Malachite (opaque striated light and dark green)',
    'Moss agate (translucent pink or yellow-white with mossy gray/green markings)',
    'Obsidian (opaque black)',
    'Rhodochrosite (opaque light pink)',
    'Tiger eye (translucent brown with golden center)',
    'Turquoise (opaque light blue-green)',
  ],
  50: [
    'Bloodstone (opaque dark gray with red flecks)',
    'Carnelian (opaque orange to red-brown)',
    'Chalcedony (opaque white)',
    'Chrysoprase (translucent green)',
    'Citrine (transparent pale yellow-brown)',
    'Jasper (opaque blue/black/brown)',
    'Moonstone (translucent white with pale blue glow)',
    'Onyx (opaque bands of black and white/black and red)',
    'Quartz (transparent white/smoky gray/yellow)',
    'Sardonyx (opaque bands of red and white)',
    'Star rose quartz (translucent rosy stone with white star center)',
    'Zircon (transparent pale blue-green)',
  ],
  100: [
    'Amber (transparent watery gold to rich gold)',
    'Amethyst (transparent deep purple)',
    'Chrysoberyl (transparent yellow-green to pale green)',
    'Coral (opaque crimson)',
    'Garnet (transparent red/brown-green/violet)',
    'Jade (translucent light green/deep green/white)',
    'Jet (opaque deep black)',
    'Pearl (opaque lustrous white/yellowish/pink/gray/black)',
    'Spinel (transparent red/red-brown/deep green)',
    'Tourmaline (transparent pale green/blue/brown/red)',
  ],
  500: [
    'Alexandrite (transparent dark green)',
    'Aquamarine (transparent pale blue-green)',
    'Black pearl (opaque pure black)',
    'Blue spinel (transparent deep blue)',
    'Peridot (transparent rich olive green)',
    'Topaz (transparent golden yellow)',
  ],
  1000: [
    'Black opal (translucent dark green with black mottling and golden flecks)',
    'Blue sapphire (transparent blue-white to medium blue)',
    'Emerald (transparent deep bright green)',
    'Fire opal (translucent fiery red)',
    'Opal (translucent pale blue with green and golden mottling)',
    'Star ruby (translucent ruby with white star-shaped center)',
    'Star sapphire (translucent blue sapphire with white star-shaped center)',
    'Yellow sapphire (transparent fiery yellow to yellow-green)',
  ],
  5000: [
    'Black sapphire (translucent lustrous black with glowing highlights)',
    'Diamond (transparent blue-white/canary/pink/brown/blue)',
    'Jacinth (transparent fiery orange)',
    'Ruby (transparent clear red to deep crimson)',
  ],
};

// =============================================================================
// ART OBJECT TABLES (by value)
// =============================================================================

export const ART_OBJECT_TABLES = {
  25: [
    'Silver ewer',
    'Carved bone statuette',
    'Small gold bracelet',
    'Cloth-of-gold vestments',
    'Black velvet mask stitched with silver thread',
    'Copper chalice with silver filigree',
    'Pair of engraved bone dice',
    'Small mirror set in a painted wooden frame',
    'Embroidered silk handkerchief',
    'Gold locket with a painted portrait inside',
  ],
  250: [
    'Gold ring set with bloodstones',
    'Carved ivory statuette',
    'Large gold bracelet',
    'Silver necklace with a gemstone pendant',
    'Bronze crown',
    'Silk robe with gold embroidery',
    'Large well-made tapestry',
    'Brass mug with jade inlay',
    'Box of turquoise animal figurines',
    'Gold bird cage with electrum filigree',
  ],
  750: [
    'Silver chalice set with moonstones',
    'Silver-plated steel longsword with jet set in hilt',
    'Carved harp of exotic wood with ivory inlay and zircon gems',
    'Small gold idol',
    'Gold dragon comb set with red garnets as eyes',
    'Bottle stopper cork embossed with gold leaf and set with amethysts',
    'Ceremonial electrum dagger with a black pearl in the pommel',
    'Silver and gold brooch',
    'Obsidian statuette with gold fittings and inlay',
    'Painted gold war mask',
  ],
  2500: [
    'Fine gold chain set with a fire opal',
    'Old masterpiece painting',
    'Embroidered silk and velvet mantle set with numerous moonstones',
    'Platinum bracelet set with a sapphire',
    'Embroidered glove set with jewel chips',
    'Jeweled anklet',
    'Gold music box',
    'Gold circlet set with four aquamarines',
    'Eye patch with a mock eye set in blue sapphire and moonstone',
    'A necklace string of small pink pearls',
  ],
  7500: [
    'Jeweled gold crown',
    'Jeweled platinum ring',
    'Small gold statuette set with rubies',
    'Gold cup set with emeralds',
    'Gold jewelry box with platinum filigree',
    "Painted gold child's sarcophagus",
    'Jade game board with solid gold playing pieces',
    'Bejeweled ivory drinking horn with gold filigree',
  ],
};

// =============================================================================
// MAGIC ITEM TABLES (A-I)
// Based on DMG Magic Item Tables
// =============================================================================

// TODO: Implement full magic item generation
// For now, storing table references for future implementation
export const MAGIC_ITEM_TABLES = {
  A: 'Minor common/uncommon consumables (potions, scrolls)',
  B: 'Minor common/uncommon permanent items',
  C: 'Moderate uncommon consumables',
  D: 'Moderate uncommon permanent items',
  E: 'Major uncommon/rare consumables',
  F: 'Major uncommon/rare permanent items',
  G: 'Rare/very rare consumables',
  H: 'Rare/very rare permanent items',
  I: 'Very rare/legendary permanent items',
};

// =============================================================================
// SRD TRAPS (v5.2.1, pages 199-202)
// All 8 official trap types with scaling by character level
// =============================================================================

export const SRD_TRAPS = {
  'Collapsing Roof': {
    severity: 'deadly',
    trigger: 'trip wire',
    description: 'Supports collapse, dropping roof on 10×10 ft area',
    effect: 'Creatures make DC 15 Dex save or take bludgeoning damage',
    damage: {
      levels_1_4: '2d10',
      levels_5_10: '4d10',
      levels_11_16: '10d10',
      levels_17_20: '18d10',
    },
    notes: 'Half damage on successful save. Debris creates difficult terrain.',
  },

  'Falling Net': {
    severity: 'nuisance',
    trigger: 'trip wire',
    description: 'Net drops on creature triggering trap',
    effect: 'Creature makes DC 10 Dex save or restrained until freed',
    damage: 'none',
    notes:
      'DC 10 Str check or dealing 5 slashing damage to AC 10 net frees creature. Net has 5 HP.',
  },

  'Fire-Casting Statue': {
    severity: 'deadly',
    trigger: 'pressure plate',
    description: 'Statue shoots gout of magical flame in 30 ft cone',
    effect: 'Creatures in cone make Dex save or take fire damage',
    damage: {
      levels_1_4: { dice: '2d10', dc: 15 },
      levels_5_10: { dice: '4d10', dc: 15 },
      levels_11_16: { dice: '10d10', dc: 16 },
      levels_17_20: { dice: '18d10', dc: 18 },
    },
    notes: 'Half damage on successful save. DC varies by level bracket.',
  },

  'Hidden Pit': {
    severity: 'nuisance',
    trigger: 'trapdoor',
    description: 'Hinged floor section opens into pit',
    effect: 'Creature makes DC 15 Dex save or falls, taking damage',
    damage: {
      levels_1_4: '1d6',
      levels_5_10: '3d6',
      levels_11_16: '6d6',
      levels_17_20: '12d6',
    },
    notes: 'Damage listed is fall damage. Add spike damage for spiked pit variant.',
  },

  'Poisoned Darts': {
    severity: 'deadly',
    trigger: 'pressure plate',
    description: 'Spring-loaded darts shoot from small holes',
    effect: 'Creature makes Dex save or hit by 1d3 darts, each dealing damage',
    damage: {
      levels_1_4: { dart: '1d6', dc: 14 },
      levels_5_10: { dart: '2d6', dc: 14 },
      levels_11_16: { dart: '4d6', dc: 16 },
      levels_17_20: { dart: '7d6', dc: 18 },
    },
    damageType: 'poison',
    notes:
      'Each dart deals poison damage. DC and damage scale with level. Roll 1d3 for dart count.',
  },

  'Poisoned Needle': {
    severity: 'nuisance',
    trigger: 'lock or container',
    description: 'Needle springs out when lock picked or container opened without key',
    effect: 'Creature makes DC 15 Con save or takes poison damage and becomes poisoned for 1 hour',
    damage: {
      levels_1_4: '1d10',
      levels_5_10: '3d10',
      levels_11_16: '6d10',
      levels_17_20: '10d10',
    },
    damageType: 'poison',
    notes: 'Poisoned condition lasts 1 hour on failed save.',
  },

  'Spiked Pit': {
    severity: 'deadly',
    trigger: 'trapdoor',
    description: 'Hinged floor section opens into pit with spikes at bottom',
    effect: 'Creature makes DC 15 Dex save or falls onto spikes',
    damage: {
      levels_1_4: { fall: '1d6', spikes: '1d6' },
      levels_5_10: { fall: '3d6', spikes: '4d6' },
      levels_11_16: { fall: '6d6', spikes: '10d6' },
      levels_17_20: { fall: '12d6', spikes: '18d6' },
    },
    notes: 'Fall damage + spike damage on failed save. Successful save avoids pit entirely.',
  },

  'Rolling Stone': {
    severity: 'deadly',
    trigger: 'pressure plate',
    description: 'Large stone sphere rolls down corridor (high-level trap only)',
    effect: 'Creatures in path make Dex save or take bludgeoning damage',
    damage: {
      levels_11_16: { dice: '10d10', dc: 15 },
      levels_17_20: { dice: '10d10', dc: 15 },
    },
    notes:
      'Only appears in level 11+ dungeons. Stone continues rolling until stopped by obstacle. Half damage on successful save.',
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the appropriate CR bracket for treasure generation
 * @param {number} cr - Challenge rating
 * @returns {string} CR bracket key for TREASURE_HOARD_TABLES
 */
export function getCRBracket(cr) {
  if (cr <= 4) return 'CR_0_4';
  if (cr <= 10) return 'CR_5_10';
  if (cr <= 16) return 'CR_11_16';
  return 'CR_17_PLUS';
}

/**
 * Get a scaled trap based on character level
 * @param {string} trapName - Name of trap from SRD_TRAPS
 * @param {number} level - Character level (1-20)
 * @returns {object} Trap data with scaled damage/DC
 */
export function getScaledTrap(trapName, level) {
  const trap = SRD_TRAPS[trapName];
  if (!trap) {
    logger.mapgen.error('Trap not found in SRD_TRAPS', { trapName });
    return null;
  }

  // Determine level bracket
  let bracket;
  if (level <= 4) bracket = 'levels_1_4';
  else if (level <= 10) bracket = 'levels_5_10';
  else if (level <= 16) bracket = 'levels_11_16';
  else bracket = 'levels_17_20';

  // Clone trap and insert scaled damage
  const scaledTrap = { ...trap };

  if (typeof trap.damage === 'object' && trap.damage !== null && trap.damage !== 'none') {
    const damageForLevel = trap.damage[bracket];

    // Handle different damage structures
    if (typeof damageForLevel === 'string') {
      // Simple string like "2d10"
      scaledTrap.scaledDamage = damageForLevel;
    } else if (typeof damageForLevel === 'object' && damageForLevel !== null) {
      // Object with dice/dc or multiple damage types
      if (damageForLevel.dice) {
        // { dice: '2d10', dc: 15 }
        scaledTrap.scaledDamage = damageForLevel.dice;
        scaledTrap.saveDC = damageForLevel.dc;
      } else if (damageForLevel.dart) {
        // { dart: '1d6', dc: 14 } - poisoned darts
        scaledTrap.scaledDamage = damageForLevel.dart;
        scaledTrap.saveDC = damageForLevel.dc;
        scaledTrap.dartDamage = damageForLevel.dart;
      } else if (damageForLevel.fall && damageForLevel.spikes) {
        // { fall: '1d6', spikes: '1d6' } - spiked pit
        scaledTrap.scaledDamage = `${damageForLevel.fall} + ${damageForLevel.spikes}`;
      } else {
        // Unknown structure, fallback
        scaledTrap.scaledDamage = '0';
      }
    } else {
      scaledTrap.scaledDamage = '0';
    }
  } else {
    // damage is 'none' or a direct string
    scaledTrap.scaledDamage = trap.damage === 'none' ? '0' : trap.damage;
  }

  scaledTrap.level = level;
  scaledTrap.bracket = bracket;

  return scaledTrap;
}

/**
 * Get a random gemstone description by value
 * @param {number} value - Gemstone value (10, 50, 100, 500, 1000, 5000)
 * @returns {string} Gemstone description
 */
export function getRandomGemstone(value) {
  const gems = GEMSTONE_TABLES[value];
  if (!gems) {
    logger.mapgen.error('No gemstone table for value', { value });
    return `Unknown gemstone (${value}gp)`;
  }
  return gems[Math.floor(Math.random() * gems.length)];
}

/**
 * Get a random art object description by value
 * @param {number} value - Art object value (25, 250, 750, 2500, 7500)
 * @returns {string} Art object description
 */
export function getRandomArtObject(value) {
  const art = ART_OBJECT_TABLES[value];
  if (!art) {
    logger.mapgen.error('No art object table for value', { value });
    return `Unknown art object (${value}gp)`;
  }
  return art[Math.floor(Math.random() * art.length)];
}
