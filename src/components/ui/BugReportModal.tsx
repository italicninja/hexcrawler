// @ts-nocheck
import { useState } from 'react';
import { useGameLog } from '../../contexts/GameLogContext';
import { submitBugReport } from '../../utils/githubApi';
import { useEventListener } from '../../hooks/useEventListener';
import './BugReportModal.css';

/**
 * BugReportModal Component
 * Modal for submitting bug reports to GitHub issues
 * Automatically attaches game log to the issue
 */
function BugReportModal({ isOpen, onClose }) {
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const { messages, addMessage } = useGameLog();

  // Escape key handler
  useEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen) {
      handleCancel();
    }
  });

  const handleSubmit = async e => {
    e.preventDefault();

    if (!description.trim()) {
      setError('Please enter a bug description');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Format game log for attachment
      const gameLog = messages
        .map(msg => `[${msg.timestamp}] [${msg.type}] ${msg.text}`)
        .join('\n');

      const result = await submitBugReport(description, gameLog);

      if (result.success) {
        addMessage(`Bug report submitted successfully! Issue #${result.issueNumber}`, 'success');
        setDescription('');
        onClose();
      } else {
        setError(result.error || 'Failed to submit bug report');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setDescription('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="bug-report-overlay" onClick={handleCancel}>
      <div className="bug-report-modal" onClick={e => e.stopPropagation()}>
        <div className="bug-report-header">
          <h2>Report a Bug</h2>
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
              disabled={isSubmitting}
              className="bug-description-input"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="bug-report-info">
            <p>The current game log will be automatically attached to help with debugging.</p>
            <p className="log-count">
              {messages.length} log {messages.length === 1 ? 'entry' : 'entries'} will be included
            </p>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="btn-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !description.trim()}
              className="btn-submit"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Bug Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BugReportModal;
