import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { PAGE_GROUPS, readSource } from './support/source-files';
import { renderToStaticMarkup } from 'react-dom/server';
import { IconAction } from '../../resources/js/components/icon-action';

describe('icon-only button accessibility', () => {
  test('mobile Alerts keeps accessible action names and filter wording', () => {
    const page = readSource(...PAGE_GROUPS.profile);
    const shell = readSource(...PAGE_GROUPS.shell);
    const styles = readFileSync(new URL('../../resources/css/notifications.css', import.meta.url), 'utf8');
    // Icon-only actions keep an accessible name; main PWA tabs retain visible labels.
    expect(page).toContain('aria-label={busy ? \'Marking all notifications as read\' : \'Mark all as read\'}');
    expect(page).toContain('<span className="sr-only">{busy ? \'Marking notifications read\' : \'Mark all read\'}</span>');
    expect(page).toContain('role="group" aria-label="Filter notifications"');
    expect(shell).toContain('aria-label={unread > 0 ? `Notifications, ${unread} unread` : \'Notifications\'}');
    // Concept 2: Saved moved into the account menu; bottom tabs keep icon plus visible label.
    expect(shell).toContain('<Link to="/saved"><Icon name="heart" size={17} /> Saved listings</Link>');
    expect(shell).toContain("<Icon name={isActive ? 'homeSolid' : 'home'} size={24} /><span>Home</span>");
    expect(shell).toContain('`Inbox, ${unreadMessages} unread');
    expect(shell).toContain('className="nav-badge" aria-hidden="true"');
    expect(styles).toContain('.actions .alerts .nav-badge {');
    expect(styles).toContain('.notifications-mark-all.btn {');
    expect(styles).toContain('.notifications-summary-icon { display: none; }');
  });
  test('notification screen uses icon actions rather than duplicate visible text buttons', () => {
    const source = readSource(...PAGE_GROUPS.profile);
    expect(source).toContain('<IconAction className="notifications-refresh" icon="refresh"');
    expect(source).toContain('<IconAction className="notification-mark-one" icon="check"');
    expect(source).not.toContain("'Mark read'");
    expect(source).not.toContain("'Check now'");
  });
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
