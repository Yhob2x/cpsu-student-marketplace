import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import parse from 'postcss-value-parser';

// These six stylesheets were migrated after the first UI spacing regression contract.
// Do not prevent explicitly responsive calculations, exact 0-3px optical alignments,
// negative offsets or large layout geometry from being reviewed individually.
const scopedStyles = [
  'my-store.css',
  'push-settings.css',
  'storefront.css',
  'listing-detail-polish.css',
  'explore-direct-filters.css',
  'explore-simple-filters.css',
] as const;
const steps = [4, 8, 12, 16, 24, 32, 48, 64];

test('new seller, notifications and filters spacing uses shared tokens at near-scale values', () => {
  const offenders: string[] = [];
  for (const file of scopedStyles) {
    const text = readFileSync(new URL('../../resources/js/' + file, import.meta.url), 'utf8');
    const sheet = postcss.parse(text, { from: file });
    sheet.walkDecls(decl => {
      if (!/^(?:padding|margin|gap|row-gap|column-gap)(?:-|$)/.test(decl.prop)) return;
      if (/\b(?:calc|clamp|min|max|env|color-mix)\s*\(/.test(decl.value)) return;
      parse(decl.value).walk(token => {
        if (token.type === 'function') return false;
        if (token.type !== 'word') return;
        const match = token.value.match(/^(\d*\.?\d+)(px|rem)$/);
        if (!match) return;
        const px = Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
        if (px < 4 || px > 64) return;
        const distance = Math.min(...steps.map(step => Math.abs(px - step)));
        if (distance > .01 && distance <= 2.01) {
          offenders.push(file + ':' + decl.source?.start?.line + ' ' + decl.prop + ': ' + token.value);
        }
      });
    });
  }
  expect(offenders).toEqual([]);
});
