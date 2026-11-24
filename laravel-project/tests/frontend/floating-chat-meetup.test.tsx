import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FloatingChatPanel } from '../../resources/js/floating-chat-panel';
import { messageReceiveSoundEnabled, setMessageReceiveSoundEnabled } from '../../resources/js/message-receive-sound';

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

function mockChat(transaction: Record<string, unknown> | null, handoff: Record<string, unknown> | null) {
  let ended = false;
  globalThis.fetch = (async (url: string | URL | Request) => {
    // The live conversation requests a paged history; the fixture matches its endpoint.
    const path = String(url).split('?')[0];
    if (path.endsWith('/inquiries/9/close')) {
      ended = true;
      return Response.json({});
    }
    if (path.endsWith('/inquiries')) return Response.json({ items: [{
      id: 9, otherStudentName: 'Sofia', listing: { title: 'Notebook' },
      status: 'open', lastMessage: null,
    }], hasMore: false, nextBeforeId: null });
    if (path.endsWith('/inquiries/9/messages')) return Response.json({
      thread: { id: 9, otherStudentName: 'Sofia', listingId: 7, status: ended ? 'closed' : 'open' },
      listing: null, messages: [], handoff, transaction,
      typing: false, otherActiveInChat: false,
    });
    return Response.json({});
  }) as typeof fetch;
}

async function openChat() {
  render(<MemoryRouter>
    <FloatingChatPanel motionState="open" motionEnabled={false}
      onClose={() => {}} onExitComplete={() => {}} onUnreadChanged={async () => {}} />
  </MemoryRouter>);
  fireEvent.click(await screen.findByText('Sofia'));
  await waitFor(() => expect(screen.getByText('No messages yet. Say hello.')).toBeTruthy());
}

describe('floating chat meetup map', () => {
  test('conversation without a transaction can open the private pin editor', async () => {
    mockChat(null, null);
    await openChat();
    fireEvent.click(screen.getByRole('button', { name: 'Add pin' }));
    expect(screen.getByRole('heading', { name: 'Meetup location' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose meetup pin' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close meetup map' })).toBeTruthy();
  });

  test('floating inbox and conversation share the saved sound preference without a test button', async () => {
    setMessageReceiveSoundEnabled(true);
    try {
      mockChat(null, null);
      render(<MemoryRouter><FloatingChatPanel motionState="open" motionEnabled={false}
        onClose={() => {}} onExitComplete={() => {}} onUnreadChanged={async () => {}} /></MemoryRouter>);
      expect(screen.queryByRole('button', { name: /Test sound/i })).toBeNull();
      const mute = screen.getByRole('button', { name: 'Mute incoming message sounds' });
      expect(mute.getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(mute);
      expect(messageReceiveSoundEnabled()).toBe(false);
      expect(screen.getByRole('button', { name: 'Turn on incoming message sounds' }).getAttribute('aria-pressed')).toBe('false');
      fireEvent.click(await screen.findByText('Sofia'));
      await waitFor(() => expect(screen.getByText('No messages yet. Say hello.')).toBeTruthy());
      expect(screen.getByRole('button', { name: 'Turn on incoming message sounds' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Turn on incoming message sounds' }));
      expect(messageReceiveSoundEnabled()).toBe(true);
    } finally {
      setMessageReceiveSoundEnabled(true);
    }
  });

  test('floating chat offers listing and guarded end chat actions', async () => {
    mockChat(null, null);
    await openChat();
    expect(screen.getByRole('link', { name: 'View listing' }).getAttribute('href')).toBe('/listings/7');
    fireEvent.click(screen.getByRole('button', { name: 'End chat' }));
    expect(screen.getByText('End this chat for both students?')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Your message' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Keep chatting' }));
    expect(screen.queryByText('End this chat for both students?')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'End chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, end chat' }));
    await waitFor(() => expect(screen.getByText('This conversation has ended.')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'End chat' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Full chat' })).toBeTruthy();
  });

  test('confirmed meetup remains visible and offers a deliberate revision', async () => {
    mockChat({
      id: 12, status: 'for_meetup', buyerMeetupConfirmedAt: '2026-11-19T08:00:00Z',
      sellerMeetupConfirmedAt: '2026-11-19T08:05:00Z',
      buyerCompletionConfirmedAt: null, sellerCompletionConfirmedAt: null,
    }, {
      method: 'campus_pickup', timeWindow: 'Friday 2 PM',
      generalLocation: 'Campus gate [geo:9.82759,122.82719]', status: 'proposed',
    });
    await openChat();
    fireEvent.click(screen.getByRole('button', { name: 'View map' }));
    expect(screen.getAllByText('Campus gate', { exact: true }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Open in OpenStreetMap' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Change meetup pin' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View transaction and confirm meetup' })).toBeTruthy();
  });
});

describe('floating inbox unread states and receipts', () => {
  test('unread conversations are distinguished without styling read threads as unread', async () => {
    globalThis.fetch = (async (url: string | URL | Request) => {
      const path = String(url).split('?')[0];
      if (path.endsWith('/inquiries')) return Response.json({
        items: [
          { id: 9, otherStudentName: 'New Partner', listing: { title: 'Notebook' },
            unreadCount: 2, lastMessage: { id: 21, mine: false, body: 'Is it available?', createdAt: '2026-11-19T06:30:00Z' } },
          { id: 10, otherStudentName: 'Read Partner', listing: { title: 'Bag' },
            unreadCount: 0, lastMessage: { id: 20, mine: true, body: 'Thanks', receipt: 'read', createdAt: '2026-11-19T06:00:00Z' } },
        ], hasMore: false, nextBeforeId: null,
      });
      if (path.endsWith('/inquiries/9/messages')) return Response.json({
        thread: { id: 9, otherStudentName: 'New Partner', listingId: 7, status: 'open' },
        listing: null, handoff: null, transaction: null, typing: false,
        messages: [
          { id: 21, mine: false, body: 'Is it available?', seenAt: '2026-11-19T06:40:00Z', createdAt: '2026-11-19T06:30:00Z' },
          { id: 22, mine: true, body: 'Yes', receipt: 'delivered', createdAt: '2026-11-19T06:41:00Z' },
        ],
      });
      return Response.json({});
    }) as typeof fetch;
    render(<MemoryRouter><FloatingChatPanel motionState="open" motionEnabled={false}
      onClose={() => {}} onExitComplete={() => {}} onUnreadChanged={async () => {}} /></MemoryRouter>);
    const unread = await screen.findByRole('button', { name: /New Partner.*2 unread messages/ });
    const read = screen.getByRole('button', { name: /^Read Partner, Bag$/ });
    expect(unread.className).toContain('is-unread');
    expect(read.className).not.toContain('is-unread');
    expect(unread.querySelector('.floating-chat-unread-dot')).toBeTruthy();
    expect(read.querySelector('.floating-chat-unread-dot')).toBeNull();
    expect(read.querySelector('.floating-chat-preview-receipt.is-read')).toBeTruthy();

    fireEvent.click(unread);
    await waitFor(() => expect(screen.getByText('Delivered')).toBeTruthy());
    expect(screen.queryByText('Read')).toBeNull();
  });

  test('the latest outgoing message shows the read double-check state', async () => {
    globalThis.fetch = (async (url: string | URL | Request) => {
      const path = String(url).split('?')[0];
      if (path.endsWith('/inquiries')) return Response.json({
        items: [{ id: 9, otherStudentName: 'Sofia', listing: { title: 'Notebook' }, unreadCount: 0,
          lastMessage: { id: 22, mine: true, receipt: 'read', body: 'Thank you', createdAt: '2026-11-19T06:30:00Z' } }],
        hasMore: false, nextBeforeId: null,
      });
      if (path.endsWith('/inquiries/9/messages')) return Response.json({
        thread: { id: 9, otherStudentName: 'Sofia', listingId: 7, status: 'open' },
        listing: null, handoff: null, transaction: null,
        messages: [{ id: 22, mine: true, body: 'Thank you', receipt: 'read', createdAt: '2026-11-19T06:30:00Z' }],
      });
      return Response.json({});
    }) as typeof fetch;
    render(<MemoryRouter><FloatingChatPanel motionState="open" motionEnabled={false}
      onClose={() => {}} onExitComplete={() => {}} onUnreadChanged={async () => {}} /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Sofia'));
    const read = await screen.findByText('Read');
    expect(read.parentElement?.className).toContain('is-read');
    expect(read.parentElement?.querySelectorAll('svg').length).toBe(1);
  });
});
