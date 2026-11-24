import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  hasNewIncomingMessage, messageReceiveSoundEnabled, playMessageReceiveSound,
  prepareMessageReceiveSound, setMessageReceiveSoundEnabled, unlockMessageReceiveSound,
} from '../src/message-receive-sound';

const storage = new Map<string, string>();
let plays = 0;
let pauses = 0;
let storedSoundUrl = '';
let storageBlocked = false;

class MockAudio {
  paused = true;
  currentTime = 0;
  preload = '';
  volume = 1;
  constructor(url: string) { storedSoundUrl = url; }
  load() {}
  pause() { pauses++; this.paused = true; }
  play() { plays++; this.paused = false; return Promise.resolve(); }
}

const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const priorAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');

beforeEach(() => {
  storage.clear();
  plays = 0; pauses = 0; storageBlocked = false;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem(key: string) {
          if (storageBlocked) throw new Error('disabled');
          return storage.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          if (storageBlocked) throw new Error('disabled');
          storage.set(key, value);
        },
      },
    },
  });
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: MockAudio });
  setMessageReceiveSoundEnabled(true);
});
afterEach(() => {
  if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (priorAudio) Object.defineProperty(globalThis, 'Audio', priorAudio);
  else Reflect.deleteProperty(globalThis, 'Audio');
});

describe('incoming-message bell sound', () => {
  test('audio is a local original glass-bell WAV with an audible strike and fading tail', () => {
    prepareMessageReceiveSound();
    expect(storedSoundUrl.startsWith('data:audio/wav;base64,')).toBe(true);
    const samples = Buffer.from(storedSoundUrl.slice('data:audio/wav;base64,'.length), 'base64');
    expect(samples.toString('ascii', 0, 4)).toBe('RIFF');
    const rate = samples.readUInt32LE(24);
    const frames = samples.readUInt32LE(40) / 2;
    expect(rate).toBe(24000);
    expect(frames).toBeGreaterThan(13500);
    expect(frames).toBeLessThan(14500);
    const rms = (from: number, to: number) => {
      let sum = 0;
      const a = Math.floor(from * rate), b = Math.floor(to * rate);
      for (let i = a; i < b; i++) {
        const sample = samples.readInt16LE(44 + i * 2) / 32767;
        sum += sample * sample;
      }
      return Math.sqrt(sum / (b - a));
    };
    expect(rms(0.02, 0.065)).toBeGreaterThan(rms(0.27, 0.32));
    expect(rms(0.27, 0.32)).toBeGreaterThan(rms(0.51, 0.56));
  });

  test('one new message from another student rings once while foreground', () => {
    const known = new Set([10, 11]);
    const messages = [{ id: 10, mine: false }, { id: 11, mine: true }, { id: 12, mine: false }];
    expect(hasNewIncomingMessage(messages, known, true, true)).toBe(true);
    if (hasNewIncomingMessage(messages, known, true, true)) playMessageReceiveSound();
    expect(plays).toBe(1);
    messages.forEach(message => known.add(message.id));
    expect(hasNewIncomingMessage(messages, known, true, true)).toBe(false);
    if (hasNewIncomingMessage(messages, known, true, true)) playMessageReceiveSound();
    expect(plays).toBe(1); // no duplicate on polling
  });

  test('sending is silent even when own message appears in the next poll', () => {
    expect(hasNewIncomingMessage([{ id: 22, mine: true }], new Set([21]), true, true)).toBe(false);
    expect(plays).toBe(0);
  });

  test('history load and returning from background never ring', () => {
    const incoming = [{ id: 31, mine: false }];
    expect(hasNewIncomingMessage(incoming, new Set(), false, true)).toBe(false);
    expect(hasNewIncomingMessage(incoming, new Set(), true, false)).toBe(false);
    expect(plays).toBe(0);
  });

  test('multiple new incoming messages within one poll produce one alert', () => {
    const known = new Set([41]);
    const batch = [{ id: 41, mine: true }, { id: 42, mine: false }, { id: 43, mine: false }];
    if (hasNewIncomingMessage(batch, known, true, true)) playMessageReceiveSound();
    expect(plays).toBe(1);
  });

  test('mute is saved and suppresses an incoming sound', () => {
    setMessageReceiveSoundEnabled(false);
    expect(messageReceiveSoundEnabled()).toBe(false);
    expect(storage.get('cpsu-market:message-receive-sound')).toBe('off');
    playMessageReceiveSound();
    expect(plays).toBe(0);
  });

  test('muting stops a ringing bell and unmute allows a preview', () => {
    playMessageReceiveSound();
    expect(plays).toBe(1);
    setMessageReceiveSoundEnabled(false);
    expect(pauses).toBeGreaterThanOrEqual(1);
    setMessageReceiveSoundEnabled(true);
    unlockMessageReceiveSound();
    playMessageReceiveSound();
    expect(plays).toBe(2);
  });

  test('private browsing storage restrictions do not prevent an in-page mute', () => {
    storageBlocked = true;
    setMessageReceiveSoundEnabled(false);
    expect(messageReceiveSoundEnabled()).toBe(false);
    expect(() => { unlockMessageReceiveSound(); playMessageReceiveSound(); }).not.toThrow();
    expect(plays).toBe(0);
  });
});
