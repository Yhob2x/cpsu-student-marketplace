import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InstallApp } from '../../resources/js/install-app';

const originalMatchMedia = window.matchMedia;
const currentNav = Object.getOwnPropertyDescriptor(navigator, 'standalone');

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  });
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: false });
});
afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
  if (currentNav) Object.defineProperty(navigator, 'standalone', currentNav);
  else Reflect.deleteProperty(navigator, 'standalone');
});

describe('shared header installation action', () => {
  test('is a small, accessible secondary action with on-demand guidance', () => {
    render(<InstallApp />);
    const install = screen.getByRole('button', { name: 'Install app — CPSU Market' });
    expect(install.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelectorAll('.install-app--header')).toHaveLength(1);
    expect(screen.queryByText('Install CPSU Market')).toBeNull();
    fireEvent.click(install);
    expect(screen.getByText('Install CPSU Market')).toBeTruthy();
    expect(install.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Install CPSU Market')).toBeNull();
    expect(install.getAttribute('aria-expanded')).toBe('false');
  });

  test('uses the native prompt when supported, and hides after installation', async () => {
    render(<InstallApp />);
    let called = 0;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: async () => { called++; },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    fireEvent(window, event);
    fireEvent.click(screen.getByRole('button', { name: 'Install app — CPSU Market' }));
    await waitFor(() => expect(called).toBe(1));
    fireEvent(window, new Event('appinstalled'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Install app — CPSU Market' })).toBeNull());
  });

  test('does not advertise installation inside a standalone PWA', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
    });
    const rendered = render(<InstallApp />);
    expect(rendered.container.textContent).toBe('');
  });
});
