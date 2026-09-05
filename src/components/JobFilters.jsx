import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import './JobFilters.css';

function FilterDropdown({ label, options, selected, onChange, getOptionKey, getOptionLabel, getOptionValue }) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ top: 0, left: 0, width: 0, openUp: false, maxHeight: 280 });
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  // Live track of the menu's open direction (persists across renders and is
  // stable inside event closures), so re-anchoring on page scroll never relies
  // on a stale `placement` value and never flips up/down.
  const directionRef = useRef(false);

  const openMenu = (preserveDirection = false) => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const OPTION_HEIGHT = 36;
    const MENU_PADDING = 12;
    const MENU_GAP = 6;
    // The menu always renders an extra "Any" button on top of the supplied
    // options, so the full list height must include it.
    const totalMenuHeight = MENU_PADDING + (options.length + 1) * OPTION_HEIGHT;
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const spaceAbove = rect.top - MENU_GAP;
    // On first open pick the direction with the most usable space. While the
    // menu stays open we preserve that direction so page scrolling never makes
    // it flip up/down and jitter; it only re-anchors within its own direction.
    const openUp = preserveDirection
      ? directionRef.current
      : (spaceBelow < totalMenuHeight && spaceAbove > spaceBelow);
    directionRef.current = openUp;
    const availableSpace = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(totalMenuHeight, Math.max(availableSpace, OPTION_HEIGHT * 2));

    setPlacement({
      top: openUp ? rect.top - MENU_GAP - maxHeight : rect.bottom + MENU_GAP,
      left: rect.left,
      width: rect.width,
      openUp,
      maxHeight,
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target) &&
          menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // A scroll event fires for the dropdown's own scrollable container AND for
    // the page. Internal scrolling of the dropdown must be ignored entirely.
    // A PAGE scroll must NOT close the dropdown either — instead the menu is
    // re-anchored to the (moving) trigger so it stays open and attached while
    // keeping its open-up/down direction stable (no flicker).
    // e.target of a scroll event is the element that was scrolled (the scroll
    // container), never a child inside it, so checking against the menu node
    // is exact.
    const handleScroll = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (triggerRef.current) openMenu(true);
    };
    const handleResize = () => {
      if (triggerRef.current) openMenu(true);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open]);

  // When the menu opens, bring the currently-selected option into view within
  // the menu's own scroll container (no page scrolling). Only scroll as much as
  // needed so the selected option is visible, and never force it to a corner.
  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    const menu = menuRef.current;
    const selectedEl = menu.querySelector('.filter-option.selected');
    if (!selectedEl) return;
    const optTop = selectedEl.offsetTop;
    const optBottom = optTop + selectedEl.offsetHeight;
    if (optTop < menu.scrollTop) {
      menu.scrollTop = optTop;
    } else if (optBottom > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = optBottom - menu.clientHeight;
    }
  }, [open, selected]);

  const handleSelect = (value) => {
    onChange(value);
    setOpen(false);
  };

  const selectedIsActive = selected !== null && selected !== undefined;
  let displayLabel = null;
  if (selectedIsActive && options.length > 0) {
    const matchedOption = options.find(opt => {
      const optValue = getOptionValue ? getOptionValue(opt) : opt;
      if (selected && typeof selected === 'object' && 'min' in selected) {
        return optValue && typeof optValue === 'object' && optValue.min === selected.min;
      }
      return optValue === selected;
    });
    displayLabel = matchedOption ? (getOptionLabel ? getOptionLabel(matchedOption) : String(matchedOption)) : null;
  }

  const menu = open ? (
    <div
      ref={menuRef}
      className={`filter-menu ${placement.openUp ? 'filter-menu--up' : ''}`}
      style={{
        position: 'fixed',
        top: placement.top,
        left: placement.left,
        width: placement.width,
        maxHeight: placement.maxHeight,
        zIndex: 9999,
      }}
      role="listbox"
    >
      <button
        className={`filter-option ${!selectedIsActive ? 'selected' : ''}`}
        onClick={() => handleSelect(null)}
        role="option"
        aria-selected={!selectedIsActive}
      >
        Any
      </button>
      {options.map(opt => {
        const key = getOptionKey(opt);
        const optLabel = getOptionLabel ? getOptionLabel(opt) : String(opt);
        const optValue = getOptionValue ? getOptionValue(opt) : opt;
        const isSelected = selectedIsActive && (() => {
          if (selected && typeof selected === 'object' && 'min' in selected) {
            return optValue && typeof optValue === 'object' && optValue.min === selected.min;
          }
          return optValue === selected;
        })();
        return (
          <button
            key={key}
            className={`filter-option ${isSelected ? 'selected' : ''}`}
            onClick={() => handleSelect(optValue)}
            role="option"
            aria-selected={isSelected}
          >
            {optLabel}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div className="filter-dropdown" ref={ref}>
      <button
        ref={triggerRef}
        className={`filter-trigger ${selectedIsActive ? 'active' : ''}`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{label}: <strong>{displayLabel || 'Any'}</strong></span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {menu && createPortal(menu, document.body)}
    </div>
  );
}

export default function JobFilters({ filters, onFilterChange, workTypes, employmentTypes, experienceLevels, salaryRanges, onClearFilters, hasActiveFilters }) {
  return (
    <aside className="filters-sidebar" aria-label="Job filters">
      <div className="filters-header">
        <h2 className="filters-title">Filters</h2>
        {hasActiveFilters && (
          <button className="clear-filters-btn" onClick={onClearFilters}>
            Clear all
          </button>
        )}
      </div>

      <div className="filter-group">
        <h3 className="filter-group-title">Work type</h3>
        <div className="filter-buttons">
          {workTypes.map(type => (
            <button
              key={type}
              className={`filter-chip ${filters.workType === type ? 'active' : ''}`}
              onClick={() => onFilterChange('workType', type)}
              aria-pressed={filters.workType === type}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <h3 className="filter-group-title">Employment</h3>
        <div className="filter-buttons">
          {employmentTypes.map(type => (
            <button
              key={type}
              className={`filter-chip ${filters.employmentType === type ? 'active' : ''}`}
              onClick={() => onFilterChange('employmentType', type)}
              aria-pressed={filters.employmentType === type}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <h3 className="filter-group-title">Experience level</h3>
        <FilterDropdown
          label="Experience"
          options={experienceLevels}
          selected={filters.experienceLevel}
          onChange={(val) => onFilterChange('experienceLevel', val)}
          getOptionKey={(opt) => opt}
          getOptionLabel={(opt) => opt}
          getOptionValue={(opt) => opt}
        />
      </div>

      <div className="filter-group">
        <h3 className="filter-group-title">Minimum salary</h3>
        <FilterDropdown
          label="Salary"
          options={salaryRanges}
          selected={filters.salary}
          onChange={(val) => onFilterChange('salary', val)}
          getOptionKey={(opt) => opt.label}
          getOptionLabel={(opt) => opt.label}
          getOptionValue={(opt) => opt.value}
        />
      </div>
    </aside>
  );
}
