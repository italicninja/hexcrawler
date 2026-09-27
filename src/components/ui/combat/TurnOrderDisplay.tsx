/**
 * TurnOrderDisplay - The initiative order as a ruled list on the journal page.
 * The current combatant is marked; the fallen are struck through.
 */
import PixelIcon from '../PixelIcon';
import './TurnOrderDisplay.css';

interface DisplayCombatant {
  id?: string | number;
  name?: string;
  initiative?: number;
  currentHP: number;
  maxHP: number;
  isAlly?: boolean;
  character?: { class?: string | null };
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
    <section className="turn-order" aria-label="Turn order">
      <h4 className="jp-heading">Turn order</h4>
      <ol className="jp-list">
        {turnOrder.map((combatant, index) => {
          const isCurrent = index === currentTurnIndex;
          const isDead = combatant.currentHP <= 0;
          const hpPercent = combatant.maxHP ? combatant.currentHP / combatant.maxHP : 0;
          const icon = combatant.isAlly
            ? `player:${combatant.character?.class ?? ''}`
            : isDead
              ? 'enemyDefeated'
              : 'enemy';
          const classes = [
            combatant.isAlly ? 'is-ally' : 'is-foe',
            isCurrent && 'is-selected',
            isDead && 'is-dead',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <li
              key={combatant.id ?? index}
              className={classes}
              aria-current={isCurrent ? 'true' : undefined}
            >
              <span className="to-init" title="Initiative">
                {combatant.initiative}
              </span>
              <PixelIcon name={icon} scale={2} />
              <span className="to-name">
                {combatant.name}
                {isCurrent && <em className="to-now"> acting</em>}
              </span>
              {isDead ? (
                <span className="jp-aside">fallen</span>
              ) : (
                <span className="to-hp">
                  <span className="to-hp-text">
                    {combatant.currentHP} / {combatant.maxHP}
                  </span>
                  <span className={`jp-bar${hpPercent > 0.3 ? ' jp-bar--good' : ''}`}>
                    <span style={{ width: `${hpPercent * 100}%` }} />
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default TurnOrderDisplay;
