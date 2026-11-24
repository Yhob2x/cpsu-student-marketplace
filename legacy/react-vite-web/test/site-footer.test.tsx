import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { SiteFooter, type FooterAudience } from '../src/site-footer';

function render(audience: FooterAudience, canReview = false) {
  return renderToStaticMarkup(<StaticRouter location="/"><SiteFooter audience={audience} canReview={canReview} /></StaticRouter>);
}

describe('Footer: useful links for the current student session', () => {
  test('signed-out visitors see sign-in but no removed registration link', () => {
    const html = render('guest');
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('href="/register"');
    expect(html).toContain('href="/guidelines"');
    expect(html).toContain('href="/explore?type=service"');
    expect(html).not.toContain('href="/admin"');
    expect(html).not.toContain('href="/transactions"');
  });

  test('student footer never repeats sign-in prompts and includes useful secondary destinations', () => {
    const html = render('student');
    expect(html).not.toContain('href="/login"');
    expect(html).not.toContain('href="/register"');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/saved"');
    expect(html).toContain('href="/transactions"');
    expect(html).toContain('aria-label="Footer quick links"');
  });

  test('reviewer footer contains staff links but no buyer/seller-only links', () => {
    const html = render('staff', true);
    expect(html).toContain('href="/admin"');
    expect(html).toContain('href="/notifications"');
    expect(html).not.toContain('href="/dashboard"');
    expect(html).not.toContain('href="/transactions"');
    expect(html).not.toContain('href="/register"');
  });

  test('staff without reviewer authority has no review-workspace link', () => {
    const html = render('staff', false);
    expect(html).not.toContain('href="/admin"');
    expect(html).toContain('href="/profile"');
  });

  test('session restoration does not flash guest or student links', () => {
    const html = render('checking');
    expect(html).toContain('Checking session');
    expect(html).not.toContain('href="/login"');
    expect(html).not.toContain('href="/register"');
    expect(html).not.toContain('href="/transactions"');
  });

  test('footer uses real help destination without fake separate reporting route', () => {
    const html = render('student');
    expect(html).toContain('Signed-in students can report a listing');
    expect(html).toContain('href="/guidelines"');
    expect(html).not.toContain('href="/report"');
    expect(html).toContain('CPSU Student Marketplace');
  });
});
