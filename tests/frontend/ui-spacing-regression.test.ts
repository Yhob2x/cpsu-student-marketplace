import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import parse from 'postcss-value-parser';

const migratedStyles = [
  'styles.css',
  'home-color-polish.css',
  'mobile-refinements.css',
  'home-simplification.css',
  'storefront-hierarchy.css',
  'image-zoom.css',
  'hierarchy-polish.css',
  'header-search-polish.css',
] as const;

const approvedSpacing = [4, 8, 12, 16, 24, 32, 48, 64];

/** Prevents near-scale literals reappearing without an intentional token decision. */
test('migrated spacing declarations use shared scale when within 2px of a token', () => {
  const offenders: string[] = [];
  for (const name of migratedStyles) {
    const source = readFileSync(new URL('../../resources/js/' + name, import.meta.url), 'utf8');
    const sheet = postcss.parse(source, { from: name });
    sheet.walkDecls(decl => {
      if (!/^(?:padding|margin|gap|row-gap|column-gap)(?:-|$)/.test(decl.prop)) return;
      if (/\b(?:calc|clamp|min|max|env|color-mix)\s*\(/.test(decl.value)) return;
      parse(decl.value).walk(token => {
        if (token.type === 'function') return false;
        if (token.type !== 'word') return;
        const match = token.value.match(/^(\d*\.?\d+)(px|rem)$/);
        if (!match) return;
        const value = Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
        if (value < 4 || value > 64) return;
        const distance = Math.min(...approvedSpacing.map(step => Math.abs(value - step)));
        if (distance > 0.01 && distance <= 2.1) {
          offenders.push(name + ':' + decl.source?.start?.line + ' ' + decl.prop + ': ' + token.value);
        }
      });
    });
  }
  expect(offenders).toEqual([]);
});
