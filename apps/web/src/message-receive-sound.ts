/**
 * Original 'ting' feedback for NEW INCOMING messages while a chat is open.
 *
 * No sound for sent messages, initial history, or a hidden/unfocused tab.
 * iPhone Safari may require a user gesture to unlock Web Audio before a poll arrives.
 *
 * Audio is synthesized locally as a bell-like WAV. No audio downloads, Web Push,
 * notification permission, analytics, or backend changes are involved.
 */
const preferenceKey = 'cpsu-market:message-receive-sound';
const oldPreferenceKey = 'cpsu-market:message-send-sound'; // Keep existing opt-out.

let activeChoice: boolean | null = null;
let sound: HTMLAudioElement | null = null;
let soundConstructor: typeof Audio | null = null;
let wavDataUri: string | null = null;
let fallbackContext: AudioContext | null = null;
const activeBellGains = new Set<GainNode>();

export function messageReceiveSoundEnabled(): boolean {
  if (activeChoice !== null) return activeChoice;
  try {
    return typeof window !== 'undefined' &&
      (window.localStorage.getItem(preferenceKey) ?? window.localStorage.getItem(oldPreferenceKey)) !== 'off';
  } catch { return true; }
}

export function setMessageReceiveSoundEnabled(enabled: boolean): void {
  activeChoice = enabled;
  try { window.localStorage.setItem(preferenceKey, enabled ? 'on' : 'off'); }
  catch { /* Private-browsing restrictions cannot prevent in-page muting. */ }
  if (!enabled) {
    if (sound && !sound.paused) {
      try { sound.pause(); sound.currentTime = 0; } catch { /* Audio is optional. */ }
    }
    for (const gain of activeBellGains) {
      try {
        const now = fallbackContext?.currentTime ?? 0;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
      } catch { /* Muting must never interrupt chat. */ }
    }
  }
}

/** Original glass-bell 'ting': one crisp strike with a short, shimmering decay. */
function makeWavDataUri(): string {
  if (wavDataUri) return wavDataUri;
  const rate = 24000;
  const duration = 0.58;
  const frames = Math.ceil(rate * duration);
  const bytes = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(bytes);
  const ascii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  ascii(0, 'RIFF'); view.setUint32(4, 36 + frames * 2, true);
  ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); ascii(36, 'data');
  view.setUint32(40, frames * 2, true);
  for (let i = 0; i < frames; i++) {
    const t = i / rate;
    // One glassy strike, with inharmonic partials for a natural bell quality.
    // No extra delayed musical note; the decay is the 'iiing' the user hears.
    const attack = Math.min(1, t / 0.0025);
    const fade = Math.min(1, Math.max(0, (duration - t) / 0.085));
    const fundamental = Math.exp(-t / 0.215);
    const upper = Math.exp(-t / 0.071);
    const shimmer = Math.exp(-t / 0.125);
    const tone =
      0.79 * fundamental * Math.sin(2 * Math.PI * 1174.66 * t) +
      0.20 * upper * Math.sin(2 * Math.PI * 2349.32 * t + 0.17) +
      0.12 * upper * Math.sin(2 * Math.PI * 3076.5 * t + 0.39) +
      0.085 * shimmer * Math.sin(2 * Math.PI * 1761.99 * t + 0.55);
    const sample = Math.max(-1, Math.min(1, 0.67 * attack * fade * tone));
    view.setInt16(44 + i * 2, Math.round(32767 * sample), true);
  }
  const chars: string[] = [];
  const data = new Uint8Array(bytes);
  for (let i = 0; i < data.length; i += 1024) {
    chars.push(String.fromCharCode(...data.subarray(i, i + 1024)));
  }
  wavDataUri = 'data:audio/wav;base64,' + btoa(chars.join(''));
  return wavDataUri;
}

/** Safe to call on mount: prepares local audio without playing it or needing permission. */
export function prepareMessageReceiveSound(): void {
  if (!messageReceiveSoundEnabled() || typeof Audio === 'undefined') return;
  // Recreate the element if the browser's Audio implementation changes; this
  // also keeps chat component tests isolated from a previous synthetic DOM.
  if (sound && soundConstructor !== Audio) sound = null;
  if (sound) return;
  try {
    sound = new Audio(makeWavDataUri());
    soundConstructor = Audio;
    sound.preload = 'auto';
    sound.volume = 0.7;
    sound.load();
  } catch { sound = null; }
}

/**
 * Pure gate used by the chat poll: initial history, own messages, repeat polls
 * and background/refocus catch-up must never trigger an incoming sound.
 */
export function hasNewIncomingMessage(
  messages: ReadonlyArray<{ id: number; mine: boolean }>,
  knownIds: ReadonlySet<number>,
  historyLoaded: boolean,
  foreground: boolean,
): boolean {
  return historyLoaded && foreground && messages.some(message => !message.mine && !knownIds.has(message.id));
}

/**
 * Call from a real touch/click/key interaction with the conversation.
 * Silent audio unlock allows a later incoming poll to ring on iPhone Safari
 * when Web Audio is permitted. Never plays a notification itself.
 */
export function unlockMessageReceiveSound(): void {
  if (!messageReceiveSoundEnabled() || typeof window === 'undefined') return;
  prepareMessageReceiveSound();
  const Constructor = window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) return;
  try {
    if (fallbackContext?.state === 'running') return;
    if (!fallbackContext || fallbackContext.state === 'closed') fallbackContext = new Constructor();
    if (fallbackContext.state !== 'running') void fallbackContext.resume().catch(() => {});
    const oscillator = fallbackContext.createOscillator();
    const silent = fallbackContext.createGain();
    silent.gain.value = 0;
    oscillator.connect(silent);
    silent.connect(fallbackContext.destination);
    oscillator.start();
    oscillator.stop(fallbackContext.currentTime + 0.008);
    oscillator.onended = () => { oscillator.disconnect(); silent.disconnect(); };
  } catch { /* Sound remains optional and must never interrupt messaging. */ }
}

function webAudioFallback(): void {
  if (typeof window === 'undefined') return;
  const Constructor = window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) return;
  try {
    if (!fallbackContext || fallbackContext.state === 'closed') fallbackContext = new Constructor();
    // Always resume on the gesture, including WebKit's 'interrupted' state.
    if (fallbackContext.state !== 'running') void fallbackContext.resume().catch(() => {});
    const context = fallbackContext;
    const start = context.currentTime + 0.003;
    // Single-strike bell fallback with matching bright/soft partials.
    for (const [frequency, level, decay] of [
      [1174.66, 0.23, 0.39],
      [2349.32, 0.056, 0.15],
      [3076.5, 0.034, 0.14],
      [1761.99, 0.024, 0.24],
    ]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      activeBellGains.add(gain);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(level, start + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.58);
      oscillator.onended = () => { activeBellGains.delete(gain); oscillator.disconnect(); gain.disconnect(); };
    }
  } catch { /* Never block messaging if audio APIs are restricted. */ }
}

/**
 * Call when a genuinely new INCOMING message is observed while the chat is in focus.
 * The Test sound button also calls this from a trusted gesture.
 */
export function playMessageReceiveSound(): void {
  if (!messageReceiveSoundEnabled()) return;
  prepareMessageReceiveSound();
  // Prefer Web Audio after the user's first interaction; it can ring during
  // a later polling callback even when iOS Safari blocks HTML audio autoplay.
  if (fallbackContext?.state === 'running') { webAudioFallback(); return; }
  if (!sound) { return; }
  try {
    sound.pause();
    sound.currentTime = 0;
    const started = sound.play();
    if (started && typeof started.catch === 'function') {
      void started.catch(() => {
        // WebKit may reject a media element after interrupted audio.
        // The next user gesture can retry with a fresh element.
        sound = null;
      });
    }
  } catch { sound = null; /* iPhone may require a new user tap to re-enable sound. */ }
}
