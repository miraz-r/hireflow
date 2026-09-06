import { useEffect, useRef, useState } from 'react';
import './TermsPage.css';

const SECTIONS = [
  {
    id: 'acceptance-of-terms',
    toc: 'Acceptance',
    heading: 'Acceptance of Terms',
    body: `By accessing or using HireFlow, including any websites, applications, or services made available by HireFlow (collectively, the "Platform"), you agree to be bound by these Terms of Service ("Terms"). These Terms constitute a legally binding agreement between you and HireFlow regarding your access to and use of the Platform. If you do not agree to these Terms in their entirety, you must not access or use the Platform.

We may update or modify these Terms from time to time at our sole discretion. When we make material changes, we will provide notice through the Platform or by other reasonable means. Continued use of the Platform after any such changes become effective constitutes your acceptance of the revised Terms. If you do not agree to the updated Terms, you must discontinue all use of the Platform immediately.`,
  },
  {
    id: 'eligibility',
    toc: 'Eligibility',
    heading: 'Eligibility',
    body: `You must be at least eighteen (18) years of age or the age of legal majority in your jurisdiction, whichever is greater, to create an account and use the Platform. By using the Platform, you represent and warrant that you meet all eligibility requirements set forth in these Terms and that you have the legal capacity to enter into a binding agreement.

If you use the Platform on behalf of an organization or entity, you represent that you have the authority to bind that organization to these Terms, and the terms "you" and "your" will refer to that organization. Organizations using the Platform are responsible for ensuring that all authorized users comply with these Terms. HireFlow reserves the right to deny access or terminate accounts for any user who does not meet these eligibility requirements or who provides false or misleading information during registration.`,
  },
  {
    id: 'account-registration-and-security',
    toc: 'Account & Security',
    heading: 'Account Registration and Security',
    body: `To access certain features of the Platform, you may be required to register for an account. When you register, you agree to provide accurate, current, and complete information about yourself as requested by the registration process. You are solely responsible for maintaining the confidentiality of your account credentials, including your username and password, and for all activities that occur under your account.

You agree to notify HireFlow immediately of any unauthorized access to or use of your account, or any other breach of security. HireFlow will not be liable for any loss or damage arising from your failure to comply with these security obligations. You further agree that you will not share your account credentials with any third party, transfer your account to another person, or allow any unauthorized individual to access or use the Platform through your account.`,
  },
  {
    id: 'user-accounts-and-responsibilities',
    toc: 'User Responsibilities',
    heading: 'User Accounts and Responsibilities',
    body: `As a registered user, you are responsible for maintaining the accuracy, completeness, and legality of all information you submit through the Platform. This includes your profile information, resume, cover letter, portfolio links, and any other materials or communications you provide. You agree not to submit false, misleading, or fraudulent information, and you agree not to misrepresent your qualifications, employment history, education, or identity.

You are solely responsible for the content you upload, post, or transmit through the Platform. You represent and warrant that you own or have the necessary rights and permissions to share any content you submit, and that such content does not infringe upon the intellectual property rights, privacy rights, or other rights of any third party. You also agree not to upload content that is unlawful, defamatory, harassing, threatening, obscene, or otherwise objectionable.`,
  },
  {
    id: 'jobseeker-responsibilities',
    toc: 'Jobseeker Responsibilities',
    heading: 'Jobseeker Responsibilities',
    body: `Jobseekers using the Platform agree to use it only for legitimate employment-seeking purposes. You agree not to submit duplicate applications to the same employer through multiple accounts or methods, and you agree not to attempt to circumvent any application tracking or screening systems provided by HireFlow or employers using the Platform.

You understand that HireFlow does not guarantee interviews, job offers, or employment outcomes. All hiring decisions are made solely by the employers or recruiters using the Platform. You agree not to hold HireFlow responsible for any hiring decision, refusal to hire, termination, or any other employment-related action taken by an employer. You further agree to treat all employers, recruiters, and other users with professionalism and respect, and to refrain from any behavior that could be considered harassing, discriminatory, or abusive.`,
  },
  {
    id: 'recruiter-employer-responsibilities',
    toc: 'Recruiter Responsibilities',
    heading: 'Recruiter and Employer Responsibilities',
    body: `Employers, recruiters, and hiring organizations using the Platform agree to provide accurate and truthful information in all job postings, company descriptions, and communications with candidates. You agree that all job listings must represent genuine employment opportunities and must not contain misleading, deceptive, or fraudulent claims regarding compensation, role responsibilities, working conditions, or company information.

You agree to comply with all applicable employment and anti-discrimination laws in your jurisdiction. You agree not to use the Platform to collect personal information from candidates for purposes unrelated to legitimate hiring, and you agree to handle all candidate information in accordance with applicable privacy laws and our Privacy Policy. You are solely responsible for the content of your job listings, screening criteria, and hiring practices.`,
  },
  {
    id: 'job-listings-and-hiring-decisions',
    toc: 'Job Listings and Hiring',
    heading: 'Job Listings and Hiring Decisions',
    body: `HireFlow provides a marketplace that connects jobseekers with potential employers. HireFlow does not employ jobseekers, does not act as an employer, and is not a party to any employment agreement between a jobseeker and an employer. All job listings on the Platform are provided by third-party employers or recruiters, and HireFlow does not verify, endorse, or guarantee the accuracy or legitimacy of any job posting.

Hiring decisions, including whether to interview, hire, or retain a candidate, are made exclusively by the employer or recruiter. HireFlow does not participate in, influence, or control any hiring decision. You acknowledge and agree that HireFlow is not responsible for any employment-related disputes, claims, or losses arising from interactions between users of the Platform.`,
  },
  {
    id: 'applications-and-submitted-information',
    toc: 'Applications',
    heading: 'Applications and User-Submitted Information',
    body: `When you submit an application through the Platform, including your resume, cover letter, profile data, or any supplementary materials, you grant HireFlow and the relevant employer or recruiter a limited, non-exclusive license to access, review, store, and process that information solely in connection with the application and related hiring activities.

You understand that submitting an application does not guarantee that you will be contacted by an employer, invited to interview, or offered a position. Employers may choose to review applications at their discretion and may not respond to every applicant. You agree not to submit the same application repeatedly or to submit applications that contain false or misleading information.`,
  },
  {
    id: 'prohibited-conduct',
    toc: 'Prohibited Conduct',
    heading: 'Prohibited Conduct',
    body: `You agree not to use the Platform for any unlawful purpose or in any manner that violates these Terms. Prohibited activities include, but are not limited to: submitting false or misleading information; attempting to access another user's account without authorization; using the Platform to distribute spam, malware, or harmful code; engaging in harassment, discrimination, or abusive behavior toward other users; attempting to circumvent the Platform's security features; scraping, scraping, or collecting data from the Platform without authorization; posting fraudulent job listings; and using the Platform for any purpose other than legitimate job searching, recruiting, or hiring.

HireFlow reserves the right to investigate any suspected violation of these Terms and to take appropriate action, including suspending or terminating accounts, removing content, and reporting illegal activity to the appropriate authorities.`,
  },
  {
    id: 'content-and-intellectual-property',
    toc: 'Intellectual Property',
    heading: 'Content and Intellectual Property',
    body: `All content provided by HireFlow on the Platform, including text, graphics, logos, icons, images, software, and design elements (collectively, "Platform Content"), is the property of HireFlow or its licensors and is protected by applicable intellectual property laws. You are granted a limited, non-transferable, non-exclusive license to access and use the Platform Content solely for your personal or internal business use in connection with the Platform.

You retain ownership of any content you submit to the Platform ("User Content"). By submitting User Content, you grant HireFlow a worldwide, royalty-free, non-exclusive license to use, reproduce, modify, adapt, publish, and display such content in connection with the operation and promotion of the Platform. You represent and warrant that you have all rights necessary to grant this license and that your User Content does not violate the rights of any third party.`,
  },
  {
    id: 'third-party-services-and-links',
    toc: 'Third Parties',
    heading: 'Third-Party Services and Links',
    body: `The Platform may contain links to third-party websites, services, or resources that are not owned or controlled by HireFlow. HireFlow has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third-party websites or services.

By using the Platform, you acknowledge and agree that HireFlow will not be liable for any damage or loss caused by or in connection with your use of any third-party content, goods, or services available through the Platform. We encourage you to read the terms and privacy policies of any third-party services you access through the Platform.`,
  },
  {
    id: 'privacy',
    toc: 'Privacy',
    heading: 'Privacy',
    body: `Your privacy is important to us. Our Privacy Policy describes how we collect, use, store, and share your personal information when you use the Platform. By using the Platform, you agree to the collection and use of information in accordance with our Privacy Policy, which is incorporated into these Terms by reference.

We encourage you to review the Privacy Policy regularly to understand our current practices regarding your personal data. If you do not agree with our Privacy Policy, you should not use the Platform.`,
  },
  {
    id: 'platform-availability-and-changes',
    toc: 'Platform Changes',
    heading: 'Platform Availability and Changes',
    body: `HireFlow strives to maintain the availability of the Platform but does not guarantee uninterrupted or error-free access. We may suspend, withdraw, discontinue, or change any part of the Platform at any time without notice. We will not be liable if, for any reason, the Platform is unavailable at any time or for any period.

We reserve the right to modify, suspend, or discontinue any feature or functionality of the Platform, including adding or removing services, adjusting interfaces, or implementing new systems, without liability to you or any third party. Your continued use of the Platform after any such changes constitutes acceptance of the modified Platform.`,
  },
  {
    id: 'disclaimers',
    toc: 'Disclaimers',
    heading: 'Disclaimers',
    body: `The Platform and all content, features, and services provided through it are offered on an "as is" and "as available" basis without warranties of any kind, either express or implied. To the maximum extent permitted by applicable law, HireFlow disclaims all warranties, including but not limited to implied warranties of merchantability, fitness for a particular purpose, non-infringement, and any warranties arising out of course of dealing or usage of trade.

HireFlow does not warrant that the Platform will meet your specific requirements, that the Platform will be uninterrupted, timely, secure, or error-free, or that any errors in the Platform will be corrected. You assume all risks associated with your use of the Platform.`,
  },
  {
    id: 'limitation-of-liability',
    toc: 'Liability',
    heading: 'Limitation of Liability',
    body: `To the maximum extent permitted by applicable law, HireFlow and its affiliates, officers, directors, employees, agents, licensors, and service providers will not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to damages for loss of profits, revenue, data, or use, arising out of or relating to these Terms or your use of the Platform, even if HireFlow has been advised of the possibility of such damages.

In no event will HireFlow's total liability to you for all claims arising out of or relating to these Terms or your use of the Platform exceed the amount, if any, paid by you to HireFlow for access to the Platform during the twelve (12) months preceding the event giving rise to liability. These limitations apply regardless of the form of action, whether in contract, tort, strict liability, or otherwise.`,
  },
  {
    id: 'indemnification',
    toc: 'Indemnification',
    heading: 'Indemnification',
    body: `You agree to indemnify, defend, and hold harmless HireFlow and its affiliates, officers, directors, employees, agents, and licensors from and against any and all claims, demands, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or relating to: (a) your access to or use of the Platform; (b) your violation of these Terms; (c) your violation of any rights of another party, including any intellectual property, privacy, or publicity rights; (d) your User Content; or (e) any dispute between you and another user of the Platform.

HireFlow reserves the right, at your expense, to assume the exclusive defense and control of any matter subject to indemnification by you. You agree to cooperate fully with HireFlow in the defense of any such claim.`,
  },
  {
    id: 'account-suspension-and-termination',
    toc: 'Account Termination',
    heading: 'Account Suspension and Termination',
    body: `HireFlow reserves the right, at its sole discretion and without prior notice, to suspend or terminate your account, restrict your access to the Platform, or remove any content you have submitted if we believe, in our sole judgment, that you have violated these Terms, that your conduct poses a risk to the Platform or other users, or that termination is otherwise appropriate.

Upon termination, your right to use the Platform will immediately cease, and we may delete your account and any associated data in accordance with our data retention practices described in our Privacy Policy. You may delete your account at any time by following the instructions provided on the Platform. Termination of your account does not affect any obligations or liabilities that accrued before termination.`,
  },
  {
    id: 'dispute-resolution',
    toc: 'Disputes',
    heading: 'Dispute Resolution',
    body: `You agree that any dispute, claim, or controversy arising out of or relating to these Terms or the Platform will be resolved through good-faith negotiations between the parties. If the dispute cannot be resolved informally, it will be resolved through binding arbitration administered by a recognized arbitration provider in accordance with its rules, unless arbitration is not permitted by applicable law in your jurisdiction.

You agree to waive any right to participate in class-action lawsuits or class-wide arbitration. Any arbitration will be conducted on an individual basis, and multiple claims may not be consolidated in a single proceeding without the express written consent of both parties.`,
  },
  {
    id: 'changes-to-terms',
    toc: 'Changes to Terms',
    heading: 'Changes to These Terms',
    body: `HireFlow reserves the right to modify, amend, or update these Terms at any time. We will provide notice of any material changes by posting the revised Terms on the Platform or by sending a notification to the email address associated with your account. Your continued use of the Platform after any changes become effective constitutes your acceptance of the revised Terms.

We encourage you to review these Terms regularly to stay informed about your rights and obligations. If you do not agree to any revised Terms, your only remedy is to discontinue use of the Platform and close your account.`,
  },
  {
    id: 'contact-information',
    toc: 'Contact',
    heading: 'Contact Information',
    body: `If you have any questions, concerns, or comments about these Terms, please contact us at terms@hireflow.com. We are committed to addressing your inquiries in a timely and professional manner. You may also reach out through the contact options available within the Platform.

For legal notices or formal communications, please direct correspondence to our designated support team. We encourage open communication and will make reasonable efforts to respond to all legitimate inquiries within a reasonable timeframe.`,
  },
];

const NAVBAR_HEIGHT = 68;

export default function TermsPage() {
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

  // Active TOC indicator scroll alignment within the sticky TOC
  useEffect(() => {
    const toc = document.querySelector('.privacy-toc');
    const activeLink = document.querySelector('.privacy-toc-link--active');
    if (toc && activeLink) {
      activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeId]);

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
          <h1 className="privacy-title terms-hero-animated">Terms of Service</h1>
          <p className="privacy-date terms-hero-animated">Last updated: August 2026</p>
        </div>
      </div>

      <div className="container">
        <div className="privacy-layout">
          <aside className="privacy-toc terms-toc-animated" aria-label="Table of contents">
            <nav className="privacy-toc-inner">
              <h2 className="privacy-toc-heading">Table of contents</h2>
              <ul className="privacy-toc-list">
                {SECTIONS.map(({ id, toc, heading }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className={`privacy-toc-link${activeId === id ? ' privacy-toc-link--active' : ''}`}
                      onClick={(e) => handleTocClick(e, id)}
                    >
                      {toc || heading}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <article className="privacy-content">
            {SECTIONS.map((section, i) => (
              <section key={section.id} id={section.id} className="terms-section reveal-scroll">
                <h2 className="terms-section-heading">{section.heading}</h2>
                {section.body.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} className="terms-section-body">{paragraph}</p>
                ))}
                {i < SECTIONS.length - 1 && <hr className="privacy-rule" />}
              </section>
            ))}
          </article>
        </div>
      </div>
    </div>
  );
}
