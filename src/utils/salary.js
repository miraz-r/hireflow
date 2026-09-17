export const formatSalary = (salary) => {
  if (!salary || (salary.min === undefined && salary.max === undefined)) return 'Salary on application';
  if (salary.period === 'hourly') {
    if (salary.min !== undefined && salary.max !== undefined) {
      return `$${salary.min}–$${salary.max}/hr`;
    }
    if (salary.min !== undefined) return `From $${salary.min}/hr`;
    return `Up to $${salary.max}/hr`;
  }
  const fmt = (n) => (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`);
  if (salary.min !== undefined && salary.max !== undefined) {
    return `${fmt(salary.min)} – ${fmt(salary.max)}`;
  }
  if (salary.min !== undefined) return `From ${fmt(salary.min)}`;
  return `Up to ${fmt(salary.max)}`;
};