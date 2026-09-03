import { useState, useMemo, useCallback } from 'react';
import { jobs, categories, companies, popularSearches, workTypes, employmentTypes, experienceLevels, salaryRanges } from './data/mockData';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import TrustStrip from './components/TrustStrip';
import CategorySection from './components/CategorySection';
import JobFilters from './components/JobFilters';
import JobCard from './components/JobCard';
import CompanySection from './components/CompanySection';
import ValueSection from './components/ValueSection';
import CTA from './components/CTA';
import Footer from './components/Footer';
import Toast from './components/Toast';
import './App.css';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [filters, setFilters] = useState({ workType: null, employmentType: null, experienceLevel: null, salary: null });
  const [savedJobs, setSavedJobs] = useState(new Set());
  const [activeCategory, setActiveCategory] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = job.title.toLowerCase().includes(q) || job.company.toLowerCase().includes(q) || job.skills.some(s => s.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (locationQuery && !job.location.toLowerCase().includes(locationQuery.toLowerCase())) return false;
      if (filters.workType && job.workType !== filters.workType) return false;
      if (filters.employmentType && job.employmentType !== filters.employmentType) return false;
      if (filters.experienceLevel && job.experienceLevel !== filters.experienceLevel) return false;
      if (filters.salary?.min && job.salary.min < filters.salary.min) return false;
      if (activeCategory && job.category !== activeCategory) return false;
      return true;
    });
  }, [searchQuery, locationQuery, filters, activeCategory]);

  const handleSearch = useCallback((query, location) => {
    setSearchQuery(query);
    setLocationQuery(location);
    setActiveCategory(null);
  }, []);

  // Real-time search updates - single source of truth for the query
  const handleQueryChange = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  const handleLocationChange = useCallback((location) => {
    setLocationQuery(location);
  }, []);

  const handleFilterChange = useCallback((name, value) => {
    setFilters(prev => {
      const current = prev[name];
      // Compare by value (handles object values like salary)
      const isSame = JSON.stringify(current) === JSON.stringify(value);
      return { ...prev, [name]: isSame ? null : value };
    });
  }, []);

  const handleCategorySelect = useCallback((name) => {
    setActiveCategory(prev => prev === name ? null : name);
    setSearchQuery('');
  }, []);

  const handleSaveJob = useCallback((id) => {
    setSavedJobs(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); showToast('Removed from saved'); }
      else { next.add(id); showToast('Job saved'); }
      return next;
    });
  }, [showToast]);

  const clearFilters = useCallback(() => {
    setFilters({ workType: null, employmentType: null, experienceLevel: null, salary: null });
    setActiveCategory(null);
  }, []);

  const hasActiveFilters = filters.workType || filters.employmentType || filters.experienceLevel || filters.salary || activeCategory;

  return (
    <div className="app">
      <Navbar />
      <main>
        <Hero
          onSearch={handleSearch}
          onQueryChange={handleQueryChange}
          onLocationChange={handleLocationChange}
          searchQuery={searchQuery}
          locationQuery={locationQuery}
          popularSearches={popularSearches}
        />
        <TrustStrip />
        <section className="jobs-section" id="jobs">
          <div className="container">
            <CategorySection categories={categories} activeCategory={activeCategory} onCategorySelect={handleCategorySelect} />
            <div className="jobs-layout">
              <JobFilters filters={filters} onFilterChange={handleFilterChange} workTypes={workTypes} employmentTypes={employmentTypes} experienceLevels={experienceLevels} salaryRanges={salaryRanges} onClearFilters={clearFilters} hasActiveFilters={hasActiveFilters} />
              <div className="jobs-results">
                <div className="results-header">
                  <h2 className="results-title">{activeCategory ? `${activeCategory} Jobs` : searchQuery ? 'Search Results' : 'Featured Jobs'}</h2>
                  <span className="results-count">{filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'} found</span>
                </div>
                {filteredJobs.length > 0 ? (
                  <div className="jobs-grid">{filteredJobs.map(job => (<JobCard key={job.id} job={job} isSaved={savedJobs.has(job.id)} onSave={() => handleSaveJob(job.id)} />))}</div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
                    <h3>No jobs found</h3>
                    <p>Try adjusting your search or filters to find more opportunities.</p>
                    <button className="btn btn-secondary" onClick={clearFilters}>Clear all filters</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
        <CompanySection companies={companies} />
        <ValueSection />
        <CTA />
      </main>
      <Footer />
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}