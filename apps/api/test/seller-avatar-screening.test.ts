import { describe, expect, test } from 'bun:test';
import { assessSellerPhoto } from '../src/seller-avatar-screening.js';

const scores = (patch: Partial<Record<'Neutral'|'Drawing'|'Sexy'|'Porn'|'Hentai',number>>) => {
  const all = { Neutral:0, Drawing:0, Sexy:0, Porn:0, Hentai:0, ...patch };
  return Object.entries(all).map(([className, probability]) => ({className,probability}));
};
describe('seller avatar content policy', () => {
  test('safe neutral and harmless drawing pictures publish without manual review', () => {
    expect(assessSellerPhoto(scores({ Neutral:0.96,Sexy:0.02,Porn:0.01,Hentai:0.01 }))).toBe('safe');
    expect(assessSellerPhoto(scores({ Drawing:0.98,Sexy:0.02 }))).toBe('safe');
  });
  test('high porn and hentai scores reject before public storage', () => {
    expect(assessSellerPhoto(scores({ Porn:0.78,Neutral:0.2,Sexy:0.02 }))).toBe('explicit');
    expect(assessSellerPhoto(scores({ Hentai:0.69,Drawing:0.31 }))).toBe('explicit');
  });
  test('ambiguous pictures never publish', () => {
    expect(assessSellerPhoto(scores({Neutral:0.75,Porn:0.13,Sexy:0.12}))).toBe('uncertain');
    expect(assessSellerPhoto(scores({Neutral:0.59,Sexy:0.39,Porn:0.02}))).toBe('uncertain');
  });
  test('malformed or incomplete predictions fail closed', () => {
    expect(assessSellerPhoto([])).toBe('uncertain');
    expect(assessSellerPhoto(scores({Neutral:NaN}))).toBe('uncertain');
    expect(assessSellerPhoto(scores({Neutral:1.2}))).toBe('uncertain');
    expect(assessSellerPhoto(scores({Neutral:0.9}))).toBe('uncertain');
    expect(assessSellerPhoto(scores({Neutral:0.9,Drawing:0.9}))).toBe('uncertain');
    expect(assessSellerPhoto([
      {className:'Neutral',probability:0.9},
      {className:'Drawing',probability:0.1},
      {className:'Sexy',probability:0},
      {className:'Porn',probability:0},
      {className:'Unknown',probability:0},
    ])).toBe('uncertain');
  });
});
