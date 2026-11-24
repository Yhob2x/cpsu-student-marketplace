import { useEffect, useState } from 'react';
import { AlertCircle, Check, Info, X } from 'lucide-react';

export type ActionFeedback = {
  kind: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  /** Reserve the centered confirmation for meaningful, completed milestones. */
  presentation?: 'toast' | 'center';
};

const FEEDBACK_EVENT = 'cpsu:action-feedback';

/** Call only after an action has a confirmed result; never before a request succeeds. */
export function showActionFeedback(feedback: ActionFeedback): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ActionFeedback>(FEEDBACK_EVENT, { detail: feedback }));
}

/** Shared feedback for student, seller and staff workflows. Does not trap focus or block the page. */
export function ActionFeedbackHost() {
  const [notice, setNotice] = useState<(ActionFeedback & { id: number }) | null>(null);
  const [closingId, setClosingId] = useState<number | null>(null);

  useEffect(() => {
    let nextId = 0;
    const onFeedback = (event: Event) => {
      const detail = (event as CustomEvent<ActionFeedback>).detail;
      if (!detail || !detail.title || !detail.message) return;
      setClosingId(null);
      setNotice({ ...detail, id: ++nextId });
    };
    window.addEventListener(FEEDBACK_EVENT, onFeedback);
    return () => window.removeEventListener(FEEDBACK_EVENT, onFeedback);
  }, []);

  useEffect(() => {
    if (!notice || notice.kind === 'error' || closingId === notice.id) return;
    let timeout: number | undefined;
    const updateTimer = () => {
      window.clearTimeout(timeout);
      // Do not let feedback expire while the student is in another browser tab.
      if (document.visibilityState === 'visible') {
        timeout = window.setTimeout(() => setClosingId(notice.id), notice.presentation === 'center' ? 4000 : 5000);
      }
    };
    updateTimer();
    document.addEventListener('visibilitychange', updateTimer);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', updateTimer);
    };
  }, [notice, closingId]);

  useEffect(() => {
    if (!notice || closingId !== notice.id) return;
    const timeout = window.setTimeout(() => {
      setNotice(current => current?.id === closingId ? null : current);
      setClosingId(current => current === closingId ? null : current);
    }, 160);
    return () => window.clearTimeout(timeout);
  }, [notice, closingId]);

  if (!notice) return null;
  const centered = notice.presentation === 'center';
  const leaving = closingId === notice.id;
  const Icon = notice.kind === 'success' ? Check : notice.kind === 'info' ? Info : AlertCircle;

  return <div className={`action-feedback-viewport${centered ? ' action-feedback-viewport--center' : ''}`}>
    <section
      key={notice.id}
      className={`action-feedback action-feedback--${notice.kind} action-feedback--${centered ? 'center' : 'toast'}${leaving ? ' action-feedback--leaving' : ''}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
      aria-hidden={leaving ? 'true' : undefined}
      data-presentation={centered ? 'center' : 'toast'}
    >
      <span className="action-feedback-symbol" aria-hidden="true"><Icon size={centered ? 32 : 23} strokeWidth={2.3} /></span>
      <div className="action-feedback-content">
        <strong>{notice.title}</strong>
        <p>{notice.message}</p>
      </div>
      <button
        type="button"
        className="action-feedback-dismiss"
        onClick={() => setClosingId(notice.id)}
        aria-label="Dismiss feedback"
        disabled={leaving}
      ><X size={18} aria-hidden="true" /></button>
    </section>
  </div>;
}
