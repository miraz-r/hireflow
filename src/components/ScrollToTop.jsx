import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getJobsScroll, clearJobsScroll } from '../utils/jobsScrollState';

function getScrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
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
  const { pathname, hash, state, key } = useLocation();
  const prevPathname = useRef(pathname);
  const prevHash = useRef(hash);
  const jobsScrollRestored = useRef(false);

  useLayoutEffect(() => {
    if (pathname !== '/') return;

    if (state?.restoreJobsScroll != null) {
      jobsScrollRestored.current = true;
      clearJobsScroll();
      window.scrollTo({ top: state.restoreJobsScroll, left: 0, behavior: 'auto' });
      return;
    }

    const bookmark = getJobsScroll();
    if (bookmark && bookmark.jobsLocationKey === key) {
      jobsScrollRestored.current = true;
      clearJobsScroll();
      window.scrollTo({ top: bookmark.scrollY, left: 0, behavior: 'auto' });
      return;
    }

    clearJobsScroll();
  }, [pathname, key, state]);

  useEffect(() => {
    if (jobsScrollRestored.current) {
      jobsScrollRestored.current = false;
      prevPathname.current = pathname;
      prevHash.current = hash;
      return;
    }

    const behavior = getScrollBehavior();

    if (state?.scrollTo && pathname === prevPathname.current) {
      scrollToElement(state.scrollTo, behavior, 10, 100);
      prevHash.current = hash;
      return;
    }

    if (state?.scrollTo && pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      prevHash.current = hash;
      scrollToElement(state.scrollTo, behavior, 10, 100);
      return;
    }

    if (pathname === prevPathname.current) {
      if (hash !== prevHash.current) {
        prevHash.current = hash;
        if (hash) {
          const id = hash.replace('#', '');
          scrollToElement(id, behavior, 5, 100);
        } else {
          window.scrollTo({ top: 0, left: 0, behavior });
        }
      }
      return;
    }

    prevPathname.current = pathname;
    prevHash.current = hash;

    if (hash) {
      const id = hash.replace('#', '');
      scrollToElement(id, behavior, 10, 100);
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [pathname, hash, state]);

  return null;
}
