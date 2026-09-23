import { useEffect, useState } from 'react';

/**
 * Avatar - renders a user's profile picture when one exists, otherwise a
 * neutral person-silhouette default that makes clear no picture is set.
 *
 * The caller supplies the existing CSS classes for each variant so the real
 * image and the default keep the exact sizing/rounding of the surrounding
 * layout (profile header, navbar account trigger, mobile drawer).
 *
 * Props:
 *   - src: the resolved image URL (falsy → fallback/default avatar)
 *   - fallbackSrc: optional online image (e.g. pravatar.cc) used when `src`
 *     is missing; if it also fails to load, the default silhouette is shown
 *   - imgAlt: alt text for the <img>
 *   - imgClassName: class for the real-image <img>
 *   - placeholderClassName: class for the default-avatar wrapper (kept because
 *     the host CSS already sizes/centers it)
 *   - iconSize: pixel size of the silhouette icon (mirrors the project's
 *     attribute-sized inline icon convention)
 */
export default function Avatar({
  src,
  fallbackSrc,
  imgAlt = '',
  imgClassName,
  placeholderClassName,
  iconSize = 16,
}) {
  // 0 = try the real uploaded src, 1 = try fallbackSrc, 2 = default silhouette
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    setFailedCount(0);
  }, [src, fallbackSrc]);

  if (src && failedCount === 0) {
    return (
      <img
        src={src}
        alt={imgAlt}
        className={imgClassName}
        onError={() => setFailedCount(1)}
      />
    );
  }

  if (fallbackSrc && failedCount < 2) {
    return (
      <img
        src={fallbackSrc}
        alt={imgAlt}
        className={imgClassName}
        onError={() => setFailedCount(2)}
      />
    );
  }

  return (
    <span className={placeholderClassName} aria-hidden="true">
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </span>
  );
}