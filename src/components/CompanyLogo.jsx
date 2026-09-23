import { useState } from 'react';
import { companyLogo, ddgCompanyLogo } from '../lib/media';

const initialsOf = (name) => {
  const words = (name || '').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
};

/**
 * CompanyLogo - a single reusable company logo/avatar mark.
 *
 * Image priority:
 *   1. Clearbit domain logo
 *   2. DuckDuckGo domain icon
 *   3. accent color + company initials fallback
 *
 * Props:
 *   - name: company display name (used for initials and alt text)
 *   - domain: company website domain (resolves the online logo)
 *   - color: optional brand color for the initials fallback background
 *   - initialsStyle: optional inline style for the initials fallback (takes
 *     precedence over `color` when both are supplied)
 *   - imgClassName: class for the <img> variants (host CSS sizes/rounds it)
 *   - initialsClassName: class for the initials fallback box
 */
export default function CompanyLogo({ name, domain, color, initialsStyle, imgClassName, initialsClassName }) {
  // 'clearbit' = try Clearbit first, 'ddg' = Clearbit failed, try DDG,
  // 'fail' = both failed, fall back to the initials mark.
  const [stage, setStage] = useState('clearbit');
  const src = stage === 'ddg' ? ddgCompanyLogo(domain) : companyLogo(domain);
  const showImg = Boolean(domain) && stage !== 'fail';
  const style = initialsStyle || (color ? { backgroundColor: color } : undefined);

  if (!showImg) {
    return (
      <span className={initialsClassName} style={style} aria-hidden="true">
        {initialsOf(name)}
      </span>
    );
  }

  return (
    <img
      className={imgClassName}
      src={src}
      alt={`${name || 'Company'} logo`}
      style={{ objectFit: 'cover', backgroundColor: '#ffffff' }}
      onError={() => setStage(stage === 'clearbit' ? 'ddg' : 'fail')}
    />
  );
}