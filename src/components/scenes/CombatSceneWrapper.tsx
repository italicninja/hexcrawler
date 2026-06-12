/**
 * CombatSceneWrapper — the two combat render branches extracted from
 * OverworldScene (TODO #3): the battlefield canvas (main slot) and the
 * action/turn-order panel (aside slot).
 *
 * Both panes are purely presentational; all combat behaviour lives in
 * useCombatOrchestration, which OverworldScene instantiates once and passes
 * down so the orchestration effects stay mounted for the scene's lifetime.
 */
import { useGameState } from '../../contexts/GameStateContext';
import { useGameLog } from '../../contexts/GameLogContext';
import CombatCanvas from '../canvas/CombatCanvas';
import ActionPanel from '../ui/combat/ActionPanel';
import TurnOrderDisplay from '../ui/combat/TurnOrderDisplay';
import AbilityMenu from '../ui/combat/AbilityMenu';
import type { CombatOrchestration } from '../../hooks/useCombatOrchestration';

interface CombatPaneProps {
  combat: CombatOrchestration;
}

/** Battlefield canvas — rendered fullscreen in the main canvas slot. */
export function CombatCanvasPane({ combat }: CombatPaneProps) {
  const { state } = useGameState();
  const { combatUIState, setCombatUIState } = combat;

  if (!state.combatState?.battlefield) return null;

  return (
    <CombatCanvas
      battlefield={
        state.combatState.battlefield as unknown as Parameters<
          typeof CombatCanvas
        >[0]['battlefield']
      }
      combatants={
        state.combatState.turnOrder as unknown as Parameters<typeof CombatCanvas>[0]['combatants']
      }
      currentTurnIndex={state.combatState.currentTurnIndex}
      selectedAction={combatUIState.selectedAction ?? undefined}
      hoveredHex={combatUIState.hoveredHex}
      movementRemaining={state.combatState.movementRemaining}
      onHexClick={combat.handleCombatHexClick}
      onHexHover={hex => setCombatUIState(prev => ({ ...prev, hoveredHex: hex }))}
      cameraOffset={combatUIState.cameraOffset}
      cameraZoom={combatUIState.cameraZoom}
      onCameraChange={(offset, zoom) =>
        setCombatUIState(prev => ({ ...prev, cameraOffset: offset, cameraZoom: zoom }))
      }
      pendingAnimation={
        (state.combatState.pendingAnimation ?? null) as unknown as Parameters<
          typeof CombatCanvas
        >[0]['pendingAnimation']
      }
      onAnimationComplete={combat.handleAnimationComplete}
    />
  );
}

/** Action panel + ability menu + turn order — rendered in the aside slot. */
export function CombatActionPane({ combat }: CombatPaneProps) {
  const { state, dispatch, actions } = useGameState();
  const { addMessage } = useGameLog();
  const { combatUIState, setCombatUIState, showAbilityMenu, setShowAbilityMenu } = combat;

  if (!state.combatState?.battlefield) return null;

  const getCurrentCombatant = combat.getCurrentCombatant;

  return (
    <>
      {getCurrentCombatant()?.isAlly ? (
        <>
          <ActionPanel
            combatant={
              getCurrentCombatant() as unknown as Parameters<typeof ActionPanel>[0]['combatant']
            }
            selectedAction={combatUIState.selectedAction ?? undefined}
            movementRemaining={state.combatState.movementRemaining}
            attacksUsedThisTurn={combatUIState.attacksUsedThisTurn}
            turnState={state.combatState.turnState}
            onActionSelect={action =>
              setCombatUIState(prev => ({ ...prev, selectedAction: action }))
            }
            onAbilityClick={() => setShowAbilityMenu(true)}
            onFreeAbilityClick={ability => {
              const currentCombatant = getCurrentCombatant();
              if (!currentCombatant) return;
              dispatch({
                type: actions.PROCESS_COMBAT_ACTION,
                payload: {
                  actionType: 'ability',
                  attacker: currentCombatant,
                  target: currentCombatant,
                  ability,
                },
              });
            }}
            onBonusActionClick={ability => {
              const currentCombatant = getCurrentCombatant();
              const character = currentCombatant?.character;
              if (!currentCombatant || !character) return;
              dispatch({
                type: actions.PROCESS_COMBAT_ACTION,
                payload: {
                  actionType: 'ability',
                  attacker: currentCombatant,
                  target: currentCombatant,
                  ability,
                },
              });
              addMessage(`${character.name} uses ${ability.name}!`, 'action');
            }}
            onSpellClick={() => addMessage('Spells not yet implemented', 'info')}
            onDodgeClick={() => {
              const currentCombatant = getCurrentCombatant();
              if (!currentCombatant) return;
              dispatch({
                type: actions.PROCESS_COMBAT_ACTION,
                payload: {
                  actionType: 'dodge',
                  attacker: currentCombatant,
                  target: currentCombatant,
                },
              });
            }}
            onDashClick={() => addMessage('Dash not yet implemented', 'info')}
            onDisengageClick={() => addMessage('Disengage not yet implemented', 'info')}
            onHideClick={() => addMessage('Hide not yet implemented', 'info')}
            onEndTurn={combat.handleCombatEndTurn}
          />

          {/* Ability Menu modal — rendered as a portal-like overlay */}
          {showAbilityMenu && getCurrentCombatant()?.character && (
            <AbilityMenu
              character={getCurrentCombatant()?.character}
              combatant={
                getCurrentCombatant() as unknown as Parameters<typeof AbilityMenu>[0]['combatant']
              }
              onSelect={ability => {
                const currentCombatant = getCurrentCombatant();
                const character = currentCombatant?.character;
                setShowAbilityMenu(false);
                dispatch({
                  type: actions.PROCESS_COMBAT_ACTION,
                  payload: {
                    actionType: 'ability',
                    attacker: currentCombatant,
                    target: currentCombatant,
                    ability,
                  },
                });
                addMessage(`${character?.name} uses ${ability.name}!`, 'action');
              }}
              onClose={() => setShowAbilityMenu(false)}
            />
          )}
        </>
      ) : getCurrentCombatant()?.isEnemy ? (
        <div
          style={{
            padding: '1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-lighter)',
            border: '2px solid var(--border-color)',
            borderRadius: '8px',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#ff6b6b', fontSize: '1.2rem' }}>
            {getCurrentCombatant()?.name}&apos;s Turn
          </h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Enemy is taking their turn...
          </p>
        </div>
      ) : null}

      {/* Turn Order Display */}
      <TurnOrderDisplay
        turnOrder={state.combatState.turnOrder}
        currentTurnIndex={state.combatState.currentTurnIndex}
      />
    </>
  );
}
