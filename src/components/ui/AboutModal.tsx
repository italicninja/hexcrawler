import Modal, { ModalTitle } from './Modal';
import './AboutModal.css';

/**
 * AboutModal Component
 * Displays app information, version, tech stack, and credits
 */
interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const version = import.meta.env.VITE_APP_VERSION || 'unknown';
  const branch = import.meta.env.VITE_GIT_BRANCH || 'unknown';
  const commit = import.meta.env.VITE_GIT_COMMIT || 'unknown';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      overlayClassName="about-overlay"
      className="about-modal"
    >
      <div className="about-header">
        <ModalTitle>About Hexcrawler</ModalTitle>
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
            A web-based hexcrawl RPG for D&D 5e. Explore procedurally generated hex maps with party
            management, turn-based movement, and authentic D&D 5e mechanics.
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
    </Modal>
  );
}

export default AboutModal;
