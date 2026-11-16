import { useEffect, useId, useState } from 'react';
import { Icon } from './icons';

// Chromium provides a native PWA installation prompt. Safari on iOS does not.
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isAppleMobile = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function InstallApp({ variant = 'strip' }: { variant?: 'strip' | 'panel' }) {
  const [installed, setInstalled] = useState(isInstalled);
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [feedback, setFeedback] = useState('');
  const guidanceId = useId();

  useEffect(() => {
    const ready = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPrompt);
      setFeedback('');
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

  const install = async () => {
    setFeedback('');
    if (!promptEvent) {
      setShowInstructions(value => !value);
      return;
    }
    try {
      // Prompt must originate from this user click, not from a timer or effect.
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      if (choice.outcome === 'dismissed') {
        setFeedback('Installation cancelled. You can try again from the browser menu.');
        setShowInstructions(true);
      }
    } catch {
      setPromptEvent(null);
      setFeedback('The browser could not open installation right now.');
      setShowInstructions(true);
    }
  };

  if (installed) return null;

  return <section className={`install-app install-app--${variant}`} aria-label="Install CPSU Market">
    <div className="install-app__intro">
      <img src="/icons/icon-192.png" width="48" height="48" alt="" loading="lazy" />
      <div>
        <h2>CPSU Market on your phone</h2>
        <p>Add the marketplace to your Home Screen for quick access.</p>
      </div>
    </div>
    <button type="button" className="btn install-app__button" onClick={() => void install()}
      aria-expanded={promptEvent ? undefined : showInstructions}
      aria-controls={showInstructions ? guidanceId : undefined}>
      <Icon name="download" size={18} /> Install app
    </button>
    {feedback && <p className="install-app__feedback" role="status">{feedback}</p>}
    {showInstructions && <div className="install-app__guide" id={guidanceId}>
      {isAppleMobile() ? <p><strong>iPhone or iPad:</strong> Open this site in Safari, tap
        <strong> Share</strong>, choose <strong>Add to Home Screen</strong>, turn on
        <strong> Open as Web App</strong> if offered, then tap <strong>Add</strong>.</p>
        : <p><strong>Android or computer:</strong> Open your browser menu and choose
          <strong> Install app</strong> or <strong>Add to Home Screen</strong>, if available.</p>}
      {!window.isSecureContext && <p className="install-app__warning">
        This local HTTP address does not support full PWA installation. Use a trusted HTTPS
        website to enable the installable app and its service worker on your phone.
      </p>}
    </div>}
  </section>;
}
