import { useState, useRef, useEffect } from 'react';
import './JobFilters.css';

function FilterDropdown({ label, options, selected, onChange, getOptionKey, getOptionLabel, getOptionValue }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (value) => {
    onChange(value);
    setOpen(false);
  };

  // Resolve the selected value to its display label by finding the matching option
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

  return (
    <div className="filter-dropdown" ref={ref}>
      <button
        className={`filter-trigger ${selectedIsActive ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{label}: <strong>{displayLabel || 'Any'}</strong></span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="filter-menu" role="listbox">
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
      )}
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