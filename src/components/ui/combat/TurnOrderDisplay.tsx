/**
 * TurnOrderDisplay - Shows the initiative order and current turn
 * Displays combatants in initiative order with HP and status
 */
interface DisplayCombatant {
  id?: string | number;
  name?: string;
  initiative?: number;
  currentHP: number;
  maxHP: number;
  isAlly?: boolean;
}

interface TurnOrderDisplayProps {
  turnOrder: DisplayCombatant[];
  currentTurnIndex: number;
}

function TurnOrderDisplay({ turnOrder, currentTurnIndex }: TurnOrderDisplayProps) {
  if (!turnOrder || turnOrder.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--panel-bg)',
        border: '2px solid var(--border-color)',
        borderRadius: '8px',
        padding: '0.75rem',
        marginTop: '0.5rem',
      }}
    >
      <h4
        style={{
          margin: '0 0 0.5rem 0',
          color: 'var(--text-color)',
          fontSize: '0.9rem',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Turn Order
      </h4>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
        }}
      >
        {turnOrder.map((combatant, index) => {
          const isCurrent = index === currentTurnIndex;
          const hpPercent = combatant.currentHP / combatant.maxHP;
          const isDead = combatant.currentHP <= 0;

          return (
            <div
              key={combatant.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.5rem',
                backgroundColor: isCurrent ? 'var(--primary-color)' : 'var(--bg-lighter)',
                borderRadius: '4px',
                border: isCurrent
                  ? '2px solid var(--accent-color)'
                  : '1px solid var(--border-color)',
                opacity: isDead ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {/* Initiative number */}
              <div
                style={{
                  minWidth: '2rem',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  color: isCurrent ? 'white' : 'var(--text-color)',
                  backgroundColor: isCurrent ? 'rgba(0,0,0,0.2)' : 'var(--control-bg)',
                  padding: '0.15rem 0.3rem',
                  borderRadius: '3px',
                }}
              >
                {combatant.initiative}
              </div>

              {/* Name and status */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: isCurrent ? 'bold' : 'normal',
                    color: isCurrent ? 'white' : combatant.isAlly ? '#FFD700' : '#ff6b6b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textDecoration: isDead ? 'line-through' : 'none',
                  }}
                >
                  {combatant.name}
                </div>

                {/* HP Bar */}
                {!isDead && (
                  <div
                    style={{
                      marginTop: '0.15rem',
                      height: '3px',
                      backgroundColor: isCurrent ? 'rgba(0,0,0,0.2)' : 'var(--control-bg)',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${hpPercent * 100}%`,
                        height: '100%',
                        backgroundColor:
                          hpPercent > 0.6 ? '#2ecc71' : hpPercent > 0.3 ? '#f39c12' : '#e74c3c',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* HP numbers */}
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: isCurrent ? 'white' : 'var(--text-muted)',
                  minWidth: '3rem',
                  textAlign: 'right',
                }}
              >
                {isDead ? 'DEAD' : `${combatant.currentHP}/${combatant.maxHP}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TurnOrderDisplay;
