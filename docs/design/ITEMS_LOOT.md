# Items, Equipment & Loot System

**Files:** `src/game/Item.ts`, `src/game/LootGenerator.ts`, `src/game/TreasureGenerator.ts`, `src/game/data/GameTableData.ts`

## Overview

The item system covers all objects a character can carry: weapons, armor, consumables, quest items, and miscellaneous gear. Items are the bridge between the inventory/shop systems and the character stat system via equipment slots and effects.

---

## Item Entity

**File:** `src/game/Item.ts` — `class Item`

### Properties

| Property       | Type                | Description                                                      |
| -------------- | ------------------- | ---------------------------------------------------------------- |
| `id`           | string              | Auto-generated: `item_<timestamp>_<random>`                      |
| `name`         | string              | Display name                                                     |
| `type`         | ItemType            | `'weapon' \| 'armor' \| 'consumable' \| 'quest' \| 'misc'`       |
| `rarity`       | ItemRarity          | `'common' \| 'uncommon' \| 'rare' \| 'very rare' \| 'legendary'` |
| `slot`         | ItemSlot \| null    | Equipment slot, or null for inventory-only items                 |
| `description`  | string              | Flavor/mechanical text                                           |
| `value`        | number              | Gold piece value                                                 |
| `weight`       | number              | Carry weight (lb)                                                |
| `damage`       | string              | Dice string for weapons (e.g. `"1d8+3"`)                         |
| `damageType`   | string              | `"slashing"`, `"piercing"`, `"bludgeoning"`, `"fire"`, etc.      |
| `twoHanded`    | boolean             | Clears offHand slot on equip                                     |
| `charges`      | number              | Current charges (charged items)                                  |
| `maxCharges`   | number              | Maximum charges                                                  |
| `consumable`   | boolean             | Removed from inventory on use                                    |
| `effects`      | Record<string, any> | Stat modifiers applied when equipped                             |
| `requirements` | object              | Minimum ability scores or class requirements                     |
| `stackable`    | boolean             | Can stack in inventory (e.g. rations, arrows)                    |
| `quantity`     | number              | Stack size                                                       |

### Item Effects System

`effects` is a free-form record read by `Character.calculateEffectiveStats()` on equip/unequip. Supported effect keys:

| Key                                           | Effect                             |
| --------------------------------------------- | ---------------------------------- |
| `ac`                                          | Adds to Armor Class                |
| `str` / `dex` / `con` / `int` / `wis` / `cha` | Adds to ability score              |
| `hp`                                          | Adds to max HP                     |
| `speed`                                       | Modifies hex movement distance     |
| `initiative`                                  | Modifies initiative roll           |
| `attackBonus`                                 | Adds to attack rolls               |
| `damageBonus`                                 | Adds to damage rolls               |
| `allowsRiverCrossing`                         | Enables river hex traversal (raft) |
| `allowsWaterCrossing`                         | Enables water hex traversal (boat) |

Example — Longsword +1:

```javascript
{
  name: 'Longsword +1',
  type: 'weapon',
  rarity: 'uncommon',
  slot: 'mainHand',
  damage: '1d8+1',
  damageType: 'slashing',
  effects: { attackBonus: 1, damageBonus: 1 }
}
```

Example — Chain Mail:

```javascript
{
  name: 'Chain Mail',
  type: 'armor',
  rarity: 'common',
  slot: 'chest',
  effects: { ac: 16 }
}
```

Example — Raft:

```javascript
{
  name: 'Raft',
  type: 'misc',
  slot: null,
  effects: { allowsRiverCrossing: true }
}
```

### Rarity Colors (WoW-style)

| Rarity    | Color  |
| --------- | ------ |
| Common    | Gray   |
| Uncommon  | Green  |
| Rare      | Blue   |
| Very Rare | Purple |
| Legendary | Orange |

### Equipment Slot Validation

`item.canEquipToSlot(slot)` enforces slot compatibility. Ring slots are interchangeable: a `ring1`-slotted item can be equipped to `ring2` and vice versa.

Two-handed weapons set `twoHanded: true`; equipping them automatically clears `offHand`.

### Display Methods

```javascript
item.getRarityColor(); // Returns CSS color string
item.getEffectsText(); // Human-readable effects list: "+1 Attack, +1 Damage"
item.getTooltip(); // Full multi-line tooltip string for UI
item.isEquippable(); // Returns slot !== null
```

### Serialization

```javascript
item.toJSON(); // Returns plain object
Item.fromJSON(data); // Reconstructs Item instance
```

Called automatically by `Character.toJSON()` for all inventory and equipment items.

---

## Equipment Slots

| Slot Key   | Examples                                           |
| ---------- | -------------------------------------------------- |
| `head`     | Helmet of Telepathy, Cap of Water Breathing        |
| `neck`     | Amulet of Health, Periapt of Proof against Poison  |
| `chest`    | Chain Mail, Robe of Archmagi, Plate Armor          |
| `hands`    | Gauntlets of Ogre Power, Gloves of Missile Snaring |
| `legs`     | Boots of Elvenkind (if leg-slotted), Greaves       |
| `feet`     | Boots of Speed, Winged Boots                       |
| `ring1`    | Ring of Protection, Ring of Spell Storing          |
| `ring2`    | Ring of Evasion, Signet Ring                       |
| `mainHand` | Longsword, Staff of Fire, Shield                   |
| `offHand`  | Dagger, Shield, Hand Crossbow                      |

---

## Loot Generation

**File:** `src/game/LootGenerator.ts` — `class LootGenerator extends BaseGenerator`

`LootGenerator` generates treasure appropriate to a given CR. It consults its own quick-reference CR table for item counts and rarity targets, then delegates to `GameTableData.ts` for SRD-compliant treasure hoard rolls.

### CR-to-Loot Quick Table

| CR Range | Gold Range     | Item Rarity | Item Count |
| -------- | -------------- | ----------- | ---------- |
| 0        | 10–50 gp       | Common      | 0–1        |
| 1        | 20–100 gp      | Common      | 0–1        |
| 2–4      | 50–400 gp      | Uncommon    | 1–2        |
| 5–7      | 200–1,000+ gp  | Rare        | 1–3        |
| 8–11     | 1,000–5,000 gp | Very Rare   | 2–4        |
| 12+      | 5,000+ gp      | Legendary   | 3–5        |

### Generation Process

1. Map the encounter CR to a bracket
2. Roll gold amount within the bracket range
3. Roll item count (0–N based on CR)
4. For each item slot, roll on SRD treasure hoard tables from `GameTableData.ts`
5. Create `Item` instances from the roll results
6. Return `{ gold, items[] }`

---

## SRD Treasure Hoard Tables

**File:** `src/game/data/GameTableData.ts`

The complete D&D 5e SRD v5.2.1 treasure hoard tables are stored as structured data. No game logic — pure data.

### CR Brackets

| Bracket  | Coin Types                                             | Typical GP Scale      |
| -------- | ------------------------------------------------------ | --------------------- |
| CR 0–4   | cp (6d6×100), sp (3d6×100), gp (2d6×10)                | 70–700 gp             |
| CR 5–10  | cp (2d6×100), sp (2d6×1000), gp (6d6×100), pp (3d6×10) | Hundreds to thousands |
| CR 11–16 | gp (4d6×1000), pp (5d6×100)                            | Tens of thousands     |
| CR 17+   | (highest tier)                                         | Hundreds of thousands |

### Gems and Art Objects

Each bracket has a `gems_art` table of 30+ entries. Each entry covers a d100 roll range and specifies:

- `type`: `'gems'`, `'art'`, or `'none'`
- `value`: GP value per piece (10, 25, 50, 100, 250, 500, 750, 1000, 2500, 7500 gp)
- `count`: Dice expression (e.g. `"2d6"`)
- `extraGems` / `extraArt`: Optional secondary treasure
- `magicItems`: Array of magic item tables to roll on (A–I)

### Magic Item Tables (A–I)

The SRD defines 9 magic item tables by rarity:

- Tables A–C: Common items
- Tables D–F: Uncommon through Rare
- Tables G–H: Very Rare
- Table I: Legendary

These tables are stored in `GameTableData.ts`. Full magic item generation is marked as in-progress in the roadmap.

---

## Treasure Generator

**File:** `src/game/TreasureGenerator.ts`

Wraps `LootGenerator` and `GameTableData` to implement the complete SRD treasure hoard roll pipeline:

1. Determine CR bracket
2. Roll coin amounts per coin type
3. Roll d100 on `gems_art` table — determine gems/art objects
4. Roll on referenced magic item tables (A–I)
5. Return structured `{ gold, gems, art, magicItems, items[] }`

---

## Inventory Management (GameStateContext Actions)

| Action         | Description                                                                   |
| -------------- | ----------------------------------------------------------------------------- |
| `ADD_ITEM`     | Adds item to `character.inventory[]`                                          |
| `REMOVE_ITEM`  | Removes item by `item.id`                                                     |
| `EQUIP_ITEM`   | Moves item from inventory to equipment slot; triggers stat recalculation      |
| `UNEQUIP_ITEM` | Returns equipped item to inventory; triggers stat recalculation               |
| `BUY_ITEM`     | Deducts `item.value` gold; calls `ADD_ITEM`                                   |
| `SELL_ITEM`    | Adds `item.value * 0.5` gold; calls `REMOVE_ITEM`                             |
| `COLLECT_LOOT` | Calls `LootGenerator.generateLoot(cr)`; dispatches `ADD_ITEM` for each result |

**Immutability note:** All inventory actions operate on `Character.fromJSON(character.toJSON())` copies before dispatching.

---

## Consumables

Items with `consumable: true` are removed from inventory after use. Examples:

| Item                      | Effect                                      | Charges       |
| ------------------------- | ------------------------------------------- | ------------- |
| Healing Potion            | Restores 2d4+2 HP                           | 1             |
| Potion of Greater Healing | Restores 4d4+4 HP                           | 1             |
| Rations                   | Supplies 1 day of food                      | 1 (stackable) |
| Antitoxin                 | Advantage on CON saves vs poison for 1 hour | 1             |
| Torch                     | Light source                                | 1             |

Charged items (`charges > 0, maxCharges > 1`) reduce charges by 1 per use and are destroyed when charges reach 0 if `consumable: true`.

---

## Stacking

Items with `stackable: true` increment `quantity` rather than creating new inventory entries. Examples:

- Rations (stackable, quantity = number of days' supply)
- Arrows (stackable)
- Gold Pieces (not an item — tracked as `character.gold`)

---

## Implementation Status

| Feature                          | Status                               |
| -------------------------------- | ------------------------------------ |
| Item entity and serialization    | Complete                             |
| Equipment slot system            | Complete                             |
| Stat effect calculation          | Complete                             |
| CR-scaled loot generation        | Complete                             |
| SRD treasure hoard tables (data) | Complete                             |
| Gem and art object tables        | Complete                             |
| Magic item tables (data stored)  | Data present; generation in progress |
| Full magic item effects          | Not yet implemented                  |
| Attunement system                | Not yet implemented                  |
| Cursed items                     | Not yet implemented                  |
| Item crafting                    | Not yet implemented                  |
