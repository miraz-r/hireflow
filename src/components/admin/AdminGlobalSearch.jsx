import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminSearch } from '../../utils/adminApi';

const SEARCH_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const GROUP_ORDER = [
  { key: 'jobseekers', label: 'Jobseekers' },
  { key: 'recruiters', label: 'Recruiters' },
  { key: 'companies', label: 'Companies' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'applications', label: 'Applications' },
];

const routeFor = (groupKey, item) => {
  switch (groupKey) {
    case 'jobseekers':
      return `/admin/jobseekers/${item.id}`;
    case 'recruiters':
      return '/admin/recruiters';
    case 'companies':
      return '/admin/companies';
    case 'jobs':
      return `/admin/jobs/${item.id}`;
    case 'applications':
      return `/admin/applications?search=${encodeURIComponent(item.label)}`;
    default:
      return '/admin';
  }
};

/**
 * AdminGlobalSearch - the topbar's cross-entity search. Queries
 * GET /api/admin/search (debounced, stale responses dropped) and renders a
 * grouped, keyboard-navigable result panel in the existing Admin visual
 * system.
 */
export default function AdminGlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const requestSeq = useRef(0);
  const abortRef = useRef(null);

  const items = results
    ? GROUP_ORDER.flatMap((g) => (results[g.key] || []).map((item) => ({ groupKey: g.key, item })))
    : [];

  // Debounced search. Stale responses are dropped via a request sequence and
  // the in-flight request is aborted whenever the query changes.
  useEffect(() => {
    const trimmed = query.trim();
    setActiveIndex(-1);
    if (trimmed.length === 0) {
      setResults(null);
      setStatus('idle');
      setOpen(false);
      return undefined;
    }
    if (trimmed.length < 2) {
      setResults(null);
      setStatus('idle');
      setOpen(false);
      return undefined;
    }

    const seq = (requestSeq.current += 1);
    const timer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus('loading');
      setOpen(true);
      try {
        const data = await getAdminSearch(trimmed, { signal: controller.signal });
        if (seq !== requestSeq.current) return;
        setResults(data);
        setStatus('done');
      } catch (err) {
        if (controller.signal.aborted || seq !== requestSeq.current) return;
        setResults(null);
        setStatus('error');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    const onPointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const goTo = useCallback((groupKey, item) => {
    setQuery('');
    setResults(null);
    setStatus('idle');
    setOpen(false);
    setActiveIndex(-1);
    navigate(routeFor(groupKey, item));
  }, [navigate]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const active = items[activeIndex];
      if (active) goTo(active.groupKey, active.item);
    }
  };

  const totalMatches = items.length;

  return (
    <div className="admin-topbar-search" ref={containerRef}>
      <label className="sr-only" htmlFor="admin-global-search">
        Search jobs, applications, users
      </label>
      {SEARCH_ICON}
      <input
        id="admin-global-search"
        className="admin-topbar-search-input"
        type="search"
        placeholder="Search jobs, applications, users..."
        autoComplete="off"
        spellCheck="false"
        role="combobox"
        aria-expanded={open}
        aria-controls="admin-global-search-results"
        aria-activedescendant={activeIndex >= 0 ? `admin-search-option-${activeIndex}` : undefined}
        value={query}
        onChange={(e) => { setQuery(e.target.value); if (e.target.value.trim().length >= 2) setOpen(true); }}
        onFocus={() => { if (results && items.length > 0) setOpen(true); }}
        onKeyDown={onKeyDown}
      />

      {open && (
        <div
          id="admin-global-search-results"
          className="admin-global-search-results"
          role="listbox"
          aria-label="Search results"
        >
          {status === 'loading' && (
            <p className="admin-global-search-state" role="status">Searching...</p>
          )}
          {status === 'error' && (
            <p className="admin-global-search-state" role="alert">Search is unavailable right now.</p>
          )}
          {status === 'done' && totalMatches === 0 && (
            <p className="admin-global-search-state">No results for &ldquo;{query.trim()}&rdquo;</p>
          )}
          {status !== 'error' && items.length > 0 && (
            GROUP_ORDER.map((group) => {
              const groupItems = results[group.key] || [];
              if (groupItems.length === 0) return null;
              return (
                <div className="admin-global-search-group" key={group.key}>
                  <p className="admin-global-search-group-label">{group.label}</p>
                  {groupItems.map((item) => {
                    const flatIndex = items.findIndex((it) => it.groupKey === group.key && it.item.id === item.id);
                    return (
                      <button
                        type="button"
                        key={`${group.key}-${item.id}`}
                        id={`admin-search-option-${flatIndex}`}
                        role="option"
                        aria-selected={flatIndex === activeIndex}
                        className={`admin-global-search-option${flatIndex === activeIndex ? ' admin-global-search-option--active' : ''}`}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        onClick={() => goTo(group.key, item)}
                      >
                        <span className="admin-global-search-option-label">{item.label}</span>
                        {item.sublabel && (
                          <span className="admin-global-search-option-sublabel">{item.sublabel}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
