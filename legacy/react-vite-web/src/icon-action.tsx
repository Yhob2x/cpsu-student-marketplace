import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './icons';
import { Button } from './components/ui/button';

type IconActionProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'> & {
  icon: IconName;
  label: string;
  busy?: boolean;
};

/** Icon-only controls retain a readable accessible name and native button behavior. */
export function IconAction({ icon, label, busy = false, disabled, className = '', ...props }: IconActionProps) {
  return <Button {...props} type="button" variant="ghost" size="sm" className={`icon-action ${className}`.trim()}
    aria-label={label} title={label} aria-busy={busy} data-icon={icon} disabled={disabled || busy}>
    <Icon name={icon} size={20} />
  </Button>;
}
