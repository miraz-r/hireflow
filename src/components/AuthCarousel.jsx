import { useState, useCallback, useRef, useId, useEffect } from 'react';
import './AuthCarousel.css';

export default function AuthCarousel({ slides }) {
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const total = slides.length;
  const reactId = useId();
  const labelId = `auth-carousel-${reactId}`;
  const viewportRef = useRef(null);
  const dragStartX = useRef(0);
  const pointerIdRef = useRef(null);

  const goTo = useCallback((next) => {
    if (total === 0) return;
    const normalized = ((next % total) + total) % total;
    setIndex(normalized);
  }, [total]);

  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);
  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Track viewport width to compute drag percentage
  useEffect(() => {
    if (!viewportRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setViewportWidth(entry.contentRect.width);
      }
    });
    ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); goPrev(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); goNext(); }
    else if (event.key === 'Home') { event.preventDefault(); goTo(0); }
    else if (event.key === 'End') { event.preventDefault(); goTo(total - 1); }
  };

  const handlePointerDown = useCallback((e) => {
    // Ignore non-primary mouse buttons
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    setIsDragging(true);
    dragStartX.current = e.clientX;
    setDragOffset(0);
    pointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) { /* ignore */ }
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging) return;
    const delta = e.clientX - dragStartX.current;
    setDragOffset(delta);
  }, [isDragging]);

  const endDrag = useCallback(() => {
    if (!isDragging) return;
    const threshold = Math.max(40, viewportWidth * 0.12);
    if (dragOffset > threshold) {
      goPrev();
    } else if (dragOffset < -threshold) {
      goNext();
    }
    setIsDragging(false);
    setDragOffset(0);
    pointerIdRef.current = null;
  }, [isDragging, dragOffset, viewportWidth, goPrev, goNext]);

  const handlePointerUp = useCallback((e) => {
    endDrag();
    if (pointerIdRef.current !== null) {
      try {
        e.currentTarget.releasePointerCapture(pointerIdRef.current);
      } catch (_) { /* ignore */ }
    }
  }, [endDrag]);

  const handlePointerCancel = useCallback(() => {
    setIsDragging(false);
    setDragOffset(0);
    pointerIdRef.current = null;
  }, []);

  if (total === 0) return null;

  // Compute track translate including live drag offset
  const baseTranslate = -index * 100;
  const dragPercent = viewportWidth > 0 ? (dragOffset / viewportWidth) * 100 : 0;
  const trackTranslate = baseTranslate + dragPercent;
  const transitionStyle = prefersReducedMotion
    ? 'none'
    : isDragging
      ? 'none'
      : 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)';

  return (
    <div
      className="auth-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-labelledby={labelId}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <h2 id={labelId} className="auth-carousel-sr-only">HireFlow highlights</h2>

      <div className="auth-visual-grid" aria-hidden="true" />
      <div className="auth-visual-glow auth-visual-glow--top" aria-hidden="true" />
      <div className="auth-visual-glow auth-visual-glow--bottom" aria-hidden="true" />

      <div className="auth-carousel-stage" aria-hidden="true">
        <div className="auth-mock auth-mock--back">
          <div className="auth-mock-header">
            <div className="auth-mock-avatar auth-mock-avatar--indigo" />
            <div className="auth-mock-lines">
              <span className="auth-mock-line auth-mock-line--lg" />
              <span className="auth-mock-line auth-mock-line--sm" />
            </div>
          </div>
          <div className="auth-mock-tags">
            <span className="auth-mock-tag" />
            <span className="auth-mock-tag auth-mock-tag--short" />
            <span className="auth-mock-tag" />
          </div>
          <div className="auth-mock-bar">
            <span className="auth-mock-bar-fill auth-mock-bar-fill--teal" />
          </div>
        </div>

        <div className="auth-mock auth-mock--front">
          <div className="auth-mock-header">
            <div className="auth-mock-avatar auth-mock-avatar--teal" />
            <div className="auth-mock-lines">
              <span className="auth-mock-line auth-mock-line--lg" />
              <span className="auth-mock-line auth-mock-line--md" />
            </div>
            <span className="auth-mock-badge">New</span>
          </div>
          <div className="auth-mock-meta">
            <span className="auth-mock-meta-item" />
            <span className="auth-mock-meta-item auth-mock-meta-item--short" />
          </div>
          <div className="auth-mock-tags">
            <span className="auth-mock-tag" />
            <span className="auth-mock-tag auth-mock-tag--short" />
          </div>
          <div className="auth-mock-bar">
            <span className="auth-mock-bar-fill auth-mock-bar-fill--indigo" />
          </div>
        </div>
      </div>

      <div
        className="auth-carousel-viewport"
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerUp}
      >
        <div
          className="auth-carousel-track"
          style={{
            transform: `translate3d(${trackTranslate}%, 0, 0)`,
            transition: transitionStyle,
          }}
        >
          {slides.map((slide, i) => (
            <div
              key={slide.id ?? i}
              className="auth-carousel-slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${total}`}
              aria-hidden={i !== index}
            >
              <div className="auth-visual-content">
                {slide.badge && (
                  <div className="auth-visual-badge">
                    {slide.badgeIcon}
                    <span>{slide.badge}</span>
                  </div>
                )}
                <h3 className="auth-visual-title">{slide.title}</h3>
                <p className="auth-visual-subtitle">{slide.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-carousel-controls">
        <div className="auth-carousel-dots" role="tablist" aria-label="Choose slide">
          {slides.map((slide, i) => (
            <button
              key={`dot-${slide.id ?? i}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Go to slide ${i + 1}: ${slide.title}`}
              className={`auth-pager-dot ${i === index ? 'auth-pager-dot--active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
