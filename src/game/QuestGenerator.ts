/**
 * QuestGenerator — quests that point at real places on the map.
 *
 *  - buildSurvivalNote / buildFlavorNote: the two notes in the starting cache. Each note's
 *    text names a real nearby place, and picking the note up starts its quest.
 *  - generateBoardQuests: a settlement's quest board. Seeded by map seed + town + refresh
 *    period, so the same board comes back after a reload without being saved.
 *
 * Distances are in hexes (6-mile hexes, HEXES_PER_TRAVEL_DAY per day).
 */

import { Quest, QuestStatus } from './Quest';
import { formatTravelTime } from './TimeManager';
import { createSeededRNG } from '../utils/seededRandom';
import { getHexDistance, getCompassDirection } from '../utils/hexMath';
import { QUEST, STARTING_CACHE, isSettlement } from '../constants/gameConstants';

/** Minimal overworld-hex shape the generators read. */
export interface QuestWorldHex {
  col: number;
  row: number;
  terrain?: unknown; // { name } on real hexes
  poi?: { type?: string; name?: string; cr?: number } | null;
}

interface Place {
  key: string;
  name: string;
  type: string;
  cr: number;
  terrain: string;
  distance: number;
  direction: string;
}

type Coord = { col: number; row: number };

/** Sites with interiors; "cleared" means their boss (dungeon/tower) or every encounter falls. */
export const INTERIOR_SITE_TYPES = ['dungeon', 'tower', 'cave', 'ruins'];

/** Places a clear quest can point at: overworld encounters and interiors with enemies. */
export const isClearableSite = (type?: string) =>
  type === 'encounter' || INTERIOR_SITE_TYPES.includes(type ?? '');

const hexKey = (c: Coord) => `${c.col},${c.row}`;

/** POIs matching `filter` between minDist and maxDist hexes of `from`, nearest first. */
function placesNear(
  world: QuestWorldHex[],
  from: Coord,
  filter: (type: string, key: string, cr: number) => boolean,
  minDist: number,
  maxDist: number
): Place[] {
  const places: Place[] = [];
  for (const hex of world) {
    const type = hex.poi?.type;
    if (!type || !hex.poi?.name) continue;
    const key = hexKey(hex);
    const cr = hex.poi.cr ?? 0;
    if (!filter(type, key, cr)) continue;
    const distance = getHexDistance(from.col, from.row, hex.col, hex.row);
    if (distance < minDist || distance > maxDist) continue;
    places.push({
      key,
      name: hex.poi.name,
      type,
      cr,
      terrain: ((hex.terrain as { name?: string } | null)?.name ?? 'wilds').toLowerCase(),
      distance,
      direction: getCompassDirection(hex.col - from.col, hex.row - from.row),
    });
  }
  return places.sort((a, b) => a.distance - b.distance);
}

/** "a day's walk northeast" */
const where = (p: Place) => `${formatTravelTime(p.distance)} ${p.direction}`;

// ── Starting-cache notes ────────────────────────────────────────────────────

export interface StartingNote {
  text: string;
  quest: Quest | null;
}

/** Survival note: points at the nearest settlement; reaching it completes "Reach Safety". */
export function buildSurvivalNote(world: QuestWorldHex[], start: Coord): StartingNote {
  const town = placesNear(world, start, type => isSettlement(type), 1, Infinity)[0];
  if (!town) {
    return {
      text: 'A scrawled note reads: "If you\'re reading this, you survived the ambush. Keep moving — find the nearest settlement. Stay off the main road."',
      quest: null,
    };
  }
  return {
    text:
      `A scrawled note reads: "If you're reading this, you survived the ambush. ` +
      `Head ${town.direction} — there's ${town.name} ${formatTravelTime(town.distance)}. ` +
      `Stay off the main road."`,
    quest: new Quest({
      id: 'note:survival',
      title: 'Reach Safety',
      description: `The note in the cache says ${town.name} lies ${where(town)}. Get there before whatever ambushed you comes back.`,
      objectives: [Quest.createVisitObjective(town.key, `Reach ${town.name} (${where(town)})`)],
      rewards: { xp: 50, gold: 0, items: [] },
      status: QuestStatus.ACTIVE,
      questGiver: 'A scrawled note',
      location: town.name,
    }),
  };
}

/** Flavor note `variant` (index into STARTING_CACHE.NOTES), rewritten around a real place. */
export function buildFlavorNote(
  world: QuestWorldHex[],
  start: Coord,
  variant: number
): StartingNote {
  const fallback = { text: STARTING_CACHE.NOTES[variant], quest: null };
  const near = (filter: (type: string) => boolean) => placesNear(world, start, filter, 2, 16);
  const note = (
    id: string,
    title: string,
    config: Partial<ConstructorParameters<typeof Quest>[0]>
  ) =>
    new Quest({
      id: `note:${id}`,
      title,
      status: QuestStatus.ACTIVE,
      questGiver: 'A note in the cache',
      rewards: { xp: 100, gold: 0, items: [] },
      ...config,
    });

  switch (variant) {
    case 0: {
      // The journal writer went looking for help and never came back.
      const site = near(type => INTERIOR_SITE_TYPES.includes(type) || type === 'shrine')[0];
      if (!site) return fallback;
      return {
        text: `A torn journal page: "Day 12. Food running low. I've left what I could spare for whoever finds this place. Tomorrow I try the ${site.name}, ${where(site)}. Gods willing I find help there."`,
        quest: note('journal', "The Writer's Trail", {
          description: `The journal's author set out for the ${site.name} and never came back. Find out what became of them.`,
          objectives: [
            Quest.createVisitObjective(site.key, `Search the ${site.name} (${where(site)})`),
          ],
          location: site.name,
        }),
      };
    }
    case 1: {
      // A hand-drawn map with unlabeled circles: reveal three real places.
      const circled = near(type => !isSettlement(type) && type !== 'starting_cache').slice(0, 3);
      if (circled.length === 0) return fallback;
      return {
        text: `A faded map pinned to the wall — hand-drawn, showing the local terrain. ${circled.length} places are circled but have no labels. You mark them on your own map.`,
        quest: note('map', 'The Circled Places', {
          description:
            'Someone circled these places on their map and never wrote down why. Visit each of them.',
          objectives: circled.map(p =>
            Quest.createVisitObjective(p.key, `Visit the circled spot ${where(p)}`)
          ),
          reveal: circled.map(p => p.key),
          rewards: { xp: 150, gold: 0, items: [] },
          location: 'Marked on your map',
        }),
      };
    }
    case 2: {
      // The warning scratched into the wall names a real, dangerous site.
      const lair =
        near(type => type === 'tower' || type === 'dungeon')[0] ?? near(isClearableSite)[0];
      if (!lair) return fallback;
      const label = lair.type === 'encounter' ? 'PLACE' : lair.type.toUpperCase();
      return {
        text: `Scratched into the stone wall: "Beware the ${label} to the ${lair.direction.toUpperCase()}. Do NOT enter alone."`,
        quest: note('warning', `Beware the ${lair.type === 'encounter' ? 'Wilds' : lair.name}`, {
          description: `Whoever hid here was afraid of the ${lair.name}, ${where(lair)}. Put an end to whatever lives there.`,
          objectives: [Quest.createClearObjective(lair.key, `Clear the ${lair.name}`)],
          rewards: { xp: 200, gold: 25, items: [] },
          location: lair.name,
        }),
      };
    }
    case 3: {
      // The merchant's attackers are a real encounter nearby.
      const raiders = near(type => type === 'encounter')[0];
      if (!raiders) return fallback;
      return {
        text: `A merchant's ledger, entries trailing off mid-sentence. The last line reads: "...they came from the ${raiders.terrain} to the ${raiders.direction} without warning—"`,
        quest: note('ledger', 'The Merchant’s Last Entry', {
          description: `The merchant's killers came out of the ${raiders.terrain}, ${where(raiders)}. Find them and settle the debt.`,
          objectives: [Quest.createClearObjective(raiders.key, `Defeat the ${raiders.name}`)],
          rewards: { xp: 150, gold: 10, items: [] },
          location: `The ${raiders.terrain}, ${raiders.direction}`,
        }),
      };
    }
    default:
      return fallback;
  }
}

// ── Quest boards ────────────────────────────────────────────────────────────

export interface BoardOptions {
  seed: string;
  town: Coord & { name: string; type: string };
  world: QuestWorldHex[];
  level: number;
  day: number;
  /** Hex keys of sites already cleared (no quest to clear them again). */
  cleared: Set<string>;
  /** Hex keys of POIs the player has found (no quest to scout them). */
  discovered: Set<string>;
}

/** Base reward by quest level, ±20%. */
function rewardFor(level: number, multiplier: number, rng: () => number) {
  const [xp, gold] =
    level <= 2 ? [100, 50] : level <= 5 ? [300, 100] : level <= 8 ? [800, 250] : [2000, 500];
  const roll = () => multiplier * (0.8 + rng() * 0.4);
  return { xp: Math.floor(xp * roll()), gold: Math.floor(gold * roll()), items: [] };
}

/** The refresh period a game day falls in; boards reroll when it changes. */
export const boardPeriod = (day: number) => Math.floor((day - 1) / QUEST.REFRESH_DAYS);

/** A settlement's board: clear, scout and courier jobs aimed at real places nearby. */
export function generateBoardQuests(opts: BoardOptions): Quest[] {
  const { town, world, level, day, cleared, discovered } = opts;
  const townKey = hexKey(town);
  const period = boardPeriod(day);
  const rng = createSeededRNG(`${opts.seed}:board:${townKey}:${period}`);
  const { MIN, MAX } = QUEST.BOARD_RADIUS;
  const base = {
    status: QuestStatus.AVAILABLE,
    questGiver: `${town.name} quest board`,
  };

  const pools = {
    clear: placesNear(
      world,
      town,
      (type, key, cr) => isClearableSite(type) && cr <= level + 2 && !cleared.has(key),
      MIN,
      MAX
    ),
    scout: placesNear(
      world,
      town,
      (type, key) => INTERIOR_SITE_TYPES.includes(type) && !discovered.has(key),
      MIN,
      MAX
    ),
    courier: placesNear(
      world,
      town,
      (type, key) => isSettlement(type) && key !== townKey,
      MIN,
      MAX
    ),
  };

  // Take one of the nearest few so boards differ without sending you across the map.
  const take = (pool: Place[]) => pool.splice(Math.floor(rng() * Math.min(3, pool.length)), 1)[0];

  const make: Record<keyof typeof pools, (p: Place, id: string) => Quest> = {
    clear: (p, id) =>
      new Quest({
        ...base,
        id,
        title: p.type === 'encounter' ? `Bounty: ${p.name}` : `Clear the ${p.name}`,
        description: `${town.name} will pay to be rid of the ${p.name}, ${where(p)}. Report back here when it's done.`,
        objectives: [Quest.createClearObjective(p.key, `Clear the ${p.name} (${where(p)})`)],
        rewards: rewardFor(Math.max(level, p.cr), 1.2, rng),
        location: town.name,
        turnInAt: townKey,
        level: Math.max(1, p.cr),
      }),
    scout: (p, id) =>
      new Quest({
        ...base,
        id,
        title: `Scout the ${p.type}`,
        description: `Travelers speak of a ${p.type} ${where(p)}. Find it and report back to ${town.name}.`,
        objectives: [Quest.createVisitObjective(p.key, `Find the ${p.type} ${where(p)}`)],
        rewards: rewardFor(level, 0.8, rng),
        location: town.name,
        turnInAt: townKey,
        level,
      }),
    courier: (p, id) => {
      const letter = `Sealed Letter for ${p.name}`;
      return new Quest({
        ...base,
        id,
        title: `Letter to ${p.name}`,
        description: `Carry a sealed letter from ${town.name} to ${p.name}, ${where(p)}. You'll be paid on delivery.`,
        objectives: [
          Quest.createDeliverObjective(letter, p.key, `Deliver the letter to ${p.name}`),
        ],
        rewards: rewardFor(level, 0.6 + p.distance / 20, rng),
        grantItems: [
          {
            name: letter,
            type: 'quest',
            description: `Addressed to ${p.name}.`,
            weight: 0,
            value: 0,
          },
        ],
        location: p.name,
        level,
      });
    },
  };

  const kinds = Object.keys(pools) as (keyof typeof pools)[];
  const offset = Math.floor(rng() * kinds.length);
  const count = QUEST.BOARD_COUNT[town.type] ?? 1;
  const quests: Quest[] = [];
  // Round-robin the kinds, skipping any whose pool ran dry (bounded so dry pools can't spin).
  for (let i = 0; quests.length < count && i < count * 2 + kinds.length; i++) {
    const kind = kinds[(offset + i) % kinds.length];
    const place = take(pools[kind]);
    if (place) quests.push(make[kind](place, `board:${townKey}:${period}:${quests.length}`));
  }
  return quests;
}
