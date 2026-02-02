import { Character } from './Character.js';
import { generateNPCParty } from './NPCGenerator.js';

/**
 * Party class - manages the player character and 3 NPC companions
 */
export class Party {
  constructor() {
    this.player = null; // Main player character
    this.npcs = [null, null, null]; // 3 NPC slots
    this.maxSize = 4; // 1 player + 3 NPCs
  }

  /**
   * Set the player character
   */
  setPlayer(character) {
    this.player = character;
  }

  /**
   * Add an NPC to the party
   */
  addNPC(character, slot = null) {
    if (slot !== null && slot >= 0 && slot < 3) {
      this.npcs[slot] = character;
      return true;
    }

    // Find first empty slot
    for (let i = 0; i < 3; i++) {
      if (this.npcs[i] === null) {
        this.npcs[i] = character;
        return true;
      }
    }

    return false; // Party full
  }

  /**
   * Remove an NPC from the party
   */
  removeNPC(slot) {
    if (slot >= 0 && slot < 3) {
      this.npcs[slot] = null;
      return true;
    }
    return false;
  }

  /**
   * Get all living party members
   */
  getLivingMembers() {
    const members = [this.player, ...this.npcs].filter(m => m !== null && m.currentHP > 0);
    return members;
  }

  /**
   * Get all party members (including dead/null)
   */
  getAllMembers() {
    return [this.player, ...this.npcs];
  }

  /**
   * Check if party is wiped
   */
  isWiped() {
    return this.getLivingMembers().length === 0;
  }

  /**
   * Get party size
   */
  getSize() {
    return this.getAllMembers().filter(m => m !== null).length;
  }

  /**
   * Generate random NPCs for party slots
   * @param {number} level - Character level for NPCs (defaults to 1)
   * @param {number} seed - Random seed for reproducible generation
   */
  generateNPCs(level = 1, seed = Date.now()) {
    const npcs = generateNPCParty(level, seed);
    this.npcs = npcs;
  }

  /**
   * Create placeholder NPCs (for initial game state)
   * @deprecated Use generateNPCs() instead
   */
  createPlaceholderNPCs() {
    // Generate real NPCs instead of empty slots
    this.generateNPCs(1, Date.now());
  }

  /**
   * Serialize to JSON for saving
   */
  toJSON() {
    return {
      player: this.player ? this.player.toJSON() : null,
      npcs: this.npcs.map(npc => (npc ? npc.toJSON() : null)),
    };
  }

  /**
   * Load from JSON
   */
  static fromJSON(data) {
    const party = new Party();
    party.player = data.player ? Character.fromJSON(data.player) : null;
    party.npcs = data.npcs.map(npc => (npc ? Character.fromJSON(npc) : null));
    return party;
  }
}
