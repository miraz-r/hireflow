import { useEffect } from 'react';

/**
 * Closes a small overlay (menu / popover) on outside-click and Escape.
 * Mirrors the pattern used by the public Navbar's account dropdown.
 */
export default function useDismissible(open, ref, onClose) {
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, ref, onClose]);
}