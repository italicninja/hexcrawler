// @ts-nocheck
import './SaveSlot.css';

/**
 * Individual save slot display component
 * Shows save metadata and provides load/save/delete actions
 */
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
}) {
  const formatTimestamp = timestamp => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
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

  const formatPlaytime = milliseconds => {
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Empty slot
  if (!metadata) {
    return (
      <div className="save-slot empty-slot">
        <div className="slot-header">
          {isAutosave
            ? '⚡ Auto-save'
            : isQuicksave
              ? `⚡ Quick Save ${slotLetter}`
              : `💾 Slot ${slotNumber}`}
        </div>
        <div className="slot-content">
          <div className="empty-slot-message">Empty Slot</div>
        </div>
        {mode === 'save' && !isAutosave && (
          <div className="slot-actions">
            <button className="btn-save" onClick={() => onSave(slotKey)}>
              Save Here
            </button>
          </div>
        )}
      </div>
    );
  }

  // Filled slot
  return (
    <div className="save-slot filled-slot">
      <div className="slot-header">
        {isAutosave
          ? '⚡ Auto-save'
          : isQuicksave
            ? `⚡ Quick Save ${slotLetter}`
            : `💾 Slot ${slotNumber}`}
      </div>
      <div className="slot-content">
        <div className="character-info">
          <strong className="character-name">{metadata.characterName}</strong>
          <span className="character-details">
            Level {metadata.level} {metadata.class}
          </span>
        </div>
        <div className="location-info">📍 {metadata.location}</div>
        <div className="progress-info">
          <span>Day {metadata.day}</span>
          {metadata.playtime > 0 && (
            <span className="playtime">⏱️ {formatPlaytime(metadata.playtime)}</span>
          )}
        </div>
        <div className="timestamp-info">
          <small>Saved {formatTimestamp(metadata.timestamp)}</small>
        </div>
      </div>
      <div className="slot-actions">
        {mode === 'load' && (
          <button className="btn-load" onClick={() => onLoad(slotKey)}>
            Load Game
          </button>
        )}
        {mode === 'save' && !isAutosave && (
          <button className="btn-save" onClick={() => onSave(slotKey)}>
            Overwrite
          </button>
        )}
        {!isAutosave && (
          <button className="btn-delete" onClick={() => onDelete(slotKey)}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

export default SaveSlot;
