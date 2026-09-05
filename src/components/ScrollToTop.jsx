import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname, state } = useLocation();

  // Scroll to top whenever the route path changes (cross-page navigation).
  // If the navigation carries a { scrollTo: id } state, skip the default
  // scroll-to-top — the calling component (Navbar / Footer anchor links)
  // is responsible for scrolling to the target section.
  useEffect(() => {
    if (state?.scrollTo) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, state]);

  return null;
}
