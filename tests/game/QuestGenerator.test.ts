import { describe, it, expect } from 'vitest';
import {
  buildSurvivalNote,
  buildFlavorNote,
  generateBoardQuests,
  boardPeriod,
  type QuestWorldHex,
} from '../../src/game/QuestGenerator';
import { getHexDistance } from '../../src/utils/hexMath';
import { QUEST, STARTING_CACHE } from '../../src/constants/gameConstants';

const start = { col: 10, row: 10 };
const poi = (col: number, row: number, type: string, name: string, cr = 1): QuestWorldHex => ({
  col,
  row,
  terrain: { name: 'Forest' },
  poi: { type, name, cr },
});
const world: QuestWorldHex[] = [
  poi(10, 10, 'starting_cache', 'Cache'),
  poi(14, 10, 'village', 'Oakmoor'), // 4 hexes east = a day's walk
  poi(10, 16, 'town', 'Riverton'),
  poi(12, 12, 'encounter', 'Goblin Raiders'),
  poi(7, 5, 'tower', "Wizard's Tower", 2),
  poi(16, 13, 'cave', 'Dark Cave'),
  poi(4, 10, 'dungeon', 'The Pit', 9), // too dangerous for a level 1 board
];
const key = (h: QuestWorldHex) => `${h.col},${h.row}`;

describe('starting notes', () => {
  it('the survival note names the nearest settlement and its quest targets that hex', () => {
    const { text, quest } = buildSurvivalNote(world, start);
    expect(text).toContain("Head east — there's Oakmoor a day's walk");
    expect(quest!.objectives[0]).toMatchObject({ type: 'visit', target: '14,10' });
    expect(quest!.turnInAt).toBeUndefined(); // completes on arrival
  });

  it('every flavor note points at a real place, or falls back to plain flavor text', () => {
    const quests = STARTING_CACHE.NOTES.map((_, i) => buildFlavorNote(world, start, i).quest!);
    const worldKeys = new Set(world.map(key));
    for (const quest of quests) {
      expect(quest.objectives.length).toBeGreaterThan(0);
      quest.objectives.forEach(o => expect(worldKeys.has(o.target)).toBe(true));
    }
    expect(buildFlavorNote(world, start, 2).text).toContain('Beware the TOWER to the NORTHWEST');
    expect(quests[1].reveal).toHaveLength(3); // the circled places go on the map

    const empty = buildFlavorNote([], start, 2);
    expect(empty).toEqual({ text: STARTING_CACHE.NOTES[2], quest: null });
  });
});

describe('quest boards', () => {
  const town = { col: 14, row: 10, name: 'Oakmoor', type: 'town' };
  const board = (day: number, cleared = new Set<string>()) =>
    generateBoardQuests({
      seed: 'seed',
      town,
      world,
      level: 1,
      day,
      cleared,
      discovered: new Set(),
    });

  it('posts real, in-range, level-appropriate jobs', () => {
    const quests = board(1);
    expect(quests).toHaveLength(QUEST.BOARD_COUNT.town);
    for (const quest of quests) {
      const target = quest.objectives[0].recipient ?? quest.objectives[0].target;
      const hex = world.find(h => key(h) === target)!;
      expect(hex).toBeDefined();
      expect(target).not.toBe('4,10'); // CR 9 dungeon is off a level-1 board
      const d = getHexDistance(town.col, town.row, hex.col, hex.row);
      expect(d).toBeGreaterThanOrEqual(QUEST.BOARD_RADIUS.MIN);
      expect(d).toBeLessThanOrEqual(QUEST.BOARD_RADIUS.MAX);
    }
    const courier = quests.find(q => q.objectives[0].type === 'deliver');
    if (courier) expect(courier.grantItems[0].name).toBe(courier.objectives[0].target);
  });

  it('is the same board until the refresh period rolls over', () => {
    const ids = (day: number) => board(day).map(q => q.title);
    expect(ids(2)).toEqual(ids(1));
    expect(boardPeriod(1 + QUEST.REFRESH_DAYS)).toBe(1);
    expect(board(1 + QUEST.REFRESH_DAYS)[0].id).not.toBe(board(1)[0].id);
  });

  it('does not post cleared sites', () => {
    const cleared = new Set(['12,12', '7,5', '16,13']);
    expect(board(1, cleared).some(q => q.objectives[0].type === 'clear')).toBe(false);
  });
});
