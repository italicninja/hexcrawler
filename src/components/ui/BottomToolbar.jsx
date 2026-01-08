import { useState } from 'react';
import BugReportModal from './BugReportModal';
import AboutModal from './AboutModal';
import ChangelogModal from './ChangelogModal';

/**
 * BottomToolbar - Development and debugging information toolbar
 * 
 * Displays git information (branch, commit) and action buttons at the bottom of the application.
 * 
 * Git information is injected at build time via vite.config.js:
 * - VITE_GIT_COMMIT: Short commit SHA (7 chars)
 * - VITE_GIT_BRANCH: Current git branch name
 * - VITE_GIT_LOG: Last 50 commits for changelog
 * - VITE_APP_VERSION: Version from package.json
 * 
 * Features:
 * - About modal: App info, version, tech stack, credits
 * - Changelog modal: Auto-generated from git log
 * - Bug report modal: Submit issues to GitHub
 */

function BottomToolbar() {
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);

  const branch = import.meta.env.VITE_GIT_BRANCH || 'local';
  const commit = import.meta.env.VITE_GIT_COMMIT || 'dev';

  return (
    <>
      <div className="bottom-toolbar">
        <div className="git-info">
          {branch}@{commit}
        </div>
        
        {/* Spacer to push buttons to the right */}
        <div style={{ flex: 1 }} />
        
        <div className="toolbar-actions">
          <button 
            className="toolbar-action-btn"
            onClick={() => setIsAboutOpen(true)}
            title="About Hexcrawler"
          >
            About
          </button>
          <button 
            className="toolbar-action-btn"
            onClick={() => setIsChangelogOpen(true)}
            title="View Changelog"
          >
            Changelog
          </button>
          <button 
            className="toolbar-action-btn"
            onClick={() => setIsBugReportOpen(true)}
            title="Report a bug"
          >
            Report Bug
          </button>
        </div>
      </div>

      <AboutModal 
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />
      <ChangelogModal 
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
      />
      <BugReportModal 
        isOpen={isBugReportOpen}
        onClose={() => setIsBugReportOpen(false)}
      />
    </>
  );
}

export default BottomToolbar;
