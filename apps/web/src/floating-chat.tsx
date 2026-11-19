import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from './icons';
import { FloatingChatPanel } from './floating-chat-panel';
import { unlockMessageReceiveSound } from './message-receive-sound';

/** Hide on full messaging routes, sign-in forms, and staff workspaces. */
export function showFloatingChat(pathname: string, ready: boolean, isStaff: boolean) {
  return ready && !isStaff
    && !/^\/(?:inquiries(?:\/|$)|login\/?$|register\/?$)/.test(pathname);
}

type MotionState = 'closed' | 'entering' | 'open' | 'exiting';

export function FloatingChat({ ready, isStaff, signedIn, unreadMessages, campusName, onUnreadChanged }: {
  ready: boolean;
  isStaff: boolean;
  signedIn: boolean;
  unreadMessages: number;
  campusName?: string | null;
  onUnreadChanged?: () => Promise<void>;
}) {
  const { pathname } = useLocation();
  const [motionState, setMotionState] = useState<MotionState>('closed');
  const [motionEnabled, setMotionEnabled] = useState(true);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const visible = showFloatingChat(pathname, ready, isStaff);
  const rendered = motionState !== 'closed';
  const expanded = motionState === 'open' || motionState === 'entering';

  useEffect(() => { setMotionState('closed'); }, [pathname, signedIn, visible]);

  // Wait until the starting (slightly offset) frame has rendered, then animate in.
  // Closing uses a reversible CSS transition; no timeout can leave a ghost dialog.
  useEffect(() => {
    if (motionState !== 'entering') return;
    const frame = window.requestAnimationFrame(() => setMotionState(current =>
      current === 'entering' ? 'open' : current));
    return () => window.cancelAnimationFrame(frame);
  }, [motionState]);

  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const close = (instant = false, restoreFocus = true) => {
    setMotionState(current => !instant && motionEnabled && !prefersReducedMotion() && current !== 'closed'
      ? 'exiting' : 'closed');
    if (restoreFocus) triggerRef.current?.focus();
  };
  const toggle = (keyboard: boolean) => {
    unlockMessageReceiveSound();
    const reduce = keyboard || prefersReducedMotion();
    setMotionEnabled(!reduce);
    setMotionState(current => {
      if (current === 'open' || current === 'entering') return reduce || !motionEnabled ? 'closed' : 'exiting';
      if (current === 'exiting') return 'open'; // A quick second click reverses the closing transition.
      return reduce ? 'open' : 'entering';
    });
  };

  useEffect(() => {
    if (!rendered) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(true);
      }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) close(false, false);
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
    };
  }, [rendered, motionEnabled]);

  if (!visible) return null;
  const unread = signedIn && Number.isFinite(unreadMessages) ? Math.max(0, Math.trunc(unreadMessages)) : 0;
  const label = unread > 0 ? `Chat, ${unread} unread message${unread === 1 ? '' : 's'}` : 'Chat — open messages';
  const contents = <>
    <Icon name="chat" size={21} />
    <span>Chat</span>
    {unread > 0 && <span className="floating-chat-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
  </>;
  if (!signedIn) return <Link className="floating-chat" to="/login?next=%2Finquiries" aria-label={label}>
    {contents}
  </Link>;
  return <div className="floating-chat-widget" ref={containerRef}>
    <button ref={triggerRef} type="button" className="floating-chat"
      aria-label={label} aria-expanded={expanded} aria-controls={expanded ? 'floating-chat-panel' : undefined}
      onClick={event => toggle(event.detail === 0)}>
      {contents}
    </button>
    {rendered && <FloatingChatPanel
      campusName={campusName}
      motionState={motionState}
      motionEnabled={motionEnabled}
      onExitComplete={() => setMotionState(current => current === 'exiting' ? 'closed' : current)}
      onUnreadChanged={onUnreadChanged ?? (async () => {})}
      onClose={instant => close(Boolean(instant))} />}
  </div>;
}
