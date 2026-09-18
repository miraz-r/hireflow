import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import * as Flags from 'country-flag-icons/react/3x2';
import {
  getCountryByIso2,
  getCountryOptions,
  getNationalExample,
  isNationalNumberTooLong,
} from '../utils/phone';
import './CountryPhoneInput.css';

/**
 * CountryPhoneInput
 *
 * Country-aware phone field made of two parts:
 *   [ Country selector: SVG flag + calling code + chevron ]
 *   [ National/local number input                          ]
 *
 * The country code is chosen through the selector and is never typed into the
 * number field. The number input only holds the national/local portion.
 *
 * Controlled component: the parent owns `country` (ISO 3166-1 alpha-2) and the
 * national number `value`, and updates them via `onCountryChange`/`onValueChange`.
 *
 * The dropdown renders through a React portal attached to <body> and uses
 * fixed positioning so it is never clipped by the auth page's overflow-hidden
 * panes/carousel, and it clamps itself inside the viewport on small screens.
 */
export default function CountryPhoneInput({
  id,
  name,
  value,
  onValueChange,
  country,
  onCountryChange,
  placeholder,
  disabled,
  error,
  ariaInvalid,
  ariaDescribedBy,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pos, setPos] = useState(null);

  const buttonRef = useRef(null);
  const popRef = useRef(null);
  const searchRef = useRef(null);
  const nationalInputRef = useRef(null);
  const optionRefs = useRef([]);
  const listRef = useRef(null);

  const options = useMemo(() => getCountryOptions(), []);
  const selected = useMemo(() => getCountryByIso2(country), [country]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, '');
    if (!q) return options;
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.iso2.toLowerCase().includes(q) ||
        o.callingCode.includes(q)
    );
  }, [options, query]);

  const listboxId = useId();
  const activeCountry =
    activeIndex >= 0 && activeIndex < filtered.length
      ? filtered[activeIndex]
      : null;

  const resolvedPlaceholder =
    placeholder ?? getNationalExample(country) ?? 'Phone number';

  const close = () => setOpen(false);

  const openDropdown = () => {
    if (disabled) return;
    setQuery('');
    setActiveIndex(-1);
    setOpen(true);
  };

  const toggle = () => (open ? close() : openDropdown());

  const chooseCountry = (iso2) => {
    setOpen(false);
    if (iso2 === country) return;
    onCountryChange(iso2);
    // Let the user immediately continue typing the number for the new country.
    if (!disabled) {
      requestAnimationFrame(() => {
        const input = nationalInputRef.current;
        if (input) input.focus();
      });
    }
  };

  // Enforce the selected country's maximum phone-number length (from the same
  // libphonenumber-js metadata the rest of the component uses). Changes that
  // would push the value past the allowed length are dropped so the user can
  // neither over-type nor paste more digits than the country allows. Short or
  // in-progress numbers are always accepted here; the min-length/format check
  // remains the form's existing submit-time validation.
  const handleNationalChange = (e) => {
    const next = e.target.value;
    if (isNationalNumberTooLong(next, country)) return;
    onValueChange(next);
  };

  /* -------- dropdown position (portal, never clipped) -------- */
  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const pop = popRef.current;
    if (!button || !pop) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Cap to the viewport with an 8px breathing room on each side so the menu
    // never overflows horizontally, even on ~220px screens.
    const popWidth = Math.min(320, vw - 16);
    pop.style.width = `${popWidth}px`;

    // Measure the natural content height first; otherwise a previous clamp
    // (or the CSS fallback max-height) leaks into the next measurement.
    pop.style.maxHeight = 'none';
    const contentHeight = pop.offsetHeight;

    const btnRect = button.getBoundingClientRect();
    const gap = 6;
    const spaceBelow = vh - btnRect.bottom - gap;
    const spaceAbove = btnRect.top - gap;
    const maxByViewport = Math.floor(vh * 0.7);

    // Prefer opening below; only flip upward when the menu does not fit
    // underneath and there is clearly more room above.
    const fitsBelow = spaceBelow >= Math.min(contentHeight, maxByViewport);
    const dropUp = !fitsBelow && spaceAbove > spaceBelow;
    const available = dropUp ? spaceAbove : spaceBelow;
    const popHeight = Math.max(
      Math.min(contentHeight, available, maxByViewport),
      0
    );

    pop.style.maxHeight = `${popHeight}px`;

    let top;
    if (dropUp) {
      top = Math.max(8, btnRect.top - popHeight - gap);
    } else {
      top = Math.min(btnRect.bottom + gap, Math.max(8, vh - popHeight - 8));
    }
    const left = Math.max(8, Math.min(btnRect.left, vw - popWidth - 8));

    setPos({ top, left, width: popWidth });
  }, [open, query, filtered.length]);

  // Close on any scroll/resize while the menu is open - safer than trying to
  // chase re-positioning across the auth page's internal scroll containers.
  // Scrolls originating inside the list itself (browsing countries) are kept.
  useEffect(() => {
    if (!open) return;
    const dismiss = (e) => {
      if (e.target && popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', dismiss, { capture: true, passive: true });
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, { capture: true });
      window.removeEventListener('resize', dismiss);
    };
  }, [open]);

  // Close on outside pointer interaction.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (buttonRef.current?.contains(e.target)) return;
      if (popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  // Reset transient state each time the menu opens.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(-1);
      setPos(null);
    } else {
      requestAnimationFrame(() => {
        const input = searchRef.current;
        if (input) input.focus({ preventScroll: true });
      });
    }
  }, [open]);

  // Restart the visible window at the top whenever the search results change.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = 0;
  }, [query]);

  // Keep the keyboard-highlighted option in view by scrolling the list itself
  // (never scrollIntoView, which can chain page scrolls and dismiss the menu).
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = optionRefs.current[activeIndex];
    const list = listRef.current;
    if (!el || !list) return;
    const listTop = list.getBoundingClientRect().top;
    const elTop = el.getBoundingClientRect().top;
    if (elTop < listTop) {
      list.scrollTop -= listTop - elTop;
    } else {
      const listBottom = list.getBoundingClientRect().bottom;
      const elBottom = el.getBoundingClientRect().bottom;
      if (elBottom > listBottom) {
        list.scrollTop += elBottom - listBottom;
      }
    }
  }, [activeIndex, filtered.length]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length === 0) return;
      const target =
        filtered.length === 1 ? filtered[0] : filtered[activeIndex];
      if (target) chooseCountry(target.iso2);
    } else if (e.key === 'Escape') {
      close();
      buttonRef.current?.focus();
    }
  };

  const handleButtonKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      openDropdown();
    } else if (e.key === 'Escape' && open) {
      close();
    }
  };

  const SelectedFlag = selected ? Flags[selected.iso2] : null;
  const callingCode = selected ? `+${selected.callingCode}` : '';

  return (
    <div
      className={`phone-country-input${open ? ' is-open' : ''}${
        error ? ' has-error' : ''
      }`}
      data-disabled={disabled || undefined}
    >
      <div className="phone-country-control">
        <button
          type="button"
          ref={buttonRef}
          className="phone-country-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label={
            selected
              ? `Country: ${selected.name}, calling code ${callingCode}`
              : 'Select country'
          }
          onClick={toggle}
          onKeyDown={handleButtonKeyDown}
          disabled={disabled}
        >
          <span className="phone-country-flag" aria-hidden="true">
            {SelectedFlag ? <SelectedFlag width={18} height={12} /> : null}
          </span>
          <span className="phone-country-code">{callingCode}</span>
          <svg
            className="phone-country-caret"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <span className="phone-country-divider" aria-hidden="true" />

        <input
          ref={nationalInputRef}
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          className="phone-country-number"
          value={value}
          onChange={handleNationalChange}
          placeholder={resolvedPlaceholder}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          {...(error ? { 'data-invalid': true } : {})}
        />
      </div>

      {open &&
        createPortal(
          <div
            ref={popRef}
            className="phone-country-pop"
            style={
              pos
                ? { top: pos.top, left: pos.left, width: pos.width }
                : { visibility: 'hidden' }
            }
            onBlur={(e) => {
              const next = e.relatedTarget;
              if (
                next &&
                (popRef.current?.contains(next) ||
                  buttonRef.current?.contains(next))
              ) {
                return;
              }
              setOpen(false);
            }}
          >
            <div className="phone-country-search">
              <svg
                className="phone-country-search-icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                role="combobox"
                aria-label="Search countries"
                aria-expanded={open}
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-activedescendant={
                  activeCountry
                    ? `country-option-${activeCountry.iso2}`
                    : undefined
                }
                placeholder="Search country or code"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleSearchKeyDown}
              />
            </div>

            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label="Select a country"
              className="phone-country-list"
            >
              {filtered.length === 0 && (
                <li className="phone-country-empty">No countries match</li>
              )}
              {filtered.map((option, i) => {
                const isActive = i === activeIndex;
                const isSelected = option.iso2 === country;
                const OptionFlag = Flags[option.iso2];
                return (
                  <li
                    key={option.iso2}
                    id={`country-option-${option.iso2}`}
                    ref={(el) => {
                      optionRefs.current[i] = el;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    data-active={isActive || undefined}
                    className={`phone-country-option${isSelected ? ' is-selected' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => chooseCountry(option.iso2)}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <span
                      className="phone-country-option-flag"
                      aria-hidden="true"
                    >
                      {OptionFlag ? (
                        <OptionFlag width={21} height={14} />
                      ) : null}
                    </span>
                    <span className="phone-country-option-name">
                      {option.name}
                    </span>
                    <span className="phone-country-option-code">
                      +{option.callingCode}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}