import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { categories, companies, popularSearches, workTypes, employmentTypes, experienceLevels, salaryRanges } from './data/mockData';
import { fetchJobs } from './utils/jobsApi';
import { useAuth } from './context/AuthContext';
import { apiGet, apiPost, apiDelete } from './utils/api';
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
import ScrollToTop from './components/ScrollToTop';
import PageTransition from './components/PageTransition';
import Toast from './components/Toast';
import Reveal from './components/Reveal';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import JobDetailPage from './pages/JobDetailPage';
import ApplyPage from './pages/ApplyPage';
import SavedJobsPage from './pages/SavedJobsPage';
import ResourcesPage from './pages/ResourcesPage';
import ResourceDetailPage from './pages/ResourceDetailPage';
import SalaryGuidePage from './pages/SalaryGuidePage';
import AboutPage from './pages/AboutPage';
import BlogPage from './pages/BlogPage';
import InfoPage from './pages/InfoPage';
import './App.css';

export default function App() {
  const { loading: authLoading, user } = useAuth();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [filters, setFilters] = useState({ workType: null, employmentType: null, experienceLevel: null, salary: null });
  const [savedJobs, setSavedJobs] = useState(new Set());
  const [activeCategory, setActiveCategory] = useState(null);
  const [toast, setToast] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 12;

  // Load saved jobs from the backend for authenticated jobseekers.
  useEffect(() => {
    if (!user || user.role !== 'jobseeker') {
      setSavedJobs(new Set());
      return;
    }
    let cancelled = false;
    apiGet('/saved-jobs', { timeout: 4000 })
      .then((res) => {
        if (cancelled) return;
        const ids = (res.data?.savedJobs || []).map((j) => j.id);
        setSavedJobs(new Set(ids));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  // Stable target for the "Featured Jobs" section. When a filter changes we
  // scroll this section to the top of the viewport so the filtered results are
  // immediately visible, no matter where the user currently is on the page.
  const featuredJobsRef = useRef(null);
  // Skip the scroll on the very first render (initial page load) so the user
  // lands at the top of the homepage, not auto-flung to the Featured Jobs view.
  const firstFilterRender = useRef(true);

  // Load jobs from the API (falls back to mock data if the backend is down).
  useEffect(() => {
    let cancelled = false;
    fetchJobs()
      .then((data) => {
        if (!cancelled) setJobs(data);
      })
      .finally(() => {
        if (!cancelled) setJobsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
  }, [jobs, searchQuery, locationQuery, filters, activeCategory]);

  const handleSearch = useCallback((query, location) => {
    setSearchQuery(query);
    setLocationQuery(location);
    setActiveCategory(null);
    setCurrentPage(1);
  }, []);

  // Real-time search updates - single source of truth for the query
  const handleQueryChange = useCallback((query) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  const handleLocationChange = useCallback((location) => {
    setLocationQuery(location);
    setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback((name, value) => {
    setFilters(prev => {
      const current = prev[name];
      // Compare by value (handles object values like salary)
      const isSame = JSON.stringify(current) === JSON.stringify(value);
      return { ...prev, [name]: isSame ? null : value };
    });
    setCurrentPage(1);
  }, []);

  const handleCategorySelect = useCallback((name) => {
    setActiveCategory(prev => prev === name ? null : name);
    setSearchQuery('');
    setCurrentPage(1);
  }, []);

  const handleSaveJob = useCallback(async (id) => {
    if (!user) {
      showToast('Please sign in to save jobs');
      return;
    }
    if (user.role !== 'jobseeker') return;

    const isCurrentlySaved = savedJobs.has(id);

    // Optimistic update
    setSavedJobs((prev) => {
      const next = new Set(prev);
      if (isCurrentlySaved) next.delete(id);
      else next.add(id);
      return next;
    });

    try {
      if (isCurrentlySaved) {
        await apiDelete(`/saved-jobs/${id}`, { timeout: 8000 });
        showToast('Removed from saved');
      } else {
        await apiPost('/saved-jobs', { jobId: id }, { timeout: 8000 });
        showToast('Job saved');
      }
    } catch {
      // Revert on failure
      setSavedJobs((prev) => {
        const next = new Set(prev);
        if (isCurrentlySaved) next.add(id);
        else next.delete(id);
        return next;
      });
      showToast('Unable to update saved job');
    }
  }, [user, savedJobs, showToast]);

  const clearFilters = useCallback(() => {
    setFilters({ workType: null, employmentType: null, experienceLevel: null, salary: null });
    setActiveCategory(null);
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = filters.workType || filters.employmentType || filters.experienceLevel || filters.salary || activeCategory;

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedJobs = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredJobs.slice(start, start + PAGE_SIZE);
  }, [filteredJobs, safePage]);

  const goToPage = useCallback((page) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  }, [totalPages]);

  // Scroll to the top of the Featured Jobs results when the user changes page
  // via pagination. Uses requestAnimationFrame so the DOM has updated with the
  // new page's job cards before we scroll.
  useEffect(() => {
    if (!featuredJobsRef.current) return;
    requestAnimationFrame(() => {
      featuredJobsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [currentPage]);

  // After a filter change, bring the user to the top of the Featured Jobs
  // section so the freshly-filtered results are immediately visible. Runs in a
  // passive effect (after the new results have rendered) and only when the
  // effective filter state actually changed — never on normal scrolling, which
  // does not alter `filters`/`activeCategory`. The initial render is skipped so
  // the homepage is not auto-scrolled on first load.
  useEffect(() => {
    if (firstFilterRender.current) {
      firstFilterRender.current = false;
      return;
    }
    featuredJobsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, activeCategory]);

  // Wait for the AuthProvider to finish restoring the session before
  // rendering the rest of the app, so we don't briefly flash an
  // unauthenticated state for a user with a valid stored JWT.
  if (authLoading) {
    return <div className="app app-loading" aria-busy="true" />;
  }

  return (
    <div className="app">
      <ScrollToTop />
      <Navbar />
      <main>
        <PageTransition>
          <Routes>
          <Route path="/" element={
            <HomePage
              searchQuery={searchQuery}
              locationQuery={locationQuery}
              filters={filters}
              savedJobs={savedJobs}
              activeCategory={activeCategory}
              hasActiveFilters={hasActiveFilters}
              jobsLoading={jobsLoading}
              filteredJobs={filteredJobs}
              paginatedJobs={paginatedJobs}
              currentPage={safePage}
              totalPages={totalPages}
              featuredJobsRef={featuredJobsRef}
              onPageChange={goToPage}
              onSearch={handleSearch}
              onQueryChange={handleQueryChange}
              onLocationChange={handleLocationChange}
              onFilterChange={handleFilterChange}
              onCategorySelect={handleCategorySelect}
              onSaveJob={handleSaveJob}
              onClearFilters={clearFilters}
              user={user}
            />
          } />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
          <Route path="/jobs/:id/apply" element={<ApplyPage />} />
          <Route path="/resources/:slug" element={<ResourceDetailPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/salary-guide" element={<SalaryGuidePage />} />
          <Route path="/saved-jobs" element={<SavedJobsPage />} />
          <Route path="/career-advice" element={<InfoPage />} />
          <Route path="/pricing" element={<InfoPage />} />
          <Route path="/talent-search" element={<InfoPage />} />
          <Route path="/solutions" element={<InfoPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/careers" element={<InfoPage />} />
          <Route path="/press" element={<InfoPage />} />
          <Route path="/privacy" element={<InfoPage />} />
          <Route path="/terms" element={<InfoPage />} />
          <Route path="/cookie-policy" element={<InfoPage />} />
          <Route path="/accessibility" element={<InfoPage />} />
        </Routes>
        </PageTransition>
      </main>
      {location.pathname !== '/login' && location.pathname !== '/register' && <Footer />}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
function HomePage({
  searchQuery, locationQuery, filters, savedJobs, activeCategory,
  hasActiveFilters, jobsLoading, filteredJobs, paginatedJobs, currentPage, totalPages,
  featuredJobsRef, onPageChange,
  onSearch, onQueryChange, onLocationChange,
  onFilterChange, onCategorySelect, onSaveJob, onClearFilters, user,
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
        user={user}
      />
      <Reveal><TrustStrip /></Reveal>
      <section className="jobs-section" id="jobs" ref={featuredJobsRef}>
        <div className="container">
          <Reveal>
            <CategorySection categories={categories} activeCategory={activeCategory} onCategorySelect={onCategorySelect} />
          </Reveal>
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
              {jobsLoading ? (
                <div className="jobs-loading" role="status" aria-live="polite">
                  <span className="jobs-loading-text">Loading jobs…</span>
                </div>
              ) : filteredJobs.length > 0 ? (
                <>
                  <div className="jobs-grid">{paginatedJobs.map(job => (<JobCard key={job.id} job={job} isSaved={savedJobs.has(job.id)} onSave={() => onSaveJob(job.id)} />))}</div>
                  {totalPages > 1 && (
                    <nav className="pagination" aria-label="Job list pagination">
                      <button
                        type="button"
                        className="pagination-btn"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                        aria-label="Previous page"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
                        <span>Previous</span>
                      </button>
                      <div className="pagination-pages">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            type="button"
                            className={`pagination-page ${page === currentPage ? 'active' : ''}`}
                            onClick={() => onPageChange(page)}
                            aria-label={`Page ${page}`}
                            aria-current={page === currentPage ? 'page' : undefined}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="pagination-btn"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        aria-label="Next page"
                      >
                        <span>Next</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    </nav>
                  )}
                </>
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
      <Reveal><CompanySection companies={companies} /></Reveal>
      <Reveal><ValueSection /></Reveal>
      <Reveal><CTA /></Reveal>
    </>
  );
}
