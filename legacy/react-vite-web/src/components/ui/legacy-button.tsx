import { forwardRef, type ButtonHTMLAttributes } from 'react';

/**
 * Compatibility wrapper for existing .btn controls.
 * Keep the native button and CSS contract until each surface is safely
 * migrated to the shared shadcn Button. Not a new design variant.
 */
export const LegacyButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function LegacyButton({ className = '', ...props }, ref) {
    return <button {...props} ref={ref} className={['btn', className].filter(Boolean).join(' ')} />;
  },
);
