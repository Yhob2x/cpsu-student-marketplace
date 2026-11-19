import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FloatingChatPanel } from '../src/floating-chat-panel';

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

function mockChat(transaction: Record<string, unknown> | null, handoff: Record<string, unknown> | null) {
  globalThis.fetch = (async (url: string | URL | Request) => {
    const path = String(url);
    if (path.endsWith('/inquiries')) return Response.json([{
      id: 9, otherStudentName: 'Sofia', listing: { title: 'Notebook' },
      status: 'open', lastMessage: null,
    }]);
    if (path.endsWith('/inquiries/9/messages')) return Response.json({
      thread: { id: 9, otherStudentName: 'Sofia', listingId: 7, status: 'open' },
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
