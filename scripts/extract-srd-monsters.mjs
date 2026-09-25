#!/usr/bin/env node
/**
 * Regenerates src/game/data/SrdMonsters.ts from the SRD 5.1 PDF.
 *
 *   curl -sSLo srd.pdf https://media.wizards.com/2016/downloads/DND/SRD-OGL_V5.1.pdf
 *   pdftotext srd.pdf srd.txt
 *   node scripts/extract-srd-monsters.mjs srd.txt [maxCR=5]
 *   npx prettier --write src/game/data/SrdMonsters.ts
 *
 * Only combat numbers are kept: AC, HP, speed, abilities, CR, weapon/spell attacks,
 * multiattack count, first save DC. Traits, spells and reactions are dropped.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , txtPath, maxCRArg = '5'] = process.argv;
if (!txtPath) {
  console.error('usage: node scripts/extract-srd-monsters.mjs <srd.txt> [maxCR]');
  process.exit(1);
}
const MAX_CR = Number(maxCRArg);

const text = readFileSync(txtPath, 'utf8')
  .replace(/\s+/g, ' ')
  .replace(/Not for resale\. Permission granted.*?System Reference Document 5\.1 \d+/g, ' ')
  .replace(/ {2,}/g, ' ')
  .replace(/--/g, '-')
  .replace(/[−–]/g, '-');

const SIZES = 'Tiny|Small|Medium|Large|Huge|Gargantuan';
// "<Name> <Size> <type>..., <alignment> Armor Class" — name is the capitalized run before the size
const HEADER = new RegExp(
  `((?:[A-Z][\\w'/-]*(?:\\s|$)(?:of |the )?){1,5})(${SIZES}) ([a-z][A-Za-z ]*?(?: \\([^)]*\\))?),([a-z -]+?) Armor Class (\\d+)`,
  'g'
);
// Group headings that land in front of a creature name ("Golems Clay Golem")
const GROUP_PREFIX =
  /^(?:Monsters \([A-Z]\) |Angels |Animated Objects |Demons |Devils |Dinosaurs |Dragons?,? (?:Chromatic|Metallic)? ?|Elementals |Fungi |Genies |Ghouls? |Giants |Golems |Hags |Lycanthropes |Mephits |Mummies |Nagas |Oozes |Skeletons |Sphinxes |Vampires |Zombies |Creatures |Nonplayer Characters )+/;

const CR_XP = { 0: 0, '1/8': 0.125, '1/4': 0.25, '1/2': 0.5 };
const COUNT = { one: 1, two: 2, three: 3, four: 4, five: 5 };

const headers = [...text.matchAll(HEADER)];
const monsters = [];

headers.forEach((h, i) => {
  const block = text.slice(h.index, headers[i + 1]?.index ?? text.length);
  const name = h[1].trim().replace(GROUP_PREFIX, '').trim();

  const crMatch = block.match(/Challenge (\d+\/\d+|\d+) \(/);
  const hpMatch = block.match(/Hit Points (\d+)/);
  const abil = block.match(/STR DEX CON INT WIS CHA ((?:\d+ \([+-]?\d+\) ?){6})/);
  if (!crMatch || !hpMatch || !abil) return;
  const cr = CR_XP[crMatch[1]] ?? Number(crMatch[1]);
  if (cr === 0 || cr > MAX_CR) return;

  const [strength, dexterity, constitution, intelligence, wisdom, charisma] = [
    ...abil[1].matchAll(/(\d+) \(/g),
  ].map(m => Number(m[1]));

  const actions = block.split(/ Actions /)[1]?.split(/ (?:Reactions|Legendary Actions) /)[0] ?? '';
  const attacks = [];
  const attackRe =
    /([A-Z][\w' ()-]*?)(?: \([^)]*\))?\. (?:Melee or Ranged|Melee|Ranged) (?:Weapon|Spell) Attack: \+(\d+) to hit(?: \([^)]*\))?, (?:reach (\d+) ft\.)?(?: or )?(?:ranged? (\d+)(?:\/\d+)? ft\.)?.*?Hit: [^.]*?\((\d+d\d+(?: [+-] \d+)?)\) (\w+) damage/g;
  for (const a of actions.matchAll(attackRe)) {
    const [, atkName, bonus, reachFt, rangeFt, dice, damageType] = a;
    attacks.push({
      name: atkName.trim().replace(/^.*\. /, ''),
      bonus: Number(bonus),
      damage: dice.replace(/ /g, ''),
      damageType,
      // Reach weapons (even thrown ones like spears) fight adjacent; pure ranged use range
      range: reachFt || !rangeFt ? 1 : Math.round(Number(rangeFt) / 5),
    });
  }
  // Combat always swings attacks[0] at the enemy's `range`, so a creature with any melee
  // attack keeps only melee attacks. ponytail: ranged fallbacks (goblin shortbow) dropped
  // until combat picks an attack by distance.
  const melee = attacks.filter(a => a.range === 1);
  if (melee.length > 0) attacks.splice(0, attacks.length, ...melee);
  if (attacks.length === 0) return;

  const multi = actions.match(
    /Multiattack(?: \([^)]*\))?\. The [\w' -]+? makes (one|two|three|four|five)\b/
  );
  // Fastest listed speed (walk, fly, swim...) — hex combat has one movement value
  const speedClause = block.match(/Speed ([^A-Z]*)/)?.[1] ?? '';
  const speedFt = Math.max(0, ...[...speedClause.matchAll(/(\d+) ft\./g)].map(m => Number(m[1])));
  const dc = block.match(/DC (\d+)/);

  const avg = d => {
    const [, n, s, k = '0'] = d.match(/(\d+)d(\d+)([+-]\d+)?/);
    return (Number(n) * (Number(s) + 1)) / 2 + Number(k);
  };
  const multiattack = multi ? COUNT[multi[1]] : 1;

  monsters.push({
    name,
    cr,
    hp: Number(hpMatch[1]),
    ac: Number(h[5]),
    attackBonus: Math.max(...attacks.map(a => a.bonus)),
    damagePerRound: Math.round(avg(attacks[0].damage) * multiattack),
    saveDC: dc ? Number(dc[1]) : 10,
    strength,
    dexterity,
    constitution,
    intelligence,
    wisdom,
    charisma,
    attacks: attacks.map(({ name: n, damage, damageType, range }) => ({
      name: n,
      damage,
      damageType,
      range,
    })),
    multiattack,
    range: attacks[0].range,
    moveDistance: speedFt > 0 ? Math.round(speedFt / 5) : 6,
  });
});

// Later duplicates (e.g. a name reused in the appendix) lose to the first definition
const byKey = {};
for (const m of monsters) {
  const key = m.name.toLowerCase();
  if (!byKey[key]) byKey[key] = m;
}

const out = `// GENERATED by scripts/extract-srd-monsters.mjs — do not edit by hand.
//
// This work includes material taken from the System Reference Document 5.1 ("SRD 5.1")
// by Wizards of the Coast LLC and available at
// https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed
// under the Creative Commons Attribution 4.0 International License available at
// https://creativecommons.org/licenses/by/4.0/legalcode.
//
// Combat stats only, CR 1/8–${MAX_CR}. Ranges and speeds are in 5-ft hexes.

export interface SrdAttack {
  name: string;
  damage: string;
  damageType: string;
  range: number;
}

export interface SrdMonster {
  name: string;
  cr: number;
  hp: number;
  ac: number;
  attackBonus: number;
  damagePerRound: number;
  saveDC: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  attacks: SrdAttack[];
  multiattack: number;
  range: number;
  moveDistance: number;
}

/** Keyed by lowercase SRD name */
export const SRD_MONSTERS: Record<string, SrdMonster> = ${JSON.stringify(byKey, null, 2)};
`;
writeFileSync('src/game/data/SrdMonsters.ts', out);
console.log(`${Object.keys(byKey).length} monsters (CR 1/8-${MAX_CR}) written`);
