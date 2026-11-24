import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { IconAction } from '../../resources/js/components/icon-action';
import { EmptyState, ErrorState, LoadingState } from '../../resources/js/components/ui/screen-state';

describe('shared visual consistency components', () => {
  test('icon-only actions reuse the shared Button without losing their name or disabled state', () => {
    const html = renderToStaticMarkup(<IconAction icon="refresh" label="Refresh" busy />);
    expect(html).toContain('data-slot="button"');
    expect(html).toContain('data-variant="ghost"');
    expect(html).toContain('data-size="sm"');
    expect(html).toContain('aria-label="Refresh"');
    expect(html).toContain('disabled=""');
  });
  test('loading and empty states have consistent semantics without introducing tasks', () => {
    const loading = renderToStaticMarkup(<LoadingState>Loading saved listings…</LoadingState>);
    const empty = renderToStaticMarkup(<EmptyState title="No conversations yet" action={<a href="/explore">Explore listings</a>}>No messages yet.</EmptyState>);
    expect(loading).toContain('role="status"');
    expect(empty).toContain('<h2>No conversations yet</h2>');
    expect(empty).toContain('href="/explore"');
  });
  test('compact empty and error states keep the existing inline presentation', () => {
    const empty = renderToStaticMarkup(<EmptyState compact>Nothing saved yet.</EmptyState>);
    const error = renderToStaticMarkup(<ErrorState compact title="Could not load saved listings" retry={() => {}}>Network unavailable.</ErrorState>);
    expect(empty).toContain('class="muted"');
    expect(empty).not.toContain('<h2>');
    expect(error).toContain('role="alert"');
    expect(error).toContain('Retry</button>');
  });
  test('full-page errors explain the problem and provide retry', () => {
    const html = renderToStaticMarkup(<ErrorState title="Messages could not load" retry={() => {}} retryText="Try again">Network unavailable.</ErrorState>);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Messages could not load');
    expect(html).toContain('Try again</button>');
  });
  test('light-only scales reuse current theme rather than inventing palette values', () => {
    const css = readFileSync(new URL('../../resources/css/ui-consistency.css', import.meta.url), 'utf8');
    for (const variable of ['--ui-space-1: 4px','--ui-space-8: 64px','--ui-radius-sm: 6px','--ui-radius-md: 12px','--ui-radius-full: 9999px','--ui-touch-target: 44px']) {
      expect(css).toContain(variable);
    }
    expect(css).not.toMatch(/#[a-fA-F0-9]{6}/);
  });
});
