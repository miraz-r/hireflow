// Mock data for HireFlow

export const jobs = [
  { id: 1, title: 'Senior Frontend Engineer', company: 'Stellar Labs', location: 'San Francisco, CA', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 180000, max: 220000, currency: 'USD' }, experienceLevel: 'Senior', skills: ['React', 'TypeScript', 'Next.js'], description: 'Build beautiful user interfaces.', postedAt: '2 days ago', category: 'Engineering' },
  { id: 2, title: 'Product Designer', company: 'Canvas Digital', location: 'New York, NY', workType: 'Remote', employmentType: 'Full-time', salary: { min: 140000, max: 180000, currency: 'USD' }, experienceLevel: 'Mid-level', skills: ['Figma', 'Design Systems'], description: 'Shape the design language.', postedAt: '5 hours ago', category: 'Design' },
  { id: 3, title: 'Backend Engineer', company: 'CloudForge', location: 'Austin, TX', workType: 'On-site', employmentType: 'Full-time', salary: { min: 160000, max: 200000, currency: 'USD' }, experienceLevel: 'Senior', skills: ['Go', 'Kubernetes', 'AWS'], description: 'Build cloud infrastructure.', postedAt: '1 week ago', category: 'Engineering' },
  { id: 4, title: 'Growth Marketing Manager', company: 'Venture Path', location: 'Boston, MA', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 120000, max: 150000, currency: 'USD' }, experienceLevel: 'Mid-level', skills: ['SEO', 'Analytics'], description: 'Drive acquisition strategies.', postedAt: '3 days ago', category: 'Marketing' },
  { id: 5, title: 'DevOps Engineer', company: 'Scale Systems', location: 'Seattle, WA', workType: 'Remote', employmentType: 'Full-time', salary: { min: 150000, max: 190000, currency: 'USD' }, experienceLevel: 'Senior', skills: ['Terraform', 'Docker', 'CI/CD'], description: 'Optimize infrastructure.', postedAt: '4 days ago', category: 'Engineering' },
  { id: 6, title: 'Product Manager', company: 'Nexus Health', location: 'Chicago, IL', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 160000, max: 200000, currency: 'USD' }, experienceLevel: 'Senior', skills: ['Product Strategy', 'Agile'], description: 'Lead product development.', postedAt: '1 day ago', category: 'Product' },
  { id: 7, title: 'UX Researcher', company: 'Canvas Digital', location: 'New York, NY', workType: 'Remote', employmentType: 'Contract', salary: { min: 80, max: 100, currency: 'USD', period: 'hourly' }, experienceLevel: 'Mid-level', skills: ['User Interviews', 'Testing'], description: 'Uncover user insights.', postedAt: '6 days ago', category: 'Design' },
  { id: 8, title: 'Full Stack Developer', company: 'FinEdge', location: 'Denver, CO', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 140000, max: 170000, currency: 'USD' }, experienceLevel: 'Mid-level', skills: ['Node.js', 'React', 'MongoDB'], description: 'Build financial apps.', postedAt: '2 weeks ago', category: 'Engineering' },
  { id: 9, title: 'Content Strategist', company: 'Momentum Media', location: 'Los Angeles, CA', workType: 'Remote', employmentType: 'Full-time', salary: { min: 90000, max: 120000, currency: 'USD' }, experienceLevel: 'Mid-level', skills: ['Copywriting', 'Social Media'], description: 'Craft compelling content.', postedAt: '1 week ago', category: 'Marketing' },
  { id: 10, title: 'Data Engineer', company: 'DataSphere', location: 'Remote', workType: 'Remote', employmentType: 'Full-time', salary: { min: 170000, max: 210000, currency: 'USD' }, experienceLevel: 'Senior', skills: ['Python', 'Spark', 'Snowflake'], description: 'Build data pipelines.', postedAt: '3 days ago', category: 'Engineering' },
  { id: 11, title: 'Customer Success Manager', company: 'SupportPro', location: 'Portland, OR', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 85000, max: 110000, currency: 'USD' }, experienceLevel: 'Mid-level', skills: ['Account Management', 'SaaS'], description: 'Help clients succeed.', postedAt: '5 days ago', category: 'Customer Success' },
  { id: 12, title: 'Mobile Engineer', company: 'AppCraft Studio', location: 'Miami, FL', workType: 'Remote', employmentType: 'Full-time', salary: { min: 150000, max: 185000, currency: 'USD' }, experienceLevel: 'Senior', skills: ['React Native', 'Swift'], description: 'Build mobile apps.', postedAt: '1 week ago', category: 'Engineering' },
  { id: 13, title: 'Finance Analyst', company: 'ClearView Capital', location: 'New York, NY', workType: 'On-site', employmentType: 'Full-time', salary: { min: 100000, max: 130000, currency: 'USD' }, experienceLevel: 'Entry-level', skills: ['Financial Modeling', 'Excel'], description: 'Support investment decisions.', postedAt: '2 days ago', category: 'Finance' },
  { id: 14, title: 'Operations Coordinator', company: 'LogiFlow', location: 'Atlanta, GA', workType: 'Hybrid', employmentType: 'Full-time', salary: { min: 65000, max: 80000, currency: 'USD' }, experienceLevel: 'Entry-level', skills: ['Process Optimization', 'Analytics'], description: 'Streamline operations.', postedAt: '4 days ago', category: 'Operations' },
  { id: 15, title: 'Visual Designer', company: 'BrandForge', location: 'San Francisco, CA', workType: 'Remote', employmentType: 'Contract', salary: { min: 70, max: 90, currency: 'USD', period: 'hourly' }, experienceLevel: 'Mid-level', skills: ['Visual Design', 'Brand Identity'], description: 'Create stunning visuals.', postedAt: '1 week ago', category: 'Design' }
];

export const categories = [
  { id: 'engineering', name: 'Engineering', count: 156 },
  { id: 'design', name: 'Design', count: 42 },
  { id: 'product', name: 'Product', count: 28 },
  { id: 'marketing', name: 'Marketing', count: 35 },
  { id: 'finance', name: 'Finance', count: 19 },
  { id: 'customer-success', name: 'Customer Success', count: 24 },
  { id: 'operations', name: 'Operations', count: 31 }
];

export const companies = [
  { id: 1, name: 'Stellar Labs', industry: 'Technology', hiringCount: 12 },
  { id: 2, name: 'Canvas Digital', industry: 'Design Studio', hiringCount: 8 },
  { id: 3, name: 'CloudForge', industry: 'Cloud Services', hiringCount: 15 },
  { id: 4, name: 'Venture Path', industry: 'Venture Capital', hiringCount: 5 },
  { id: 5, name: 'Scale Systems', industry: 'Infrastructure', hiringCount: 9 },
  { id: 6, name: 'Nexus Health', industry: 'Healthcare', hiringCount: 11 }
];

export const popularSearches = ['Frontend Engineer', 'Product Manager', 'Remote Developer', 'UX Designer', 'Data Scientist'];
export const workTypes = ['Remote', 'Hybrid', 'On-site'];
export const employmentTypes = ['Full-time', 'Part-time', 'Contract'];
export const experienceLevels = ['Entry-level', 'Mid-level', 'Senior', 'Lead', 'Manager'];
export const salaryRanges = [
  { label: '$50k+', value: { min: 50000 } },
  { label: '$100k+', value: { min: 100000 } },
  { label: '$150k+', value: { min: 150000 } },
  { label: '$200k+', value: { min: 200000 } }
];