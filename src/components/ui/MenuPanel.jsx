import PropTypes from 'prop-types';

/**
 * MenuPanel - Reusable popup panel for menus
 * Displays content in a centered modal overlay
 */
function MenuPanel({ title, isOpen, onClose, children, width = '600px', maxWidth = '90vw' }) {
  if (!isOpen) return null;

  const handleBackdropClick = e => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="menu-panel-backdrop"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
      }}
    >
      <div
        className="menu-panel menu-panel-container"
        style={{
          backgroundColor: 'var(--panel-bg)',
          border: '2px solid var(--border-color)',
          borderRadius: '8px',
          width: width,
          maxWidth: maxWidth,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          className="menu-panel-header"
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-color)',
          }}
        >
          <h2
            style={{
              margin: 0,
              color: 'var(--accent-color)',
              fontSize: '1.5rem',
              fontWeight: 600,
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              lineHeight: 1,
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.target.style.color = 'var(--text-color)')}
            onMouseLeave={e => (e.target.style.color = 'var(--text-muted)')}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          className="menu-panel-content"
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

MenuPanel.propTypes = {
  title: PropTypes.string.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node,
  width: PropTypes.string,
  maxWidth: PropTypes.string,
};

export default MenuPanel;
