import { useState, useCallback } from 'react';

/**
 * useConfirm hook - Provides a confirm() function that returns a Promise
 *
 * Usage:
 * const { confirm, ConfirmDialog } = useConfirm();
 *
 * // In your component JSX:
 * <ConfirmDialog />
 *
 * // To show a confirm dialog:
 * const confirmed = await confirm("Are you sure?", "This will delete your data");
 * if (confirmed) {
 *   // User clicked confirm
 * }
 */
export function useConfirm() {
  const [state, setState] = useState({
    open: false,
    title: '',
    description: '',
    resolve: null,
  });

  const confirm = useCallback((title, description) => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title,
        description,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState((prev) => {
      if (prev.resolve) {
        prev.resolve(true);
      }
      return { open: false, title: '', description: '', resolve: null };
    });
  }, []);

  const handleCancel = useCallback(() => {
    setState((prev) => {
      if (prev.resolve) {
        prev.resolve(false);
      }
      return { open: false, title: '', description: '', resolve: null };
    });
  }, []);

  const handleOpenChange = useCallback((open) => {
    if (!open) {
      setState((prev) => {
        // Dialog was closed without clicking a button (e.g., ESC key or clicking overlay)
        if (prev.resolve) {
          prev.resolve(false);
        }
        return { ...prev, open };
      });
    } else {
      setState(prev => ({ ...prev, open }));
    }
  }, []);

  return {
    confirm,
    dialogProps: {
      open: state.open,
      onOpenChange: handleOpenChange,
      title: state.title,
      description: state.description,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  };
}
