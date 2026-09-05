import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import './PageTransition.css';

export default function PageTransition({ children }) {
  const location = useLocation();
  const [animKey, setAnimKey] = useState(0);
  const [phase, setPhase] = useState('idle');

  const prevPathRef = useRef(location.pathname);
  const animatingRef = useRef(false);
  const timeoutRef = useRef(null);
  const isInitialRef = useRef(true);

  useEffect(() => {
    if (isInitialRef.current) {
      isInitialRef.current = false;
      prevPathRef.current = location.pathname;
      return;
    }

    if (location.pathname === prevPathRef.current) return;

    prevPathRef.current = location.pathname;

    if (animatingRef.current) return;
    animatingRef.current = true;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setPhase('exiting');

    // Exit phase duration — must match the CSS transition (100ms).
    // Reduced motion skips the visual exit entirely.
    const exitDuration = reducedMotion ? 0 : 100;

    timeoutRef.current = setTimeout(() => {
      setPhase('idle');
      setAnimKey((k) => k + 1);
      animatingRef.current = false;
    }, exitDuration);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [location.pathname]);

  const handleAnimEnd = () => {
    if (phase === 'exiting') {
      setPhase('idle');
      setAnimKey((k) => k + 1);
      animatingRef.current = false;
    }
  };

  const className =
    'page-transition' +
    (phase === 'exiting' ? ' page-exit' : '') +
    (animKey > 0 ? ' page-enter' : '');

  return (
    <div className={className} key={animKey} onAnimationEnd={handleAnimEnd}>
      {children}
    </div>
  );
}
