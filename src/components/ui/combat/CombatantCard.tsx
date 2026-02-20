// @ts-nocheck

/**
 * CombatantCard - Display individual combatant status in turn order
 * Used in TurnOrderPanel to show HP, AC, initiative, and status
 */
function CombatantCard({ combatant, isActive }) {
  if (!combatant) {
    return null;
  }

  const hpPercent = combatant.maxHP > 0 ? (combatant.currentHP / combatant.maxHP) * 100 : 0;

  // Determine HP color: green > 50%, yellow 25-50%, red < 25%
  const getHPColor = percent => {
    if (percent > 50) return 'bg-green-500';
    if (percent > 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const isAlly = combatant.isAlly || false;
  const borderColor = isAlly ? 'border-yellow-500' : 'border-red-500';
  const activeBorderColor = isAlly ? 'border-yellow-400' : 'border-red-400';

  return (
    <div
      className={`
        rounded-lg p-3 transition-all duration-200
        ${
          isActive
            ? `${activeBorderColor} border-2 bg-opacity-20 shadow-lg ${isAlly ? 'bg-yellow-500' : 'bg-red-500'}`
            : `${borderColor} border bg-opacity-5 ${isAlly ? 'bg-yellow-500' : 'bg-red-500'}`
        }
      `}
      style={{
        backgroundColor: isActive
          ? isAlly
            ? 'rgba(234, 179, 8, 0.1)'
            : 'rgba(239, 68, 68, 0.1)'
          : 'rgba(45, 55, 72, 0.3)',
      }}
    >
      {/* Name and Initiative */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="font-bold text-sm" style={{ color: 'var(--text-color)' }}>
            {combatant.name}
          </div>
          {combatant.class && (
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {combatant.class}
            </div>
          )}
        </div>
        <div
          className="text-xs font-semibold px-2 py-1 rounded"
          style={{
            backgroundColor: 'var(--bg-lighter)',
            color: 'var(--text-color)',
          }}
        >
          Init: {combatant.initiative}
        </div>
      </div>

      {/* HP Bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-light)' }}>
          <span>HP</span>
          <span>
            {combatant.currentHP}/{combatant.maxHP}
          </span>
        </div>
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-lighter)',
          }}
        >
          <div
            className={`h-full transition-all duration-300 ${getHPColor(hpPercent)}`}
            style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }}
          />
        </div>
      </div>

      {/* AC */}
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-light)' }}>
        <span>AC:</span>
        <span className="font-semibold">{combatant.armorClass || combatant.ac || 10}</span>
      </div>

      {/* Status Effects (placeholder for future implementation) */}
      {combatant.statusEffects && combatant.statusEffects.length > 0 && (
        <div className="mt-2 flex gap-1 flex-wrap">
          {combatant.statusEffects.map((status, idx) => (
            <span
              key={idx}
              className="text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'var(--bg-color)',
              }}
            >
              {status}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default CombatantCard;
