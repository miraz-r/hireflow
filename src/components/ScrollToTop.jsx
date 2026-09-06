import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname, hash, state } = useLocation();
  const previousPathname = useRef(pathname);
  const previousHash = useRef(hash);

  useEffect(() => {
    // If navigating to a new pathname (cross-page), always scroll to top first.
    // Then, if there's a hash, scroll to the target section after render.
    if (pathname !== previousPathname.current) {
      previousPathname.current = pathname;
      previousHash.current = hash;

      // If state has scrollTo (from Navbar/Footer anchor links), skip auto-top
      // because the target component will handle it.
      if (state?.scrollTo) {
        // Wait for render then scroll to target.
        const id = state.scrollTo;
        const attemptScroll = () => {
          const el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            // If element not yet rendered, retry briefly.
            setTimeout(attemptScroll, 100);
          }
        };
        // Small delay to allow PageTransition render.
        setTimeout(attemptScroll, 150);
        return;
      }

      // Cross-page, no hash: scroll to top immediately.
      if (!hash) {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      } else {
        // Cross-page with hash: scroll to top first, then target after render.
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        const id = hash.replace('#', '');
        const attemptScroll = () => {
          const el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            setTimeout(attemptScroll, 100);
          }
        };
        setTimeout(attemptScroll, 200);
      }
      return;
    }

    // Same pathname, hash changed (same-page anchor navigation)
    if (hash !== previousHash.current) {
      previousHash.current = hash;
      if (hash) {
        const id = hash.replace('#', '');
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      }
    }
  }, [pathname, hash, state]);

  return null;
}
