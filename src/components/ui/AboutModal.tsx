// @ts-nocheck
import { useEffect } from 'react';
import './AboutModal.css';

/**
 * AboutModal Component
 * Displays app information, version, tech stack, and credits
 */
function AboutModal({ isOpen, onClose }) {
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

  if (!isOpen) return null;

  const version = import.meta.env.VITE_APP_VERSION || 'unknown';
  const branch = import.meta.env.VITE_GIT_BRANCH || 'unknown';
  const commit = import.meta.env.VITE_GIT_COMMIT || 'unknown';

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={e => e.stopPropagation()}>
        <div className="about-header">
          <h2>About Hexcrawler</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="about-content">
          <div className="about-title">
            <h3>Hexcrawler v{version}</h3>
          </div>

          <div className="about-description">
            <p>
              A web-based hexcrawl RPG for D&D 5e. Explore procedurally generated hex maps with
              party management, turn-based movement, and authentic D&D 5e mechanics.
            </p>
          </div>

          <div className="about-section">
            <h4>Version Information</h4>
            <ul>
              <li>Branch: {branch}</li>
              <li>Commit: {commit}</li>
            </ul>
          </div>

          <div className="about-section">
            <h4>Tech Stack</h4>
            <ul>
              <li>React 19.0</li>
              <li>Vite 5.0</li>
              <li>HTML5 Canvas</li>
              <li>D&D 5e SRD</li>
            </ul>
          </div>

          <div className="about-section">
            <h4>Links</h4>
            <ul>
              <li>
                <a
                  href="https://github.com/italicninja/hexcrawler"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="about-link"
                >
                  GitHub Repository
                </a>
              </li>
            </ul>
          </div>

          <div className="about-credits">
            <p>Developed by ItalicNinja</p>
          </div>
        </div>

        <div className="about-footer">
          <button onClick={onClose} className="btn-close">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default AboutModal;
