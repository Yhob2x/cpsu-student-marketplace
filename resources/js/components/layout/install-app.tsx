import { useEffect, useId, useRef, useState } from 'react';

import { Icon } from '@/components/icons';

// Chromium can open a native PWA prompt; iPhone Safari needs manual instructions.
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const isInstalled = () =>
  typeof window !== 'undefined' &&
  ((typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
  (typeof navigator !== 'undefined' &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true));

const isAppleMobile = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// One install action in the shared header: text on desktop, icon on small screens.
export function InstallApp() {
  const [installed, setInstalled] = useState(isInstalled);
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [feedback, setFeedback] = useState('');
  const guidanceId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ready = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPrompt);
      setFeedback('');
      setShowInstructions(false);
    };
    const complete = () => {
      setInstalled(true);
      setPromptEvent(null);
      setShowInstructions(false);
    };
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const checkMode = () => { if (isInstalled()) complete(); };
    window.addEventListener('beforeinstallprompt', ready);
    window.addEventListener('appinstalled', complete);
    displayMode.addEventListener?.('change', checkMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', ready);
      window.removeEventListener('appinstalled', complete);
      displayMode.removeEventListener?.('change', checkMode);
    };
  }, []);

  // Installation help is a lightweight popover: Escape or tapping elsewhere
  // dismisses it without trapping focus or hiding the marketplace.
  useEffect(() => {
    if (!showInstructions) return;
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setShowInstructions(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowInstructions(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [showInstructions]);

  const install = async () => {
    setFeedback('');
    if (!promptEvent) {
      setShowInstructions(value => !value);
      return;
    }
    try {
      // Native installation must be initiated from an actual button click.
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      if (choice.outcome === 'dismissed') {
        setFeedback('Installation cancelled. You can try from the browser menu.');
        setShowInstructions(true);
      }
    } catch {
      setPromptEvent(null);
      setFeedback('The browser could not open installation right now.');
      setShowInstructions(true);
    }
  };

  if (installed) return null;

  return <div ref={rootRef} className="install-app install-app--header">
    <button type="button" className="install-app__button" onClick={() => void install()}
      aria-label="Install app — CPSU Market" title="Install CPSU Market"
      aria-expanded={promptEvent ? undefined : showInstructions}
      aria-controls={showInstructions ? guidanceId : undefined}>
      <Icon name="download" size={18} /><span className="install-app__label">Install app</span>
    </button>
    {showInstructions && <div className="install-app__guide" id={guidanceId}>
      <strong className="install-app__guide-title">Install CPSU Market</strong>
      {feedback && <p className="install-app__feedback" role="status">{feedback}</p>}
      {isAppleMobile() ? <p>On iPhone or iPad, open this site in <strong>Safari</strong>, tap
        <strong> Share</strong>, select <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
        Turn on <strong>Open as Web App</strong> if offered.</p>
        : <p>Open your browser menu and choose <strong>Install app</strong> or
          <strong> Add to Home Screen</strong>, if supported.</p>}
      {!window.isSecureContext && <p className="install-app__warning">
        On your phone, installation needs a secure HTTPS site. Local HTTP addresses
        may not support installation or background notifications.
      </p>}
      <button type="button" className="install-app__close"
        onClick={() => setShowInstructions(false)}>Close instructions</button>
    </div>}
  </div>;
}
