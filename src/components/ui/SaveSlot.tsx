import './SaveSlot.css';
import PixelIcon from './PixelIcon';

/**
 * Individual save slot display component
 * Shows save metadata and provides load/save/delete actions
 */
interface SaveMetadata {
  characterName: string;
  level: number;
  class: string;
  location: string;
  day: number;
  playtime: number;
  timestamp: number;
}

interface SaveSlotProps {
  slotKey: string;
  metadata?: SaveMetadata | null;
  slotNumber?: number;
  slotLetter?: string;
  isAutosave?: boolean;
  isQuicksave?: boolean;
  mode: string;
  onLoad: (slotKey: string) => void;
  onSave: (slotKey: string) => void;
  onDelete: (slotKey: string) => void;
}

function SaveSlot({
  slotKey,
  metadata,
  slotNumber,
  slotLetter,
  isAutosave,
  isQuicksave,
  mode,
  onLoad,
  onSave,
  onDelete,
}: SaveSlotProps) {
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return (
        date.toLocaleDateString() +
        ' ' +
        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    }
  };

  const formatPlaytime = (milliseconds: number) => {
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const slotTitle = (
    <h4 className="save-slot-title">
      <PixelIcon name={isAutosave || isQuicksave ? 'bolt' : 'disk'} />
      {isAutosave ? 'Auto-save' : isQuicksave ? `Quick Save ${slotLetter}` : `Slot ${slotNumber}`}
      <span className="jp-aside">
        {metadata ? `Saved ${formatTimestamp(metadata.timestamp)}` : 'Empty Slot'}
      </span>
    </h4>
  );

  // Empty slot
  if (!metadata) {
    return (
      <div className="save-slot empty-slot">
        {slotTitle}
        {mode === 'save' && !isAutosave && (
          <button
            type="button"
            className="jp-link jp-link--primary"
            onClick={() => onSave(slotKey)}
          >
            Save Here
          </button>
        )}
      </div>
    );
  }

  // Filled slot
  return (
    <div className="save-slot filled-slot">
      {slotTitle}
      <p className="save-slot-name">
        {metadata.characterName}
        <span className="jp-muted">
          , level {metadata.level} {metadata.class}
        </span>
      </p>
      <dl className="jp-rows">
        <div className="jp-row">
          <dt>Location</dt>
          <dd>{metadata.location}</dd>
        </div>
        <div className="jp-row">
          <dt>Day</dt>
          <dd>{metadata.day}</dd>
        </div>
        {metadata.playtime > 0 && (
          <div className="jp-row">
            <dt>Played</dt>
            <dd>{formatPlaytime(metadata.playtime)}</dd>
          </div>
        )}
      </dl>
      <div className="jp-actions">
        {mode === 'load' && (
          <button
            type="button"
            className="jp-link jp-link--primary"
            onClick={() => onLoad(slotKey)}
          >
            Load Game
          </button>
        )}
        {mode === 'save' && !isAutosave && (
          <button
            type="button"
            className="jp-link jp-link--primary"
            onClick={() => onSave(slotKey)}
          >
            Overwrite
          </button>
        )}
        {!isAutosave && (
          <button
            type="button"
            className="jp-link save-slot-delete"
            onClick={() => onDelete(slotKey)}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

export default SaveSlot;
