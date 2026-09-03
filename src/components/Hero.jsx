import { useState, useEffect } from 'react';
import './Hero.css';

export default function Hero({ onSearch, onQueryChange, onLocationChange, searchQuery, locationQuery, popularSearches }) {
  // Local state for input display
  const [localQuery, setLocalQuery] = useState(searchQuery || '');
  const [localLocation, setLocalLocation] = useState(locationQuery || '');
  // Track which popular keyword is currently selected (for bidirectional sync)
  const [selectedKeyword, setSelectedKeyword] = useState(null);

  // Sync local state when parent state changes externally
  useEffect(() => {
    setLocalQuery(searchQuery || '');
  }, [searchQuery]);

  useEffect(() => {
    setLocalLocation(locationQuery || '');
  }, [locationQuery]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(localQuery.trim(), localLocation.trim());
  };

  const handleQueryChange = (e) => {
    const value = e.target.value;
    setLocalQuery(value);
    onQueryChange(value); // Real-time update to parent state

    // Check if typed value exactly matches a popular keyword
    const matched = popularSearches.find(k => k.toLowerCase() === value.toLowerCase());
    setSelectedKeyword(matched || null);
  };

  const handleLocationChange = (e) => {
    const value = e.target.value;
    setLocalLocation(value);
    onLocationChange(value); // Real-time update to parent state
  };

  const handlePopularClick = (term) => {
    // If clicking the already-selected keyword, clear the search
    if (selectedKeyword === term) {
      setLocalQuery('');
      setLocalLocation('');
      setSelectedKeyword(null);
      onQueryChange('');
      onLocationChange('');
    } else {
      // Select the keyword
      setLocalQuery(term);
      setLocalLocation('');
      setSelectedKeyword(term);
      onQueryChange(term);
      onLocationChange('');
    }
  };

  return (
    <section className="hero">
      <div className="container">
        <div className="hero-content">
          <span className="hero-eyebrow">
            <span className="eyebrow-dot"></span>
            <span>Now with 2,400+ new opportunities</span>
          </span>
          
          <h1 className="hero-headline">
            Find work <span className="hero-highlight">worth working for.</span>
          </h1>
          
          <p className="hero-subheadline">
            Discover opportunities that match your skills, values, and ambitions. 
            HireFlow connects ambitious professionals with companies that care.
          </p>

          <form className="search-form" onSubmit={handleSubmit} role="search">
            <div className="search-fields">
              <div className="search-field">
                <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
                <div className="search-input-wrap">
                  <label htmlFor="hero-search" className="search-label">Job title, skill, or company</label>
                  <input
                    id="hero-search"
                    type="text"
                    value={localQuery}
                    onChange={handleQueryChange}
                    placeholder="Job title, skill, or company"
                    className="search-input"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="search-divider" aria-hidden="true"></div>

              <div className="search-field">
                <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <div className="search-input-wrap">
                  <label htmlFor="hero-location" className="search-label">Location</label>
                  <input
                    id="hero-location"
                    type="text"
                    value={localLocation}
                    onChange={handleLocationChange}
                    placeholder="San Francisco, Remote..."
                    className="search-input"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            <button type="submit" className="search-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <span>Search jobs</span>
            </button>
          </form>

          <div className="popular-searches">
            <span className="popular-label">Popular:</span>
            {popularSearches.map(term => (
              <button
                key={term}
                className={`popular-tag ${selectedKeyword === term ? 'popular-tag--selected' : ''}`}
                onClick={() => handlePopularClick(term)}
                type="button"
                aria-pressed={selectedKeyword === term}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}