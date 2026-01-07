/**
 * BottomToolbar - Development and debugging information toolbar
 * 
 * Displays git information (branch, commit) at the bottom of the application.
 * Designed to be extensible for additional debugging/info items.
 * 
 * Git information is injected at build time via vite.config.js:
 * - VITE_GIT_COMMIT: Short commit SHA (7 chars)
 * - VITE_GIT_BRANCH: Current git branch name
 * 
 * To add new toolbar items:
 * 1. Add a new toolbar-section div
 * 2. Use toolbar-separator div between sections
 * 3. Follow the label/value pattern for consistency
 * 
 * Example additions:
 * - Version number from package.json
 * - Build timestamp
 * - Environment (dev/staging/prod)
 * - FPS counter for performance monitoring
 * - Network status indicator
 * - Active user count (for multiplayer features)
 */

function BottomToolbar() {
  const gitInfo = {
    commit: import.meta.env.VITE_GIT_COMMIT || 'dev',
    branch: import.meta.env.VITE_GIT_BRANCH || 'local'
  };

  return (
    <div className="bottom-toolbar">
      <div className="toolbar-section">
        <span className="toolbar-label">Branch:</span>
        <span className="toolbar-value">{gitInfo.branch}</span>
      </div>
      
      <div className="toolbar-separator" />
      
      <div className="toolbar-section">
        <span className="toolbar-label">Commit:</span>
        <span className="toolbar-value" title={`Commit: ${gitInfo.commit}`}>
          {gitInfo.commit}
        </span>
      </div>
      
      {/* Future toolbar items can be added here */}
      {/* Example usage:
      <div className="toolbar-separator" />
      <div className="toolbar-section">
        <span className="toolbar-label">Version:</span>
        <span className="toolbar-value">1.0.0</span>
      </div>
      
      <div className="toolbar-separator" />
      <div className="toolbar-section">
        <span className="toolbar-label">FPS:</span>
        <span className="toolbar-value">60</span>
      </div>
      
      <div className="toolbar-separator" />
      <div className="toolbar-section">
        <span className="toolbar-label">Env:</span>
        <span className="toolbar-value">{import.meta.env.MODE}</span>
      </div>
      */}
    </div>
  );
}

export default BottomToolbar;
