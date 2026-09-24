import { useRef, type CSSProperties, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

/**
 * Accessible modal shell on Radix Dialog: role="dialog", aria-modal, labelled by
 * the <ModalTitle> inside it, closes on Escape / backdrop click, traps focus and
 * restores it to the opener on close. Styling stays with the caller's classes.
 */
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  overlayClassName?: string;
  overlayStyle?: CSSProperties;
  className?: string;
  style?: CSSProperties;
}

function Modal({
  isOpen,
  onClose,
  children,
  overlayClassName,
  overlayStyle,
  className,
  style,
}: ModalProps) {
  // Radix only restores focus to a <Dialog.Trigger>; our openers are plain buttons,
  // so remember whatever had focus when the dialog opened and return focus there.
  const openerRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <Dialog.Portal>
        {/* Content nested in Overlay keeps the existing flex-centering CSS working */}
        <Dialog.Overlay className={overlayClassName} style={overlayStyle}>
          <Dialog.Content
            className={className}
            style={style}
            aria-modal="true"
            aria-describedby={undefined}
            onOpenAutoFocus={() => {
              openerRef.current = document.activeElement as HTMLElement | null;
            }}
            onCloseAutoFocus={e => {
              if (openerRef.current?.isConnected) {
                e.preventDefault();
                openerRef.current.focus();
              }
            }}
          >
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Heading that labels the surrounding Modal (use asChild to keep your own element). */
export const ModalTitle = Dialog.Title;

export default Modal;
