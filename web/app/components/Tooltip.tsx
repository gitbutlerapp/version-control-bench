'use client';

import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  label: string;
  children: React.ReactNode;
  className?: string;
  // when provided, the trigger acts as a button (e.g. click to scroll to detail)
  onActivate?: () => void;
}

// A hover/focus tooltip that renders to document.body with fixed positioning,
// so it escapes the results table's overflow-x clip.
export function Tooltip({ label, children, className, onActivate }: TooltipProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const show = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    // clamp the centre so a wide tooltip near a screen edge stays on-screen
    const half = 140;
    const cx = r.left + r.width / 2;
    const x = Math.min(Math.max(cx, half + 8), window.innerWidth - half - 8);
    setPos({ x, y: r.bottom });
  }, []);
  const hide = useCallback(() => setPos(null), []);

  const interactive = Boolean(onActivate);

  return (
    <span
      ref={ref}
      className={`tt-trigger${interactive ? ' tt-interactive' : ''}${className ? ` ${className}` : ''}`}
      data-interactive={interactive}
      role={interactive ? 'button' : undefined}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={onActivate}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate?.();
              }
            }
          : undefined
      }
      aria-label={interactive ? `${label} — open details` : undefined}
    >
      {children}
      {pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <span className="tooltip" role="tooltip" style={{ left: pos.x, top: pos.y + 8 }}>
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
