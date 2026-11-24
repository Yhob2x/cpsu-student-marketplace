import type { ReactNode } from 'react';

/** Presentation only: callers own fetches, retries, state and authorization. */
export function LoadingState({ children }: { children: ReactNode }) {
  return <p className="muted" role="status">{children}</p>;
}

export function EmptyState({ title, children, action, compact = false }: {
  title?: string; children: ReactNode; action?: ReactNode; compact?: boolean;
}) {
  if (compact) return <p className="muted">{children}</p>;
  return <div className="empty">
    {title && <h2>{title}</h2>}
    <p className="muted">{children}</p>
    {action}
  </div>;
}

export function ErrorState({ title, children, retry, retryText = 'Retry', compact = false }: {
  title: string; children: ReactNode; retry?: () => void;
  retryText?: string; compact?: boolean;
}) {
  if (compact) return <p className="err" role="alert">
    {title}: {children}
    {retry && <> <button type="button" className="btn ghost" onClick={retry}>{retryText}</button></>}
  </p>;
  return <div className="empty" role="alert">
    <h2>{title}</h2>
    <p className="muted">{children}</p>
    {retry && <button type="button" className="btn" onClick={retry}>{retryText}</button>}
  </div>;
}
