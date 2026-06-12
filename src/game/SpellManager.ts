/**
 * SpellManager - Helper functions for D&D 5e spell management
 * Handles spell retrieval, slot tracking, and casting validation
 */

import { SPELL_LISTS } from './SpellList';
import logger from '../utils/logger';

type SpellcastingType = 'full' | 'half' | 'warlock' | 'none';

interface SpellLike {
  name: string;
  level: number;
  [key: string]: unknown;
}

/** A class's spells keyed by level: { "0": [...], "1": [...] } */
type ClassSpellList = Record<string, SpellLike[]>;

/** Loose shape for the spellcaster fields these helpers read/mutate. */
interface SpellcasterCharacter {
  class: string;
  level: number;
  spellSlotsUsed?: Record<number, number>;
}

// SPELL_LISTS comes from a still-untyped module; assert its structural shape here.
const SPELL_LISTS_BY_CLASS = SPELL_LISTS as unknown as Record<string, ClassSpellList>;

/**
 * D&D 5e Spell Slots per Level
 * Maps character level -> spell slots by level
 * Format: [level1, level2, level3, level4, level5, level6, level7, level8, level9]
 */
const SPELL_SLOTS_BY_LEVEL: Record<string, Record<number, number[]>> = {
  // Full casters (Cleric, Druid, Wizard, Sorcerer, Bard)
  full: {
    1: [2, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [3, 0, 0, 0, 0, 0, 0, 0, 0],
    3: [4, 2, 0, 0, 0, 0, 0, 0, 0],
    4: [4, 3, 0, 0, 0, 0, 0, 0, 0],
    5: [4, 3, 2, 0, 0, 0, 0, 0, 0],
    6: [4, 3, 3, 0, 0, 0, 0, 0, 0],
    7: [4, 3, 3, 1, 0, 0, 0, 0, 0],
    8: [4, 3, 3, 2, 0, 0, 0, 0, 0],
    9: [4, 3, 3, 3, 1, 0, 0, 0, 0],
    10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
    11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
    12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
    13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
    14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
    15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
    16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
    17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
    18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
    19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
    20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
  },

  // Half casters (Paladin, Ranger)
  half: {
    1: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [2, 0, 0, 0, 0, 0, 0, 0, 0],
    3: [3, 0, 0, 0, 0, 0, 0, 0, 0],
    4: [3, 0, 0, 0, 0, 0, 0, 0, 0],
    5: [4, 2, 0, 0, 0, 0, 0, 0, 0],
    6: [4, 2, 0, 0, 0, 0, 0, 0, 0],
    7: [4, 3, 0, 0, 0, 0, 0, 0, 0],
    8: [4, 3, 0, 0, 0, 0, 0, 0, 0],
    9: [4, 3, 2, 0, 0, 0, 0, 0, 0],
    10: [4, 3, 2, 0, 0, 0, 0, 0, 0],
    11: [4, 3, 3, 0, 0, 0, 0, 0, 0],
    12: [4, 3, 3, 0, 0, 0, 0, 0, 0],
    13: [4, 3, 3, 1, 0, 0, 0, 0, 0],
    14: [4, 3, 3, 1, 0, 0, 0, 0, 0],
    15: [4, 3, 3, 2, 0, 0, 0, 0, 0],
    16: [4, 3, 3, 2, 0, 0, 0, 0, 0],
    17: [4, 3, 3, 3, 1, 0, 0, 0, 0],
    18: [4, 3, 3, 3, 1, 0, 0, 0, 0],
    19: [4, 3, 3, 3, 2, 0, 0, 0, 0],
    20: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  },

  // Warlock (Pact Magic - different system)
  warlock: {
    1: [1, 0, 0, 0, 0, 0, 0, 0, 0], // 1st level slots
    2: [2, 0, 0, 0, 0, 0, 0, 0, 0], // 2 1st level slots
    3: [0, 2, 0, 0, 0, 0, 0, 0, 0], // 2 2nd level slots
    4: [0, 2, 0, 0, 0, 0, 0, 0, 0],
    5: [0, 0, 2, 0, 0, 0, 0, 0, 0], // 2 3rd level slots
    6: [0, 0, 2, 0, 0, 0, 0, 0, 0],
    7: [0, 0, 2, 0, 0, 0, 0, 0, 0],
    8: [0, 0, 2, 0, 0, 0, 0, 0, 0],
    9: [0, 0, 2, 0, 0, 0, 0, 0, 0],
    10: [0, 0, 2, 0, 0, 0, 0, 0, 0],
    11: [0, 0, 3, 0, 0, 0, 0, 0, 0], // 3 3rd level slots
    12: [0, 0, 3, 0, 0, 0, 0, 0, 0],
    13: [0, 0, 3, 0, 0, 0, 0, 0, 0],
    14: [0, 0, 3, 0, 0, 0, 0, 0, 0],
    15: [0, 0, 3, 0, 0, 0, 0, 0, 0],
    16: [0, 0, 3, 0, 0, 0, 0, 0, 0],
    17: [0, 0, 0, 4, 0, 0, 0, 0, 0], // 4 4th level slots
    18: [0, 0, 0, 4, 0, 0, 0, 0, 0],
    19: [0, 0, 0, 4, 0, 0, 0, 0, 0],
    20: [0, 0, 0, 4, 0, 0, 0, 0, 0],
  },
};

/**
 * Get spell casting type for a class
 */
function getSpellcastingType(className: string): SpellcastingType {
  const classKey = className.toLowerCase();
  const fullCasters = ['wizard', 'sorcerer', 'cleric', 'druid', 'bard'];
  const halfCasters = ['paladin', 'ranger'];

  if (fullCasters.includes(classKey)) return 'full';
  if (halfCasters.includes(classKey)) return 'half';
  if (classKey === 'warlock') return 'warlock';
  return 'none';
}

/**
 * Get maximum spell slots for a character, keyed by spell level.
 */
export function getMaxSpellSlots(character: SpellcasterCharacter): Record<number, number> {
  const spellcastingType = getSpellcastingType(character.class);

  if (spellcastingType === 'none') {
    return {};
  }

  const slotsArray = SPELL_SLOTS_BY_LEVEL[spellcastingType][character.level] || [];
  const slots: Record<number, number> = {};

  slotsArray.forEach((count, index) => {
    if (count > 0) {
      slots[index + 1] = count;
    }
  });

  return slots;
}

/**
 * Get current (available) spell slots for a character, keyed by spell level.
 */
export function getCurrentSpellSlots(character: SpellcasterCharacter): Record<number, number> {
  const maxSlots = getMaxSpellSlots(character);
  const usedSlots = character.spellSlotsUsed || {};
  const currentSlots: Record<number, number> = {};

  Object.keys(maxSlots).forEach(level => {
    const levelNum = parseInt(level, 10);
    const max = maxSlots[levelNum];
    const used = usedSlots[levelNum] || 0;
    currentSlots[levelNum] = Math.max(0, max - used);
  });

  return currentSlots;
}

/**
 * Get a specific spell by class and name. Returns the spell or null if not found.
 */
export function getSpell(className: string, spellName: string): SpellLike | null {
  const classKey = className.toLowerCase();
  const classList = SPELL_LISTS_BY_CLASS[classKey];

  if (!classList) {
    logger.combat.warn('No spell list found for class', { class: className });
    return null;
  }

  // Search through all spell levels for this class
  for (const level in classList) {
    const spells = classList[level];
    const spell = spells.find(s => s.name.toLowerCase() === spellName.toLowerCase());
    if (spell) {
      return spell;
    }
  }

  logger.combat.warn('Spell not found for class', { spell: spellName, class: className });
  return null;
}

/**
 * Get all available spells for a character
 * For now, returns all spells for the class up to character's max spell level
 * In future, this could filter by known/prepared spells
 *
 */
export function getAvailableSpells(character: SpellcasterCharacter): SpellLike[] {
  const classKey = character.class.toLowerCase();
  const classList = SPELL_LISTS_BY_CLASS[classKey];

  if (!classList) {
    return [];
  }

  const maxSpellLevel = getMaxSpellLevel(character);
  const availableSpells: SpellLike[] = [];

  // Collect all spells up to max spell level
  for (let level = 0; level <= maxSpellLevel; level++) {
    if (classList[level]) {
      availableSpells.push(...classList[level]);
    }
  }

  return availableSpells;
}

/**
 * Get maximum spell level a character can cast (0-9)
 */
export function getMaxSpellLevel(character: SpellcasterCharacter): number {
  const spellcastingType = getSpellcastingType(character.class);

  if (spellcastingType === 'none') return 0;

  const slots = SPELL_SLOTS_BY_LEVEL[spellcastingType][character.level] || [];

  // Find highest spell level with at least 1 slot
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i] > 0) {
      return i + 1;
    }
  }

  return 0; // Only cantrips
}

/**
 * Check if character has a spell slot of a given level (0 = cantrip, always true)
 */
export function hasSpellSlot(character: SpellcasterCharacter, level: number): boolean {
  // Cantrips don't require slots
  if (level === 0) return true;

  const currentSlots = getCurrentSpellSlots(character);
  return (currentSlots[level] || 0) > 0;
}

/**
 * Spend a spell slot of a given level (mutates character). Cantrips (0) are free.
 * (Named spendSpellSlot rather than useSpellSlot so lint doesn't treat it as a React hook.)
 */
export function spendSpellSlot(character: SpellcasterCharacter, level: number): boolean {
  // Cantrips don't consume slots
  if (level === 0) return true;

  if (!hasSpellSlot(character, level)) {
    return false;
  }

  // Initialize spellSlotsUsed if needed, then increment used slots
  const used = character.spellSlotsUsed ?? (character.spellSlotsUsed = {});
  used[level] = (used[level] || 0) + 1;

  return true;
}

/**
 * Restore a spell slot of a given level (mutates character).
 */
export function restoreSpellSlot(character: SpellcasterCharacter, level: number): boolean {
  if (!character.spellSlotsUsed || !character.spellSlotsUsed[level]) {
    return false; // No slots to restore
  }

  character.spellSlotsUsed[level] = Math.max(0, character.spellSlotsUsed[level] - 1);
  return true;
}

/**
 * Restore all spell slots (for long rest, mutates character).
 */
export function restoreAllSpellSlots(character: SpellcasterCharacter): void {
  character.spellSlotsUsed = {};
}

/**
 * Get available spell slot levels (for UI display)
 */
export function getAvailableSpellSlots(character: SpellcasterCharacter): number[] {
  const currentSlots = getCurrentSpellSlots(character);
  return Object.keys(currentSlots)
    .map(level => parseInt(level, 10))
    .filter(level => currentSlots[level] > 0)
    .sort((a, b) => a - b);
}

/**
 * Check if character can cast a specific spell.
 */
export function canCastSpell(
  character: SpellcasterCharacter,
  spell: SpellLike
): { canCast: boolean; reason: string } {
  // Check if character's class can cast this spell
  const classKey = character.class.toLowerCase();
  const classList = SPELL_LISTS_BY_CLASS[classKey];

  if (!classList) {
    return {
      canCast: false,
      reason: `${character.class} cannot cast spells`,
    };
  }

  // Check if spell is in the class's spell list
  let spellFound = false;
  for (const level in classList) {
    if (classList[level].some(s => s.name === spell.name)) {
      spellFound = true;
      break;
    }
  }

  if (!spellFound) {
    return {
      canCast: false,
      reason: `${spell.name} is not available to ${character.class}s`,
    };
  }

  // Check if character has spell slot (or is cantrip)
  if (spell.level === 0) {
    return { canCast: true, reason: 'Cantrip' };
  }

  if (!hasSpellSlot(character, spell.level)) {
    return {
      canCast: false,
      reason: `No level ${spell.level} spell slots remaining`,
    };
  }

  return { canCast: true, reason: 'Ready to cast' };
}

/**
 * Get spell slots summary for display (e.g., "1st: 2/4, 2nd: 1/3")
 */
export function getSpellSlotsSummary(character: SpellcasterCharacter): string {
  const maxSlots = getMaxSpellSlots(character);
  const currentSlots = getCurrentSpellSlots(character);

  const levelNames = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

  const summary = Object.keys(maxSlots)
    .map(level => {
      const levelNum = parseInt(level, 10);
      const current = currentSlots[levelNum] || 0;
      const max = maxSlots[levelNum];
      return `${levelNames[levelNum]}: ${current}/${max}`;
    })
    .join(', ');

  return summary || 'No spell slots';
}

/**
 * Get spells organized by level for a character: { 0: [...], 1: [...], ... }
 */
export function getSpellsByLevel(character: SpellcasterCharacter): Record<number, SpellLike[]> {
  const availableSpells = getAvailableSpells(character);
  const spellsByLevel: Record<number, SpellLike[]> = {};

  availableSpells.forEach(spell => {
    if (!spellsByLevel[spell.level]) {
      spellsByLevel[spell.level] = [];
    }
    spellsByLevel[spell.level].push(spell);
  });

  return spellsByLevel;
}

// Export helper functions
export default {
  getSpell,
  getAvailableSpells,
  getMaxSpellSlots,
  getCurrentSpellSlots,
  hasSpellSlot,
  spendSpellSlot,
  restoreSpellSlot,
  restoreAllSpellSlots,
  getAvailableSpellSlots,
  canCastSpell,
  getSpellSlotsSummary,
  getSpellsByLevel,
  getMaxSpellLevel,
};
