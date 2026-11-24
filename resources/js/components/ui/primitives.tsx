import { createElement, type HTMLAttributes, type LabelHTMLAttributes } from 'react';

type PanelTag = 'div' | 'section' | 'article' | 'aside';

/**
 * Keep the legacy .panel contract while standardizing markup.
 * Rendering the requested HTML tag preserves section landmarks and events.
 */
export function Panel({ as: Tag = 'div', className = '', ...props }: HTMLAttributes<HTMLElement> & { as?: PanelTag }) {
  return createElement(Tag, { ...props, className: ['panel', className].filter(Boolean).join(' ') });
}

/** Native label wrapper; never hides a form control's visible or accessible name. */
export function Field({ className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} className={['field', className].filter(Boolean).join(' ')} />;
}
