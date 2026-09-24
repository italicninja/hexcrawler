import type { ReactNode } from 'react';
import Modal, { ModalTitle } from './Modal';

/**
 * MenuPanel - Reusable popup panel for menus
 * Displays content in a centered modal overlay
 */
interface MenuPanelProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children?: ReactNode;
  width?: string;
  maxWidth?: string;
}

function MenuPanel({
  title,
  isOpen,
  onClose,
  children,
  width = '600px',
  maxWidth = '90vw',
}: MenuPanelProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      overlayClassName="menu-panel-backdrop"
      overlayStyle={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 'var(--z-menu)',
        padding: '1rem',
      }}
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
        <ModalTitle
          style={{
            margin: 0,
            color: 'var(--accent-color)',
            fontSize: '1.5rem',
            fontWeight: 600,
          }}
        >
          {title}
        </ModalTitle>
        <button
          onClick={onClose}
          aria-label="Close"
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
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-color)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
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
    </Modal>
  );
}

export default MenuPanel;
