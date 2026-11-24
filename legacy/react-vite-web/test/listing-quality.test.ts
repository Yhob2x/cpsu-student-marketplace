import { describe, expect, test } from 'bun:test';
import { assessListingReadability } from '../src/listing-quality';

describe('advisory listing readability audit', () => {
  test('flags placeholder names without rejecting or rewriting them', () => {
    const result = assessListingReadability('Product', 'A usable and clear description with some details.');
    expect(result).toContain('Replace generic wording with the actual item or service name.');
  });
  test('flags very short and hard-to-read headings', () => {
    expect(assessListingReadability('x', 'Synthetic listing description.')).toContain('Use a descriptive title of at least 12 characters.');
    expect(assessListingReadability('NEW BOOK NOTEBOOK', 'Synthetic listing description.')).toContain('Avoid ALL CAPS so students can scan the title easily.');
  });
  test('flags repetitive titles for human review without altering or removing them', () => {
    expect(assessListingReadability('aaaaaaaaaaaaaaaaaaa', 'A full description with plenty of context.'))
      .toContain('Replace repeated letters or placeholder text with the actual item or service name.');
    expect(assessListingReadability('asdasdasdasdasd', 'A full description with plenty of context.'))
      .toContain('Replace repeated letters or placeholder text with the actual item or service name.');
  });
  test('accepts specific and readable product and service names', () => {
    expect(assessListingReadability('Calculus textbook, second edition', 'Used book in good condition.')).toEqual([]);
    expect(assessListingReadability('Portrait photography for graduation', 'Portrait photography sessions.')).toEqual([]);
  });
  test('suggests useful descriptions for unclear or generic content', () => {
    expect(assessListingReadability('Calculus textbook, second edition', 'Nice item')).toContain('Describe condition, scope, or included details in a complete sentence.');
  });
});
