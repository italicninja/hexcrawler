// @ts-nocheck
import { useEffect, useMemo } from 'react';
import './ChangelogModal.css';

/**
 * ChangelogModal Component
 * Displays auto-generated changelog from git commit history
 * Parses git log, strips prefixes, and groups by date
 */
function ChangelogModal({ isOpen, onClose }) {
  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = e => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Parse and group git log
  const changelog = useMemo(() => {
    const gitLogRaw = import.meta.env.VITE_GIT_LOG || '';
    if (!gitLogRaw) return {};

    const commits = gitLogRaw.split('\n').map(line => {
      const [hash, subject, dateStr] = line.split('|');

      // Strip common prefixes
      let cleanSubject = subject;
      const prefixes = [
        'feat:',
        'fix:',
        'chore:',
        'docs:',
        'style:',
        'refactor:',
        'test:',
        'perf:',
      ];
      for (const prefix of prefixes) {
        if (cleanSubject.toLowerCase().startsWith(prefix)) {
          cleanSubject = cleanSubject.substring(prefix.length).trim();
          // Capitalize first letter
          cleanSubject = cleanSubject.charAt(0).toUpperCase() + cleanSubject.slice(1);
          break;
        }
      }

      // Parse date
      const date = new Date(dateStr);
      const dateKey = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      return { hash, subject: cleanSubject, dateKey, date };
    });

    // Group by date
    const grouped = commits.reduce((acc, commit) => {
      if (!acc[commit.dateKey]) {
        acc[commit.dateKey] = [];
      }
      acc[commit.dateKey].push(commit);
      return acc;
    }, {});

    return grouped;
  }, []);

  if (!isOpen) return null;

  return (
    <div className="changelog-overlay" onClick={onClose}>
      <div className="changelog-modal" onClick={e => e.stopPropagation()}>
        <div className="changelog-header">
          <h2>Changelog</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="changelog-content">
          {Object.keys(changelog).length === 0 ? (
            <p className="changelog-empty">No changelog available</p>
          ) : (
            Object.entries(changelog).map(([date, commits]) => (
              <div key={date} className="changelog-section">
                <h3 className="changelog-date">{date}</h3>
                <ul className="changelog-list">
                  {commits.map(commit => (
                    <li key={commit.hash}>{commit.subject}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="changelog-footer">
          <button onClick={onClose} className="btn-close">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChangelogModal;
