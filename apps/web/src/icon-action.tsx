import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './icons';

type IconActionProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'> & {
  icon: IconName;
  label: string;
  busy?: boolean;
};

/** Icon-only controls retain a readable accessible name and native button behavior. */
export function IconAction({ icon, label, busy = false, disabled, className = '', ...props }: IconActionProps) {
  return <button {...props} type="button" className={`icon-action ${className}`.trim()}
    aria-label={label} title={label} aria-busy={busy} data-icon={icon} disabled={disabled || busy}>
    <Icon name={icon} size={20} />
  </button>;
}
