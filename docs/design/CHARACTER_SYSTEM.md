# Character System

**File:** `src/game/Character.ts`

## Overview

`Character` is the central entity class representing any living combatant belonging to the player party — the player character (PC) or a generated NPC companion. It implements D&D 5e mechanics end-to-end: ability scores, combat stats, equipment, inventory, spell slots, rest mechanics, survival stats, XP/leveling, and hidden social stats (piety, generosity).

---

## Ability Scores

Six standard D&D 5e ability scores stored in `character.abilities`:

| Ability      | Key            | Modifier Formula          |
| ------------ | -------------- | ------------------------- |
| Strength     | `strength`     | `floor((score - 10) / 2)` |
| Dexterity    | `dexterity`    | same                      |
| Constitution | `constitution` | same                      |
| Intelligence | `intelligence` | same                      |
| Wisdom       | `wisdom`       | same                      |
| Charisma     | `charisma`     | same                      |

**Accessing modifiers:**

```javascript
const mod = character.getModifier('wisdom'); // e.g. 15 WIS → +2
```

---

## Combat Statistics

| Property           | Description                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `maxHP`            | Maximum hit points (set at class creation, increases on level-up) |
| `currentHP`        | Current hit points                                                |
| `armorClass`       | Effective AC (recalculated after equip/unequip)                   |
| `proficiencyBonus` | Per-level per D&D 5e table (levels 1–20)                          |
| `hitDie`           | Hit die type (e.g. 10 for Fighter, 6 for Wizard)                  |
| `initiative`       | DEX modifier (used in combat initiative rolls)                    |
| `moveDistance`     | Hex movement range per turn (typically 6)                         |
| `viewDistance`     | Fog-of-war reveal radius in hexes (typically 2)                   |

---

## Supported Classes (12)

All standard D&D 5e classes are supported. Each class applies unique stat arrays, proficiencies, and ability lists at construction via `applyClassModifiers(charClass)`:

| Class     | Hit Die | Primary Stat | Notable Abilities                               |
| --------- | ------- | ------------ | ----------------------------------------------- |
| Barbarian | d12     | STR          | Rage (2/day bonus action)                       |
| Bard      | d8      | CHA          | Bardic Inspiration (2/day bonus action)         |
| Cleric    | d8      | WIS          | Channel Divinity (1/day), Healing Word (bonus)  |
| Druid     | d8      | WIS          | Wild Shape (2/day), Healing Word                |
| Fighter   | d10     | STR/DEX      | Second Wind (1/day), Action Surge (1/day)       |
| Monk      | d8      | DEX          | Ki Point abilities, Martial Arts (bonus action) |
| Paladin   | d10     | STR/CHA      | Divine Smite, Lay on Hands, Aura of Protection  |
| Ranger    | d10     | DEX          | Hunter's Mark, Favored Terrain                  |
| Rogue     | d8      | DEX          | Sneak Attack, Cunning Action (bonus action)     |
| Sorcerer  | d6      | CHA          | Sorcery Points, Metamagic                       |
| Warlock   | d8      | CHA          | Eldritch Blast, Pact Magic                      |
| Wizard    | d6      | INT          | Arcane Recovery, Prepared Spells                |

---

## Equipment System

Characters have 10 named equipment slots:

| Slot Key   | Description                       |
| ---------- | --------------------------------- |
| `head`     | Helmets, hats                     |
| `neck`     | Amulets, necklaces                |
| `chest`    | Armor, robes                      |
| `hands`    | Gloves, gauntlets                 |
| `legs`     | Leg armor, pants                  |
| `feet`     | Boots, shoes                      |
| `ring1`    | Ring (interchangeable with ring2) |
| `ring2`    | Ring (interchangeable with ring1) |
| `mainHand` | Primary weapon or shield          |
| `offHand`  | Secondary weapon or shield        |

**Two-handed weapons:** Setting `item.twoHanded = true` automatically clears the `offHand` slot when equipped.

**Stat recalculation:** After every equip/unequip, `calculateEffectiveStats()` recomputes AC, ability scores, and maxHP by summing `baseStats` plus all equipped item `effects`.

### Equipping Items

```javascript
// Immutable pattern required (AGENTS.md critical rule)
const updated = Character.fromJSON(character.toJSON());
updated.equipItem(itemId, 'mainHand');
dispatch({ type: actions.EQUIP_ITEM, payload: updated });
```

---

## Inventory

`character.inventory` is an array of `Item` instances. The character also holds:

| Property      | Description                                                    |
| ------------- | -------------------------------------------------------------- |
| `inventory[]` | All carried items (includes equipped items tracked separately) |
| `gold`        | Gold pieces currency                                           |
| `rations`     | Food supply for survival system                                |

Terrain traversal is checked via inventory item `effects`:

- `effects.allowsRiverCrossing` → `character.hasRaft()` returns `true`
- `effects.allowsWaterCrossing` → `character.hasBoat()` returns `true`

---

## Spell System

Characters store spell-related data for spellcasting classes:

| Property           | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `spells[]`         | Known/prepared spells (Spell instances)               |
| `spellSlotsUsed`   | Record of spent slots per level `{ 1: 2, 2: 1, ... }` |
| `hitDiceRemaining` | Used by short rest recovery                           |

Spell slot recovery: Full reset on long rest via `RestManager.recoverLongRestAbilities()`.

---

## XP and Leveling

| Property        | Description                 |
| --------------- | --------------------------- |
| `xp`            | Current experience points   |
| `xpToNextLevel` | XP threshold for next level |

Static `XP_TABLE` maps level 1–20 to required XP (standard D&D 5e values).

### Level Up

`character.levelUp()` when `xp >= xpToNextLevel`:

1. Increments `level`
2. Recalculates `proficiencyBonus` from the D&D 5e proficiency table
3. Adds HP: `rollResult(hitDie) + CON modifier` (minimum 1)
4. Returns a summary object with what changed

Triggered by `AWARD_XP` → `LEVEL_UP_CHARACTER` actions in `GameStateContext`.

---

## Survival Properties

| Property          | Description                                                 |
| ----------------- | ----------------------------------------------------------- |
| `rations`         | Current food supply                                         |
| `daysWithoutFood` | Consecutive days without eating                             |
| `exhaustionLevel` | 0–6 (6 = death)                                             |
| `foragedHexes`    | Set of hexes already foraged (prevent re-foraging same hex) |
| `lastLongRest`    | Game-hours timestamp of last long rest                      |

See `SURVIVAL_EXPLORATION.md` for full survival mechanics.

---

## Hidden Stats

| Property                 | Description                                                           |
| ------------------------ | --------------------------------------------------------------------- |
| `hiddenStats.piety`      | Increases via shrine interactions (`character.increasePiety(amount)`) |
| `hiddenStats.generosity` | Increases via NPC offering; 1 point per 10 gold donated               |

These stats are not currently displayed in the UI but affect future mechanics.

---

## Serialization

Characters must be fully serializable for localStorage persistence:

```javascript
// Serialize
const json = character.toJSON();
// All Item instances in inventory/equipment are also serialized

// Deserialize
const restored = Character.fromJSON(json);
// Items re-instantiated as Item instances
```

**Critical pattern:** Never mutate a character instance directly. Always create a copy first:

```javascript
// CORRECT
const updated = Character.fromJSON(character.toJSON());
updated.rations--;
dispatch({ type: actions.UPDATE_CHARACTER, payload: updated });

// WRONG - breaks React
character.rations--;
```

---

## Party System

**File:** `src/game/Party.ts`

`Party` is a thin container managing exactly 1 player + up to 3 NPC companions.

| Property  | Description                           |
| --------- | ------------------------------------- |
| `player`  | Single `Character` (player character) |
| `npcs[3]` | Fixed 3-slot array; null = empty slot |
| `maxSize` | 4 (1 PC + 3 NPCs)                     |

### Key Methods

| Method                      | Description                                       |
| --------------------------- | ------------------------------------------------- |
| `addNPC(character, slot?)`  | Slot-targeted or fills first-available slot       |
| `removeNPC(slot)`           | Nulls the slot                                    |
| `getLivingMembers()`        | Returns all members with `currentHP > 0`          |
| `getAllMembers()`           | Returns `[player, ...npcs]` (including nulls)     |
| `isWiped()`                 | True when all living members are dead (game over) |
| `getSize()`                 | Count of non-null members                         |
| `generateNPCs(level, seed)` | Calls `NPCGenerator.generateNPCParty()`           |

Party is passed to `Combat` as `party.getLivingMembers()`.

---

## NPC Generation

**File:** `src/game/NPCGenerator.ts`

Generates randomized NPC companions with D&D-themed names, personalities, and class builds.

### NPC Classes (5 available)

| Class   | Hit Die | Primary | Stat Allocation                                |
| ------- | ------- | ------- | ---------------------------------------------- |
| Fighter | d10     | STR     | STR 16, DEX 14, CON 15, INT 10, WIS 12, CHA 10 |
| Rogue   | d8      | DEX     | STR 10, DEX 17, CON 13, INT 14, WIS 11, CHA 12 |
| Cleric  | d8      | WIS     | STR 13, DEX 10, CON 14, INT 12, WIS 16, CHA 13 |
| Wizard  | d6      | INT     | STR 8, DEX 14, CON 13, INT 17, WIS 12, CHA 10  |
| Ranger  | d10     | DEX     | STR 13, DEX 16, CON 14, INT 12, WIS 14, CHA 10 |

### Name Pools

- 24 male names (Aldric, Brom, Cedric, Dorian, Edric…)
- 23 female names (Aria, Brienne, Elara, Fiona, Isolde…)
- 18 surnames (Ironforge, Stormwind, Blackwood…)

### Personality Traits (18)

brave, cautious, greedy, loyal, reckless, wise, curious, stern, jovial, secretive, honorable, cunning, compassionate, arrogant, humble, zealous, pragmatic, melancholic

### Background Hooks (12)

former soldier, merchant, scholar, street urchin, noble disgraced, adventurer-for-hire, reformed criminal, religious pilgrim, survivor of disaster, ex-city guard, wandering entertainer, exiled from homeland

`generateNPCParty(level, seed)` creates exactly 3 NPCs scaled to the provided level, using the seed for reproducible generation.
