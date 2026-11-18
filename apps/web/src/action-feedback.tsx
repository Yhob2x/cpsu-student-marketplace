import { useEffect, useState } from 'react';
import { AlertCircle, Check, Info, X } from 'lucide-react';

export type ActionFeedback = {
  kind: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
};

const FEEDBACK_EVENT = 'cpsu:action-feedback';

/** Call only after an action has a confirmed result; never before a request succeeds. */
export function showActionFeedback(feedback: ActionFeedback): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ActionFeedback>(FEEDBACK_EVENT, { detail: feedback }));
}

/** Shared, non-blocking feedback for student, seller and administrative actions. */
export function ActionFeedbackHost() {
  const [notice, setNotice] = useState<(ActionFeedback & { id: number }) | null>(null);

  useEffect(() => {
    let nextId = 0;
    const onFeedback = (event: Event) => {
      const detail = (event as CustomEvent<ActionFeedback>).detail;
      if (!detail || !detail.title || !detail.message) return;
      setNotice({ ...detail, id: ++nextId });
    };
    window.addEventListener(FEEDBACK_EVENT, onFeedback);
    return () => window.removeEventListener(FEEDBACK_EVENT, onFeedback);
  }, []);

  useEffect(() => {
    if (!notice || notice.kind === 'error') return;
    const timeout = window.setTimeout(() => setNotice(current => current?.id === notice.id ? null : current), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  if (!notice) return null;
  const Icon = notice.kind === 'success' ? Check : notice.kind === 'info' ? Info : AlertCircle;
  return <div className="action-feedback-viewport">
    <section
      key={notice.id}
      className={`action-feedback action-feedback--${notice.kind}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
    >
      <span className="action-feedback-symbol" aria-hidden="true"><Icon size={24} strokeWidth={2.5} /></span>
      <div className="action-feedback-content">
        <strong>{notice.title}</strong>
        <p>{notice.message}</p>
      </div>
      <button type="button" className="action-feedback-dismiss" onClick={() => setNotice(null)} aria-label="Dismiss feedback">
        <X size={17} aria-hidden="true" />
      </button>
    </section>
  </div>;
}
