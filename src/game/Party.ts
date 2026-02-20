// @ts-nocheck
// TODO: Add proper types - Party management class
import { Character } from './Character';
import { generateNPCParty } from './NPCGenerator';

/**
 * Party class - manages the player character and 3 NPC companions
 */
export class Party {
  constructor() {
    this.player = null; // Main player character
    this.npcs = [null, null, null]; // 3 NPC slots
    this.maxSize = 4; // 1 player + 3 NPCs
  }

  setPlayer(character) {
    this.player = character;
  }

  addNPC(character, slot = null) {
    if (slot !== null && slot >= 0 && slot < 3) {
      this.npcs[slot] = character;
      return true;
    }

    for (let i = 0; i < 3; i++) {
      if (this.npcs[i] === null) {
        this.npcs[i] = character;
        return true;
      }
    }

    return false; // Party full
  }

  removeNPC(slot) {
    if (slot >= 0 && slot < 3) {
      this.npcs[slot] = null;
      return true;
    }
    return false;
  }

  getLivingMembers() {
    const members = [this.player, ...this.npcs].filter(m => m !== null && m.currentHP > 0);
    return members;
  }

  getAllMembers() {
    return [this.player, ...this.npcs];
  }

  isWiped() {
    return this.getLivingMembers().length === 0;
  }

  getSize() {
    return this.getAllMembers().filter(m => m !== null).length;
  }

  generateNPCs(level = 1, seed = Date.now()) {
    const npcs = generateNPCParty(level, seed);
    this.npcs = npcs;
  }

  /** @deprecated Use generateNPCs() instead */
  createPlaceholderNPCs() {
    this.generateNPCs(1, Date.now());
  }

  toJSON() {
    return {
      player: this.player ? this.player.toJSON() : null,
      npcs: this.npcs.map(npc => (npc ? npc.toJSON() : null)),
    };
  }

  static fromJSON(data) {
    const party = new Party();
    party.player = data.player ? Character.fromJSON(data.player) : null;
    party.npcs = data.npcs.map(npc => (npc ? Character.fromJSON(npc) : null));
    return party;
  }
}
