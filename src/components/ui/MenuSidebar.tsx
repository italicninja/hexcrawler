// @ts-nocheck

/**
 * MenuSidebar - Vertical list of clickable menu items
 */
function MenuSidebar({ items, onItemClick, selectedItem }) {
  return (
    <div
      className="menu-sidebar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        padding: '1rem',
        backgroundColor: 'var(--panel-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        width: '100%',
      }}
    >
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => !item.disabled && onItemClick(item)}
          disabled={item.disabled}
          title={item.disabledReason || undefined}
          className={`menu-sidebar-item ${selectedItem?.id === item.id ? 'selected' : ''} ${item.isDev ? 'dev-item' : ''} ${item.disabled ? 'disabled' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.5rem 0.75rem',
            backgroundColor: item.disabled
              ? 'var(--bg-color)'
              : item.isDev
                ? 'rgba(255, 69, 0, 0.2)'
                : selectedItem?.id === item.id
                  ? 'var(--bg-lighter)'
                  : 'var(--bg-color)',
            border: item.disabled
              ? '1px solid var(--border-color)'
              : item.isDev
                ? '2px solid rgba(255, 69, 0, 0.6)'
                : selectedItem?.id === item.id
                  ? '2px solid var(--accent-color)'
                  : '1px solid var(--border-color)',
            borderRadius: '6px',
            color: item.disabled
              ? 'var(--text-muted)'
              : item.isDev
                ? '#ff4500'
                : 'var(--text-color)',
            fontSize: '1rem',
            fontWeight: item.isDev ? '700' : '500',
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            opacity: item.disabled ? 0.5 : 1,
            transition: 'all 0.2s ease',
            textAlign: 'left',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => {
            if (item.disabled) return;
            if (item.isDev) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 69, 0, 0.4)';
            } else if (selectedItem?.id !== item.id) {
              e.currentTarget.style.backgroundColor = 'var(--bg-lighter)';
              e.currentTarget.style.borderColor = 'var(--text-muted)';
            }
          }}
          onMouseLeave={e => {
            if (item.disabled) return;
            if (item.isDev) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 69, 0, 0.2)';
            } else if (selectedItem?.id !== item.id) {
              e.currentTarget.style.backgroundColor = 'var(--bg-color)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', color: 'var(--text-color)' }}>{item.label}</div>
          </div>
          {item.badge !== undefined && item.badge > 0 && (
            <div
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: 'var(--accent-color)',
                color: 'var(--bg-color)',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: '700',
              }}
            >
              {item.badge}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

export default MenuSidebar;
