import { useState, useEffect, useRef, cloneElement } from 'react';
import { useLocation } from 'react-router-dom';
import './PageTransition.css';

export default function PageTransition({ children }) {
  const location = useLocation();
  const [outgoingLocation, setOutgoingLocation] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const prevLocationRef = useRef(location);
  const timerRef = useRef(null);
  const isInitialRef = useRef(true);

  useEffect(() => {
    if (isInitialRef.current) {
      isInitialRef.current = false;
      prevLocationRef.current = location;
      return;
    }

    const prevPathname = prevLocationRef.current.pathname;
    const currentPathname = location.pathname;

    if (prevPathname === currentPathname) {
      prevLocationRef.current = location;
      return;
    }

    const oldLocation = prevLocationRef.current;
    prevLocationRef.current = location;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      setOutgoingLocation(null);
      setIsTransitioning(false);
      return;
    }

    setOutgoingLocation(oldLocation);
    setIsTransitioning(true);

    timerRef.current = setTimeout(() => {
      setOutgoingLocation(null);
      setIsTransitioning(false);
      timerRef.current = null;
    }, 380);
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="page-transition-wrapper">
      {outgoingLocation && (
        <div className="route-layer route-outgoing" aria-hidden="true">
          {cloneElement(children, {
            location: outgoingLocation,
            key: `out-${outgoingLocation.pathname}-${outgoingLocation.search}`
          })}
        </div>
      )}
      <div className={`route-layer route-incoming${isTransitioning ? ' route-incoming--animating' : ''}`}>
        {cloneElement(children, {
          location,
          key: `in-${location.pathname}-${location.search}`
        })}
      </div>
    </div>
  );
}
