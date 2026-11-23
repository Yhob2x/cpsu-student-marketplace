import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConversationSwipeActions } from '../src/conversation-swipe-actions';

afterEach(() => cleanup());

function setup(muted = false) {
  let muteCalls: boolean[] = [];
  let deleteCalls = 0;
  const view = render(<ConversationSwipeActions name="Alex" muted={muted}
    onMute={async value => { muteCalls.push(value); }}
    onDelete={async () => { deleteCalls++; }}>
    <button type="button">Open chat</button>
  </ConversationSwipeActions>);
  return { view, get muteCalls() { return muteCalls; }, get deleteCalls() { return deleteCalls; } };
}

describe('conversation swipe actions', () => {
  test('offers keyboard-accessible actions with explicit More button', async () => {
    const state = setup();
    const more = screen.getByRole('button', { name: 'Show options for Alex' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'Mute notifications for Alex' }).tabIndex).toBe(-1);
    fireEvent.click(more);
    expect(screen.getByRole('button', { name: 'Mute notifications for Alex' }).tabIndex).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Mute notifications for Alex' }));
    await waitFor(() => expect(state.muteCalls).toEqual([true]));
    expect(state.deleteCalls).toBe(0);
  });

  test('swipe left opens actions without treating a vertical scroll as a swipe', () => {
    const state = setup();
    const foreground = state.view.container.querySelector<HTMLElement>('.swipe-conversation-foreground')!;
    fireEvent.pointerDown(foreground, { pointerId: 1, button: 0, clientX: 230, clientY: 90 });
    fireEvent.pointerMove(foreground, { pointerId: 1, clientX: 226, clientY: 150 });
    fireEvent.pointerUp(foreground, { pointerId: 1, clientX: 226, clientY: 150 });
    expect(foreground.getAttribute('data-open')).toBe('false');

    fireEvent.pointerDown(foreground, { pointerId: 2, button: 0, clientX: 235, clientY: 90 });
    fireEvent.pointerMove(foreground, { pointerId: 2, clientX: 150, clientY: 93 });
    fireEvent.pointerUp(foreground, { pointerId: 2, clientX: 150, clientY: 93 });
    expect(foreground.getAttribute('data-open')).toBe('true');
  });

  test('delete asks for confirmation and does not run when cancelled', async () => {
    const state = setup(true);
    fireEvent.click(screen.getByRole('button', { name: 'Show options for Alex' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alex from my inbox' }));
    expect(screen.getByText('Delete from your inbox?')).toBeTruthy();
    expect(screen.getByText(/transaction records are preserved/)).toBeTruthy();
    expect(state.deleteCalls).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(state.deleteCalls).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Show options for Alex' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alex from my inbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete from inbox' }));
    await waitFor(() => expect(state.deleteCalls).toBe(1));
  });
});
