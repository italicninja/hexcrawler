// @ts-nocheck
import { useState } from 'react';
import { useEventListener } from '../../../hooks/useEventListener';

/**
 * SpellMenu - Modal overlay for selecting spell to cast
 * Shows spells grouped by level with slot tracking
 */
function SpellMenu({ character, onSelect, onClose }) {
  const [selectedLevel, setSelectedLevel] = useState('all');

  // Spell slot configuration by class and level
  const getSpellSlots = () => {
    // Simplified spell slot table for level 1-5 characters
    const spellSlots = {
      1: { 1: 2 },
      2: { 1: 3 },
      3: { 1: 4, 2: 2 },
      4: { 1: 4, 2: 3 },
      5: { 1: 4, 2: 3, 3: 2 },
    };

    const level = Math.min(character.level || 1, 5);
    return spellSlots[level] || { 1: 2 };
  };

  const spellSlots = getSpellSlots();
  const spellSlotsUsed = character.spellSlotsUsed || {};

  // Calculate remaining spell slots per level
  const getRemainingSlots = level => {
    const max = spellSlots[level] || 0;
    const used = spellSlotsUsed[level] || 0;
    return Math.max(0, max - used);
  };

  // Group spells by level
  const groupSpellsByLevel = () => {
    const spells = character.spells || [];
    const grouped = {
      0: [], // Cantrips
      1: [],
      2: [],
      3: [],
    };

    spells.forEach(spell => {
      const level = spell.level || 0;
      if (grouped[level]) {
        grouped[level].push(spell);
      }
    });

    return grouped;
  };

  const groupedSpells = groupSpellsByLevel();

  // Handle ESC key to close
  useEventListener('keydown', e => {
    if (e.key === 'Escape') {
      onClose();
    }
  });

  // Handle click outside to close
  const handleOverlayClick = e => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  /**
   * Check if spell can be cast (has available slots or is cantrip)
   */
  const canCastSpell = spell => {
    if (spell.level === 0) return true; // Cantrips are always available
    return getRemainingSlots(spell.level) > 0;
  };

  /**
   * Get spell school color
   */
  const getSchoolColor = school => {
    const colors = {
      Abjuration: '#3498db',
      Conjuration: '#9b59b6',
      Divination: '#f39c12',
      Enchantment: '#e91e63',
      Evocation: '#e74c3c',
      Illusion: '#8e44ad',
      Necromancy: '#2c3e50',
      Transmutation: '#16a085',
    };
    return colors[school] || 'var(--primary-color)';
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
      onClick={handleOverlayClick}
    >
      <div
        className="rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--panel-bg)',
          border: '2px solid var(--accent-color)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex justify-between items-center p-4"
          style={{
            backgroundColor: 'var(--bg-lighter)',
            borderBottom: '2px solid var(--border-color)',
          }}
        >
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-color)' }}>
              Select Spell
            </h2>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {character.name} - Level {character.level} {character.class}
            </div>
          </div>
          <button
            className="text-3xl font-bold px-3 py-1 rounded-full transition-colors hover:bg-red-500 hover:bg-opacity-20"
            style={{ color: 'var(--text-color)' }}
            onClick={onClose}
            aria-label="Close spell menu"
          >
            ×
          </button>
        </div>

        {/* Spell Slot Display */}
        <div
          className="p-4 grid grid-cols-3 gap-3"
          style={{
            backgroundColor: 'var(--bg-color)',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          {[1, 2, 3].map(level => {
            const max = spellSlots[level] || 0;
            const remaining = getRemainingSlots(level);
            if (max === 0) return null;

            return (
              <div
                key={level}
                className="p-2 rounded text-center"
                style={{
                  backgroundColor: 'var(--bg-lighter)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Level {level} Slots
                </div>
                <div
                  className="text-lg font-bold"
                  style={{
                    color: remaining > 0 ? 'var(--accent-color)' : 'var(--text-muted)',
                  }}
                >
                  {remaining}/{max}
                </div>
              </div>
            );
          })}
        </div>

        {/* Level Filter Tabs */}
        <div
          className="flex gap-2 p-3 overflow-x-auto"
          style={{
            backgroundColor: 'var(--bg-lighter)',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <button
            className={`px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
              selectedLevel === 'all' ? 'ring-2' : ''
            }`}
            style={{
              backgroundColor: selectedLevel === 'all' ? 'var(--primary-color)' : 'var(--bg-color)',
              color: selectedLevel === 'all' ? 'white' : 'var(--text-color)',
              border: '1px solid var(--border-color)',
            }}
            onClick={() => setSelectedLevel('all')}
          >
            All Spells
          </button>
          {Object.keys(groupedSpells).map(level => {
            if (groupedSpells[level].length === 0) return null;
            const levelNum = parseInt(level);
            const label = levelNum === 0 ? 'Cantrips' : `Level ${levelNum}`;

            return (
              <button
                key={level}
                className={`px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
                  selectedLevel === level ? 'ring-2' : ''
                }`}
                style={{
                  backgroundColor:
                    selectedLevel === level ? 'var(--primary-color)' : 'var(--bg-color)',
                  color: selectedLevel === level ? 'white' : 'var(--text-color)',
                  border: '1px solid var(--border-color)',
                }}
                onClick={() => setSelectedLevel(level)}
              >
                {label} ({groupedSpells[level].length})
              </button>
            );
          })}
        </div>

        {/* Spell List */}
        <div className="overflow-y-auto p-4 space-y-4">
          {Object.keys(groupedSpells).map(level => {
            const levelNum = parseInt(level);
            const spells = groupedSpells[level];

            // Filter based on selected level
            if (selectedLevel !== 'all' && selectedLevel !== level) return null;
            if (spells.length === 0) return null;

            const levelLabel = levelNum === 0 ? 'Cantrips' : `Level ${levelNum} Spells`;

            return (
              <div key={level}>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-color)' }}>
                  {levelLabel}
                  {levelNum > 0 && (
                    <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      ({getRemainingSlots(levelNum)}/{spellSlots[levelNum] || 0} slots)
                    </span>
                  )}
                </h3>

                <div className="space-y-2">
                  {spells.map((spell, index) => {
                    const canCast = canCastSpell(spell);

                    return (
                      <button
                        key={index}
                        className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                          canCast
                            ? 'hover:scale-102 cursor-pointer'
                            : 'opacity-50 cursor-not-allowed'
                        }`}
                        style={{
                          backgroundColor: 'var(--bg-lighter)',
                          border: `2px solid ${canCast ? 'var(--border-color)' : 'var(--text-muted)'}`,
                        }}
                        onMouseEnter={e => {
                          if (canCast) {
                            e.currentTarget.style.borderColor = getSchoolColor(spell.school);
                          }
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                        }}
                        onClick={() => {
                          if (canCast) {
                            onSelect(spell, spell.level);
                            onClose();
                          }
                        }}
                        disabled={!canCast}
                      >
                        {/* Spell header */}
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-bold" style={{ color: 'var(--text-color)' }}>
                              {spell.name}
                            </h4>
                            <div className="flex gap-2 text-xs mt-1">
                              <span
                                className="px-2 py-1 rounded"
                                style={{
                                  backgroundColor: getSchoolColor(spell.school),
                                  color: 'white',
                                }}
                              >
                                {spell.school || 'Evocation'}
                              </span>
                              {spell.range && (
                                <span style={{ color: 'var(--text-muted)' }}>
                                  Range: {spell.range}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-sm mb-2" style={{ color: 'var(--text-light)' }}>
                          {spell.description || 'A magical spell.'}
                        </p>

                        {/* Components */}
                        {spell.components && (
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Components: {spell.components}
                          </div>
                        )}

                        {/* Can't cast warning */}
                        {!canCast && spell.level > 0 && (
                          <div className="text-xs mt-2 text-red-400">No spell slots remaining</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* No spells message */}
          {Object.values(groupedSpells).every(arr => arr.length === 0) && (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              <p>No spells available</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-4"
          style={{
            backgroundColor: 'var(--bg-lighter)',
            borderTop: '2px solid var(--border-color)',
          }}
        >
          <button
            className="w-full py-2 rounded-lg font-semibold transition-colors"
            style={{
              backgroundColor: 'var(--border-color)',
              color: 'var(--text-color)',
            }}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default SpellMenu;
