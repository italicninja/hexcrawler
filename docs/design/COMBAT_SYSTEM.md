# Combat System

**Files:** `src/game/Combat.ts`, `src/game/Enemy.ts`, `src/game/EnemyAI.ts`, `src/game/OpportunityAttack.ts`, `src/game/DiceRoller.ts`

**Scene:** `src/components/scenes/CombatScene.jsx`

**Reducer:** `src/contexts/reducers/combatReducer.ts`

## Overview

Combat is a full D&D 5e tactical turn-based system. It supports player-controlled turns on a hex battlefield with initiative ordering, action economy, multi-attack, bonus actions, reactions, AI-driven enemy turns, and line-of-sight checks.

Combat is triggered by:

- Entering an Encounter POI hex
- Choosing to fight in an optional encounter prompt

---

## Combat Initialization

When `START_COMBAT` is dispatched:

1. A `Combat` instance is created with `party.getLivingMembers()` and the encounter's enemy list
2. `combat.rollInitiative()` sorts all combatants by d20 + DEX modifier (descending)
3. `combatState` is set in `GameStateContext` with the full turn order and battlefield
4. Scene transitions to `'combat'`
5. `combat.initializeAI()` (async) loads AI configurations per enemy family/variant

**CR-to-XP table** (`CR_TO_XP`) is exported from `Combat.ts` — used by `GameStateContext` to award XP on victory.

---

## Combat State Structure

```typescript
combatState: {
  active: boolean,
  combat: Combat,               // The Combat instance
  battlefield: HexGrid,         // Hex grid slice for the battlefield
  turnOrder: CombatantSlot[],   // All participants in initiative order
  currentTurnIndex: number,
  round: number,
  encounterName: string,
  encounterType: 'standard' | 'boss' | 'ambush',
  waitingForPlayerAction: boolean,
  movementRemaining: number,    // Feet of movement left this turn
  turnState: TurnState,         // Per-turn action economy tracking
}

TurnState: {
  actionUsed: boolean,
  bonusActionUsed: boolean,
  reactionUsed: boolean,
  movementUsed: number,         // Feet used this turn
  freeObjectUsed: boolean,
  attacksMade: number,          // For Extra Attack tracking
  conditions: Condition[],      // Active conditions on current combatant
  readyAction: ReadyAction | null,
}

CombatantSlot: {
  id: string,
  name: string,
  currentHP: number,
  maxHP: number,
  isEnemy: boolean,
  character: Character | null,  // For player/NPC slots
  enemy: Enemy | null,          // For enemy slots
  position: { col, row },       // Hex position on battlefield
  initiative: number,
  statusEffects: string[],
}
```

---

## HP Source of Truth During Combat

HP is tracked exclusively in `combatState.turnOrder[].currentHP` during combat — **not** in `Character.currentHP`. This prevents desync.

```typescript
// CORRECT during combat
const updatedTurnOrder = state.combatState.turnOrder.map(c => {
  if (c.id === targetId) return { ...c, currentHP: newHP };
  return c;
});
// Use UPDATE_COMBATANT_HP action

// WRONG
character.currentHP = newHP; // Never do this during combat
```

When combat ends via `END_COMBAT`, Character HP is synced from the final `turnOrder` values.

---

## Action Economy

Per D&D 5e, each combatant gets per turn:

| Resource                | Count          | Tracked By                  |
| ----------------------- | -------------- | --------------------------- |
| Action                  | 1              | `turnState.actionUsed`      |
| Bonus Action            | 1              | `turnState.bonusActionUsed` |
| Reaction                | 1 (per round)  | `turnState.reactionUsed`    |
| Movement                | Speed × 5 feet | `turnState.movementUsed`    |
| Free Object Interaction | 1              | `turnState.freeObjectUsed`  |

All resources reset at the start of each combatant's turn via `RESET_COMBAT_TURN_STATE`.

**Movement:** Each hex = 5 feet. `movementRemaining = (moveSpeed * 5) - movementUsed`. Movement can be split before and after actions within the same turn.

---

## Standard Actions

All implemented in `CombatScene.jsx` action handlers:

| Action         | Cost              | Effect                                                                                         |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| **Attack**     | Action            | Attack roll vs target AC; triggers Extra Attack if eligible                                    |
| **Dodge**      | Action            | Attackers have disadvantage until start of your next turn; adds `Dodging` condition            |
| **Dash**       | Action            | Gain extra movement equal to your speed (adds `moveSpeed * 5` feet)                            |
| **Disengage**  | Action            | Your movement doesn't provoke opportunity attacks; adds `Disengaged` condition                 |
| **Help**       | Action            | Give ally within 1 hex advantage on next attack; adds `Helped` condition to target             |
| **Hide**       | Action            | Stealth check vs highest passive Perception; success adds `Hidden` condition                   |
| **Search**     | Action            | Perception check; removes `Hidden` from enemies whose Stealth check this beats                 |
| **Use Object** | Action            | Free object interaction if already used; interacts with held item                              |
| **Ready**      | Action            | Declare a readied action with a trigger condition (system exists; full UI not yet implemented) |
| **Cast Spell** | Action (or Bonus) | Resolves spell effect via SpellManager                                                         |

---

## Bonus Actions

Available bonus actions depend on class and equipped items:

| Class     | Bonus Action                         | Level | Uses      |
| --------- | ------------------------------------ | ----- | --------- |
| Barbarian | Rage                                 | 1     | 2/day     |
| Bard      | Bardic Inspiration                   | 1     | 2/day     |
| Fighter   | Second Wind (heal 1d10+level)        | 1     | 1/day     |
| Monk      | Martial Arts (unarmed strike)        | 1     | Unlimited |
| Rogue     | Cunning Action (Dash/Disengage/Hide) | 2     | Unlimited |

**Two-Weapon Fighting:** When attacking with a light melee weapon in the main hand, you may use your bonus action to attack with a light weapon in the off-hand (no ability modifier to damage, unless you have the Two-Weapon Fighting style).

`character.getAvailableBonusActions()` returns the list of available bonus actions given current resources.

---

## Extra Attack

`character.getAttacksPerAction()` determines the number of attacks per Attack action:

| Class      | Level 1–4 | Level 5–10 | Level 11–19 | Level 20 |
| ---------- | --------- | ---------- | ----------- | -------- |
| Fighter    | 1         | 2          | 3           | 4        |
| Barbarian  | 1         | 2          | 2           | 2        |
| Paladin    | 1         | 2          | 2           | 2        |
| Ranger     | 1         | 2          | 2           | 2        |
| Monk       | 1         | 2          | 2           | 2        |
| All others | 1         | 1          | 1           | 1        |

`turnState.attacksMade` tracks progress. The UI shows "Attack (1/2)" during multi-attack. Movement is allowed between attacks.

---

## Reactions: Opportunity Attacks

**File:** `src/game/OpportunityAttack.ts`

Triggered when a hostile creature you can see moves out of your melee reach (1 hex).

### `checkOpportunityAttacks(movingCombatant, fromHex, toHex, allCombatants)`

Returns an array of combatants eligible to make an opportunity attack. Checks:

1. Moving combatant does **not** have the `Disengaged` condition
2. Potential attacker is alive (`currentHP > 0`)
3. Potential attacker has not used their reaction this round (`reactionUsed === false`)
4. Potential attacker is on the opposite team
5. Target was within melee reach (1 hex) before moving

### Prompt Behavior

- **Player movement triggering OA:** `OpportunityAttackPrompt.jsx` modal offers "Allow Attacks" or "Cancel Movement"
- **Enemy movement triggering OA:** Player auto-confirms (no prompt); player's reaction is consumed
- **AI enemy movement:** AI auto-confirms OAs against the player

Making an opportunity attack consumes the attacker's reaction for the round.

---

## Attack Resolution

All attack rolls go through `DiceRoller.attackRoll(character, attackType, targetAC, weaponName)`:

1. Roll d20 (with advantage/disadvantage if conditions apply)
2. Add attack modifier:
   - Melee: STR modifier + proficiency bonus
   - Ranged: DEX modifier + proficiency bonus
3. Natural 20 = critical hit (damage dice rolled twice)
4. Compare total to target AC:
   - `>= AC` → Hit
   - `< AC` → Miss
5. Auto-logs to GameLog: `"Longsword 15+5=20 vs AC 16: Hit"`

### Critical Hits

On a natural 20:

- All damage dice rolled twice (not added twice — literally 2× the dice)
- Bonus modifiers (ability mod, enhancement) added only once
- DiceRoller logs: `"Greatsword CRITICAL HIT! 20+5=25 vs AC 16"`

### Damage Rolls

`DiceRoller.damageRoll("1d8+3", "slashing")`:

- Parses dice string: `(\d+)d(\d+)(?:\+(\d+))?`
- Rolls each die, sums total
- Logs: `"8 slashing damage (1d8+3)"`

---

## Conditions

Active conditions are stored in `turnState.conditions[]`:

| Condition    | Source                    | Effect                                         | Duration                 |
| ------------ | ------------------------- | ---------------------------------------------- | ------------------------ |
| `Dodging`    | Dodge action              | Attackers have disadvantage                    | Until start of next turn |
| `Disengaged` | Disengage action          | Movement doesn't provoke OAs                   | Until end of turn        |
| `Helped`     | Help action (target ally) | Advantage on next attack                       | Until next attack made   |
| `Hidden`     | Hide action (success)     | Attackers have disadvantage; +2d6 Sneak Attack | Until revealed           |

Conditions with `duration: 'end_of_turn'` are cleared when `RESET_COMBAT_TURN_STATE` fires. Conditions with `duration: 'until_revealed'` persist until explicitly removed (e.g., Search action).

---

## Enemy System

**File:** `src/game/Enemy.ts`

Monsters are created with a name, CR, type, and optional family/variant for AI loading.

### CR Stat Table

| CR  | HP   | AC  | Attack Bonus | Multiattack | Special   |
| --- | ---- | --- | ------------ | ----------- | --------- |
| 0   | 7    | 13  | +3           | 1           | —         |
| 1   | 36   | 13  | +3           | 1           | —         |
| 2   | 52   | 13  | +4           | 1           | —         |
| 3   | 66   | 13  | +4           | 1           | —         |
| 4   | 84   | 14  | +5           | 1           | —         |
| 5   | 95   | 15  | +6           | 1           | —         |
| 6   | 112  | 15  | +6           | 2           | —         |
| 7   | 133  | 15  | +6           | 2           | Ranged 20 |
| 8   | 136  | 16  | +7           | 2           | —         |
| 10  | 157  | 17  | +7           | 2           | Ranged 20 |
| 11+ | 175+ | 17+ | +8           | 3           | —         |

Stats fall back to nearest lower CR entry if exact match not found.

### Enemy Type → AI Family Mapping

| Enemy Type                                         | AI Family |
| -------------------------------------------------- | --------- |
| beast                                              | beast     |
| humanoid, goblinoid                                | humanoid  |
| undead                                             | undead    |
| dragon                                             | dragon    |
| construct, elemental, aberration, celestial, fiend | construct |
| default                                            | humanoid  |

---

## Enemy AI

**File:** `src/game/EnemyAI.ts` + `src/game/ai/`

AI configs are loaded asynchronously per enemy family/variant via `AIEngine.loadAI(family, variant)`. If loading fails, `AIEngine.getFallbackAI()` provides a default decision tree.

### Decision Tree (Priority Order)

1. **Low HP (< 25%)** → Reposition to backline / attempt to flee
2. **Has special ability + 30% chance** → Use special ability
3. **In melee range (1 hex)** → Attack the nearest ally
4. **Has ranged attack + line of sight + in range** → Attack lowest HP ally
5. **Otherwise** → Move toward nearest ally

### Line of Sight

**File:** `src/game/LineOfSight.ts`

`checkLineOfSight(fromHex, toHex, hexGrid)` — Used by AI ranged attack decisions and targeting. Blocked by mountain and wall hex types.

### Pathfinding

**File:** `src/game/Pathfinding.ts`

A\* pathfinding for enemy movement toward targets and for player movement validation. Takes terrain difficulty into account for path cost.

---

## Flee Mechanic

- Player can attempt to flee during their turn
- Flee DC = `10 + (average enemy CR / 2)`
- DEX check vs flee DC
- On success: combat ends, player exits the encounter
- `canFlee` and `fleeAttempted` flags on the `Combat` instance prevent spamming

---

## Spells in Combat

**File:** `src/game/SpellManager.ts`, `src/game/Spell.ts`, `src/game/AbilityEffects.ts`

Spells are data-driven `Spell` instances with injected effect functions. Combat resolves spells via:

```
CombatScene.handleCastSpell()
  → SpellManager.getSpell(spellName)
  → SpellManager.hasSpellSlot(character, spellLevel)
  → SpellManager.useSpellSlot(character, spellLevel)
  → spell.cast(caster, target, diceRoller)
  → { success, damage, healing, ... }
```

Spell attack bonus: `proficiency + spellcasting ability modifier`
Spell save DC: `8 + proficiency + spellcasting ability modifier`

---

## Combat End

### Victory (all enemies dead)

1. `END_COMBAT` action dispatched with `outcome: 'victory'`
2. XP awarded: `getXPForCR(enemy.cr)` for each defeated enemy
3. If `xp >= xpToNextLevel`, `LEVEL_UP_CHARACTER` triggered
4. Character HP synced from `turnOrder[].currentHP` back to `character.currentHP`
5. `combatState` cleared
6. Scene transitions to `'overworld'`

### Defeat (all allies dead)

1. `END_COMBAT` dispatched with `outcome: 'defeat'`
2. Game-over handling (to be implemented — currently returns to overworld)

### Loot

After victory, `COLLECT_LOOT` is dispatched:

- `LootGenerator.generateLoot(averageCR)` creates gold + item rewards
- Items added to character inventory
- Gold added to `character.gold`

---

## UI Components

| Component                     | File                        | Purpose                                            |
| ----------------------------- | --------------------------- | -------------------------------------------------- |
| `ActionPanel.jsx`             | `src/components/ui/combat/` | Shows all 8 actions, ability buttons, End Turn     |
| `ActionEconomyDisplay.jsx`    | `src/components/ui/combat/` | Visual tracker: Action / Bonus / Movement / Object |
| `OpportunityAttackPrompt.jsx` | `src/components/ui/combat/` | Allow/Cancel movement modal                        |
| `CombatLog.jsx`               | `src/components/ui/combat/` | Scrollable log of all combat events                |
| `TurnOrderDisplay.jsx`        | `src/components/ui/combat/` | Shows initiative order with HP bars                |
| `BattlefieldCanvas.jsx`       | `src/components/canvas/`    | Hex battlefield with combatant positions           |

---

## Known Limitations

| Feature                                  | Status                                                   |
| ---------------------------------------- | -------------------------------------------------------- |
| Ready Action trigger UI                  | System exists; trigger conditions UI not implemented     |
| Use Object action                        | Handler exists; no object interaction system             |
| Bonus Action spells                      | Cast time metadata not fully specified in all spell data |
| Reactions beyond OA                      | Shield, Counterspell, etc. not implemented               |
| Concentration tracking                   | Not tracked for concentration spells                     |
| Legendary Actions                        | Monster legendary actions not implemented                |
| Lair Actions                             | Not implemented                                          |
| Status Effects (Poisoned, Stunned, etc.) | Not implemented beyond Dodging/Disengaged/Hidden         |
| Flanking                                 | Not implemented (optional D&D rule)                      |
| Cover                                    | Not implemented                                          |

---

## XP Rewards by CR

| CR  | XP    | CR  | XP      |
| --- | ----- | --- | ------- |
| 0   | 10    | 8   | 3,900   |
| 1/8 | 25    | 9   | 5,000   |
| 1/4 | 50    | 10  | 5,900   |
| 1/2 | 100   | 11  | 7,200   |
| 1   | 200   | 12  | 8,400   |
| 2   | 450   | 13  | 10,000  |
| 3   | 700   | 14  | 11,500  |
| 4   | 1,100 | 15  | 13,000  |
| 5   | 1,800 | 16  | 15,000  |
| 6   | 2,300 | 17  | 18,000  |
| 7   | 2,900 | 18  | 20,000  |
| —   | —     | 20  | 25,000  |
| —   | —     | 30  | 155,000 |

(Source: D&D 5e SRD, stored in `Combat.ts` as `CR_TO_XP`)
