import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';

type Category = { id: number; name: string };

const SHORT_NAMES: Record<string, string> = {
  'Handmade goods': 'Handmade',
  'Pre-loved items': 'Pre-loved',
  'Books & notes (pre-loved)': 'Books',
  'Food & drinks': 'Food & Drinks',
  'Printing & school supplies': 'School Supplies',
  'Design & creative': 'Design',
  'Tutoring': 'Skills & Tutoring',
  'Tech & IT help': 'Electronics & IT',
  'Photography & video': 'Photo & Video',
};

/** Picks a line icon from the managed category name, so new admin categories still get a sensible glyph. */
export function categoryIcon(name: string): string {
  const label = name.toLowerCase();
  if (/print|school supplies/.test(label)) return 'printer';
  if (/book|notes/.test(label)) return 'book';
  if (/food|drink|snack|coffee/.test(label)) return 'utensils';
  if (/design|creativ|\barts?\b/.test(label)) return 'palette';
  if (/tutor|lesson|educat|skill/.test(label)) return 'graduation';
  if (/tech|digital|gadget|computer|it help|electronic/.test(label)) return 'laptop';
  if (/photo|video/.test(label)) return 'camera';
  if (/cloth|fashion|accessor/.test(label)) return 'shirt';
  if (/handmade|craft|pre-loved|second.hand/.test(label)) return 'package';
  if (/service|repair/.test(label)) return 'wrench';
  return 'tag';
}

export const shortCategoryName = (name: string) => SHORT_NAMES[name] ?? name;

const VISIBLE = 8;

/** "All", the first eight managed categories and "More", as one scrollable row of icon chips. */
export function CategoryChips({ categories }: { categories: Category[] }) {
  const shown = categories.slice(0, VISIBLE);
  return <nav className="category-chips" aria-label="Browse by category">
    <Link to="/explore" className="category-chips__item is-active" aria-current="true">
      <span className="category-chips__icon" aria-hidden="true"><Icon name="grid" size={22} /></span><span>All</span>
    </Link>
    {shown.map(category => <Link key={category.id} to={`/explore?categoryId=${category.id}`} className="category-chips__item" title={category.name}
      aria-label={shortCategoryName(category.name) === category.name ? category.name : `${shortCategoryName(category.name)} — ${category.name}`}>
      <span className="category-chips__icon" aria-hidden="true"><Icon name={categoryIcon(category.name)} size={22} /></span>
      <span aria-hidden="true">{shortCategoryName(category.name)}</span>
    </Link>)}
    {categories.length > VISIBLE && <Link to="/explore" className="category-chips__item" aria-label="More categories">
      <span className="category-chips__icon" aria-hidden="true"><Icon name="more" size={22} /></span><span aria-hidden="true">More</span>
    </Link>}
  </nav>;
}
