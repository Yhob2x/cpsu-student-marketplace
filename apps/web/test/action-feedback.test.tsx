import { afterEach, describe, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActionFeedbackHost, showActionFeedback } from '../src/action-feedback';

afterEach(() => cleanup());

describe('Shared action feedback', () => {
  test('announces a confirmed success and can be dismissed', () => {
    render(<ActionFeedbackHost />);
    act(() => showActionFeedback({ kind: 'success', title: 'Task completed', message: 'Your changes have been saved successfully.' }));
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Task completed');
    expect(status.textContent).toContain('Your changes have been saved successfully.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss feedback' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('uses alert semantics for errors and replaces an earlier success', () => {
    render(<ActionFeedbackHost />);
    act(() => showActionFeedback({ kind: 'success', title: 'Saved', message: 'Success.' }));
    act(() => showActionFeedback({ kind: 'error', title: 'Upload failed', message: 'Please try again.' }));
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Upload failed');
    expect(alert.textContent).toContain('Please try again.');
    expect(screen.queryByText('Success.')).toBeNull();
  });
});
