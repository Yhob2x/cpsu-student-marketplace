import type { ReactNode } from 'react';

// Small line-icon set drawn inline so the UI needs no icon dependency. Every glyph inherits `currentColor`
// and is marked aria-hidden: the surrounding text always carries the meaning.
const PATHS: Record<string, ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>,
  sliders: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2.2" fill="var(--paper)" /><circle cx="16" cy="17" r="2.2" fill="var(--paper)" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m6 15 6-6 6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  home: <><path d="m3 10 9-7 9 7v10H3Z" /><path d="M9 20v-7h6v7" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <path d="M5 12h14" />,
  close: <path d="M5 5l14 14M19 5 5 19" />,
  download: <><path d="M12 3v12m-4-4 4 4 4-4" /><path d="M5 17v3h14v-3" /></>,
  tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-6.2-6.2A2 2 0 0 1 3.8 13V4.8a1 1 0 0 1 1-1H13a2 2 0 0 1 1.4.6l6.2 6.2a2 2 0 0 1 0 2.8Z" /><circle cx="8" cy="8" r="1.4" /></>,
  book: <><path d="M12 5.5C9.6 4 7 3.8 4 4.5v14c3-.7 5.6-.5 8 1 2.4-1.5 5-1.7 8-1v-14c-3-.7-5.6-.5-8 1Z" /><path d="M12 5.5v14" /></>,
  utensils: <><path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M15 12V7a4 4 0 0 1 4-4v18" /></>,
  printer: <><path d="M7 9V4h10v5M7 17H4v-7h16v7h-3M7 14h10v7H7Z" /><path d="M17 12h.01" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18h1.3a2.1 2.1 0 0 0 1.7-3.4 2 2 0 0 1 1.5-3.3H18A3 3 0 0 0 21 11a9 9 0 0 0-9-8Z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="6.8" r="1" /><circle cx="15.1" cy="7" r="1" /></>,
  graduation: <><path d="m2 9 10-5 10 5-10 5Z" /><path d="M6 11v5c3.4 2.8 8.6 2.8 12 0v-5M22 9v6" /></>,
  laptop: <><rect x="5" y="4" width="14" height="12" rx="1.5" /><path d="m3 20 2-4h14l2 4Z" /></>,
  camera: <><path d="M4 7h4l1.5-2h5L16 7h4v13H4Z" /><circle cx="12" cy="13.3" r="3" /></>,
  package: <><path d="m3 7 9-4 9 4v10l-9 4-9-4Z" /><path d="m3 7 9 4 9-4M12 11v10M7.5 5l9 4" /></>,
  shirt: <path d="m8 4-5 3 2 5 3-1v9h8v-9l3 1 2-5-5-3a4.4 4.4 0 0 1-8 0Z" />,
  wrench: <><path d="M14.5 6.5a5 5 0 0 0-6.4 6.4L3.5 17.5a2.1 2.1 0 0 0 3 3l4.6-4.6a5 5 0 0 0 6.4-6.4l-3 3-3-3Z" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
  heart: <path d="M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.6 12 20 12 20Z" />,
  thumbsUp: <><path d="M7.5 10V20H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3.5ZM7.5 10l4-6.5a2 2 0 0 1 2.5-.8l.5.3-.5 6h6.4a2 2 0 0 1 1.9 2.7l-2.5 7A2 2 0 0 1 18 20H7.5" /></>,
  eye: <><path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.7" /></>,
  star: <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2Z" />,
  heartSolid: <path fill="currentColor" stroke="none" d="M12 21s-8-4.9-8-10.6C4 6.1 6.6 4 9.2 4c1.2 0 2.2.5 2.8 1.3C12.6 4.5 13.6 4 14.8 4c2.6 0 5.2 2.1 5.2 6.4C20 16.1 12 21 12 21Z" />,
  chat: <path d="M20 12a7.5 7.5 0 0 1-11 6.7L4.5 20l1.3-4.3A7.5 7.5 0 1 1 20 12Z" />,
  chatSolid: <path fill="currentColor" stroke="none" d="M12 3C6.75 3 2.5 6.68 2.5 11.3c0 2 .82 3.8 2.2 5.2L3.9 21l4.65-2.1c1.08.46 2.25.7 3.45.7 5.25 0 9.5-3.68 9.5-8.3S17.25 3 12 3Z" />,
  bell: <><path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15Z" /><path d="M9.8 20.5a2.4 2.4 0 0 0 4.4 0" /></>,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  userPlus: <><circle cx="9.5" cy="8" r="3.2" /><path d="M3.5 20a6 6 0 0 1 12 0M19 7v9m-4.5-4.5h9" /></>,
  userCheck: <><circle cx="9.5" cy="8" r="3.2" /><path d="M3.5 20a6 6 0 0 1 12 0m2-7 2.3 2.3L23 11" /></>,
  userPlusSolid: <><circle cx="9" cy="8" r="3.4" fill="currentColor" stroke="none" /><path fill="currentColor" stroke="none" d="M2.7 20.4c0-3.8 2.9-6.7 6.3-6.7s6.3 2.9 6.3 6.7H2.7Z" /><rect x="17.6" y="6.4" width="2.8" height="9.2" rx="1.4" fill="currentColor" stroke="none" /><rect x="14.4" y="9.6" width="9.2" height="2.8" rx="1.4" fill="currentColor" stroke="none" /></>,
  userCheckSolid: <><circle cx="9" cy="8" r="3.4" fill="currentColor" stroke="none" /><path fill="currentColor" stroke="none" d="M2.7 20.4c0-3.8 2.9-6.7 6.3-6.7s6.3 2.9 6.3 6.7H2.7Z" /><path fill="currentColor" stroke="none" d="m14.4 12.2 2.2-2.2 2.3 2.4 3.1-3.2 2 2-5.1 5.2-4.5-4.2Z" /></>,
  shield: <><path d="M12 3.5 19 6v6c0 4.4-3 7.4-7 8.5-4-1.1-7-4.1-7-8.5V6Z" /><path d="m9 12 2 2 4-4" /></>,
  pin: <><path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z" /><circle cx="12" cy="11" r="2.3" /></>,
  flag: <path d="M6 21V4h11l-2 4 2 4H6" />,
  arrow: <><path d="M5 12h13" /><path d="m12.5 5.5 6.5 6.5-6.5 6.5" /></>,
  store: <><path d="M4 9.5V20h16V9.5" /><path d="M3 9.5 5 4h14l2 5.5Z" /><path d="M9.5 20v-5h5v5" /></>,
  leaf: <><path d="M20 4c0 9-5.5 14-13 14H4c0-8 5-14 13-14Z" /><path d="M4 20 12 12" /></>,
  edit: <><path d="M12 20H4v-8L15.5 4.5a2 2 0 0 1 2.8 2.8L10 16h-4v-4" /><path d="m13.5 6.5 4 4" /></>,
  refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.2 9A7 7 0 0 1 18.5 7L20 12M4 12l1.5 5A7 7 0 0 0 17.8 15" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  checks: <><path d="m2.5 12.5 4.5 4.5L16 7" /><path d="m10 16.5 2.5 2.5L22 8" /></>,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{PATHS[name]}</svg>;
}
