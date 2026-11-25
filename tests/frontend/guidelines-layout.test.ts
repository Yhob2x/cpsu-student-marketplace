import { describe, expect, test } from 'bun:test';
import { parseGuidelineSections } from '../../resources/js/lib/content/guidelines';

describe('marketplace guideline sections', () => {
  test('preserves the published rule wording while creating stable section anchors', () => {
    const sections = parseGuidelineSections('# What you can list\nStudent goods and services.\n\n# Meeting and paying\nAgree on handoff.\nThe marketplace never holds money.');
    expect(sections).toEqual([
      { id: 'guideline-1', title: 'What you can list', paragraphs: ['Student goods and services.'] },
      { id: 'guideline-2', title: 'Meeting and paying', paragraphs: ['Agree on handoff.', 'The marketplace never holds money.'] },
    ]);
  });

  test('supports content without headings and Windows newlines', () => {
    expect(parseGuidelineSections('Keep it safe.\r\nBe respectful.')).toEqual([
      { id: 'guideline-1', title: 'Overview', paragraphs: ['Keep it safe.', 'Be respectful.'] },
    ]);
  });

  test('ignores empty lines and returns no empty sections for empty content', () => {
    expect(parseGuidelineSections(' \n \n')).toEqual([]);
  });
});
