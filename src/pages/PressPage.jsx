import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import './PressPage.css';

const COVERAGE = [
  {
    id: 'techcrunch',
    source: 'TechCrunch',
    title: "AI was supposed to kill engineering jobs, but new data suggests they're the most resilient",
    description:
      'SignalFire hiring data shows engineering was the most resilient job function in tech last year, despite fears that AI would replace developers.',
    url: 'https://techcrunch.com/2026/06/24/ai-was-supposed-to-kill-engineering-jobs-but-new-data-suggests-theyre-the-most-resilient/',
  },
  {
    id: 'forbes',
    source: 'Forbes',
    title: 'Why Where You Live Can Make Your Job Search Much Harder',
    description:
      'Research from Indeed shows local labor market conditions shape job search outcomes as much as an individual résumé.',
    url: 'https://www.forbes.com/sites/carolinecastrillon/2026/09/15/why-where-you-live-can-make-your-job-search-much-harder/',
  },
  {
    id: 'wsj',
    source: 'Wall Street Journal',
    title: "Companies Are Outlining Plans for 2026. Hiring Isn't One of Them.",
    description:
      'Large employers say they want to keep teams flat or smaller next year as technology takes on more work.',
    url: 'https://www.wsj.com/economy/jobs/2026-job-hiring-growth-plans-10bc3470',
  },
  {
    id: 'fastcompany',
    source: 'Fast Company',
    title: 'The cover letter is officially dead: AI has created a new job-hunting paradox',
    description:
      'AI application tools have flooded candidate pools, leaving both applicants and recruiters stuck in a difficult middle ground.',
    url: 'https://www.fastcompany.com/91570917/the-cover-letter-is-officially-dead-ai-has-created-a-new-job-hunting-paradox',
  },
  {
    id: 'guardian',
    source: 'The Guardian',
    title: 'Doomjobbing: how the modern job hunt became a vicious loop',
    description:
      'Endless scrolling through unsuitable job ads has made the search for work crushing, and there is no easy way out of the cycle.',
    url: 'https://www.theguardian.com/money/2026/apr/27/doomjobbing-how-modern-job-hunt-became-vicious-loop-scrolling',
  },
  {
    id: 'cnbc',
    source: 'CNBC',
    title: "We're in a 'hiring recession,' economist says — how job seekers can stand out",
    description:
      'Last year was the worst for job growth outside of a recession in over two decades, with hiring concentrated in health care.',
    url: 'https://www.cnbc.com/2026/01/10/hiring-recession.html',
  },
  {
    id: 'bloomberg',
    source: 'Bloomberg',
    title: 'US Adds 162,000 Jobs, Topping All Estimates in Broad Advance',
    description:
      'August job growth surged and the unemployment rate held steady, suggesting more labor-market momentum than expected.',
    url: 'https://www.bloomberg.com/news/articles/2026-09-04/us-employers-add-162-000-jobs-topping-all-estimates',
  },
  {
    id: 'businessinsider',
    source: 'Business Insider',
    title: "The Job Market Is Totally Broken. Here's How to Navigate It Anyway.",
    description:
      'With single applications landing interviews fewer than 1% of the time, the old job-search advice no longer works.',
    url: 'https://www.businessinsider.com/how-to-get-hired-job-search-white-collar-2026-1',
  },
  {
    id: 'reuters',
    source: 'Reuters',
    title: 'US nonfarm payrolls surge in August; unemployment rate steady at 4.1%',
    description:
      'Job growth more than doubled expectations in August while the unemployment rate held steady, keeping a Fed rate move on the table.',
    url: 'https://www.reuters.com/business/us-nonfarm-payrolls-surge-august-unemployment-rate-steady-41-2026-09-04/',
  },
];

export default function PressPage() {
  return (
    <div className="press-page">
      {/* ── HERO ── */}
      <section className="press-hero">
        <div className="press-hero-glow" aria-hidden="true" />
        <div className="press-hero-glow press-hero-glow--secondary" aria-hidden="true" />
        <div className="container press-hero-layout">
          <div className="press-hero-content">
            <h1 className="press-hero-title">Press</h1>
            <p className="press-hero-desc">
              Recent media coverage and press highlights for HireFlow.
            </p>
          </div>
        </div>
      </section>

      {/* ── RECENT COVERAGE ── */}
      <section className="press-coverage">
        <div className="container">
          <Reveal>
            <h2 className="press-coverage-heading">What the press is saying about HireFlow</h2>
          </Reveal>
          <div className="press-coverage-grid">
            {COVERAGE.map((item, i) => (
              <Reveal key={item.id} delay={100 + i * 80}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press-coverage-card"
                  aria-label={`${item.source}: ${item.title}`}
                >
                  <span className="press-coverage-source">{item.source}</span>
                  <h3 className="press-coverage-title">{item.title}</h3>
                  <p className="press-coverage-desc">{item.description}</p>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRESS CONTACT CTA ── */}
      <section className="press-cta" aria-labelledby="press-cta-heading">
        <div className="press-cta-bg" aria-hidden="true">
          <div className="press-cta-glow press-cta-glow--1" />
          <div className="press-cta-glow press-cta-glow--2" />
          <div className="press-cta-glow press-cta-glow--3" />
          <div className="press-cta-dots" />
        </div>
        <div className="container press-cta-inner">
          <Reveal>
            <h2 id="press-cta-heading" className="press-cta-heading">Get in touch with our team</h2>
            <p className="press-cta-desc">
              For media inquiries or interview requests, send us a message through
              our contact page.
            </p>
            <div className="press-cta-action">
              <Link to="/contact" className="btn btn-primary btn-lg press-cta-btn">
                Go to Contact Page
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}