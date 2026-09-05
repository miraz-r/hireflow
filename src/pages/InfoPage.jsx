import { useLocation, Link } from 'react-router-dom';
import './InfoPage.css';

const PAGES = {
  '/resources': {
    title: 'Resources',
    eyebrow: 'Learn & grow',
    hero: 'Guides, tools, and insights to help you search smarter, interview with confidence, and build the career you want.',
    sections: [
      {
        type: 'cards',
        heading: 'Explore our resources',
        items: [
          { icon: '📄', title: 'Career Advice', description: 'Practical tips on resumes, interviews, and navigating your next career move.', link: '/career-advice' },
          { icon: '💰', title: 'Salary Guide', description: 'Transparent salary benchmarks across roles, experience levels, and locations.', link: '/salary-guide' },
          { icon: '🏢', title: 'Company Profiles', description: 'Research companies, culture, and open positions before you apply.', link: '/#companies' },
          { icon: '📊', title: 'Job Market Insights', description: 'Stay informed on hiring trends, in-demand skills, and market shifts.', link: '/blog' },
        ],
      },
      {
        type: 'text',
        heading: 'Why HireFlow?',
        body: 'We believe job searching should be transparent, efficient, and stress-free. Every resource on HireFlow is designed to give you an edge — whether you are exploring your first role or planning your next leadership position.',
      },
    ],
    cta: { label: 'Start browsing jobs', to: '/' },
  },

  '/salary-guide': {
    title: 'Salary Guide',
    eyebrow: 'Compensation',
    hero: 'Transparent salary benchmarks across roles, experience levels, and locations to help you negotiate with confidence.',
    sections: [
      {
        type: 'table',
        heading: 'Popular role salaries',
        headers: ['Role', 'Entry-level', 'Mid-level', 'Senior'],
        rows: [
          ['Frontend Engineer', '$95k – $120k', '$130k – $170k', '$170k – $220k'],
          ['Backend Engineer', '$100k – $125k', '$140k – $180k', '$180k – $230k'],
          ['Product Manager', '$90k – $115k', '$130k – $165k', '$165k – $210k'],
          ['UX Designer', '$80k – $105k', '$115k – $150k', '$150k – $195k'],
          ['Data Scientist', '$100k – $130k', '$140k – $180k', '$180k – $240k'],
          ['DevOps Engineer', '$95k – $120k', '$135k – $175k', '$175k – $225k'],
        ],
      },
      {
        type: 'text',
        heading: 'How to use salary data',
        body: 'These figures represent total compensation including base salary, bonuses, and equity where applicable. Actual offers vary by company size, location, and individual experience. Use these benchmarks as a starting point for negotiations, not a ceiling.',
      },
      {
        type: 'list',
        heading: 'Tips for negotiating',
        items: [
          'Research the company\'s compensation philosophy and pay bands before your offer conversation.',
          'Consider the full package — base salary, bonuses, equity, benefits, and flexibility all matter.',
          'Quantify your impact with specific metrics and outcomes from previous roles.',
          'Practice your negotiation conversation with a friend or mentor beforehand.',
          'Get the offer in writing before making a decision, and take time to evaluate it.',
        ],
      },
    ],
    cta: { label: 'Find roles matching your skills', to: '/' },
  },

  '/saved-jobs': {
    title: 'Saved Jobs',
    eyebrow: 'Your shortlist',
    hero: 'Jobs you save while browsing live here so you can compare opportunities and apply when you are ready.',
    sections: [
      {
        type: 'features',
        heading: 'How it works',
        items: [
          { icon: '🔖', title: 'Save with one click', description: 'Tap the bookmark icon on any job card to add it to your saved list instantly.' },
          { icon: '📋', title: 'Compare side by side', description: 'Review saved positions together to compare salaries, locations, and requirements.' },
          { icon: '✅', title: 'Apply when ready', description: 'Take your time evaluating each opportunity, then apply directly from your shortlist.' },
        ],
      },
    ],
    cta: { label: 'Browse jobs to save', to: '/' },
  },

  '/career-advice': {
    title: 'Career Advice',
    eyebrow: 'Guidance',
    hero: 'Practical advice on resumes, interviews, and navigating your next career move from the HireFlow team.',
    sections: [
      {
        type: 'cards',
        heading: 'Latest articles',
        items: [
          { icon: '📝', title: 'Writing a resume that gets interviews', description: 'How to structure your resume, highlight impact, and tailor it for each application without starting from scratch every time.' },
          { icon: '🎤', title: 'Acing the behavioral interview', description: 'Use the STAR method to tell compelling stories about your experience. We break down the most common questions and how to prepare.' },
          { icon: '🔄', title: 'When to make a career pivot', description: 'Signs it is time for a change, how to transfer skills between industries, and building credibility in a new field.' },
          { icon: '💼', title: 'Negotiating your first offer', description: 'A step-by-step guide to evaluating compensation packages and having the conversation with confidence.' },
          { icon: '🌐', title: 'Thriving in a remote role', description: 'Communication habits, workspace setup, and routines that help remote employees stay visible and productive.' },
          { icon: '📈', title: 'Building your personal brand', description: 'How to position yourself as a thought leader through your portfolio, LinkedIn, and professional network.' },
        ],
      },
    ],
    cta: { label: 'Find your next opportunity', to: '/' },
  },

  '/pricing': {
    title: 'Pricing',
    eyebrow: 'Plans',
    hero: 'Simple, transparent pricing for jobseekers and employers. Posting a job and applying are free to get started.',
    sections: [
      {
        type: 'pricing',
        heading: 'Choose your plan',
        tiers: [
          {
            name: 'Free',
            price: '$0',
            period: 'forever',
            description: 'Everything you need to start your job search.',
            features: ['Unlimited job browsing', 'Save up to 10 jobs', 'Create your profile', 'Apply to unlimited jobs', 'Basic salary insights'],
            cta: { label: 'Get started', to: '/register' },
            highlighted: false,
          },
          {
            name: 'Pro',
            price: '$12',
            period: 'per month',
            description: 'Advanced tools for serious job seekers.',
            features: ['Everything in Free', 'Unlimited saved jobs', 'Application tracking', 'Priority support', 'Salary negotiation guides', 'Profile visibility boost'],
            cta: { label: 'Start free trial', to: '/register' },
            highlighted: true,
          },
          {
            name: 'Employer',
            price: '$199',
            period: 'per posting',
            description: 'Reach top talent with a single job post.',
            features: ['30-day listing', 'Featured placement', 'Applicant management', 'Company profile page', 'Analytics dashboard', 'Email support'],
            cta: { label: 'Post a job', to: '/profile?tab=post' },
            highlighted: false,
          },
        ],
      },
    ],
  },

  '/talent-search': {
    title: 'Talent Search',
    eyebrow: 'For employers',
    hero: 'Find and connect with qualified candidates across engineering, design, product, and more.',
    sections: [
      {
        type: 'features',
        heading: 'What you get',
        items: [
          { icon: '🔍', title: 'Advanced filters', description: 'Search by skills, experience level, work type, salary expectations, and location to find your ideal candidate.' },
          { icon: '📊', title: 'Candidate insights', description: 'Review detailed profiles, work history, and skill assessments before reaching out.' },
          { icon: '💬', title: 'Direct messaging', description: 'Connect with candidates through our built-in messaging system. No need to share personal contact info.' },
          { icon: '📈', title: 'Hiring analytics', description: 'Track pipeline metrics, time-to-hire, and source effectiveness from your dashboard.' },
        ],
      },
      {
        type: 'text',
        heading: 'How Talent Search works',
        body: 'Post a job or search our candidate database directly. Our matching algorithm surfaces the most relevant profiles based on skills, experience, and preferences. Reach out to top candidates and manage your entire hiring pipeline in one place.',
      },
    ],
    cta: { label: 'Post your first job', to: '/profile?tab=post' },
  },

  '/solutions': {
    title: 'Solutions',
    eyebrow: 'How HireFlow helps',
    hero: 'Learn how HireFlow powers hiring for companies of every size — from first job posting to building an entire team.',
    sections: [
      {
        type: 'cards',
        heading: 'Built for every team',
        items: [
          { icon: '🚀', title: 'Startups', description: 'Post your first role in minutes. Reach candidates who are excited about early-stage opportunities and equity.' },
          { icon: '🏢', title: 'Scale-ups', description: 'Manage multiple openings, coordinate hiring managers, and track applicants across roles with our pipeline tools.' },
          { icon: '🌍', title: 'Enterprise', description: 'Custom integrations, dedicated support, and employer branding features for large-scale hiring programs.' },
        ],
      },
      {
        type: 'list',
        heading: 'Why companies choose HireFlow',
        items: [
          'Qualified candidate pool across engineering, design, product, marketing, and operations.',
          'Transparent pricing with no hidden fees or long-term contracts.',
          'Built-in applicant tracking so you never lose track of a promising candidate.',
          'Company profile pages that showcase your culture and attract the right fit.',
          'Analytics to understand what is working and optimize your hiring process.',
        ],
      },
    ],
    cta: { label: 'Get started today', to: '/register' },
  },

  '/about': {
    title: 'About Us',
    eyebrow: 'Our story',
    hero: 'HireFlow connects talent with opportunity. We are building a calmer, clearer job marketplace for everyone.',
    sections: [
      {
        type: 'stats',
        items: [
          { value: '15k+', label: 'Jobs posted' },
          { value: '2.4k', label: 'Companies' },
          { value: '85k', label: 'Candidates' },
          { value: '94%', label: 'Satisfaction rate' },
        ],
      },
      {
        type: 'text',
        heading: 'Our mission',
        body: 'Job searching should not feel like a second job. We started HireFlow because we believed the hiring process could be better — more transparent for candidates, more efficient for employers, and more human for everyone involved. Today, we are building the tools that make that vision real.',
      },
      {
        type: 'list',
        heading: 'What we believe',
        items: [
          'Transparency builds trust. Salary ranges, company cultures, and process timelines should all be visible upfront.',
          'Quality over quantity. A curated set of relevant opportunities beats an endless, unfiltered feed.',
          'Everyone deserves a great hiring experience. Whether you are applying or hiring, the process should respect your time.',
          'Data should inform, not replace, human judgment. We build tools that help people make better decisions.',
        ],
      },
    ],
    cta: { label: 'Join the team', to: '/careers' },
  },

  '/blog': {
    title: 'Blog',
    eyebrow: 'Insights',
    hero: 'Stories, guides, and hiring insights from the HireFlow team.',
    sections: [
      {
        type: 'cards',
        heading: 'Recent posts',
        items: [
          { icon: '📰', title: 'The state of remote hiring in 2026', description: 'Remote work continues to reshape how companies hire. We analyzed trends across our platform to see what is changing.' },
          { icon: '📰', title: '5 skills every product manager needs', description: 'From data literacy to stakeholder management, these are the competencies hiring managers look for most.' },
          { icon: '📰', title: 'Building inclusive job descriptions', description: 'Small changes in language can significantly increase the diversity of your applicant pool. Here is what works.' },
          { icon: '📰', title: 'Salary negotiation myths debunked', description: 'We asked hiring managers and recruiters to separate fact from fiction when it comes to compensation discussions.' },
          { icon: '📰', title: 'How to evaluate a startup offer', description: 'Beyond salary: equity, growth potential, culture, and the questions you should ask before signing.' },
          { icon: '📰', title: 'The rise of skills-based hiring', description: 'Why more companies are dropping degree requirements and how it changes the talent landscape.' },
        ],
      },
    ],
    cta: { label: 'Find a job', to: '/' },
  },

  '/careers': {
    title: 'Careers',
    eyebrow: 'Join the team',
    hero: 'Interested in building the future of work with us? We are always looking for passionate people.',
    sections: [
      {
        type: 'cards',
        heading: 'Open positions',
        items: [
          { icon: '💻', title: 'Senior Frontend Engineer', description: 'Build the interfaces that thousands of jobseekers and employers use every day. React, TypeScript, and a passion for craft.', link: '/register' },
          { icon: '🎨', title: 'Product Designer', description: 'Shape the experience from search to hire. Own the design process end-to-end in a small, collaborative team.', link: '/register' },
          { icon: '📊', title: 'Data Engineer', description: 'Build the infrastructure behind our matching algorithms and salary insights. Python, Spark, and curiosity required.', link: '/register' },
          { icon: '📝', title: 'Content Writer', description: 'Craft guides, blog posts, and resources that help people navigate their careers with confidence.', link: '/register' },
        ],
      },
      {
        type: 'list',
        heading: 'What we offer',
        items: [
          'Competitive salary and equity packages for all full-time roles.',
          'Flexible remote-first culture with optional co-working spaces.',
          'Health, dental, and vision insurance from day one.',
          'Generous PTO and learning budget for professional development.',
          'A small team where your work has visible, direct impact.',
        ],
      },
    ],
    cta: { label: 'See open roles', to: '/careers' },
  },

  '/press': {
    title: 'Press',
    eyebrow: 'Media',
    hero: 'Press releases, media kits, and contact information for journalists covering HireFlow.',
    sections: [
      {
        type: 'text',
        heading: 'Press inquiries',
        body: 'For media inquiries, interview requests, or to request our brand assets, reach out to our press team. We respond to all legitimate press inquiries within one business day.',
      },
      {
        type: 'cards',
        heading: 'Recent coverage',
        items: [
          { icon: '📰', title: 'HireFlow raises Series A to expand job marketplace', description: 'TechCrunch covers HireFlow\'s funding round and vision for transparent hiring.' },
          { icon: '📰', title: 'The startup making job searches less painful', description: 'Forbes profiles HireFlow\'s approach to curating quality opportunities.' },
          { icon: '📰', title: 'How HireFlow is changing salary transparency', description: 'The Wall Street Journal explores the impact of visible salary ranges on job markets.' },
        ],
      },
    ],
    cta: { label: 'Contact press team', to: '/about' },
  },

  '/privacy': {
    title: 'Privacy Policy',
    eyebrow: 'Legal',
    hero: 'How HireFlow collects, uses, and protects your personal information.',
    sections: [
      {
        type: 'legal',
        blocks: [
          {
            heading: 'Information we collect',
            body: 'When you create an account, we collect your name, email address, and professional profile information you choose to provide. We also collect usage data such as pages viewed, search queries, and interactions with job listings to improve our platform.',
          },
          {
            heading: 'How we use your information',
            body: 'We use your information to provide and improve our services, match you with relevant opportunities, communicate about your account and job applications, and send optional career-related updates you can opt out of at any time.',
          },
          {
            heading: 'Data sharing',
            body: 'We do not sell your personal information. We share your profile with employers only when you apply to a job or explicitly opt in to candidate visibility. Aggregated, anonymized data may be used for market insights and reporting.',
          },
          {
            heading: 'Data security',
            body: 'We implement industry-standard encryption, access controls, and regular security audits to protect your data. All data is transmitted over encrypted connections and stored in secure, access-restricted environments.',
          },
          {
            heading: 'Your rights',
            body: 'You can access, update, or delete your account data at any time from your profile settings. For additional requests, contact our privacy team. We respond to all data requests within 30 days.',
          },
          {
            heading: 'Contact',
            body: 'If you have questions about this policy, contact us at privacy@hireflow.com.',
          },
        ],
      },
    ],
  },

  '/terms': {
    title: 'Terms of Service',
    eyebrow: 'Legal',
    hero: 'The terms that govern your use of the HireFlow platform and services.',
    sections: [
      {
        type: 'legal',
        blocks: [
          {
            heading: 'Acceptance of terms',
            body: 'By accessing or using HireFlow, you agree to these Terms of Service. If you do not agree, please do not use the platform. We may update these terms periodically, and continued use constitutes acceptance of any changes.',
          },
          {
            heading: 'Account responsibilities',
            body: 'You are responsible for maintaining the accuracy of your profile information and the security of your account credentials. You must be at least 18 years old to create an account. One account per person — duplicate accounts may be removed.',
          },
          {
            heading: 'Platform use',
            body: 'HireFlow is a job marketplace that connects candidates with employers. We are not a party to any employment relationship. We do not guarantee job placement, interview invitations, or hiring outcomes.',
          },
          {
            heading: 'Content and conduct',
            body: 'You retain ownership of content you upload. By posting a profile or applying to jobs, you grant HireFlow a limited license to display that content in connection with our services. You agree not to misuse the platform, submit false information, or attempt to circumvent our systems.',
          },
          {
            heading: 'Termination',
            body: 'You may delete your account at any time. We reserve the right to suspend or terminate accounts that violate these terms. Upon termination, your data will be handled in accordance with our Privacy Policy.',
          },
          {
            heading: 'Limitation of liability',
            body: 'HireFlow is provided "as is" without warranties of any kind. We are not liable for indirect, incidental, or consequential damages arising from your use of the platform.',
          },
        ],
      },
    ],
  },

  '/cookie-policy': {
    title: 'Cookie Policy',
    eyebrow: 'Legal',
    hero: 'How HireFlow and our partners use cookies to improve your experience.',
    sections: [
      {
        type: 'legal',
        blocks: [
          {
            heading: 'What are cookies',
            body: 'Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences, keep you logged in, and understand how you use the platform.',
          },
          {
            heading: 'Essential cookies',
            body: 'These are required for HireFlow to function. They handle authentication, security, and basic site operations. You cannot opt out of essential cookies without disabling the platform entirely.',
          },
          {
            heading: 'Analytics cookies',
            body: 'We use analytics tools to understand how visitors interact with HireFlow — which pages are most popular, where users encounter issues, and how we can improve. This data is aggregated and does not identify individual users.',
          },
          {
            heading: 'Managing cookies',
            body: 'You can control cookie preferences through your browser settings. Disabling certain cookies may affect platform functionality. Most browsers allow you to block or delete cookies while still using websites.',
          },
          {
            heading: 'Updates',
            body: 'We may update this policy as we add new features or change our analytics practices. Check this page periodically for the latest information.',
          },
        ],
      },
    ],
  },

  '/accessibility': {
    title: 'Accessibility',
    eyebrow: 'Inclusive by design',
    hero: 'Our commitment to making HireFlow usable and accessible for everyone.',
    sections: [
      {
        type: 'text',
        heading: 'Our commitment',
        body: 'HireFlow is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply the relevant accessibility standards.',
      },
      {
        type: 'list',
        heading: 'What we do',
        items: [
          'Design and develop with WCAG 2.1 AA compliance as a target.',
          'Use semantic HTML and ARIA attributes to ensure screen reader compatibility.',
          'Provide keyboard navigation for all interactive elements.',
          'Maintain sufficient color contrast ratios throughout the interface.',
          'Test with assistive technologies including screen readers and keyboard-only navigation.',
          'Train our team on accessibility best practices and inclusive design principles.',
        ],
      },
      {
        type: 'text',
        heading: 'Known limitations',
        body: 'While we strive for full accessibility, some legacy content may not yet meet our target standards. We are actively working to address these gaps. If you encounter a barrier, please let us know — your feedback directly shapes our priorities.',
      },
      {
        type: 'text',
        heading: 'Feedback',
        body: 'If you experience any difficulty using HireFlow or have suggestions for improving accessibility, contact us at accessibility@hireflow.com. We take all feedback seriously and respond within two business days.',
      },
    ],
    cta: { label: 'Return to homepage', to: '/' },
  },
};

function SectionCards({ section }) {
  return (
    <div className="info-section">
      {section.heading && <h2 className="info-section-heading">{section.heading}</h2>}
      <div className="info-cards">
        {section.items.map((item, i) => {
          const inner = (
            <>
              <span className="info-card-icon" aria-hidden="true">{item.icon}</span>
              <h3 className="info-card-title">{item.title}</h3>
              <p className="info-card-desc">{item.description}</p>
            </>
          );
          return item.link ? (
            <Link key={i} to={item.link} className="info-card card">
              {inner}
            </Link>
          ) : (
            <div key={i} className="info-card card">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionFeatures({ section }) {
  return (
    <div className="info-section">
      {section.heading && <h2 className="info-section-heading">{section.heading}</h2>}
      <div className="info-features">
        {section.items.map((item, i) => (
          <div key={i} className="info-feature">
            <span className="info-feature-icon" aria-hidden="true">{item.icon}</span>
            <div>
              <h3 className="info-feature-title">{item.title}</h3>
              <p className="info-feature-desc">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionPricing({ section }) {
  return (
    <div className="info-section">
      {section.heading && <h2 className="info-section-heading">{section.heading}</h2>}
      <div className="info-pricing">
        {section.tiers.map((tier, i) => (
          <div key={i} className={`info-pricing-card card${tier.highlighted ? ' info-pricing-card--highlighted' : ''}`}>
            {tier.highlighted && <span className="badge badge-primary info-pricing-badge">Most popular</span>}
            <h3 className="info-pricing-name">{tier.name}</h3>
            <div className="info-pricing-price">
              <span className="info-pricing-amount">{tier.price}</span>
              <span className="info-pricing-period">/{tier.period}</span>
            </div>
            <p className="info-pricing-desc">{tier.description}</p>
            <ul className="info-pricing-features">
              {tier.features.map((f, j) => (
                <li key={j}>{f}</li>
              ))}
            </ul>
            <Link to={tier.cta.to} className={`btn ${tier.highlighted ? 'btn-primary' : 'btn-secondary'} btn-lg info-pricing-cta`}>
              {tier.cta.label}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTable({ section }) {
  return (
    <div className="info-section">
      {section.heading && <h2 className="info-section-heading">{section.heading}</h2>}
      <div className="info-table-wrap">
        <table className="info-table">
          <thead>
            <tr>
              {section.headers.map((h, i) => <th key={i}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => <td key={j}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionStats({ section }) {
  return (
    <div className="info-section">
      <div className="info-stats">
        {section.items.map((item, i) => (
          <div key={i} className="info-stat">
            <span className="info-stat-value">{item.value}</span>
            <span className="info-stat-label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionText({ section }) {
  return (
    <div className="info-section">
      {section.heading && <h2 className="info-section-heading">{section.heading}</h2>}
      <p className="info-body-text">{section.body}</p>
    </div>
  );
}

function SectionList({ section }) {
  return (
    <div className="info-section">
      {section.heading && <h2 className="info-section-heading">{section.heading}</h2>}
      <ul className="info-list">
        {section.items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}

function SectionLegal({ section }) {
  return (
    <div className="info-section info-legal">
      {section.blocks.map((block, i) => (
        <div key={i} className="info-legal-block">
          <h2 className="info-legal-heading">{block.heading}</h2>
          <p>{block.body}</p>
        </div>
      ))}
    </div>
  );
}

const SECTION_RENDERERS = {
  cards: SectionCards,
  features: SectionFeatures,
  pricing: SectionPricing,
  table: SectionTable,
  stats: SectionStats,
  text: SectionText,
  list: SectionList,
  legal: SectionLegal,
};

export default function InfoPage() {
  const { pathname } = useLocation();
  const page = PAGES[pathname] || {
    title: 'Page',
    eyebrow: 'HireFlow',
    hero: 'This page is not yet available. In the meantime, explore our job listings.',
    sections: [],
    cta: { label: 'Browse jobs', to: '/' },
  };

  return (
    <div className="info-page">
      <div className="info-page-hero">
        <div className="container">
          <span className="section-eyebrow">{page.eyebrow}</span>
          <h1 className="info-page-title">{page.title}</h1>
          <p className="info-page-hero-desc">{page.hero}</p>
        </div>
      </div>

      <div className="container info-page-content">
        {page.sections.map((section, i) => {
          const Renderer = SECTION_RENDERERS[section.type];
          return Renderer ? <Renderer key={i} section={section} /> : null;
        })}

        {page.cta && (
          <div className="info-section info-cta-section">
            <Link to={page.cta.to} className="btn btn-primary btn-lg">{page.cta.label}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
