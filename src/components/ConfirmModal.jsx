import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ConfirmModal.css';

/**
 * ConfirmModal — fixed-to-viewport confirmation dialog.
 *
 * Rendered through a portal to <body>. Mounting a `position: fixed` overlay
 * inside a route layer would trap it in that layer's containing block (the
 * PageTransition route layers apply `will-change: transform` and, during
 * transitions, a real transform), which is what made the old in-place modal
 * float relative to the page instead of the viewport. Portaling to <body> —
 * the same approach the Navbar drawer uses — roots the overlay at the
 * viewport regardless of scroll position.
 *
 * While open it:
 *   - locks body scroll without moving the page (position/top technique, the
 *     established project pattern) and restores the exact scroll offset on
 *     close, so cancel never jumps the page;
 *   - closes on Escape, matching the app's dialog/menu convention;
 *   - moves focus into the dialog so keyboard users aren't operating controls
 *     behind the overlay, and returns focus to the triggering control on close.
 *
 * Props: open, title, children (description/error), confirmLabel, busyLabel,
 * busy, onClose, onConfirm.
 */
export default function ConfirmModal({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  busyLabel = 'Working…',
  busy = false,
  onClose,
  onConfirm,
}) {
  const titleId = useId();
  const dialogRef = useRef(null);

  // Keep a ref so the scroll/escape effect only re-runs when `open` changes,
  // not on every parent re-render (e.g. busy or error state flips).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const scrollY = window.scrollY;

    // Lock underlying page scroll without detaching the visual position.
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // Move focus into the dialog once the portal has rendered.
    const raf = window.requestAnimationFrame(() => {
      if (dialogRef.current) {
        dialogRef.current.focus();
      }
    });

    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      // Restore the pre-open scroll offset now the lock is released.
      window.scrollTo(0, scrollY);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="modal-content" ref={dialogRef} tabIndex={-1}>
        <h3 id={titleId} className="modal-title">
          {title}
        </h3>
        {children}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}