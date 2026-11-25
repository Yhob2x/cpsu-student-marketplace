import { expect, test } from '@playwright/test';
import { mockMarketplace, syntheticListing } from './support/mock-marketplace';

const ratedListing = { ...syntheticListing, seller: { ...syntheticListing.seller,
  rating: { average: 4, count: 1 } } };

test('Home and Explore show the same published store rating beside the seller', async ({ page }) => {
  await mockMarketplace(page);
  await page.route('**/api/v1/listings**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/listings/fresh' || path === '/api/v1/listings/popular') {
      return route.fulfill({ json: { items: [ratedListing] } });
    }
    if (path === '/api/v1/listings') {
      return route.fulfill({ json: { items: [ratedListing], total: 1, page: 1, pageSize: 20 } });
    }
    return route.fallback();
  });
  await page.goto('/');
  const homeCard = page.locator('.home-listing-section').first().locator('.product-card');
  await expect(homeCard.getByRole('img', { name: /Store rating 4\.0 out of 5 from 1 published review/ })).toBeVisible();
  await expect(homeCard.locator('.listing-seller-row')).toContainText('By Synthetic Campus Books');
  await expect(homeCard.locator('.listing-store-rating svg')).toHaveCSS('color', 'rgb(242, 183, 5)');
  await page.goto('/explore');
  const exploreCard = page.locator('.explore-results .product-card').first();
  await expect(exploreCard.getByRole('img', { name: /Store rating 4\.0 out of 5 from 1 published review/ })).toBeVisible();
  await expect(exploreCard.locator('.listing-seller-row')).toContainText('By Synthetic Campus Books');
  await expect(exploreCard.locator('.listing-store-rating svg')).toHaveCSS('color', 'rgb(242, 183, 5)');
});

test('an unrated store has no invented number on Home or Explore', async ({ page }) => {
  await mockMarketplace(page);
  await page.goto('/');
  await expect(page.locator('.home-listing-section .product-card').first()).toBeVisible();
  await expect(page.locator('.home-listing-section .listing-store-rating')).toHaveCount(0);
  await page.goto('/explore');
  await expect(page.locator('.explore-results .product-card').first()).toBeVisible();
  await expect(page.locator('.explore-results .listing-store-rating')).toHaveCount(0);
});

test('Store review stars, summary badge and rating bars use the same yellow', async ({ page }) => {
  await mockMarketplace(page);
  await page.route('**/api/v1/seller-profiles/30/reviews**', route => route.fulfill({ json: {
    available: true, summary: { average: 4, count: 1,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 } },
    items: [{ id: 1, rating: 4, body: 'Helpful seller', createdAt: '2026-11-18T09:00:00.000Z' }],
    page: 1, pageSize: 8,
  } }));
  await page.goto('/stores/30');
  await expect(page.getByRole('heading', { name: 'Ratings & reviews' })).toBeVisible();
  await expect(page.locator('.store-rating-stars').first()).toHaveCSS('color', 'rgb(242, 183, 5)');
  await expect(page.locator('.storefront-rating-star')).toHaveCSS('color', 'rgb(242, 183, 5)');
  await expect(page.locator('.store-review-distribution-row').filter({ hasText: /4/ }).first().locator('span[aria-hidden="true"]')).toHaveCSS('color', 'rgb(242, 183, 5)');
  await expect(page.locator('.store-review-average')).not.toHaveCSS('color', 'rgb(242, 183, 5)');
});
