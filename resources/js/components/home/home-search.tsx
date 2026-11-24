import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';

type Category = { id: number; name: string };

/** Marketplace search with an optional category, handing off to Explore's URL filters. */
export function HomeSearch({ categories }: { categories: Category[] }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const compact = useCompactScreen();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (categoryId) params.set('categoryId', categoryId);
    navigate(params.size ? `/explore?${params}` : '/explore');
  };

  return <form className="home-search" role="search" aria-label="Search the marketplace" onSubmit={submit}>
    <label className="home-search__field">
      <Icon name="search" size={20} />
      <span className="sr-only">Search listings</span>
      <input type="search" value={query} maxLength={80} onChange={event => setQuery(event.target.value)}
        placeholder={compact ? 'Search listings, services, or skills…' : 'Search for products, services, or skills (e.g., “laptop”, “tutor”, “printing”)'} enterKeyHint="search" />
    </label>
    <button type="submit" className="btn home-search__submit">Search</button>
    <label className="home-search__category">
      <Icon name="grid" size={18} />
      <span className="sr-only">Category</span>
      <select value={categoryId} onChange={event => setCategoryId(event.target.value)}>
        <option value="">Category</option>
        {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>
    </label>
    <Link to="/explore" className="home-search__filters" aria-label="All filters">
      <Icon name="sliders" size={18} /><span>All Filters</span>
    </Link>
  </form>;
}

/** True on phone-width screens, where the long search hint would be cut off. */
function useCompactScreen() {
  const query = '(max-width: 860px)';
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && (window.matchMedia?.(query).matches ?? false));
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return;
    const update = () => setCompact(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, []);
  return compact;
}
