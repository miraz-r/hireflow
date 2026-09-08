import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import './AccessibilityPage.css';

const PRACTICES = [
  {
    num: '01',
    title: 'Semantic HTML & ARIA',
    desc: 'We design and develop with WCAG 2.1 AA compliance as a target, using semantic HTML and ARIA attributes to ensure screen reader compatibility.',
  },
  {
    num: '02',
    title: 'Keyboard Navigation',
    desc: 'Every interactive element on HireFlow can be reached and operated using only a keyboard. Focus states are clearly visible and follow a logical order.',
  },
  {
    num: '03',
    title: 'Color Contrast',
    desc: 'We maintain sufficient color contrast ratios throughout the interface. Text, icons, and interactive controls remain readable across light and dark surfaces.',
  },
  {
    num: '04',
    title: 'Assistive Technology Testing',
    desc: 'We test with assistive technologies including screen readers and keyboard-only navigation. Real user feedback directly shapes our priorities.',
  },
  {
    num: '05',
    title: 'Inclusive Design Principles',
    desc: 'We train our team on accessibility best practices and inclusive design principles, ensuring access is considered at every stage rather than added later.',
  },
  {
    num: '06',
    title: 'Continuous Improvement',
    desc: 'We actively work to address accessibility gaps in legacy content and new features. Your feedback helps us identify barriers and prioritize fixes quickly.',
  },
];

export default function AccessibilityPage() {
  return (
    <div className="accessibility-page">
      <section className="accessibility-hero">
        <div className="accessibility-hero-glow" aria-hidden="true" />
        <div className="accessibility-hero-glow accessibility-hero-glow--secondary" aria-hidden="true" />
        <div className="container accessibility-hero-layout">
          <div className="accessibility-hero-content">
            <span className="accessibility-hero-eyebrow">Inclusive by design</span>
            <h1 className="accessibility-hero-title">Accessibility</h1>
            <p className="accessibility-hero-desc">
              Our commitment to making HireFlow usable and accessible for everyone.
            </p>
          </div>
          <div className="accessibility-hero-visual">
            <div className="accessibility-hero-visual-card">
              <span className="accessibility-hero-visual-label">Standard</span>
              <div className="accessibility-hero-visual-count">WCAG 2.1 AA</div>
              <span className="accessibility-hero-visual-desc">Our accessibility target</span>
            </div>
          </div>
        </div>
      </section>

      <section className="accessibility-commitment">
        <div className="container">
          <Reveal>
            <span className="accessibility-section-eyebrow">Our commitment</span>
            <h2 className="accessibility-commitment-heading">
              Accessibility is not an afterthought.
            </h2>
            <p className="accessibility-commitment-body">
              HireFlow is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply relevant accessibility standards at every stage of design and development. If you experience any difficulty using HireFlow or have suggestions for improving accessibility, please contact us at <a href="mailto:accessibility@hireflow.com">accessibility@hireflow.com</a>. We take all feedback seriously and respond within two business days.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="accessibility-practices">
        <div className="container">
          <Reveal>
            <span className="accessibility-section-eyebrow">What we do</span>
            <h2 className="accessibility-practices-heading">Practices that guide our work.</h2>
          </Reveal>
          <div className="accessibility-practices-grid">
            {PRACTICES.map((p, i) => (
              <Reveal key={p.num} delay={100 + i * 80}>
                <div className="accessibility-practice-card">
                  <span className="accessibility-practice-number">{p.num}</span>
                  <h3 className="accessibility-practice-title">{p.title}</h3>
                  <p className="accessibility-practice-desc">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="accessibility-known">
        <div className="container">
          <Reveal>
            <span className="accessibility-section-eyebrow">Transparency</span>
            <h2 className="accessibility-known-heading">Known limitations.</h2>
            <div className="accessibility-known-card">
              <p className="accessibility-known-body">
                While we strive for full accessibility, some legacy content may not yet meet our target standards. We are actively working to address these gaps. If you encounter a barrier, please let us know — your feedback directly shapes our priorities.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="accessibility-feedback">
        <div className="container">
          <Reveal>
            <h2 className="accessibility-feedback-heading">We want to hear from you.</h2>
            <p className="accessibility-feedback-desc">
              Your experience matters. If you have suggestions for improving accessibility on HireFlow, contact our team at <a href="mailto:accessibility@hireflow.com">accessibility@hireflow.com</a>. We respond within two business days and use every message to guide our priorities.
            </p>
            <a href="mailto:accessibility@hireflow.com" className="btn btn-primary btn-lg accessibility-feedback-btn">
              Send accessibility feedback
            </a>
            <Link to="/" className="btn btn-secondary btn-lg accessibility-return-btn">Return to homepage</Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
