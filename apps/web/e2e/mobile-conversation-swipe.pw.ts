import { expect, test } from '@playwright/test';

test('mobile quick inbox and full inbox expose safe swipe actions', async ({ page }) => {
  const rows = [
    { id: 9, otherStudentName: 'Alex', listing: { title: 'Notebook' }, status: 'open',
      unreadCount: 1, muted: false,
      lastMessage: { id: 100, mine: false, body: 'Hello', createdAt: '2026-11-23T06:00:00Z' } },
    { id: 10, otherStudentName: 'Jamie', listing: { title: 'Bag' }, status: 'open',
      unreadCount: 0, muted: false,
      lastMessage: { id: 99, mine: false, body: 'Hello', createdAt: '2026-11-23T05:00:00Z' } },
  ];
  const writes: string[] = [];
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/auth/refresh') return json({ accessToken: 'synthetic-test-only' });
    if (path === '/me') return json({ id: 42, displayName: 'Synthetic Student', email: 'synthetic@example.invalid',
      roles: [{ role: 'student', campusId: 1 }], affiliations: [], storeId: null });
    if (path === '/inquiries') return json({ items: rows, hasMore: false, nextBeforeId: null });
    if (path === '/notifications/unread-count') return json({ total: 1, messages: 1 });
    if (path === '/saved') return json([]);
    if (path === '/inquiries/9/preferences' && request.method() === 'PATCH') {
      writes.push('mute');
      rows[0].muted = true;
      return json({ muted: true });
    }
    if (path === '/inquiries/10/hide' && request.method() === 'POST') {
      writes.push('delete');
      rows.splice(1, 1);
      return route.fulfill({ status: 204 });
    }
    return json({});
  });
  // Saved has a simple empty-state fetch; keep this synthetic test independent of Home data.
  await page.goto('/saved');
  await page.locator('.floating-chat').click();
  const quick = page.locator('.floating-chat-panel');
  const alex = quick.locator('.floating-chat-inbox-row', { hasText: 'Alex' });
  await expect(alex).toBeVisible();
  const box = await alex.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 - 110, box!.y + box!.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(quick.locator('.swipe-conversation-foreground').first()).toHaveAttribute('data-open', 'true');
  await quick.getByRole('button', { name: 'Mute notifications for Alex' }).click();
  await expect(quick.getByTitle('Notifications muted')).toBeVisible();
  expect(writes).toContain('mute');

  await page.goto('/inquiries');
  const jamie = page.locator('.inquiry-row', { hasText: 'Jamie' });
  await expect(jamie).toBeVisible();
  const more = page.getByRole('button', { name: 'Show options for Jamie' });
  await more.click();
  await page.getByRole('button', { name: 'Delete Jamie from my inbox' }).click();
  await expect(page.getByText('Delete from your inbox?')).toBeVisible();
  expect(writes).not.toContain('delete');
  await page.getByRole('button', { name: 'Delete from inbox' }).click();
  await expect(jamie).toHaveCount(0);
  expect(writes).toContain('delete');
});
