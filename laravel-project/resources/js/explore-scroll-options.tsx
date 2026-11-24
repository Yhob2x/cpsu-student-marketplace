import { useEffect, useRef, useState, type ReactNode } from 'react';

export type FilterScrollState = { overflowing: boolean; previous: boolean; next: boolean };
export function filterScrollState(scrollWidth: number, clientWidth: number, scrollLeft: number): FilterScrollState {
  const limit = Math.max(0, scrollWidth - clientWidth);
  return { overflowing: limit > 3, previous: scrollLeft > 3, next: scrollLeft < limit - 3 };
}

/** Clear optional cues for scrollable chips; native swiping and keyboard buttons remain. */
export function ExploreScrollOptions({ label, count, children }: {
  label: 'Campus' | 'Category';
  count: number;
  children: ReactNode;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<FilterScrollState>({ overflowing: false, previous: false, next: false });
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const update = () => setState(filterScrollState(element.scrollWidth, element.clientWidth, element.scrollLeft));
    const frame = requestAnimationFrame(update);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    window.addEventListener('resize', update);
    element.addEventListener('scroll', update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', update);
      element.removeEventListener('scroll', update);
    };
  }, [count]);
  return <div className="explore-options-shell" data-can-scroll={state.overflowing}
    data-has-next={state.next}>
    <div className="explore-inline-filter-options" ref={rail} role="group"
      aria-label={label + ' filter choices'} tabIndex={state.overflowing ? 0 : -1}>{children}</div>
  </div>;
}
