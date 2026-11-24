import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { FloatingChat, showFloatingChat } from '../../resources/js/floating-chat';

function html(path: string, ready: boolean, isStaff: boolean, signedIn: boolean, unread: number) {
  return renderToStaticMarkup(<StaticRouter location={path}>
    <FloatingChat ready={ready} isStaff={isStaff} signedIn={signedIn} unreadMessages={unread} />
  </StaticRouter>);
}
describe('floating Chat shortcut', () => {
  test('hides in a conversation, inbox and sign-in pages, and for staff', () => {
    for (const path of ['/inquiries', '/inquiries/42', '/login', '/register']) {
      expect(showFloatingChat(path, true, false)).toBe(false);
      expect(html(path, true, false, true, 7)).not.toContain('floating-chat');
    }
    expect(html('/', true, true, true, 3)).not.toContain('floating-chat');
    expect(html('/', false, false, false, 0)).not.toContain('floating-chat');
  });
  test('guest Chat opens sign-in with a safe inbox return path and no count', () => {
    const output = html('/', true, false, false, 38);
    expect(output).toContain('href="/login?next=%2Finquiries"');
    expect(output).toContain('Chat');
    expect(output).not.toContain('floating-chat-badge');
  });
  test('signed-in students see the live unread badge, capped to 99+', () => {
    expect(html('/explore', true, false, true, 38)).toContain('38 unread messages');
    expect(html('/explore', true, false, true, 38)).toContain('floating-chat-badge');
    expect(html('/profile', true, false, true, 125)).toContain('99+');
    expect(html('/', true, false, true, 0)).not.toContain('floating-chat-badge');
  });
});
