import { useState, useCallback } from 'react';

interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  resolve: ((value: boolean) => void) | null;
}

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface UseConfirmReturn {
  confirm: (title: string, description: string) => Promise<boolean>;
  dialogProps: DialogProps;
}

/**
 * useConfirm hook - Provides a confirm() function that returns a Promise.
 *
 * Usage:
 * const { confirm, dialogProps } = useConfirm();
 *
 * // In your component JSX:
 * <ConfirmDialog {...dialogProps} />
 *
 * // To show a confirm dialog:
 * const confirmed = await confirm("Are you sure?", "This will delete your data");
 */
export function useConfirm(): UseConfirmReturn {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: '',
    description: '',
    resolve: null,
  });

  const confirm = useCallback((title: string, description: string): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      setState({
        open: true,
        title,
        description,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState(prev => {
      prev.resolve?.(true);
      return { open: false, title: '', description: '', resolve: null };
    });
  }, []);

  const handleCancel = useCallback(() => {
    setState(prev => {
      prev.resolve?.(false);
      return { open: false, title: '', description: '', resolve: null };
    });
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setState(prev => {
        prev.resolve?.(false);
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
