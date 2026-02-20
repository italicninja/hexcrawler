// @ts-nocheck

/**
 * OpportunityAttackPrompt - Modal prompt for D&D 5e Opportunity Attacks
 * Shows when enemy movement triggers an opportunity attack
 */
function OpportunityAttackPrompt({ attackers, target, onConfirm, onDecline }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
    >
      <div
        className="rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
        style={{
          backgroundColor: 'var(--panel-bg)',
          border: '2px solid var(--accent-color)',
        }}
      >
        <h2 className="text-2xl font-bold mb-4" style={{ color: '#e74c3c' }}>
          ⚔️ Opportunity Attack!
        </h2>

        <div className="mb-6">
          {attackers.map((attacker, index) => (
            <p key={index} className="mb-2" style={{ color: 'var(--text-color)' }}>
              <strong>{attacker.name}</strong> can attack <strong>{target.name}</strong> as they
              leave melee range
            </p>
          ))}
        </div>

        <div className="flex gap-4">
          <button
            onClick={onConfirm}
            className="flex-1 font-semibold py-2 px-4 rounded transition-all duration-200 hover:scale-105"
            style={{
              backgroundColor: '#e74c3c',
              color: 'white',
            }}
          >
            Allow Attacks
          </button>
          <button
            onClick={onDecline}
            className="flex-1 font-semibold py-2 px-4 rounded transition-all duration-200 hover:scale-105"
            style={{
              backgroundColor: 'var(--bg-lighter)',
              color: 'var(--text-color)',
              border: '2px solid var(--border-color)',
            }}
          >
            Cancel Movement
          </button>
        </div>
      </div>
    </div>
  );
}

export default OpportunityAttackPrompt;
