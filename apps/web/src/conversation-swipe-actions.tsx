import { useRef, useState, type PointerEvent, type MouseEvent, type ReactNode } from 'react';
import { Bell, BellOff, MoreHorizontal, Trash2 } from 'lucide-react';
import { explain } from './api';

const ACTION_WIDTH = 160;
const GESTURE_START = 12;
const SWIPE_THRESHOLD = 45;

type Props = {
  name: string;
  muted: boolean;
  children: ReactNode;
  onMute: (nextMuted: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
};
type Gesture = { x: number; y: number; originallyOpen: boolean; dragging: boolean };

/** Touch gesture is progressive enhancement: More actions is the keyboard/mouse fallback. */
export function ConversationSwipeActions({ name, muted, children, onMute, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    if (pending || confirmDelete || event.button !== 0
      || (event.target instanceof Element && event.target.closest('.swipe-conversation-more'))) return;
    gesture.current = { x: event.clientX, y: event.clientY, originallyOpen: open, dragging: false };
    suppressClick.current = false;
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (!g.dragging) {
      if (Math.abs(dy) >= GESTURE_START && Math.abs(dy) > Math.abs(dx)) {
        gesture.current = null;
        return; // Native vertical scrolling always wins.
      }
      if (Math.abs(dx) < GESTURE_START || Math.abs(dx) < Math.abs(dy) * 1.25) return;
      g.dragging = true;
    }
    const start = g.originallyOpen ? -ACTION_WIDTH : 0;
    setDrag(Math.max(-ACTION_WIDTH, Math.min(0, start + dx)));
  };
  const onUp = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.dragging) {
      const dx = event.clientX - g.x;
      const next = g.originallyOpen ? dx < SWIPE_THRESHOLD : dx < -SWIPE_THRESHOLD;
      setOpen(next);
      suppressClick.current = true;
    }
    setDrag(null);
  };
  const onCancel = () => { gesture.current = null; setDrag(null); };
  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick.current = false;
      return;
    }
    // A tap on a revealed row closes the tray instead of accidentally navigating.
    if (open && !(event.target instanceof Element && event.target.closest('.swipe-conversation-more'))) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  };
  const toggleMute = async () => {
    if (pending) return;
    setPending(true);
    setError('');
    try { await onMute(!muted); setOpen(false); }
    catch (e) { setError(explain(e)); }
    finally { setPending(false); }
  };
  const deleteFromInbox = async () => {
    if (pending) return;
    setPending(true);
    setError('');
    try { await onDelete(); }
    catch (e) { setError(explain(e)); setPending(false); }
  };

  return <div className="swipe-conversation">
    <div className="swipe-conversation-track">
      <div className="swipe-conversation-actions" aria-label={`Actions for ${name}`} aria-hidden={!open}>
        <button type="button" disabled={pending} tabIndex={open ? 0 : -1}
          aria-label={`${muted ? 'Unmute' : 'Mute'} notifications for ${name}`}
          onClick={() => void toggleMute()}>
          {muted ? <Bell size={19} aria-hidden="true" /> : <BellOff size={19} aria-hidden="true" />}
          <span>{muted ? 'Unmute' : 'Mute'}</span>
        </button>
        <button type="button" disabled={pending} tabIndex={open ? 0 : -1}
          aria-label={`Delete ${name} from my inbox`}
          onClick={() => { setOpen(false); setConfirmDelete(true); setError(''); }}>
          <Trash2 size={19} aria-hidden="true" /><span>Delete</span>
        </button>
      </div>
      <div className="swipe-conversation-foreground"
        style={drag === null ? undefined : { transform: `translate3d(${drag}px, 0, 0)`, transition: 'none' }}
        data-open={open ? 'true' : 'false'}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        onPointerCancel={onCancel} onClickCapture={onClickCapture}>
        <div className="swipe-conversation-content">{children}</div>
        <button type="button" className="swipe-conversation-more"
          aria-label={`${open ? 'Close' : 'Show'} options for ${name}`}
          aria-expanded={open} disabled={pending}
          onClick={() => setOpen(value => !value)}>
          <MoreHorizontal size={19} aria-hidden="true" />
        </button>
      </div>
    </div>
    {confirmDelete && <div className="swipe-conversation-confirm" role="group"
      aria-label={`Remove conversation with ${name}`}>
      <strong>Delete from your inbox?</strong>
      <p>This hides the chat only for you. Messages and transaction records are preserved. A new message can bring it back.</p>
      <div>
        <button type="button" className="swipe-conversation-delete-confirm" disabled={pending}
          onClick={() => void deleteFromInbox()}>{pending ? 'Deleting…' : 'Delete from inbox'}</button>
        <button type="button" disabled={pending}
          onClick={() => { setConfirmDelete(false); setError(''); }}>Cancel</button>
      </div>
    </div>}
    {error && <p className="swipe-conversation-error" role="alert">{error}</p>}
  </div>;
}
