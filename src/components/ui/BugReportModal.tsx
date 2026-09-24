import { useState, type FormEvent } from 'react';
import { useGameLog } from '../../contexts/GameLogContext';
import { openBugReport } from '../../utils/githubApi';
import Modal, { ModalTitle } from './Modal';
import './BugReportModal.css';

/**
 * BugReportModal Component
 * Opens a prefilled GitHub new-issue form (in a new tab) with the game log attached
 */
interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { messages, addMessage } = useGameLog();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!description.trim()) {
      setError('Please enter a bug description');
      return;
    }

    const gameLog = messages.map(msg => `[${msg.timestamp}] [${msg.type}] ${msg.text}`).join('\n');

    if (openBugReport(description, gameLog)) {
      addMessage('Bug report opened on GitHub in a new tab.', 'success');
      setDescription('');
      setError(null);
      onClose();
    } else {
      setError('Could not open a new tab. Please allow popups for this site and try again.');
    }
  };

  const handleCancel = () => {
    setDescription('');
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      overlayClassName="bug-report-overlay"
      className="bug-report-modal"
    >
      <div className="bug-report-header">
        <ModalTitle>Report a Bug</ModalTitle>
        <button className="close-button" onClick={handleCancel} aria-label="Close">
          &times;
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bug-report-form">
        <div className="form-group">
          <label htmlFor="bug-description">
            Describe the bug
            <span className="required">*</span>
          </label>
          <textarea
            id="bug-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What happened? What did you expect to happen? Steps to reproduce..."
            rows={8}
            className="bug-description-input"
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="bug-report-info">
          <p>
            This opens a prefilled GitHub issue in a new tab (a GitHub account is required). The
            recent game log is attached to help with debugging.
          </p>
          <p className="log-count">
            {messages.length} log {messages.length === 1 ? 'entry' : 'entries'} will be included
          </p>
        </div>

        <div className="form-actions">
          <button type="button" onClick={handleCancel} className="btn-cancel">
            Cancel
          </button>
          <button type="submit" disabled={!description.trim()} className="btn-submit">
            Open on GitHub
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default BugReportModal;
