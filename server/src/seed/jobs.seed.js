/**
 * HireFlow — Job seeder.
 *
 * Populates the jobs collection with ~50 starter jobs. Idempotent: skips any
 * job that already exists (matched by company + title), so it's safe to rerun.
 *
 * Usage:
 *   node src/seed/jobs.seed.js
 */
require('dotenv').config();
const dns = require('dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

const mongoose = require('mongoose');
const env = require('../config/env');
const Job = require('../models/Job');

const SEED_JOBS = [
  // ---- Engineering ----
  { title: 'Senior Frontend Engineer', company: 'Stellar Labs', location: 'San Francisco, CA', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 180000, max: 220000 }, experienceLevel: 'Senior', skills: ['React', 'TypeScript', 'Next.js'], description: 'Build beautiful user interfaces and own our design system.', category: 'Engineering' },
  { title: 'Backend Engineer', company: 'CloudForge', location: 'Austin, TX', workType: 'On-site', employmentType: 'Full-time', salary: { min: 160000, max: 200000 }, experienceLevel: 'Senior', skills: ['Go', 'Kubernetes', 'AWS'], description: 'Build highly reliable cloud infrastructure.', category: 'Engineering' },
  { title: 'DevOps Engineer', company: 'Scale Systems', location: 'Seattle, WA', workType: 'Remote', employmentType: 'Full-time', salary: { min: 150000, max: 190000 }, experienceLevel: 'Senior', skills: ['Terraform', 'Docker', 'CI/CD'], description: 'Optimize our deployment pipeline and infrastructure.', category: 'Engineering' },
  { title: 'Full Stack Developer', company: 'FinEdge', location: 'Denver, CO', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 140000, max: 170000 }, experienceLevel: 'Mid-level', skills: ['Node.js', 'React', 'MongoDB'], description: 'Build financial applications end to end.', category: 'Engineering' },
  { title: 'Data Engineer', company: 'DataSphere', location: 'Remote', workType: 'Remote', employmentType: 'Full-time', salary: { min: 170000, max: 210000 }, experienceLevel: 'Senior', skills: ['Python', 'Spark', 'Snowflake'], description: 'Build and maintain data pipelines at scale.', category: 'Engineering' },
  { title: 'Mobile Engineer', company: 'AppCraft Studio', location: 'Miami, FL', workType: 'Remote', employmentType: 'Full-time', salary: { min: 150000, max: 185000 }, experienceLevel: 'Senior', skills: ['React Native', 'Swift'], description: 'Build and ship mobile apps for iOS and Android.', category: 'Engineering' },
  { title: 'Site Reliability Engineer', company: 'CloudForge', location: 'Austin, TX', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 165000, max: 205000 }, experienceLevel: 'Senior', skills: ['SRE', 'Observability', 'Linux'], description: 'Keep our platform fast, reliable, and always available.', category: 'Engineering' },
  { title: 'QA Automation Engineer', company: 'ReliableApps', location: 'Phoenix, AZ', workType: 'Remote', employmentType: 'Full-time', salary: { min: 110000, max: 145000 }, experienceLevel: 'Mid-level', skills: ['Playwright', 'Cypress', 'JavaScript'], description: 'Own our automated testing strategy.', category: 'Engineering' },
  { title: 'Software Engineer — Growth', company: 'Venture Path', location: 'Boston, MA', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 145000, max: 175000 }, experienceLevel: 'Mid-level', skills: ['React', 'Node.js', 'Experimentation'], description: 'Build experiments that drive user growth.', category: 'Engineering' },
  { title: 'Machine Learning Engineer', company: 'DataSphere', location: 'Remote', workType: 'Remote', employmentType: 'Full-time', salary: { min: 175000, max: 220000 }, experienceLevel: 'Senior', skills: ['Python', 'PyTorch', 'MLOps'], description: 'Deploy production ML models that power our products.', category: 'Engineering' },

  // ---- Design ----
  { title: 'Product Designer', company: 'Canvas Digital', location: 'New York, NY', workType: 'Remote', employmentType: 'Full-time', salary: { min: 140000, max: 180000 }, experienceLevel: 'Mid-level', skills: ['Figma', 'Design Systems'], description: 'Shape the design language across our product.', category: 'Design' },
  { title: 'UX Researcher', company: 'Canvas Digital', location: 'New York, NY', workType: 'Remote', employmentType: 'Contract', salary: { min: 80, max: 100, period: 'hourly' }, experienceLevel: 'Mid-level', skills: ['User Interviews', 'Testing'], description: 'Uncover deep user insights to guide product decisions.', category: 'Design' },
  { title: 'Visual Designer', company: 'BrandForge', location: 'San Francisco, CA', workType: 'Remote', employmentType: 'Contract', salary: { min: 70, max: 90, period: 'hourly' }, experienceLevel: 'Mid-level', skills: ['Visual Design', 'Brand Identity'], description: 'Create stunning visuals and brand assets.', category: 'Design' },
  { title: 'UI Designer', company: 'MobileFirst', location: 'Los Angeles, CA', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 120000, max: 150000 }, experienceLevel: 'Mid-level', skills: ['UI Design', 'Figma', 'Prototyping'], description: 'Design clean, functional interfaces for mobile apps.', category: 'Design' },
  { title: 'Brand Designer', company: 'Ogilvy Digital', location: 'Chicago, IL', workType: 'On-site', employmentType: 'Full-time', salary: { min: 115000, max: 145000 }, experienceLevel: 'Mid-level', skills: ['Brand Identity', 'Illustration'], description: 'Build and evolve iconic brand identities.', category: 'Design' },
  { title: 'Interaction Designer', company: 'Pulse Robotics', location: 'Boston, MA', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 130000, max: 160000 }, experienceLevel: 'Senior', skills: ['Interaction Design', 'Motion', 'Figma'], description: 'Design delightful motion and interactions.', category: 'Design' },
  { title: 'Design Systems Designer', company: 'Atlassian', location: 'Remote', workType: 'Remote', employmentType: 'Full-time', salary: { min: 140000, max: 180000 }, experienceLevel: 'Senior', skills: ['Design Systems', 'Accessibility'], description: 'Own a scalable, accessible design system.', category: 'Design' },

  // ---- Product ----
  { title: 'Product Manager', company: 'Nexus Health', location: 'Chicago, IL', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 160000, max: 200000 }, experienceLevel: 'Senior', skills: ['Product Strategy', 'Agile'], description: 'Lead product development across multiple squads.', category: 'Product' },
  { title: 'Associate Product Manager', company: 'Bolt Financial', location: 'San Francisco, CA', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 110000, max: 140000 }, experienceLevel: 'Entry-level', skills: ['Product Discovery', 'Analytics'], description: 'Support PMs and grow into a product leader.', category: 'Product' },
  { title: 'Senior Product Manager', company: 'Fintech Corp', location: 'New York, NY', workType: 'On-site', employmentType: 'Full-time', salary: { min: 175000, max: 215000 }, experienceLevel: 'Senior', skills: ['Roadmapping', 'Stakeholder Mgmt'], description: 'Own product strategy for a major product line.', category: 'Product' },
  { title: 'Product Analytics Manager', company: 'Insightful', location: 'Seattle, WA', workType: 'Remote', employmentType: 'Full-time', salary: { min: 150000, max: 185000 }, experienceLevel: 'Senior', skills: ['SQL', 'Amplitude', 'A/B Testing'], description: 'Turn data into product decisions.', category: 'Product' },
  { title: 'Technical Product Manager', company: 'CloudScale', location: 'Austin, TX', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 160000, max: 195000 }, experienceLevel: 'Senior', skills: ['APIs', 'Cloud', 'Platform'], description: 'Drive platform API strategy and delivery.', category: 'Product' },

  // ---- Marketing ----
  { title: 'Growth Marketing Manager', company: 'Venture Path', location: 'Boston, MA', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 120000, max: 150000 }, experienceLevel: 'Mid-level', skills: ['SEO', 'Analytics'], description: 'Drive acquisition strategies and growth loops.', category: 'Marketing' },
  { title: 'Content Strategist', company: 'Momentum Media', location: 'Los Angeles, CA', workType: 'Remote', employmentType: 'Full-time', salary: { min: 90000, max: 120000 }, experienceLevel: 'Mid-level', skills: ['Copywriting', 'Social Media'], description: 'Craft compelling content across channels.', category: 'Marketing' },
  { title: 'SEO Specialist', company: 'SearchRev', location: 'Denver, CO', workType: 'Remote', employmentType: 'Full-time', salary: { min: 85000, max: 110000 }, experienceLevel: 'Mid-level', skills: ['SEO', 'Content Marketing', 'Analytics'], description: 'Drive organic search growth.', category: 'Marketing' },
  { title: 'Social Media Manager', company: 'PopCulture', location: 'New York, NY', workType: 'On-site', employmentType: 'Full-time', salary: { min: 80000, max: 105000 }, experienceLevel: 'Mid-level', skills: ['Social Strategy', 'Content Creation'], description: 'Own our community and social presence.', category: 'Marketing' },
  { title: 'Performance Marketing Lead', company: 'AdScale', location: 'Remote', workType: 'Remote', employmentType: 'Full-time', salary: { min: 135000, max: 170000 }, experienceLevel: 'Senior', skills: ['Paid Media', 'Google Ads', 'Meta Ads'], description: 'Lead paid acquisition across channels.', category: 'Marketing' },
  { title: 'Brand Marketing Manager', company: 'Ogilvy Digital', location: 'Chicago, IL', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 120000, max: 150000 }, experienceLevel: 'Senior', skills: ['Brand Campaigns', 'PR'], description: 'Shape brand narratives and campaigns.', category: 'Marketing' },

  // ---- Finance ----
  { title: 'Finance Analyst', company: 'ClearView Capital', location: 'New York, NY', workType: 'On-site', employmentType: 'Full-time', salary: { min: 100000, max: 130000 }, experienceLevel: 'Entry-level', skills: ['Financial Modeling', 'Excel'], description: 'Support investment decisions with rigorous analysis.', category: 'Finance' },
  { title: 'Accountant', company: 'Ledger & Co.', location: 'Chicago, IL', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 75000, max: 95000 }, experienceLevel: 'Mid-level', skills: ['GAAP', 'QuickBooks'], description: 'Manage financial reporting and compliance.', category: 'Finance' },
  { title: 'Financial Controller', company: 'Propel Ventures', location: 'San Francisco, CA', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 160000, max: 195000 }, experienceLevel: 'Senior', skills: ['Financial Reporting', 'Audit'], description: 'Own accounting and financial control.', category: 'Finance' },
  { title: 'Investment Analyst', company: 'Summit Capital', location: 'Boston, MA', workType: 'On-site', employmentType: 'Full-time', salary: { min: 120000, max: 150000 }, experienceLevel: 'Mid-level', skills: ['Valuation', 'Due Diligence'], description: 'Evaluate investments and build financial models.', category: 'Finance' },

  // ---- Customer Success ----
  { title: 'Customer Success Manager', company: 'SupportPro', location: 'Portland, OR', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 85000, max: 110000 }, experienceLevel: 'Mid-level', skills: ['Account Management', 'SaaS'], description: 'Help clients succeed and grow with our product.', category: 'Customer Success' },
  { title: 'Customer Support Specialist', company: 'ZenDesk Partner', location: 'Remote', workType: 'Remote', employmentType: 'Full-time', salary: { min: 55000, max: 75000 }, experienceLevel: 'Entry-level', skills: ['Support', 'CRM'], description: 'Deliver fast, empathetic support to customers.', category: 'Customer Success' },
  { title: 'Account Executive', company: 'Nova Software', location: 'Denver, CO', workType: 'Remote', employmentType: 'Full-time', salary: { min: 90000, max: 130000 }, experienceLevel: 'Mid-level', skills: ['Sales', 'CRM', 'Negotiation'], description: 'Drive new business and manage key accounts.', category: 'Customer Success' },
  { title: 'Onboarding Manager', company: 'BrightPath', location: 'Austin, TX', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 80000, max: 105000 }, experienceLevel: 'Mid-level', skills: ['Onboarding', 'Project Mgmt'], description: 'Guide new customers through a smooth onboarding.', category: 'Customer Success' },

  // ---- Operations ----
  { title: 'Operations Coordinator', company: 'LogiFlow', location: 'Atlanta, GA', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 65000, max: 80000 }, experienceLevel: 'Entry-level', skills: ['Process Optimization', 'Analytics'], description: 'Streamline operations and improve workflows.', category: 'Operations' },
  { title: 'Supply Chain Manager', company: 'GlobalFreight', location: 'Miami, FL', workType: 'On-site', employmentType: 'Full-time', salary: { min: 110000, max: 140000 }, experienceLevel: 'Senior', skills: ['Logistics', 'Inventory Mgmt'], description: 'Oversee global supply chain operations.', category: 'Operations' },
  { title: 'Program Manager', company: 'Northwind', location: 'Seattle, WA', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 130000, max: 165000 }, experienceLevel: 'Senior', skills: ['Program Mgmt', 'Cross-functional'], description: 'Lead complex cross-functional programs.', category: 'Operations' },
  { title: 'Recruiter', company: 'TalentBridge', location: 'New York, NY', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 85000, max: 115000 }, experienceLevel: 'Mid-level', skills: ['Talent Acquisition', 'Interviewing'], description: 'Source and hire top talent across teams.', category: 'Operations' },

  // ---- Data & Security ----
  { title: 'Data Analyst', company: 'Insightful', location: 'Remote', workType: 'Remote', employmentType: 'Full-time', salary: { min: 95000, max: 125000 }, experienceLevel: 'Mid-level', skills: ['SQL', 'Tableau', 'Python'], description: 'Turn raw data into actionable insights.', category: 'Data' },
  { title: 'Security Engineer', company: 'CyberShield', location: 'Washington, DC', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 150000, max: 190000 }, experienceLevel: 'Senior', skills: ['Application Security', 'AWS', 'Pen Testing'], description: 'Secure our platform and applications.', category: 'Data' },
  { title: 'Business Intelligence Analyst', company: 'Vantage Data', location: 'Chicago, IL', workType: 'On-site', employmentType: 'Full-time', salary: { min: 100000, max: 130000 }, experienceLevel: 'Mid-level', skills: ['Power BI', 'SQL', 'Dimensional Modeling'], description: 'Build BI reports and dashboards.', category: 'Data' },

  // ---- Human Resources ----
  { title: 'HR Business Partner', company: 'PeopleFirst', location: 'Denver, CO', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 105000, max: 135000 }, experienceLevel: 'Senior', skills: ['Employee Relations', 'Talent Mgmt'], description: 'Partner with leaders on people strategy.', category: 'Human Resources' },
  { title: 'People Operations Specialist', company: 'CoreWork', location: 'Austin, TX', workType: 'Remote', employmentType: 'Full-time', salary: { min: 70000, max: 90000 }, experienceLevel: 'Mid-level', skills: ['Onboarding', 'HRIS', 'Compliance'], description: 'Support the employee lifecycle end to end.', category: 'Human Resources' },

  // ---- Sales ----
  { title: 'Sales Development Representative', company: 'Nova Software', location: 'Remote', workType: 'Remote', employmentType: 'Full-time', salary: { min: 60000, max: 80000 }, experienceLevel: 'Entry-level', skills: ['Outbound Sales', 'CRM'], description: 'Generate and qualify new sales opportunities.', category: 'Sales' },
  { title: 'Enterprise Account Manager', company: 'GlobalSoft', location: 'New York, NY', workType: 'On-site', employmentType: 'Full-time', salary: { min: 140000, max: 180000 }, experienceLevel: 'Senior', skills: ['Enterprise Sales', 'Negotiation'], description: 'Manage and grow enterprise accounts.', category: 'Sales' },

  // ---- Legal ----
  { title: 'Corporate Counsel', company: 'LegalEdge', location: 'Chicago, IL', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 150000, max: 190000 }, experienceLevel: 'Senior', skills: ['Corporate Law', 'Contracts'], description: 'Provide legal guidance across the organization.', category: 'Legal' },
  { title: 'Paralegal', company: 'Smith & Partners', location: 'Boston, MA', workType: 'On-site', employmentType: 'Full-time', salary: { min: 60000, max: 80000 }, experienceLevel: 'Entry-level', skills: ['Legal Research', 'Document Mgmt'], description: 'Support attorneys with case preparation.', category: 'Legal' },

  // ---- Extra engineering + others to keep the catalogue fresh ----
  { title: 'Engineering Manager', company: 'Stellar Labs', location: 'San Francisco, CA', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 200000, max: 240000 }, experienceLevel: 'Manager', skills: ['Leadership', 'React', 'Coaching'], description: 'Lead and grow a team of frontend engineers.', category: 'Engineering' },
  { title: 'Solutions Engineer', company: 'CloudScale', location: 'New York, NY', workType: 'Remote', employmentType: 'Full-time', salary: { min: 145000, max: 180000 }, experienceLevel: 'Mid-level', skills: ['APIs', 'Technical Sales', 'Node.js'], description: 'Bridge sales and engineering for enterprise clients.', category: 'Engineering' },
  { title: 'Frontend Engineer', company: 'Bolt Financial', location: 'San Francisco, CA', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 140000, max: 175000 }, experienceLevel: 'Mid-level', skills: ['React', 'TypeScript', 'CSS'], description: 'Ship polished, accessible frontend features.', category: 'Engineering' },
  { title: 'Security Operations Analyst', company: 'CyberShield', location: 'Washington, DC', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 105000, max: 135000 }, experienceLevel: 'Mid-level', skills: ['SIEM', 'Incident Response'], description: 'Monitor and respond to security incidents.', category: 'Data' },
  { title: 'Quantitative Analyst', company: 'Summit Capital', location: 'New York, NY', workType: 'On-site', employmentType: 'Full-time', salary: { min: 150000, max: 190000 }, experienceLevel: 'Senior', skills: ['Python', 'Statistics', 'Finance'], description: 'Develop quantitative models for trading strategies.', category: 'Finance' },
  { title: 'Talent Acquisition Partner', company: 'TalentBridge', location: 'Remote', workType: 'Remote', employmentType: 'Full-time', salary: { min: 90000, max: 120000 }, experienceLevel: 'Mid-level', skills: ['Sourcing', 'Interviewing'], description: 'Build pipelines for hard-to-fill technical roles.', category: 'Human Resources' },
];

(async () => {
  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    console.log(`[seed] Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);

    let inserted = 0;
    let skipped = 0;

    for (const job of SEED_JOBS) {
      const existing = await Job.findOne({ company: job.company, title: job.title });
      if (existing) {
        skipped += 1;
        continue;
      }
      await Job.create(job);
      inserted += 1;
    }

    console.log(`[seed] Done. inserted=${inserted} skipped=${skipped} total=${await Job.countDocuments()}`);
  } catch (err) {
    console.error('[seed] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  }
})();
