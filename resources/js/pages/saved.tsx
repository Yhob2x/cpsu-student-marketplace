import { useEffect, useState } from 'react';

import { ListingCard } from '@/components/listings/listing-card';
import { ListingCardsSkeleton } from '@/components/ui/async-feedback';
import { EmptyState, ErrorState } from '@/components/ui/screen-state';
import { api, explain } from '@/lib/api';
import { useMe } from '@/providers/session-provider';
import { Listing } from '@/types/listing';

export function Saved() {
  const [rows, setRows] = useState<Listing[] | null>(null);
  const [error, setError] = useState('');
  const { me, savedIds } = useMe();
  const load = () => api<Listing[]>('/saved').then(r => { setRows(r); setError(''); }).catch(x => setError(explain(x)));
  // Render local saves immediately. Refetching on each optimistic change could race the write.
  useEffect(() => { if (me) void load(); }, [me?.id]);
  const visibleSaved = rows?.filter(listing => savedIds.includes(listing.id));
  return <><h1>Saved</h1>
    {rows === null && !error && <ListingCardsSkeleton />}
    {error && <ErrorState title="Could not load saved listings" retry={load} compact>{error}</ErrorState>}
    {visibleSaved?.length === 0 && !error && <EmptyState compact>Nothing saved yet. Use Save on a listing to keep it here.</EmptyState>}
    {!error && <div className="grid listing-grid">{visibleSaved?.map(l => <ListingCard key={l.id} l={l} />)}</div>}
  </>;
}
