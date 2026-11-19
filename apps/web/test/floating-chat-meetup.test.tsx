import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FloatingChatPanel } from '../src/floating-chat-panel';
import { messageReceiveSoundEnabled, setMessageReceiveSoundEnabled } from '../src/message-receive-sound';

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
    if (path.endsWith('/inquiries')) return Response.json([{
      id: 9, otherStudentName: 'Sofia', listing: { title: 'Notebook' },
      status: 'open', lastMessage: null,
    }]);
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
