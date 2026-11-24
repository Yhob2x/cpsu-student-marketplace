import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { heroHeadline, type HomePageView } from '@/lib/content/home-page-content';

const FALLBACK_ART = '/illustrations/campus-abstract.svg';

const TRUST = [
  { icon: 'shield', title: 'Students only', body: 'Verified CPSU users' },
  { icon: 'bolt', title: 'Campus-focused', body: 'Buy, sell & meet safely' },
  { icon: 'users', title: 'Community-driven', body: 'Products, services & skills' },
] as const;

const SHORTCUTS = [
  { to: '/explore', icon: 'cart', title: 'Buy', body: 'Find great deals', className: 'home-hero2__float--buy' },
  { to: '/dashboard', icon: 'tag', title: 'Sell', body: 'Earn & declutter', className: 'home-hero2__float--sell' },
  { to: '/inquiries', icon: 'users', title: 'Connect', body: 'Meet & collaborate', className: 'home-hero2__float--connect' },
] as const;

/** Editorial hero: managed copy on the left, the managed campus image in an organic frame on the right. */
export function HomeHero({ content, canSell }: { content: HomePageView; canSell: boolean }) {
  const { copy, images } = content;
  const headline = heroHeadline(copy);
  return <section className="home-hero2" aria-labelledby="home-hero-title">
    <div className="home-hero2__copy">
      <p className="home-hero2__eyebrow"><span aria-hidden="true" />{copy.heroEyebrow}</p>
      <h1 id="home-hero-title" className="home-hero2__title">
        {headline.lead} <span className="home-hero2__highlight">{headline.highlight}</span>
        {headline.tail && <><br /> {headline.tail}</>}
      </h1>
      <p className="home-hero2__body">{copy.heroBody}</p>
      <div className="home-hero2__actions">
        <Link to="/explore" className="btn home-hero2__primary"><span className="home-hero2__label-long">Explore Marketplace</span><span className="home-hero2__label-short">Explore</span> <Icon name="arrow" size={18} /></Link>
        {canSell && <Link to="/dashboard" className="btn ghost home-hero2__secondary"><span className="home-hero2__label-long">Sell an Item</span><span className="home-hero2__label-short">Sell / Post</span> <Icon name="plus" size={18} /></Link>}
      </div>
      <ul className="home-hero2__trust">
        {TRUST.map(item => <li key={item.title}><span className="home-hero2__trust-icon" aria-hidden="true"><Icon name={item.icon} size={20} /></span>
          <span><strong>{item.title}</strong><small>{item.body}</small></span></li>)}
      </ul>
    </div>
    <div className="home-hero2__art">
      <span className="home-hero2__blob home-hero2__blob--gold" aria-hidden="true" />
      <span className="home-hero2__blob home-hero2__blob--sage" aria-hidden="true" />
      <figure className="home-hero2__frame" aria-hidden="true">
        <img src={images.hero ?? FALLBACK_ART} alt="" decoding="async" fetchPriority="high"
          onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = FALLBACK_ART; }} />
      </figure>
      <nav className="home-hero2__floats" aria-label="Start here">
        {SHORTCUTS.filter(item => canSell || item.to !== '/dashboard').map(item =>
          <Link key={item.to} to={item.to} className={`home-hero2__float ${item.className}`}>
            <span className="home-hero2__float-icon" aria-hidden="true"><Icon name={item.icon} size={20} /></span>
            <span><strong>{item.title}</strong><small>{item.body}</small></span>
          </Link>)}
      </nav>
    </div>
  </section>;
}
