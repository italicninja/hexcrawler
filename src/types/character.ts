/**
 * Character Type Definitions
 */

import type { AbilityScores, Skills, CharacterClass, Item, ItemSlot } from './game';

export interface CharacterData {
  // Basic info
  name: string;
  class: CharacterClass;
  level: number;
  xp: number;
  
  // Combat stats
  maxHP: number;
  currentHP: number;
  armorClass: number;
  proficiencyBonus: number;
  
  // Abilities
  abilities: AbilityScores;
  skills: Skills;
  
  // Resources
  gold: number;
  rations: number;
  water: number;
  
  // Movement & vision
  moveDistance: number;
  viewDistance: number;
  
  // Hit dice
  hitDice: string; // e.g., "1d10"
  hitDiceRemaining: number;
  
  // Status
  exhaustion: number;
  daysWithoutFood: number;
  daysWithoutWater: number;
  
  // Equipment
  inventory: Item[];
  equipped: Partial<Record<ItemSlot, Item>>;
  
  // Foraging (cooldown tracking)
  foragedHexes?: Record<string, number>; // hexKey -> day last foraged
  
  // Rest tracking
  lastLongRest?: number; // Game time in hours
}

export interface CharacterJSON extends CharacterData {
  // Serialized version for save/load
}
