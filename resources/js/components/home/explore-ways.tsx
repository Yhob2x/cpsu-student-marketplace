import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';

type Shortcut = { to: string; icon: string; title: string; body: string };

/** Phone-only shortcut grid under the hero. */
export function QuickActions({ canSell }: { canSell: boolean }) {
  const items: Shortcut[] = [
    { to: '/explore', icon: 'bag', title: 'Buy', body: 'Find items' },
    ...(canSell ? [{ to: '/dashboard', icon: 'tag', title: 'Sell', body: 'Post a listing' }] : []),
    { to: '/inquiries', icon: 'users', title: 'Connect', body: 'Meet students' },
    ...(canSell ? [{ to: '/transactions', icon: 'receipt', title: 'Transactions', body: 'Track & manage' }] : [{ to: '/guidelines', icon: 'book', title: 'Guidelines', body: 'Trade safely' }]),
  ];
  return <nav className="quick-actions" aria-label="Quick actions">
    {items.map(item => <Link key={item.to} to={item.to} className="quick-actions__item">
      <span className="quick-actions__icon" aria-hidden="true"><Icon name={item.icon} size={22} /></span>
      <strong>{item.title}</strong><small>{item.body}</small>
    </Link>)}
  </nav>;
}

/** "More ways to explore" band: the main kinds of things students trade. */
export function ExploreWays() {
  const items: Shortcut[] = [
    { to: '/explore?type=physical_product', icon: 'bag', title: 'Products', body: 'Everyday essentials & student needs' },
    { to: '/explore?type=service', icon: 'wrench', title: 'Services', body: 'Printing, errands, & more' },
    { to: '/explore?type=service&q=tutor', icon: 'graduation', title: 'Skills', body: 'Tutoring, design, & campus talents' },
    { to: '/inquiries', icon: 'users', title: 'Connect', body: 'Meet fellow students & build networks' },
  ];
  return <section className="explore-ways" aria-labelledby="explore-ways-title">
    <h2 id="explore-ways-title">More Ways to <span>Explore</span></h2>
    <div className="explore-ways__grid">
      {items.map(item => <Link key={item.title} to={item.to} className="explore-ways__item">
        <span className="explore-ways__icon" aria-hidden="true"><Icon name={item.icon} size={24} /></span>
        <span><strong>{item.title}</strong><small>{item.body}</small></span>
      </Link>)}
    </div>
  </section>;
}
