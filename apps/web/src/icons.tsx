import type { ReactNode } from 'react';

// Small line-icon set drawn inline so the UI needs no icon dependency. Every glyph inherits `currentColor`
// and is marked aria-hidden: the surrounding text always carries the meaning.
const PATHS: Record<string, ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>,
  sliders: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2.2" fill="var(--paper)" /><circle cx="16" cy="17" r="2.2" fill="var(--paper)" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m6 15 6-6 6 6" />,
  home: <><path d="m3 10 9-7 9 7v10H3Z" /><path d="M9 20v-7h6v7" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  download: <><path d="M12 3v12m-4-4 4 4 4-4" /><path d="M5 17v3h14v-3" /></>,
  tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-6.2-6.2A2 2 0 0 1 3.8 13V4.8a1 1 0 0 1 1-1H13a2 2 0 0 1 1.4.6l6.2 6.2a2 2 0 0 1 0 2.8Z" /><circle cx="8" cy="8" r="1.4" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>,
  heart: <path d="M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.6 12 20 12 20Z" />,
  chat: <path d="M20 12a7.5 7.5 0 0 1-11 6.7L4.5 20l1.3-4.3A7.5 7.5 0 1 1 20 12Z" />,
  bell: <><path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15Z" /><path d="M9.8 20.5a2.4 2.4 0 0 0 4.4 0" /></>,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  shield: <><path d="M12 3.5 19 6v6c0 4.4-3 7.4-7 8.5-4-1.1-7-4.1-7-8.5V6Z" /><path d="m9 12 2 2 4-4" /></>,
  pin: <><path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z" /><circle cx="12" cy="11" r="2.3" /></>,
  flag: <path d="M6 21V4h11l-2 4 2 4H6" />,
  arrow: <><path d="M5 12h13" /><path d="m12.5 5.5 6.5 6.5-6.5 6.5" /></>,
  store: <><path d="M4 9.5V20h16V9.5" /><path d="M3 9.5 5 4h14l2 5.5Z" /><path d="M9.5 20v-5h5v5" /></>,
  leaf: <><path d="M20 4c0 9-5.5 14-13 14H4c0-8 5-14 13-14Z" /><path d="M4 20 12 12" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  checks: <><path d="m2.5 12.5 4.5 4.5L16 7" /><path d="m10 16.5 2.5 2.5L22 8" /></>,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{PATHS[name]}</svg>;
}
