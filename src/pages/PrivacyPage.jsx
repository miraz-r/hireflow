import { useEffect, useRef, useState } from 'react';
import './PrivacyPage.css';

const SECTIONS = [
  {
    id: 'information-we-collect',
    heading: 'Information we collect',
    body: 'When you create an account, we collect your name, email address, and professional profile information you choose to provide. We also collect usage data such as pages viewed, search queries, and interactions with job listings to improve our platform.',
  },
  {
    id: 'how-we-use-your-information',
    heading: 'How we use your information',
    body: 'We use your information to provide and improve our services, match you with relevant opportunities, communicate about your account and job applications, and send optional career-related updates you can opt out of at any time.',
  },
  {
    id: 'data-sharing',
    heading: 'Data sharing',
    body: 'We do not sell your personal information. We share your profile with employers only when you apply to a job or explicitly opt in to candidate visibility. Aggregated, anonymized data may be used for market insights and reporting.',
  },
  {
    id: 'data-security',
    heading: 'Data security',
    body: 'We implement industry-standard encryption, access controls, and regular security audits to protect your data. All data is transmitted over encrypted connections and stored in secure, access-restricted environments.',
  },
  {
    id: 'your-rights',
    heading: 'Your rights',
    body: 'You can access, update, or delete your account data at any time from your profile settings. For additional requests, contact our privacy team. We respond to all data requests within 30 days.',
  },
  {
    id: 'contact',
    heading: 'Contact',
    body: 'If you have questions about this policy, contact us at privacy@hireflow.com.',
  },
];

const NAVBAR_HEIGHT = 68;

export default function PrivacyPage() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const activeRef = useRef(activeId);

  useEffect(() => {
    let raf = 0;

    const getReadingLine = () => {
      const navbarHeight = NAVBAR_HEIGHT;
      const remaining = window.innerHeight - navbarHeight;
      return navbarHeight + Math.max(0, remaining * 0.30);
    };

    const computeActive = () => {
      const readingLine = getReadingLine();
      let active = null;
      let closestDist = Infinity;
      let closestId = null;

      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      if (atBottom) {
        return SECTIONS[SECTIONS.length - 1].id;
      }

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
          if (bottom <= readingLine) {
            dist = readingLine - bottom;
          } else if (top > readingLine) {
            dist = top - readingLine;
          }
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
          <h1 className="privacy-title">Privacy Policy</h1>
          <p className="privacy-date">Last updated: August 2026</p>
        </div>
      </div>

      <div className="container">
        <div className="privacy-layout">
          <aside className="privacy-toc" aria-label="Table of contents">
            <nav className="privacy-toc-inner">
              <h2 className="privacy-toc-heading">Table of contents</h2>
              <ul className="privacy-toc-list">
                {SECTIONS.map(({ id, heading }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className={`privacy-toc-link${activeId === id ? ' privacy-toc-link--active' : ''}`}
                      onClick={(e) => handleTocClick(e, id)}
                    >
                      {heading}
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
