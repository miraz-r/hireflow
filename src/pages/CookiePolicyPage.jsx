import { useEffect, useRef, useState } from 'react';
import './CookiePolicyPage.css';

const SECTIONS = [
  {
    id: 'what-are-cookies',
    toc: 'What Are Cookies',
    heading: 'What Are Cookies',
    body: `Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences, keep you logged in, and understand how you use the platform. We use cookies to provide a smoother, more personalized experience across HireFlow.`,
  },
  {
    id: 'essential-cookies',
    toc: 'Essential Cookies',
    heading: 'Essential Cookies',
    body: `These cookies are required for HireFlow to function properly. They handle authentication, security, and basic site operations. Because they are necessary for the platform to work, you cannot opt out of essential cookies without disabling access to the service entirely.`,
  },
  {
    id: 'analytics-cookies',
    toc: 'Analytics Cookies',
    heading: 'Analytics Cookies',
    body: `We use analytics tools to understand how visitors interact with HireFlow — which pages are most popular, where users encounter issues, and how we can improve. This data is aggregated and anonymized. It does not identify individual users personally and is used solely to enhance the platform experience.`,
  },
  {
    id: 'managing-cookies',
    toc: 'Managing Cookies',
    heading: 'Managing Cookies',
    body: `You can control cookie preferences through your browser settings. Most browsers allow you to block or delete cookies while continuing to use websites. Disabling certain cookies may affect platform functionality, particularly analytics-related features, but essential operations will remain available.`,
  },
  {
    id: 'updates',
    toc: 'Updates',
    heading: 'Updates',
    body: `We may update this Cookie Policy as we add new features or change our analytics practices. We encourage you to review this page periodically to stay informed about how cookies are used on HireFlow. Continued use of the platform after any updates constitutes acceptance of the revised policy.`,
  },
  {
    id: 'contact',
    toc: 'Contact',
    heading: 'Contact',
    body: `If you have any questions about this Cookie Policy, please contact us at privacy@hireflow.com. We are committed to transparency and will respond to inquiries in a timely manner.`,
  },
];

const NAVBAR_HEIGHT = 68;

export default function CookiePolicyPage() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const activeRef = useRef(activeId);

  useEffect(() => {
    let raf = 0;
    const getReadingLine = () => {
      const remaining = window.innerHeight - NAVBAR_HEIGHT;
      return NAVBAR_HEIGHT + Math.max(0, remaining * 0.30);
    };
    const computeActive = () => {
      const readingLine = getReadingLine();
      let active = null;
      let closestDist = Infinity;
      let closestId = null;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) return SECTIONS[SECTIONS.length - 1].id;
      for (let i = 0; i < SECTIONS.length; i++) {
        const el = document.getElementById(SECTIONS[i].id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const top = rect.top;
        const bottom = rect.bottom;
        if (top <= readingLine && bottom > readingLine) {
          active = SECTIONS[i].id;
          closestDist = Infinity;
          closestId = null;
        } else {
          let dist = Infinity;
          if (bottom <= readingLine) dist = readingLine - bottom;
          else if (top > readingLine) dist = top - readingLine;
          if (dist < closestDist) {
            closestDist = dist;
            closestId = SECTIONS[i].id;
          }
        }
      }
      return active || closestId || SECTIONS[0].id;
    };
    const updateActive = () => {
      raf = 0;
      const next = computeActive();
      if (next !== activeRef.current) {
        activeRef.current = next;
        setActiveId(next);
      }
    };
    const scheduleUpdate = () => {
      if (!raf) raf = requestAnimationFrame(updateActive);
    };
    updateActive();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', updateActive);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', updateActive);
    };
  }, []);

  const handleTocClick = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - NAVBAR_HEIGHT - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <div className="privacy-page">
      <div className="privacy-header">
        <div className="privacy-header-glow" aria-hidden="true" />
        <div className="privacy-header-glow privacy-header-glow--secondary" aria-hidden="true" />
        <div className="container">
          <h1 className="privacy-title">Cookie Policy</h1>
          <p className="privacy-date">Last updated: August 2026</p>
        </div>
      </div>

      <div className="container">
        <div className="privacy-layout">
          <aside className="privacy-toc terms-toc-animated" aria-label="Table of contents">
            <nav className="privacy-toc-inner">
              <h2 className="privacy-toc-heading">Table of contents</h2>
              <ul className="privacy-toc-list">
                {SECTIONS.map(({ id, toc }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className={`privacy-toc-link${activeId === id ? ' privacy-toc-link--active' : ''}`}
                      onClick={(e) => handleTocClick(e, id)}
                    >
                      {toc}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <article className="privacy-content">
            {SECTIONS.map((section, i) => (
              <section key={section.id} id={section.id} className="privacy-section reveal-scroll">
                <h2 className="privacy-section-heading">{section.heading}</h2>
                <p className="privacy-section-body">{section.body}</p>
                {i < SECTIONS.length - 1 && <hr className="privacy-rule" />}
              </section>
            ))}
          </article>
        </div>
      </div>
    </div>
  );
}
