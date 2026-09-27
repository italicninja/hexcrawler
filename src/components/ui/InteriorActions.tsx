import { useGameState } from '../../contexts/GameStateContext';
import PixelIcon from './PixelIcon';
import { isSettlement } from '../../constants/gameConstants';

/**
 * The way out of a POI/town, as an ink link on the journal page. Towns can be left from
 * anywhere; dungeons, caves, ruins and towers only from the entrance tile. Arrival details
 * (buildings, stairs, loot, the entrance) are written to the game log as you move.
 */
interface InteriorHex {
  col: number;
  row: number;
  terrain?: { key?: string };
  content?: string | null;
}

interface InteriorActionsProps {
  playerPosition?: { col: number; row: number } | null;
  interiorMap?: { hexes: InteriorHex[] } | null;
}

function InteriorActions({ playerPosition, interiorMap }: InteriorActionsProps) {
  const { state, actions, dispatch } = useGameState();
  if (!state.currentPOI || !interiorMap || !playerPosition) return null;

  const { poi } = state.currentPOI;
  const isTown = isSettlement(poi.type);
  const currentHex = interiorMap.hexes.find(
    h => h.col === playerPosition.col && h.row === playerPosition.row
  );
  const onExitHex = currentHex?.terrain?.key === 'exit' || currentHex?.content === 'exit';
  const canLeave = isTown || onExitHex;

  return (
    <div className="hex-actions">
      {canLeave ? (
        <div className="jp-actions">
          <button
            type="button"
            className="jp-link jp-link--primary"
            title={`Leave ${poi.name}`}
            onClick={() =>
              dispatch({ type: isTown ? actions.EXIT_TOWN : actions.EXIT_EXPLORATION })
            }
          >
            <PixelIcon name="arrowLeft" /> Exit {isTown ? 'Town' : 'Interior'}
          </button>
        </div>
      ) : (
        <p className="jp-note">Return to the entrance to leave.</p>
      )}
    </div>
  );
}

export default InteriorActions;
