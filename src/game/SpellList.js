/**
 * SpellList - Complete D&D 5e Spell Lists (Levels 0-3)
 * Organized by class with spell instances
 */

import { Spell } from './Spell.js';

// ============================================================================
// CLERIC SPELLS
// ============================================================================

const clericCantrips = [
  new Spell({
    name: 'Sacred Flame',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'enemy',
    savingThrow: 'dexterity',
    description: 'Flame-like radiance descends on a creature. Target must succeed on a Dexterity saving throw or take 1d8 radiant damage.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Sacred Flame' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'dexterity', dc);
      
      if (save.success) {
        return {
          message: `${target.name} DEX save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: Success! No damage`,
          damage: 0
        };
      }
      
      const damage = diceRoller.rollDice(8, 1);
      return {
        message: `${target.name} DEX save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: Failed! ${damage} radiant damage`,
        damage
      };
    }
  }),

  new Spell({
    name: 'Light',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Touch',
    components: { verbal: true, somatic: false, material: true },
    duration: '1 hour',
    targetType: 'self',
    description: 'You touch one object that is no larger than 10 feet in any dimension. Until the spell ends, the object sheds bright light in a 20-foot radius.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} creates magical light for 1 hour`,
        effect: 'light'
      };
    }
  }),

  new Spell({
    name: 'Guidance',
    level: 0,
    school: 'Divination',
    castingTime: '1 action',
    range: 'Touch',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    targetType: 'ally',
    description: 'You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${target.name} receives guidance (+1d4 to next ability check)`,
        effect: 'guidance'
      };
    }
  }),

  new Spell({
    name: 'Thaumaturgy',
    level: 0,
    school: 'Transmutation',
    castingTime: '1 action',
    range: 'Self',
    components: { verbal: true, somatic: false, material: false },
    duration: 'Up to 1 minute',
    targetType: 'self',
    description: 'You manifest a minor wonder, a sign of supernatural power, within range.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} manifests a minor supernatural effect`,
        effect: 'thaumaturgy'
      };
    }
  })
];

const clericLevel1 = [
  new Spell({
    name: 'Cure Wounds',
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Touch',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'ally',
    description: 'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Cure Wounds' });
      const spellcastingAbility = spell._getSpellcastingAbility(caster.class);
      const abilityMod = spell._getAbilityModifier(caster.abilities[spellcastingAbility]);
      const healing = diceRoller.rollDice(8, 1) + abilityMod;
      
      return {
        message: `${target.name} healed for ${healing} HP`,
        healing
      };
    }
  }),

  new Spell({
    name: 'Bless',
    level: 1,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '30 feet',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    targetType: 'ally',
    description: 'You bless up to three creatures. Whenever a target makes an attack roll or saving throw before the spell ends, the target can roll a d4 and add the number rolled.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${target.name} receives blessing (+1d4 to attacks and saves)`,
        effect: 'bless'
      };
    }
  }),

  new Spell({
    name: 'Shield of Faith',
    level: 1,
    school: 'Abjuration',
    castingTime: '1 bonus action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Concentration, up to 10 minutes',
    concentration: true,
    targetType: 'ally',
    description: 'A shimmering field appears and surrounds a creature of your choice, granting it a +2 bonus to AC.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${target.name} gains +2 AC from Shield of Faith`,
        effect: 'shield_of_faith'
      };
    }
  }),

  new Spell({
    name: 'Guiding Bolt',
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'enemy',
    attackRoll: true,
    description: 'A flash of light streaks toward a creature. Make a ranged spell attack. On a hit, the target takes 4d6 radiant damage.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Guiding Bolt' });
      const attackBonus = spell.getSpellAttackBonus(caster);
      const roll = diceRoller.rollD20();
      const total = roll + attackBonus;
      const targetAC = target.armorClass || 10;
      
      if (roll === 20 || (roll !== 1 && total >= targetAC)) {
        const damage = roll === 20 ? diceRoller.rollDice(6, 8) : diceRoller.rollDice(6, 4);
        return {
          message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: ${roll === 20 ? 'CRITICAL HIT!' : 'Hit!'} ${damage} radiant damage`,
          damage
        };
      }
      
      return {
        message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: Miss!`,
        damage: 0
      };
    }
  }),

  new Spell({
    name: 'Healing Word',
    level: 1,
    school: 'Evocation',
    castingTime: '1 bonus action',
    range: '60 feet',
    components: { verbal: true, somatic: false, material: false },
    duration: 'Instantaneous',
    targetType: 'ally',
    description: 'A creature of your choice that you can see regains hit points equal to 1d4 + your spellcasting ability modifier.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Healing Word' });
      const spellcastingAbility = spell._getSpellcastingAbility(caster.class);
      const abilityMod = spell._getAbilityModifier(caster.abilities[spellcastingAbility]);
      const healing = diceRoller.rollDice(4, 1) + abilityMod;
      
      return {
        message: `${target.name} healed for ${healing} HP`,
        healing
      };
    }
  }),

  new Spell({
    name: 'Inflict Wounds',
    level: 1,
    school: 'Necromancy',
    castingTime: '1 action',
    range: 'Touch',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'enemy',
    attackRoll: true,
    description: 'Make a melee spell attack. On a hit, the target takes 3d10 necrotic damage.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Inflict Wounds' });
      const attackBonus = spell.getSpellAttackBonus(caster);
      const roll = diceRoller.rollD20();
      const total = roll + attackBonus;
      const targetAC = target.armorClass || 10;
      
      if (roll === 20 || (roll !== 1 && total >= targetAC)) {
        const damage = roll === 20 ? diceRoller.rollDice(10, 6) : diceRoller.rollDice(10, 3);
        return {
          message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: ${roll === 20 ? 'CRITICAL HIT!' : 'Hit!'} ${damage} necrotic damage`,
          damage
        };
      }
      
      return {
        message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: Miss!`,
        damage: 0
      };
    }
  })
];

const clericLevel2 = [
  new Spell({
    name: 'Spiritual Weapon',
    level: 2,
    school: 'Evocation',
    castingTime: '1 bonus action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    targetType: 'enemy',
    attackRoll: true,
    description: 'You create a floating spectral weapon. As a bonus action, you can move it and make a melee spell attack dealing 1d8 + spellcasting modifier force damage.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Spiritual Weapon' });
      const attackBonus = spell.getSpellAttackBonus(caster);
      const spellcastingAbility = spell._getSpellcastingAbility(caster.class);
      const abilityMod = spell._getAbilityModifier(caster.abilities[spellcastingAbility]);
      const roll = diceRoller.rollD20();
      const total = roll + attackBonus;
      const targetAC = target.armorClass || 10;
      
      if (roll === 20 || (roll !== 1 && total >= targetAC)) {
        const baseDamage = roll === 20 ? diceRoller.rollDice(8, 2) : diceRoller.rollDice(8, 1);
        const damage = baseDamage + abilityMod;
        return {
          message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: ${roll === 20 ? 'CRITICAL HIT!' : 'Hit!'} ${damage} force damage`,
          damage
        };
      }
      
      return {
        message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: Miss!`,
        damage: 0
      };
    }
  }),

  new Spell({
    name: 'Hold Person',
    level: 2,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    targetType: 'enemy',
    savingThrow: 'wisdom',
    description: 'Choose a humanoid that you can see. The target must succeed on a Wisdom saving throw or be paralyzed.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Hold Person' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'wisdom', dc);
      
      if (save.success) {
        return {
          message: `${target.name} WIS save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: Success! Resists paralysis`,
          effect: null
        };
      }
      
      return {
        message: `${target.name} WIS save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: Failed! Paralyzed`,
        effect: 'paralyzed'
      };
    }
  }),

  new Spell({
    name: 'Lesser Restoration',
    level: 2,
    school: 'Abjuration',
    castingTime: '1 action',
    range: 'Touch',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'ally',
    description: 'You touch a creature and can end either one disease or one condition affecting it (blinded, deafened, paralyzed, or poisoned).',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${target.name} is cured of one disease or condition`,
        effect: 'restoration'
      };
    }
  }),

  new Spell({
    name: 'Prayer of Healing',
    level: 2,
    school: 'Evocation',
    castingTime: '10 minutes',
    range: '30 feet',
    components: { verbal: true, somatic: false, material: false },
    duration: 'Instantaneous',
    targetType: 'ally',
    description: 'Up to six creatures regain hit points equal to 2d8 + your spellcasting ability modifier.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Prayer of Healing' });
      const spellcastingAbility = spell._getSpellcastingAbility(caster.class);
      const abilityMod = spell._getAbilityModifier(caster.abilities[spellcastingAbility]);
      const healing = diceRoller.rollDice(8, 2) + abilityMod;
      
      return {
        message: `${target.name} healed for ${healing} HP`,
        healing
      };
    }
  })
];

const clericLevel3 = [
  new Spell({
    name: 'Spirit Guardians',
    level: 3,
    school: 'Conjuration',
    castingTime: '1 action',
    range: 'Self (15-foot radius)',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Concentration, up to 10 minutes',
    concentration: true,
    targetType: 'area',
    savingThrow: 'wisdom',
    description: 'You call spirits to protect you. When a creature enters the area or starts its turn there, it must make a Wisdom saving throw or take 3d8 radiant damage (half on success).',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Spirit Guardians' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'wisdom', dc);
      const fullDamage = diceRoller.rollDice(8, 3);
      const damage = save.success ? Math.floor(fullDamage / 2) : fullDamage;
      
      return {
        message: `${target.name} WIS save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: ${save.success ? 'Success!' : 'Failed!'} ${damage} radiant damage`,
        damage
      };
    }
  }),

  new Spell({
    name: 'Revivify',
    level: 3,
    school: 'Necromancy',
    castingTime: '1 action',
    range: 'Touch',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Instantaneous',
    targetType: 'ally',
    description: 'You touch a creature that has died within the last minute. That creature returns to life with 1 hit point.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${target.name} is revived with 1 HP`,
        healing: 1,
        effect: 'revive'
      };
    }
  }),

  new Spell({
    name: 'Dispel Magic',
    level: 3,
    school: 'Abjuration',
    castingTime: '1 action',
    range: '120 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'enemy',
    description: 'Choose one creature, object, or magical effect. Any spell of 3rd level or lower on the target ends.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `Dispel Magic removes magical effects from ${target.name}`,
        effect: 'dispel'
      };
    }
  }),

  new Spell({
    name: 'Beacon of Hope',
    level: 3,
    school: 'Abjuration',
    castingTime: '1 action',
    range: '30 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    targetType: 'ally',
    description: 'Choose any number of creatures. For the duration, each target has advantage on Wisdom saving throws and death saving throws, and regains the maximum number of hit points possible from healing.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${target.name} receives Beacon of Hope (advantage on WIS/death saves, max healing)`,
        effect: 'beacon_of_hope'
      };
    }
  })
];

// ============================================================================
// WIZARD SPELLS
// ============================================================================

const wizardCantrips = [
  new Spell({
    name: 'Fire Bolt',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'enemy',
    attackRoll: true,
    description: 'You hurl a mote of fire at a creature. Make a ranged spell attack. On a hit, the target takes 1d10 fire damage.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Fire Bolt' });
      const attackBonus = spell.getSpellAttackBonus(caster);
      const roll = diceRoller.rollD20();
      const total = roll + attackBonus;
      const targetAC = target.armorClass || 10;
      
      if (roll === 20 || (roll !== 1 && total >= targetAC)) {
        const damage = roll === 20 ? diceRoller.rollDice(10, 2) : diceRoller.rollDice(10, 1);
        return {
          message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: ${roll === 20 ? 'CRITICAL HIT!' : 'Hit!'} ${damage} fire damage`,
          damage
        };
      }
      
      return {
        message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: Miss!`,
        damage: 0
      };
    }
  }),

  new Spell({
    name: 'Mage Hand',
    level: 0,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '30 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: '1 minute',
    targetType: 'self',
    description: 'A spectral, floating hand appears. You can use your action to control the hand to manipulate objects, open doors, or retrieve items.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} creates a spectral mage hand`,
        effect: 'mage_hand'
      };
    }
  }),

  new Spell({
    name: 'Prestidigitation',
    level: 0,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '10 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Up to 1 hour',
    targetType: 'self',
    description: 'You create one of several minor magical effects.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} performs a minor magical trick`,
        effect: 'prestidigitation'
      };
    }
  }),

  new Spell({
    name: 'Ray of Frost',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'enemy',
    attackRoll: true,
    description: 'A frigid beam of blue-white light streaks toward a creature. Make a ranged spell attack. On a hit, it takes 1d8 cold damage and its speed is reduced by 10 feet.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Ray of Frost' });
      const attackBonus = spell.getSpellAttackBonus(caster);
      const roll = diceRoller.rollD20();
      const total = roll + attackBonus;
      const targetAC = target.armorClass || 10;
      
      if (roll === 20 || (roll !== 1 && total >= targetAC)) {
        const damage = roll === 20 ? diceRoller.rollDice(8, 2) : diceRoller.rollDice(8, 1);
        return {
          message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: ${roll === 20 ? 'CRITICAL HIT!' : 'Hit!'} ${damage} cold damage (speed reduced)`,
          damage
        };
      }
      
      return {
        message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: Miss!`,
        damage: 0
      };
    }
  }),

  new Spell({
    name: 'Shocking Grasp',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Touch',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'enemy',
    attackRoll: true,
    description: 'Lightning springs from your hand. Make a melee spell attack. On a hit, the target takes 1d8 lightning damage and cannot take reactions.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Shocking Grasp' });
      const attackBonus = spell.getSpellAttackBonus(caster);
      const roll = diceRoller.rollD20();
      const total = roll + attackBonus;
      const targetAC = target.armorClass || 10;
      
      if (roll === 20 || (roll !== 1 && total >= targetAC)) {
        const damage = roll === 20 ? diceRoller.rollDice(8, 2) : diceRoller.rollDice(8, 1);
        return {
          message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: ${roll === 20 ? 'CRITICAL HIT!' : 'Hit!'} ${damage} lightning damage (no reactions)`,
          damage
        };
      }
      
      return {
        message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: Miss!`,
        damage: 0
      };
    }
  })
];

const wizardLevel1 = [
  new Spell({
    name: 'Magic Missile',
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'enemy',
    description: 'You create three glowing darts of magical force. Each dart hits a creature and deals 1d4+1 force damage.',
    effect: (caster, target, diceRoller) => {
      const damage1 = diceRoller.rollDice(4, 1) + 1;
      const damage2 = diceRoller.rollDice(4, 1) + 1;
      const damage3 = diceRoller.rollDice(4, 1) + 1;
      const totalDamage = damage1 + damage2 + damage3;
      
      return {
        message: `3 magic missiles hit ${target.name} for ${damage1}+${damage2}+${damage3}=${totalDamage} force damage`,
        damage: totalDamage
      };
    }
  }),

  new Spell({
    name: 'Shield',
    level: 1,
    school: 'Abjuration',
    castingTime: '1 reaction',
    range: 'Self',
    components: { verbal: true, somatic: true, material: false },
    duration: '1 round',
    targetType: 'self',
    description: 'An invisible barrier of magical force appears and protects you, granting you a +5 bonus to AC.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} gains +5 AC until start of next turn`,
        effect: 'shield'
      };
    }
  }),

  new Spell({
    name: 'Mage Armor',
    level: 1,
    school: 'Abjuration',
    castingTime: '1 action',
    range: 'Touch',
    components: { verbal: true, somatic: true, material: true },
    duration: '8 hours',
    targetType: 'ally',
    description: 'You touch a willing creature who is not wearing armor. The target\'s base AC becomes 13 + Dexterity modifier.',
    effect: (caster, target, diceRoller) => {
      const dexMod = Math.floor((target.abilities.dexterity - 10) / 2);
      const newAC = 13 + dexMod;
      return {
        message: `${target.name}'s AC becomes ${newAC} for 8 hours`,
        effect: 'mage_armor'
      };
    }
  }),

  new Spell({
    name: 'Burning Hands',
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (15-foot cone)',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'area',
    savingThrow: 'dexterity',
    description: 'A thin sheet of flames shoots forth. Each creature in a 15-foot cone must make a Dexterity saving throw or take 3d6 fire damage (half on success).',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Burning Hands' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'dexterity', dc);
      const fullDamage = diceRoller.rollDice(6, 3);
      const damage = save.success ? Math.floor(fullDamage / 2) : fullDamage;
      
      return {
        message: `${target.name} DEX save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: ${save.success ? 'Success!' : 'Failed!'} ${damage} fire damage`,
        damage
      };
    }
  }),

  new Spell({
    name: 'Sleep',
    level: 1,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '90 feet',
    components: { verbal: true, somatic: true, material: true },
    duration: '1 minute',
    targetType: 'area',
    description: 'Roll 5d8; creatures within a 20-foot radius fall unconscious until their combined HP equals the roll total.',
    effect: (caster, target, diceRoller) => {
      const hpPool = diceRoller.rollDice(8, 5);
      return {
        message: `Sleep affects up to ${hpPool} HP worth of creatures`,
        effect: 'sleep',
        value: hpPool
      };
    }
  }),

  new Spell({
    name: 'Detect Magic',
    level: 1,
    school: 'Divination',
    castingTime: '1 action',
    range: 'Self',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Concentration, up to 10 minutes',
    concentration: true,
    targetType: 'self',
    description: 'For the duration, you sense the presence of magic within 30 feet and can determine its school.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} can detect magic for 10 minutes`,
        effect: 'detect_magic'
      };
    }
  })
];

const wizardLevel2 = [
  new Spell({
    name: 'Scorching Ray',
    level: 2,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'enemy',
    attackRoll: true,
    description: 'You create three rays of fire. Make a ranged spell attack for each ray. On a hit, the target takes 2d6 fire damage.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Scorching Ray' });
      const attackBonus = spell.getSpellAttackBonus(caster);
      const targetAC = target.armorClass || 10;
      
      let totalDamage = 0;
      let hits = 0;
      const results = [];
      
      for (let i = 1; i <= 3; i++) {
        const roll = diceRoller.rollD20();
        const total = roll + attackBonus;
        
        if (roll === 20 || (roll !== 1 && total >= targetAC)) {
          const damage = roll === 20 ? diceRoller.rollDice(6, 4) : diceRoller.rollDice(6, 2);
          totalDamage += damage;
          hits++;
          results.push(`Ray ${i}: ${roll}+${attackBonus}=${total} ${roll === 20 ? 'CRIT' : 'Hit'} (${damage})`);
        } else {
          results.push(`Ray ${i}: ${roll}+${attackBonus}=${total} Miss`);
        }
      }
      
      return {
        message: `${results.join(', ')} = ${totalDamage} total fire damage`,
        damage: totalDamage
      };
    }
  }),

  new Spell({
    name: 'Misty Step',
    level: 2,
    school: 'Conjuration',
    castingTime: '1 bonus action',
    range: 'Self',
    components: { verbal: true, somatic: false, material: false },
    duration: 'Instantaneous',
    targetType: 'self',
    description: 'Surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space you can see.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} teleports up to 30 feet`,
        effect: 'misty_step'
      };
    }
  }),

  new Spell({
    name: 'Mirror Image',
    level: 2,
    school: 'Illusion',
    castingTime: '1 action',
    range: 'Self',
    components: { verbal: true, somatic: true, material: false },
    duration: '1 minute',
    targetType: 'self',
    description: 'Three illusory duplicates of yourself appear. Each time a creature attacks you, roll a d20 to determine if the attack hits you or an image.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} creates 3 mirror images`,
        effect: 'mirror_image',
        value: 3
      };
    }
  }),

  new Spell({
    name: 'Web',
    level: 2,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Concentration, up to 1 hour',
    concentration: true,
    targetType: 'area',
    savingThrow: 'dexterity',
    description: 'You conjure thick, sticky webbing. Creatures in the area must make a Dexterity saving throw or be restrained.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Web' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'dexterity', dc);
      
      if (save.success) {
        return {
          message: `${target.name} DEX save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: Success! Avoids webs`,
          effect: null
        };
      }
      
      return {
        message: `${target.name} DEX save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: Failed! Restrained by webs`,
        effect: 'restrained'
      };
    }
  }),

  new Spell({
    name: 'Invisibility',
    level: 2,
    school: 'Illusion',
    castingTime: '1 action',
    range: 'Touch',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Concentration, up to 1 hour',
    concentration: true,
    targetType: 'ally',
    description: 'A creature you touch becomes invisible until the spell ends. Anything the target is wearing or carrying is invisible.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${target.name} becomes invisible`,
        effect: 'invisible'
      };
    }
  })
];

const wizardLevel3 = [
  new Spell({
    name: 'Fireball',
    level: 3,
    school: 'Evocation',
    castingTime: '1 action',
    range: '150 feet',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Instantaneous',
    targetType: 'area',
    savingThrow: 'dexterity',
    description: 'A bright streak flashes to a point you choose and explodes in a 20-foot radius. Creatures must make a Dexterity saving throw or take 8d6 fire damage (half on success).',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Fireball' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'dexterity', dc);
      const fullDamage = diceRoller.rollDice(6, 8);
      const damage = save.success ? Math.floor(fullDamage / 2) : fullDamage;
      
      return {
        message: `${target.name} DEX save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: ${save.success ? 'Success!' : 'Failed!'} ${damage} fire damage`,
        damage
      };
    }
  }),

  new Spell({
    name: 'Lightning Bolt',
    level: 3,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (100-foot line)',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Instantaneous',
    targetType: 'area',
    savingThrow: 'dexterity',
    description: 'A stroke of lightning forms a 100-foot-long, 5-foot-wide line. Creatures must make a Dexterity saving throw or take 8d6 lightning damage (half on success).',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Lightning Bolt' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'dexterity', dc);
      const fullDamage = diceRoller.rollDice(6, 8);
      const damage = save.success ? Math.floor(fullDamage / 2) : fullDamage;
      
      return {
        message: `${target.name} DEX save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: ${save.success ? 'Success!' : 'Failed!'} ${damage} lightning damage`,
        damage
      };
    }
  }),

  new Spell({
    name: 'Counterspell',
    level: 3,
    school: 'Abjuration',
    castingTime: '1 reaction',
    range: '60 feet',
    components: { verbal: false, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'enemy',
    description: 'You attempt to interrupt a creature casting a spell. If the spell is 3rd level or lower, it fails.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} counters ${target.name}'s spell`,
        effect: 'counterspell'
      };
    }
  }),

  new Spell({
    name: 'Fly',
    level: 3,
    school: 'Transmutation',
    castingTime: '1 action',
    range: 'Touch',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Concentration, up to 10 minutes',
    concentration: true,
    targetType: 'ally',
    description: 'You touch a willing creature. The target gains a flying speed of 60 feet.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${target.name} gains flying speed of 60 feet`,
        effect: 'fly'
      };
    }
  }),

  new Spell({
    name: 'Haste',
    level: 3,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '30 feet',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    targetType: 'ally',
    description: 'Choose a willing creature. The target\'s speed is doubled, it gains a +2 bonus to AC, and it gains an additional action each turn.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${target.name} gains haste (double speed, +2 AC, extra action)`,
        effect: 'haste'
      };
    }
  })
];

// ============================================================================
// DRUID SPELLS
// ============================================================================

const druidCantrips = [
  new Spell({
    name: 'Produce Flame',
    level: 0,
    school: 'Conjuration',
    castingTime: '1 action',
    range: 'Self',
    components: { verbal: true, somatic: true, material: false },
    duration: '10 minutes',
    targetType: 'enemy',
    attackRoll: true,
    description: 'A flickering flame appears in your hand. You can hurl it at a creature, making a ranged spell attack dealing 1d8 fire damage.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Produce Flame' });
      const attackBonus = spell.getSpellAttackBonus(caster);
      const roll = diceRoller.rollD20();
      const total = roll + attackBonus;
      const targetAC = target.armorClass || 10;
      
      if (roll === 20 || (roll !== 1 && total >= targetAC)) {
        const damage = roll === 20 ? diceRoller.rollDice(8, 2) : diceRoller.rollDice(8, 1);
        return {
          message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: ${roll === 20 ? 'CRITICAL HIT!' : 'Hit!'} ${damage} fire damage`,
          damage
        };
      }
      
      return {
        message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: Miss!`,
        damage: 0
      };
    }
  }),

  new Spell({
    name: 'Shillelagh',
    level: 0,
    school: 'Transmutation',
    castingTime: '1 bonus action',
    range: 'Touch',
    components: { verbal: true, somatic: true, material: true },
    duration: '1 minute',
    targetType: 'self',
    description: 'Your staff or club becomes magical. Use your spellcasting ability instead of Strength for attack and damage rolls, dealing 1d8 damage.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name}'s weapon becomes magical (1d8, uses WIS)`,
        effect: 'shillelagh'
      };
    }
  }),

  new Spell({
    name: 'Druidcraft',
    level: 0,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '30 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'self',
    description: 'You create a minor nature-based effect: predict weather, light/snuff a small flame, cause a plant to bloom, etc.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} creates a minor natural effect`,
        effect: 'druidcraft'
      };
    }
  })
];

const druidLevel1 = [
  new Spell({
    name: 'Entangle',
    level: 1,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '90 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    targetType: 'area',
    savingThrow: 'strength',
    description: 'Grasping weeds and vines sprout from the ground in a 20-foot square. Creatures must make a Strength saving throw or be restrained.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Entangle' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'strength', dc);
      
      if (save.success) {
        return {
          message: `${target.name} STR save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: Success! Breaks free`,
          effect: null
        };
      }
      
      return {
        message: `${target.name} STR save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: Failed! Restrained by vines`,
        effect: 'restrained'
      };
    }
  }),

  new Spell({
    name: 'Goodberry',
    level: 1,
    school: 'Transmutation',
    castingTime: '1 action',
    range: 'Touch',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Instantaneous',
    targetType: 'ally',
    description: 'Up to ten berries appear. A creature can use its action to eat one berry, regaining 1 hit point and providing nourishment for one day.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} creates 10 goodberries (1 HP each, counts as food)`,
        effect: 'goodberry',
        value: 10
      };
    }
  }),

  new Spell({
    name: 'Thunderwave',
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (15-foot cube)',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'area',
    savingThrow: 'constitution',
    description: 'A wave of thunderous force sweeps out. Creatures must make a Constitution saving throw or take 2d8 thunder damage and be pushed 10 feet (half damage on success).',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Thunderwave' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'constitution', dc);
      const fullDamage = diceRoller.rollDice(8, 2);
      const damage = save.success ? Math.floor(fullDamage / 2) : fullDamage;
      
      return {
        message: `${target.name} CON save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: ${save.success ? 'Success!' : 'Failed! Pushed 10ft.'} ${damage} thunder damage`,
        damage
      };
    }
  })
];

const druidLevel2 = [
  new Spell({
    name: 'Moonbeam',
    level: 2,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    targetType: 'area',
    savingThrow: 'constitution',
    description: 'A silvery beam of pale light shines down in a 5-foot radius. Creatures must make a Constitution saving throw or take 2d10 radiant damage (half on success).',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Moonbeam' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'constitution', dc);
      const fullDamage = diceRoller.rollDice(10, 2);
      const damage = save.success ? Math.floor(fullDamage / 2) : fullDamage;
      
      return {
        message: `${target.name} CON save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: ${save.success ? 'Success!' : 'Failed!'} ${damage} radiant damage`,
        damage
      };
    }
  }),

  new Spell({
    name: 'Heat Metal',
    level: 2,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    targetType: 'enemy',
    savingThrow: 'constitution',
    description: 'Choose a manufactured metal object. Any creature in physical contact with it takes 2d8 fire damage and must make a Constitution saving throw or drop the object.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Heat Metal' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'constitution', dc);
      const damage = diceRoller.rollDice(8, 2);
      
      return {
        message: `${target.name} takes ${damage} fire damage. CON save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: ${save.success ? 'Holds object' : 'Drops object'}`,
        damage
      };
    }
  }),

  new Spell({
    name: 'Pass Without Trace',
    level: 2,
    school: 'Abjuration',
    castingTime: '1 action',
    range: 'Self',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Concentration, up to 1 hour',
    concentration: true,
    targetType: 'ally',
    description: 'A veil of shadows and silence radiates from you. For the duration, each creature you choose gains a +10 bonus to Dexterity (Stealth) checks.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${target.name} gains +10 to Stealth checks`,
        effect: 'pass_without_trace'
      };
    }
  })
];

const druidLevel3 = [
  new Spell({
    name: 'Call Lightning',
    level: 3,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '120 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Concentration, up to 10 minutes',
    concentration: true,
    targetType: 'area',
    savingThrow: 'dexterity',
    description: 'A storm cloud appears. You can call down a bolt of lightning dealing 3d10 lightning damage (Dexterity save for half).',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Call Lightning' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'dexterity', dc);
      const fullDamage = diceRoller.rollDice(10, 3);
      const damage = save.success ? Math.floor(fullDamage / 2) : fullDamage;
      
      return {
        message: `${target.name} DEX save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: ${save.success ? 'Success!' : 'Failed!'} ${damage} lightning damage`,
        damage
      };
    }
  }),

  new Spell({
    name: 'Conjure Animals',
    level: 3,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Concentration, up to 1 hour',
    concentration: true,
    targetType: 'area',
    description: 'You summon fey spirits that take the form of beasts. The beasts obey your commands.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} summons spirit animals to aid in combat`,
        effect: 'conjure_animals'
      };
    }
  }),

  new Spell({
    name: 'Plant Growth',
    level: 3,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '150 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'area',
    description: 'You can either enrich land to improve crops, or overgrow plants to make the area difficult terrain.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} causes rapid plant growth`,
        effect: 'plant_growth'
      };
    }
  })
];

// ============================================================================
// BARD SPELLS
// ============================================================================

const bardCantrips = [
  new Spell({
    name: 'Vicious Mockery',
    level: 0,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: false, material: false },
    duration: 'Instantaneous',
    targetType: 'enemy',
    savingThrow: 'wisdom',
    description: 'You unleash a string of insults. The target must make a Wisdom saving throw or take 1d4 psychic damage and have disadvantage on its next attack roll.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Vicious Mockery' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'wisdom', dc);
      
      if (save.success) {
        return {
          message: `${target.name} WIS save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: Success! No damage`,
          damage: 0
        };
      }
      
      const damage = diceRoller.rollDice(4, 1);
      return {
        message: `${target.name} WIS save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: Failed! ${damage} psychic damage (disadvantage on next attack)`,
        damage
      };
    }
  }),

  new Spell({
    name: 'Minor Illusion',
    level: 0,
    school: 'Illusion',
    castingTime: '1 action',
    range: '30 feet',
    components: { verbal: false, somatic: true, material: true },
    duration: '1 minute',
    targetType: 'self',
    description: 'You create a sound or an image of an object that lasts for 1 minute.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} creates a minor illusion`,
        effect: 'minor_illusion'
      };
    }
  })
];

const bardLevel1 = [
  new Spell({
    name: 'Faerie Fire',
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: false, material: false },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    targetType: 'area',
    savingThrow: 'dexterity',
    description: 'Objects and creatures in a 20-foot cube are outlined in light. Attack rolls against affected creatures have advantage.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Faerie Fire' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'dexterity', dc);
      
      if (save.success) {
        return {
          message: `${target.name} DEX save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: Success! Avoids glow`,
          effect: null
        };
      }
      
      return {
        message: `${target.name} DEX save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: Failed! Outlined in light (attackers have advantage)`,
        effect: 'faerie_fire'
      };
    }
  }),

  new Spell({
    name: 'Charm Person',
    level: 1,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '30 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: '1 hour',
    targetType: 'enemy',
    savingThrow: 'wisdom',
    description: 'You attempt to charm a humanoid. The target must make a Wisdom saving throw or be charmed by you.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Charm Person' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'wisdom', dc);
      
      if (save.success) {
        return {
          message: `${target.name} WIS save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: Success! Resists charm`,
          effect: null
        };
      }
      
      return {
        message: `${target.name} WIS save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: Failed! Charmed`,
        effect: 'charmed'
      };
    }
  })
];

const bardLevel2 = [
  new Spell({
    name: 'Shatter',
    level: 2,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Instantaneous',
    targetType: 'area',
    savingThrow: 'constitution',
    description: 'A sudden loud ringing noise erupts in a 10-foot radius sphere. Creatures must make a Constitution saving throw or take 3d8 thunder damage (half on success).',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Shatter' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'constitution', dc);
      const fullDamage = diceRoller.rollDice(8, 3);
      const damage = save.success ? Math.floor(fullDamage / 2) : fullDamage;
      
      return {
        message: `${target.name} CON save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: ${save.success ? 'Success!' : 'Failed!'} ${damage} thunder damage`,
        damage
      };
    }
  })
];

const bardLevel3 = [
  new Spell({
    name: 'Hypnotic Pattern',
    level: 3,
    school: 'Illusion',
    castingTime: '1 action',
    range: '120 feet',
    components: { verbal: false, somatic: true, material: true },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    targetType: 'area',
    savingThrow: 'wisdom',
    description: 'A twisting pattern of colors appears. Creatures must make a Wisdom saving throw or become charmed and incapacitated.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Hypnotic Pattern' });
      const dc = spell.getSpellSaveDC(caster);
      const save = diceRoller.savingThrow(target, 'wisdom', dc);
      
      if (save.success) {
        return {
          message: `${target.name} WIS save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: Success! Resists hypnosis`,
          effect: null
        };
      }
      
      return {
        message: `${target.name} WIS save ${save.roll}+${save.modifier}=${save.total} vs DC ${dc}: Failed! Charmed and incapacitated`,
        effect: 'hypnotized'
      };
    }
  })
];

// ============================================================================
// SORCERER SPELLS
// ============================================================================

// Sorcerers share many wizard spells
const sorcererCantrips = [
  wizardCantrips[0], // Fire Bolt
  wizardCantrips[3], // Ray of Frost
  wizardCantrips[1], // Mage Hand
  wizardCantrips[4]  // Shocking Grasp
];

const sorcererLevel1 = [
  wizardLevel1[0], // Magic Missile
  wizardLevel1[1], // Shield
  new Spell({
    name: 'Chromatic Orb',
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: '90 feet',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Instantaneous',
    targetType: 'enemy',
    attackRoll: true,
    description: 'You hurl a 4-inch sphere of energy. Make a ranged spell attack. On a hit, the target takes 3d8 damage of a type you choose.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Chromatic Orb' });
      const attackBonus = spell.getSpellAttackBonus(caster);
      const roll = diceRoller.rollD20();
      const total = roll + attackBonus;
      const targetAC = target.armorClass || 10;
      
      if (roll === 20 || (roll !== 1 && total >= targetAC)) {
        const damage = roll === 20 ? diceRoller.rollDice(8, 6) : diceRoller.rollDice(8, 3);
        return {
          message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: ${roll === 20 ? 'CRITICAL HIT!' : 'Hit!'} ${damage} elemental damage`,
          damage
        };
      }
      
      return {
        message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: Miss!`,
        damage: 0
      };
    }
  }),
  wizardLevel1[3]  // Burning Hands
];

const sorcererLevel2 = [
  wizardLevel2[0], // Scorching Ray
  wizardLevel2[2], // Mirror Image
  wizardLevel2[1]  // Misty Step
];

const sorcererLevel3 = [
  wizardLevel3[0], // Fireball
  wizardLevel3[4], // Haste
  wizardLevel3[2]  // Counterspell
];

// ============================================================================
// WARLOCK SPELLS
// ============================================================================

const warlockCantrips = [
  new Spell({
    name: 'Eldritch Blast',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'enemy',
    attackRoll: true,
    description: 'A beam of crackling energy streaks toward a creature. Make a ranged spell attack. On a hit, the target takes 1d10 force damage.',
    effect: (caster, target, diceRoller) => {
      const spell = new Spell({ name: 'Eldritch Blast' });
      const attackBonus = spell.getSpellAttackBonus(caster);
      const roll = diceRoller.rollD20();
      const total = roll + attackBonus;
      const targetAC = target.armorClass || 10;
      
      if (roll === 20 || (roll !== 1 && total >= targetAC)) {
        const damage = roll === 20 ? diceRoller.rollDice(10, 2) : diceRoller.rollDice(10, 1);
        return {
          message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: ${roll === 20 ? 'CRITICAL HIT!' : 'Hit!'} ${damage} force damage`,
          damage
        };
      }
      
      return {
        message: `Attack ${roll}+${attackBonus}=${total} vs AC ${targetAC}: Miss!`,
        damage: 0
      };
    }
  }),
  wizardCantrips[1] // Mage Hand
];

const warlockLevel1 = [
  new Spell({
    name: 'Hex',
    level: 1,
    school: 'Enchantment',
    castingTime: '1 bonus action',
    range: '90 feet',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Concentration, up to 1 hour',
    concentration: true,
    targetType: 'enemy',
    description: 'You place a curse on a creature. You deal an extra 1d6 necrotic damage to the target whenever you hit it with an attack.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${target.name} is hexed (+1d6 damage on hits, disadvantage on chosen ability checks)`,
        effect: 'hex'
      };
    }
  }),

  new Spell({
    name: 'Armor of Agathys',
    level: 1,
    school: 'Abjuration',
    castingTime: '1 action',
    range: 'Self',
    components: { verbal: true, somatic: true, material: true },
    duration: '1 hour',
    targetType: 'self',
    description: 'A protective magical force surrounds you. You gain 5 temporary hit points. If a creature hits you with a melee attack while you have these hit points, it takes 5 cold damage.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} gains 5 temporary HP and retaliatory cold damage`,
        effect: 'armor_of_agathys',
        tempHP: 5
      };
    }
  }),

  bardLevel1[1] // Charm Person
];

const warlockLevel2 = [
  clericLevel2[1], // Hold Person
  wizardLevel2[4], // Invisibility
  bardLevel2[0]    // Shatter
];

const warlockLevel3 = [
  new Spell({
    name: 'Hunger of Hadar',
    level: 3,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '150 feet',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    targetType: 'area',
    savingThrow: 'dexterity',
    description: 'You open a gateway to the dark between the stars. Creatures in a 20-foot sphere take 2d6 cold damage at the start of their turn.',
    effect: (caster, target, diceRoller) => {
      const damage = diceRoller.rollDice(6, 2);
      return {
        message: `${target.name} takes ${damage} cold damage in Hunger of Hadar`,
        damage
      };
    }
  }),

  wizardLevel3[2], // Counterspell
  wizardLevel3[3]  // Fly
];

// ============================================================================
// PALADIN SPELLS (No cantrips)
// ============================================================================

const paladinLevel1 = [
  clericLevel1[0], // Cure Wounds
  clericLevel1[1], // Bless
  clericLevel1[2], // Shield of Faith
  new Spell({
    name: 'Divine Favor',
    level: 1,
    school: 'Evocation',
    castingTime: '1 bonus action',
    range: 'Self',
    components: { verbal: true, somatic: false, material: false },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    targetType: 'self',
    description: 'Your weapon glows with divine radiance. Until the spell ends, your weapon attacks deal an extra 1d4 radiant damage.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name}'s weapon deals +1d4 radiant damage`,
        effect: 'divine_favor'
      };
    }
  })
];

const paladinLevel2 = [
  clericLevel2[2], // Lesser Restoration
  new Spell({
    name: 'Aid',
    level: 2,
    school: 'Abjuration',
    castingTime: '1 action',
    range: '30 feet',
    components: { verbal: true, somatic: true, material: true },
    duration: '8 hours',
    targetType: 'ally',
    description: 'Your spell bolsters your allies. Choose up to three creatures. Each target\'s hit point maximum and current hit points increase by 5.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${target.name} gains +5 max HP and +5 current HP`,
        healing: 5,
        effect: 'aid'
      };
    }
  }),

  new Spell({
    name: 'Find Steed',
    level: 2,
    school: 'Conjuration',
    castingTime: '10 minutes',
    range: '30 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    targetType: 'self',
    description: 'You summon a spirit that assumes the form of a loyal steed (warhorse, pony, camel, elk, or mastiff).',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} summons a celestial steed`,
        effect: 'find_steed'
      };
    }
  })
];

const paladinLevel3 = [
  clericLevel3[1], // Revivify
  new Spell({
    name: 'Aura of Vitality',
    level: 3,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (30-foot radius)',
    components: { verbal: true, somatic: false, material: false },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    targetType: 'ally',
    description: 'Healing energy radiates from you. On your turn, you can use a bonus action to restore 2d6 hit points to one creature in the aura.',
    effect: (caster, target, diceRoller) => {
      const healing = diceRoller.rollDice(6, 2);
      return {
        message: `${target.name} healed for ${healing} HP`,
        healing
      };
    }
  })
];

// ============================================================================
// RANGER SPELLS (No cantrips)
// ============================================================================

const rangerLevel1 = [
  clericLevel1[0], // Cure Wounds
  druidLevel1[1],  // Goodberry
  new Spell({
    name: 'Hunter\'s Mark',
    level: 1,
    school: 'Divination',
    castingTime: '1 bonus action',
    range: '90 feet',
    components: { verbal: true, somatic: false, material: false },
    duration: 'Concentration, up to 1 hour',
    concentration: true,
    targetType: 'enemy',
    description: 'You choose a creature you can see and mystically mark it as your quarry. You deal an extra 1d6 damage to the target whenever you hit it with a weapon attack.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${target.name} is marked (+1d6 damage on weapon attacks, advantage on tracking)`,
        effect: 'hunters_mark'
      };
    }
  }),

  new Spell({
    name: 'Fog Cloud',
    level: 1,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '120 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Concentration, up to 1 hour',
    concentration: true,
    targetType: 'area',
    description: 'You create a 20-foot-radius sphere of fog. The area is heavily obscured.',
    effect: (caster, target, diceRoller) => {
      return {
        message: `${caster.name} creates a fog cloud (heavily obscured area)`,
        effect: 'fog_cloud'
      };
    }
  })
];

const rangerLevel2 = [
  druidLevel2[2],  // Pass Without Trace
  new Spell({
    name: 'Spike Growth',
    level: 2,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '150 feet',
    components: { verbal: true, somatic: true, material: true },
    duration: 'Concentration, up to 10 minutes',
    concentration: true,
    targetType: 'area',
    description: 'The ground in a 20-foot radius twists and sprouts hard spikes. The area becomes difficult terrain. When a creature moves into or within the area, it takes 2d4 piercing damage for every 5 feet it travels.',
    effect: (caster, target, diceRoller) => {
      const damage = diceRoller.rollDice(4, 2);
      return {
        message: `${target.name} takes ${damage} piercing damage from spike growth`,
        damage
      };
    }
  }),
  clericLevel2[2]  // Lesser Restoration
];

const rangerLevel3 = [
  druidLevel3[1],  // Conjure Animals
  new Spell({
    name: 'Lightning Arrow',
    level: 3,
    school: 'Transmutation',
    castingTime: '1 bonus action',
    range: 'Self',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    targetType: 'enemy',
    description: 'The next time you make a ranged weapon attack, the ammunition transforms into a lightning bolt. On a hit, the target takes an extra 4d8 lightning damage.',
    effect: (caster, target, diceRoller) => {
      const damage = diceRoller.rollDice(8, 4);
      return {
        message: `Lightning arrow hits ${target.name} for +${damage} lightning damage`,
        damage
      };
    }
  })
];

// ============================================================================
// EXPORT SPELL LISTS BY CLASS
// ============================================================================

export const SPELL_LISTS = {
  cleric: {
    0: clericCantrips,
    1: clericLevel1,
    2: clericLevel2,
    3: clericLevel3
  },
  wizard: {
    0: wizardCantrips,
    1: wizardLevel1,
    2: wizardLevel2,
    3: wizardLevel3
  },
  druid: {
    0: druidCantrips,
    1: druidLevel1,
    2: druidLevel2,
    3: druidLevel3
  },
  bard: {
    0: bardCantrips,
    1: bardLevel1,
    2: bardLevel2,
    3: bardLevel3
  },
  sorcerer: {
    0: sorcererCantrips,
    1: sorcererLevel1,
    2: sorcererLevel2,
    3: sorcererLevel3
  },
  warlock: {
    0: warlockCantrips,
    1: warlockLevel1,
    2: warlockLevel2,
    3: warlockLevel3
  },
  paladin: {
    1: paladinLevel1,
    2: paladinLevel2,
    3: paladinLevel3
  },
  ranger: {
    1: rangerLevel1,
    2: rangerLevel2,
    3: rangerLevel3
  }
};

export default SPELL_LISTS;
