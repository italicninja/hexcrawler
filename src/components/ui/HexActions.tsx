import { useGameState } from '../../contexts/GameStateContext';
import { useHexInteraction } from '../../hooks/useHexInteraction';
import { isSettlement } from '../../constants/gameConstants';
import PixelIcon from './PixelIcon';

const DUNGEON_TYPES = ['cave', 'ruins', 'tower', 'dungeon'];

/**
 * What you can do at the place you're standing (enter a town, search ruins, pray at a
 * shrine...), as ink links on the journal page. Renders nothing when there's nothing to
 * do. Where-you-are details are written to the game log on arrival instead.
 */
function HexActions() {
  const { state, isPoiDiscovered, isPoiSearched } = useGameState();
  const pos = state.playerPosition;
  const hex = state.mapData?.find(h => h.col === pos.col && h.row === pos.row);
  const { handleInteract, handleSearch, handleExplore, handlePray, handleOffer, handleEnterTown } =
    useHexInteraction(hex ?? null);

  const poi = hex?.poi;
  if (!hex || !poi || !(poi.visibleWithoutDiscovery || isPoiDiscovered(hex.col, hex.row))) {
    return null;
  }

  const searched = isPoiSearched(hex.col, hex.row);
  const passive = poi.eventType === 'passive';
  const settlement = isSettlement(poi.type);
  const isShrine = poi.type === 'shrine';
  const isDungeon = DUNGEON_TYPES.includes(poi.type);

  const links = [
    passive &&
      settlement && {
        label: `Enter ${poi.name}`,
        icon: 'chevronRight',
        onClick: handleEnterTown,
        primary: true,
      },
    passive &&
      !settlement &&
      !isShrine && { label: 'Interact', icon: 'object', onClick: handleInteract, primary: true },
    isDungeon &&
      !searched && { label: 'Search', icon: 'bulb', onClick: handleSearch, primary: true },
    isDungeon &&
      searched && { label: 'Explore', icon: 'chevronRight', onClick: handleExplore, primary: true },
    isShrine && !searched && { label: 'Pray', icon: 'star', onClick: handlePray, primary: true },
    isShrine &&
      !searched && { label: 'Offer (10g)', icon: 'coins', onClick: handleOffer, primary: false },
  ].filter(Boolean) as { label: string; icon: string; onClick: () => void; primary: boolean }[];

  return (
    <div className="hex-actions">
      <p className="jp-note">
        {poi.name} is here{isShrine && searched ? '. You have already paid your respects.' : '.'}
      </p>
      {links.length > 0 && (
        <div className="jp-actions">
          {links.map(link => (
            <button
              key={link.label}
              type="button"
              className={`jp-link${link.primary ? ' jp-link--primary' : ''}`}
              onClick={link.onClick}
            >
              <PixelIcon name={link.icon} /> {link.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default HexActions;
