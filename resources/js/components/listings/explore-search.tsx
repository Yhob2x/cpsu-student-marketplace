import { type FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Icon } from '@/components/icons';

/** Keyword search for Explore. Writes `q` into the URL and keeps the other filters. */
export function ExploreSearch() {
  const [params, setParams] = useSearchParams();
  const current = params.get('q') ?? '';
  const [value, setValue] = useState(current);
  useEffect(() => setValue(current), [current]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams(params);
    const query = value.trim();
    if (query) next.set('q', query); else next.delete('q');
    next.delete('page');
    setParams(next);
  };

  return <form className="explore-search" role="search" aria-label="Search listings" onSubmit={submit}>
    <label className="home-search__field">
      <Icon name="search" size={20} />
      <span className="sr-only">Search listings</span>
      <input type="search" value={value} maxLength={80} onChange={event => setValue(event.target.value)}
        placeholder="Search products, services, or skills" enterKeyHint="search" />
    </label>
    <button type="submit" className="btn explore-search__submit">Search</button>
  </form>;
}
