import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { IconAction } from '../src/icon-action';

describe('icon-only button accessibility', () => {
  test('retains a meaningful name, tooltip, and non-decorative button semantics', () => {
    const html = renderToStaticMarkup(<IconAction icon="refresh" label="Refresh notifications" />);
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Refresh notifications"');
    expect(html).toContain('title="Refresh notifications"');
    expect(html).toContain('aria-busy="false"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('>Refresh notifications</button>');
  });
  test('busy and disabled states prevent duplicate activation and stay accessible', () => {
    const html = renderToStaticMarkup(<IconAction icon="check" label="Mark this notification as read" busy />);
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('data-icon="check"');
    expect(html).toContain('title="Mark this notification as read"');
  });
});
