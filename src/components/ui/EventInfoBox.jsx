import PropTypes from 'prop-types';
import { useEventInfoBox } from '../../contexts/EventInfoBoxContext';
import './EventInfoBox.css';

/**
 * EventInfoBox Component
 * Displays messages and events in bottom right corner
 */
function EventInfoBox() {
  const { currentEvent, dismissEvent, handleChoice } = useEventInfoBox();

  if (!currentEvent) return null;

  const isMessage = currentEvent.type === 'message';
  const isEvent = currentEvent.type === 'event';

  return (
    <div className={`event-info-box ${currentEvent.displayType}`}>
      {/* Header */}
      <div className="event-info-box-header">
        <h3>{isMessage ? currentEvent.title : currentEvent.poi.name}</h3>
        {currentEvent.dismissible && (
          <button
            className="event-info-box-close"
            onClick={dismissEvent}
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      {/* Content */}
      <div className="event-info-box-content">
        {isMessage && <p>{currentEvent.message}</p>}

        {isEvent && (
          <>
            <p>{currentEvent.poi.description}</p>

            {/* Combat info for active events */}
            {currentEvent.displayType === 'active' && currentEvent.poi.cr !== undefined && (
              <div className="event-info-box-combat-info">
                <span className="combat-stat">CR: {currentEvent.poi.cr}</span>
                {currentEvent.poi.creatures && (
                  <span className="combat-stat">{currentEvent.poi.creatures}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Choices/Actions */}
      {currentEvent.choices && currentEvent.choices.length > 0 && (
        <div className="event-info-box-actions">
          {currentEvent.choices.map((choice, index) => (
            <button
              key={index}
              className={`choice-button ${choice.style || ''}`}
              onClick={() => handleChoice(choice.action)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}

      {/* Simple OK button for messages without choices */}
      {isMessage && (!currentEvent.choices || currentEvent.choices.length === 0) && (
        <div className="event-info-box-actions">
          <button className="choice-button" onClick={dismissEvent}>
            OK
          </button>
        </div>
      )}
    </div>
  );
}

EventInfoBox.propTypes = {
  // This component doesn't receive any props, gets all data from useEventInfoBox hook
};

export default EventInfoBox;
