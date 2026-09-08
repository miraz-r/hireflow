import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

function getScrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';
}

function scrollToElement(id, behavior, maxRetries, retryDelay) {
  let attempts = 0;
  const tryScroll = () => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior, block: 'start' });
      return;
    }
    if (attempts < maxRetries) {
      attempts++;
      setTimeout(tryScroll, retryDelay);
    }
  };
  tryScroll();
}

export default function ScrollToTop() {
  const { pathname, hash, state } = useLocation();
  const prevPathname = useRef(pathname);
  const prevHash = useRef(hash);

  useEffect(() => {
    const behavior = getScrollBehavior();

    // CASE: State-based navigation (from Navbar/Footer anchor links)
    if (state?.scrollTo && pathname === prevPathname.current) {
      // Same-route state navigation — scroll to target directly
      scrollToElement(state.scrollTo, behavior, 10, 100);
      prevHash.current = hash;
      return;
    }

    if (state?.scrollTo && pathname !== prevPathname.current) {
      // Cross-route state navigation — wait for render then scroll to target
      prevPathname.current = pathname;
      prevHash.current = hash;
      scrollToElement(state.scrollTo, behavior, 10, 100);
      return;
    }

    // CASE: Same pathname, hash changed (same-page anchor navigation)
    if (pathname === prevPathname.current) {
      if (hash !== prevHash.current) {
        prevHash.current = hash;
        if (hash) {
          const id = hash.replace('#', '');
          scrollToElement(id, behavior, 5, 100);
        } else {
          // Hash removed — scroll to top
          window.scrollTo({ top: 0, left: 0, behavior });
        }
      }
      return;
    }

    // CASE: Cross-page navigation
    prevPathname.current = pathname;
    prevHash.current = hash;

    if (hash) {
      // Cross-page with hash — wait for destination to render, then scroll to target.
      // Do NOT scroll to top first; let the new page render at top naturally,
      // then smooth-scroll to the target section.
      const id = hash.replace('#', '');
      scrollToElement(id, behavior, 10, 100);
    } else {
      // Cross-page without hash — scroll to top
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [pathname, hash, state]);

  return null;
}
