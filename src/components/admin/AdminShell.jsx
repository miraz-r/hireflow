import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';
import './AdminShell.css';

/**
 * AdminShell - the full-bleed Admin application layout.
 *
 * Browser viewport
 *     ↓
 * AdminShell
 *     ├── AdminSidebar            (persistent on desktop, off-canvas drawer on mobile)
 *     └── .admin-main
 *          ├── AdminTopbar
 *          └── routed page content
 *
 * It owns the responsive mobile-drawer state and keeps the content region
 * scrolled to the top on route changes. It contains no page-specific logic.
 */
export default function AdminShell({ children }) {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarRef = useRef(null);
  const closeBtnRef = useRef(null);
  const openBtnRef = useRef(null);
  const contentRef = useRef(null);
  const restoreFocusRef = useRef(true);

  // Keep the scrollable content region at the top when the admin route changes.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);

  const openDrawer = useCallback(() => {
    restoreFocusRef.current = true;
    setDrawerOpen(true);
    // Wait for the drawer to render/position before moving focus into it.
    requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });
  }, []);

  const closeDrawer = useCallback((opts = {}) => {
    // After real navigation the page changed, so restoring focus to the menu
    // button would yank the user back. Only restore when no nav happened.
    if (opts.returnFocus !== false && restoreFocusRef.current && openBtnRef.current) {
      openBtnRef.current.focus();
    }
    setDrawerOpen(false);
  }, []);

  // Navigation initiated from inside the drawer (nav links, brand).
  const handleNavigate = useCallback(() => {
    restoreFocusRef.current = false;
    setDrawerOpen(false);
  }, []);

  // Mobile drawer: Escape closes it and Tab stays trapped inside it.
  useEffect(() => {
    if (!drawerOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeDrawer();
        return;
      }
      if (e.key !== 'Tab') return;

      const container = sidebarRef.current;
      if (!container) return;

      const candidates = container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const focusable = Array.from(candidates).filter((el) => {
        if (el.tabIndex < 0) return false;
        if (el.hasAttribute('disabled')) return false;
        if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
        if (el.getClientRects().length === 0) return false;
        return window.getComputedStyle(el).visibility !== 'hidden';
      });

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen, closeDrawer]);

  return (
    <div className={`admin-shell${drawerOpen ? ' admin-shell--drawer-open' : ''}`}>
      <AdminSidebar
        drawerRef={sidebarRef}
        closeBtnRef={closeBtnRef}
        onClose={closeDrawer}
        onNavigate={handleNavigate}
      />
      <div className="admin-drawer-backdrop" onClick={closeDrawer} aria-hidden="true" />

      <div className="admin-main">
        <AdminTopbar
          openBtnRef={openBtnRef}
          drawerOpen={drawerOpen}
          onOpenDrawer={openDrawer}
        />
        <main className="admin-content" ref={contentRef}>
          {children}
        </main>
      </div>
    </div>
  );
}