import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { CategoryChips, categoryIcon, shortCategoryName } from '../../resources/js/components/home/category-chips';
import { ExploreWays, QuickActions } from '../../resources/js/components/home/explore-ways';
import { HomeHero } from '../../resources/js/components/home/home-hero';
import { DEFAULT_HOME_PAGE, heroHeadline } from '../../resources/js/lib/content/home-page-content';

const render = (node: JSX.Element) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

describe('Concept 2 home', () => {
  test('managed hero copy renders as "Buy, Sell & Connect" / "on Campus"', () => {
    expect(heroHeadline({ heroLine1: 'Buy, Sell,', heroAccent: '&', heroLine2: 'Connect', heroLine3: 'on Campus' }))
      .toEqual({ lead: 'Buy, Sell &', highlight: 'Connect', tail: 'on Campus' });
    expect(heroHeadline({ heroLine1: 'Trade', heroAccent: 'and', heroLine2: 'Share', heroLine3: '' }))
      .toEqual({ lead: 'Trade and', highlight: 'Share', tail: '' });
    const html = render(<HomeHero content={DEFAULT_HOME_PAGE} canSell />);
    expect(html).toContain('<h1 id="home-hero-title" class="home-hero2__title">Buy, Sell &amp; <span class="home-hero2__highlight">Connect</span>');
    expect(html).toContain('Explore Marketplace');
    expect(html).toContain('Sell an Item');
    expect(html).toContain('aria-label="Start here"');
  });

  test('staff do not see selling calls to action', () => {
    const html = render(<HomeHero content={DEFAULT_HOME_PAGE} canSell={false} />);
    expect(html).not.toContain('Sell an Item');
    expect(html).not.toContain('href="/dashboard"');
    expect(render(<QuickActions canSell={false} />)).not.toContain('href="/dashboard"');
  });

  test('category chips use managed categories with icons, All and More', () => {
    const categories = Array.from({ length: 9 }, (_, index) => ({ id: index + 1, name: index === 0 ? 'Printing & school supplies' : `Category ${index + 1}` }));
    const html = render(<CategoryChips categories={categories} />);
    expect(html).toContain('href="/explore?categoryId=1"');
    expect(html).not.toContain('href="/explore?categoryId=9"');
    expect(html).toContain('aria-label="More categories"');
    expect(categoryIcon('Food & drinks')).toBe('utensils');
    expect(categoryIcon('Tech & IT help')).toBe('laptop');
    expect(shortCategoryName('Printing & school supplies')).toBe('School Supplies');
  });

  test('explore band links to real filtered results', () => {
    const html = render(<ExploreWays />);
    expect(html).toContain('href="/explore?type=physical_product"');
    expect(html).toContain('href="/explore?type=service"');
    expect(html).toContain('More Ways to <span>Explore</span>');
  });
});
