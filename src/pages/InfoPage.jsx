import { useLocation, Link } from 'react-router-dom';
import './InfoPage.css';

const CONTENT = {
  '/resources': {
    title: 'Resources',
    eyebrow: 'Learn & grow',
    description:
      'Guides, tips, and tools to help you search smarter, interview with confidence, and build the career you want.',
  },
  '/salary-guide': {
    title: 'Salary Guide',
    eyebrow: 'Compensation',
    description:
      'Transparent salary benchmarks across roles, experience levels, and locations to help you negotiate with confidence.',
  },
  '/saved-jobs': {
    title: 'Saved Jobs',
    eyebrow: 'Your shortlist',
    description:
      'Jobs you save while browsing will live here so you can compare opportunities and apply when you are ready.',
  },
  '/career-advice': {
    title: 'Career Advice',
    eyebrow: 'Guidance',
    description:
      'Practical advice on resumes, interviews, and navigating your next career move from the HireFlow team.',
  },
  '/pricing': {
    title: 'Pricing',
    eyebrow: 'Plans',
    description:
      'Simple, transparent pricing for jobseekers and employers. Posting a job and applying are free to get started.',
  },
  '/talent-search': {
    title: 'Talent Search',
    eyebrow: 'For employers',
    description:
      'Find and connect with qualified candidates across engineering, design, product, and more.',
  },
  '/solutions': {
    title: 'Solutions',
    eyebrow: 'How HireFlow helps',
    description:
      'Learn how HireFlow powers hiring for companies of every size — from first job posting to final offer.',
  },
  '/about': {
    title: 'About Us',
    eyebrow: 'Our story',
    description:
      'HireFlow connects talent with opportunity. We are building a calmer, clearer job marketplace for everyone.',
  },
  '/blog': {
    title: 'Blog',
    eyebrow: 'Insights',
    description:
      'Stories, guides, and hiring insights from the HireFlow team.',
  },
  '/careers': {
    title: 'Careers',
    eyebrow: 'Join the team',
    description:
      'Interested in building the future of work with us? We are always looking for passionate people.',
  },
  '/press': {
    title: 'Press',
    eyebrow: 'Media',
    description:
      'Press releases, media kits, and contact information for journalists covering HireFlow.',
  },
  '/privacy': {
    title: 'Privacy Policy',
    eyebrow: 'Legal',
    description:
      'How HireFlow collects, uses, and protects your personal information.',
  },
  '/terms': {
    title: 'Terms of Service',
    eyebrow: 'Legal',
    description:
      'The terms that govern your use of the HireFlow platform and services.',
  },
  '/cookie-policy': {
    title: 'Cookie Policy',
    eyebrow: 'Legal',
    description:
      'How HireFlow and our partners use cookies to improve your experience.',
  },
  '/accessibility': {
    title: 'Accessibility',
    eyebrow: 'Inclusive by design',
    description:
      'Our commitment to making HireFlow usable and accessible for everyone.',
  },
};

export default function InfoPage() {
  const { pathname } = useLocation();
  const content = CONTENT[pathname] || {
    title: 'Page',
    eyebrow: 'HireFlow',
    description: 'This page is on its way. Check back soon.',
  };

  return (
    <div className="info-page">
      <div className="container">
        <div className="card info-card">
          <span className="section-eyebrow">{content.eyebrow}</span>
          <h1 className="info-title">{content.title}</h1>
          <p className="info-description">{content.description}</p>
          <p className="info-note">Something new is coming here soon.</p>
          <div className="info-actions">
            <Link to="/" className="btn btn-primary">Browse jobs</Link>
            <Link to="/register" className="btn btn-secondary">Create an account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
