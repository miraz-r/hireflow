import { useState, useMemo, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { jobs, categories, companies, popularSearches, workTypes, employmentTypes, experienceLevels, salaryRanges } from './data/mockData';
import { useAuth } from './context/AuthContext';
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
import LoginPage from './pages/LoginPage';
import './App.css';

export default function App() {
  const { loading: authLoading } = useAuth();
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

  // Wait for the AuthProvider to finish restoring the session before
  // rendering the rest of the app, so we don't briefly flash an
  // unauthenticated state for a user with a valid stored JWT.
  if (authLoading) {
    return <div className="app app-loading" aria-busy="true" />;
  }

  return (
    <div className="app">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={
            <HomePage
              searchQuery={searchQuery}
              locationQuery={locationQuery}
              filters={filters}
              savedJobs={savedJobs}
              activeCategory={activeCategory}
              hasActiveFilters={hasActiveFilters}
              filteredJobs={filteredJobs}
              onSearch={handleSearch}
              onQueryChange={handleQueryChange}
              onLocationChange={handleLocationChange}
              onFilterChange={handleFilterChange}
              onCategorySelect={handleCategorySelect}
              onSaveJob={handleSaveJob}
              onClearFilters={clearFilters}
            />
          } />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<PlaceholderPage title="Create your account" subtitle="Join HireFlow and start your journey." />} />
        </Routes>
      </main>
      <Footer />
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
function HomePage({
  searchQuery, locationQuery, filters, savedJobs, activeCategory,
  hasActiveFilters, filteredJobs,
  onSearch, onQueryChange, onLocationChange,
  onFilterChange, onCategorySelect, onSaveJob, onClearFilters,
}) {
  return (
    <>
      <Hero
        onSearch={onSearch}
        onQueryChange={onQueryChange}
        onLocationChange={onLocationChange}
        searchQuery={searchQuery}
        locationQuery={locationQuery}
        popularSearches={popularSearches}
      />
      <TrustStrip />
      <section className="jobs-section" id="jobs">
        <div className="container">
          <CategorySection categories={categories} activeCategory={activeCategory} onCategorySelect={onCategorySelect} />
          <div className="jobs-layout">
            <JobFilters
              filters={filters}
              onFilterChange={onFilterChange}
              workTypes={workTypes}
              employmentTypes={employmentTypes}
              experienceLevels={experienceLevels}
              salaryRanges={salaryRanges}
              onClearFilters={onClearFilters}
              hasActiveFilters={hasActiveFilters}
            />
            <div className="jobs-results">
              <div className="results-header">
                <h2 className="results-title">{activeCategory ? `${activeCategory} Jobs` : searchQuery ? 'Search Results' : 'Featured Jobs'}</h2>
                <span className="results-count">{filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'} found</span>
              </div>
              {filteredJobs.length > 0 ? (
                <div className="jobs-grid">{filteredJobs.map(job => (<JobCard key={job.id} job={job} isSaved={savedJobs.has(job.id)} onSave={() => onSaveJob(job.id)} />))}</div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
                  <h3>No jobs found</h3>
                  <p>Try adjusting your search or filters to find more opportunities.</p>
                  <button className="btn btn-secondary" onClick={onClearFilters}>Clear all filters</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      <CompanySection companies={companies} />
      <ValueSection />
      <CTA />
    </>
  );
}
function PlaceholderPage({ title, subtitle }) {
  return (
    <div style={{ padding: '80px 0', textAlign: 'center' }}>
      <div className="container">
        <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>{title}</h1>
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>{subtitle}</p>
      </div>
    </div>
  );
}