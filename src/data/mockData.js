// Mock data for HireFlow

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