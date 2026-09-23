import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Select.css';

const OPTION_HEIGHT = 36;
const MENU_PADDING = 8;
const MENU_GAP = 6;

/**
 * Select - ONE reusable custom dropdown for all of HireFlow.
 * Renders a styled trigger button + a portaled listbox, replacing the native
 * browser <select> appearance everywhere (light & dark) while preserving the
 * same controlled-value + onChange({ target: { name, value } }) contract as a
 * native select, so existing form state handlers keep working unchanged.
 *
 * options: [{ value, label, disabled }]
 */
export default function Select({
  id,
  name,
  value,
  onChange,
  options = [],
  className = '',
  disabled = false,
  placeholder = 'Select…',
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ top: 0, left: 0, width: 0, openUp: false, maxHeight: 280 });
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const optionRefs = useRef([]);
  const directionRef = useRef(false);
  const listboxId = useId();

  const selected = options.find((o) => String(o.value) === String(value ?? ''));

  const anchorMenu = useCallback((preserveDirection = false) => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const totalMenuHeight = MENU_PADDING + options.length * OPTION_HEIGHT;
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const spaceAbove = rect.top - MENU_GAP;
    const openUp = preserveDirection
      ? directionRef.current
      : spaceBelow < totalMenuHeight && spaceAbove > spaceBelow;
    directionRef.current = openUp;
    const availableSpace = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(totalMenuHeight, Math.max(availableSpace, OPTION_HEIGHT * 2));

    const left = Math.min(Math.max(rect.left, 8), Math.max(8, window.innerWidth - rect.width - 8));

    setPlacement({
      top: openUp ? rect.top - MENU_GAP - maxHeight : rect.bottom + MENU_GAP,
      left,
      width: rect.width,
      openUp,
      maxHeight,
    });
  }, [options.length]);

  const openMenu = useCallback(() => {
    anchorMenu(false);
    setOpen(true);
  }, [anchorMenu]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Outside click / Escape / re-anchor on scroll & resize while open.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      const isInside =
        (rootRef.current && rootRef.current.contains(e.target)) ||
        (menuRef.current && menuRef.current.contains(e.target));
      if (!isInside) setOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      closeMenu();
    };
    const handleScroll = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (triggerRef.current) anchorMenu(true);
    };
    const handleResize = () => {
      if (triggerRef.current) anchorMenu(true);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open, anchorMenu, closeMenu]);

  // When the menu opens, bring the selected option into view in its own scroll
  // container (never forcing page scroll).
  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    const menu = menuRef.current;
    const selectedIndex = options.findIndex((o) => String(o.value) === String(value ?? ''));
    const target = optionRefs.current[selectedIndex] || optionRefs.current.find(Boolean);
    if (!target) return;
    const optTop = target.offsetTop;
    const optBottom = optTop + target.offsetHeight;
    if (optTop < menu.scrollTop) {
      menu.scrollTop = optTop;
    } else if (optBottom > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = optBottom - menu.clientHeight;
    }
  }, [open, options, value]);

  const handleSelect = (option) => {
    if (option.disabled) return;
    setOpen(false);
    triggerRef.current?.focus();
    onChange({ target: { name, value: String(option.value) } });
  };

  const focusOption = (index) => {
    const target = optionRefs.current[index];
    if (target) {
      target.focus();
      optionRefs.current[index]?.scrollIntoView({ block: 'nearest' });
    }
  };

  const focusSelectedOption = () => {
    const selectedIndex = options.findIndex((o) => String(o.value) === String(value ?? ''));
    focusOption(selectedIndex >= 0 ? selectedIndex : 0);
  };

  const handleTriggerKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open) return;
      openMenu();
      if (e.key === 'ArrowUp') {
        requestAnimationFrame(() => focusOption(options.length - 1));
      } else {
        requestAnimationFrame(focusSelectedOption);
      }
    }
  };

  const handleListboxKeyDown = (e) => {
    if (!open) return;
    const buttons = optionRefs.current.filter(Boolean);
    if (buttons.length === 0) return;
    const index = buttons.indexOf(document.activeElement);

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      if (index < 0) {
        focusSelectedOption();
      } else {
        focusOption((index + step + buttons.length) % buttons.length);
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusOption(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusOption(buttons.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const btn = document.activeElement;
      if (btn && buttons.includes(btn)) {
        const opt = options[buttons.indexOf(btn)];
        if (opt && !opt.disabled) handleSelect(opt);
      }
    } else if (e.key === 'Tab') {
      closeMenu();
    }
  };

  const displayLabel = selected ? selected.label : placeholder;
  const isPlaceholderShown = !selected;

  const menu = open ? (
    <div
      ref={menuRef}
      id={listboxId}
      className={`hf-select-menu ${placement.openUp ? 'hf-select-menu--up' : ''}`}
      style={{
        position: 'fixed',
        top: placement.top,
        left: placement.left,
        width: placement.width,
        maxHeight: placement.maxHeight,
      }}
      role="listbox"
      aria-label={ariaLabel}
      onKeyDown={handleListboxKeyDown}
    >
      <ul className="hf-select-list">
        {options.map((opt, i) => {
          const isSelected = String(opt.value) === String(value ?? '');
          return (
            <li key={`${String(opt.value)}-${i}`} role="presentation">
              <button
                type="button"
                ref={(el) => { optionRefs.current[i] = el; }}
                className={`hf-select-option ${isSelected ? 'hf-select-option--selected' : ''}`}
                role="option"
                aria-selected={isSelected}
                disabled={opt.disabled}
                onClick={() => handleSelect(opt)}
              >
                <span className="hf-select-option-label">{opt.label}</span>
                {isSelected && (
                  <svg className="hf-select-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  ) : null;

  return (
    <div className={`hf-select ${open ? 'hf-select--open' : ''}`} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        id={id}
        name={name}
        className={`hf-select-trigger ${className}`}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        onClick={(e) => {
          if (open) {
            setOpen(false);
            return;
          }
          const viaKeyboard = e.detail === 0;
          openMenu();
          if (viaKeyboard) requestAnimationFrame(focusSelectedOption);
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={`hf-select-value ${isPlaceholderShown ? 'hf-select-value--placeholder' : ''}`}>
          {displayLabel}
        </span>
        <svg
          className="hf-select-chevron"
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
      {menu && createPortal(menu, document.body)}
    </div>
  );
}