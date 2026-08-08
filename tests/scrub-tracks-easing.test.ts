// motion-quality phase 01 (feedback B, "too robotic"): sampleTrack's opt-in
// per-segment easing. Split out of scrub-tracks.test.ts to keep both files
// under the project's 200-line file-size limit — same module under test,
// separate file for the new easing surface only.
import { describe, expect, it } from 'vitest';
import { sampleTrack, type Track } from '../src/motion/scrub-tracks';

describe('sampleTrack — easing', () => {
  it('absent ease is byte-identical to today (linear)', () => {
    expect(sampleTrack([{ p: 0, v: 0 }, { p: 1, v: 10 }], 0.25)).toBe(2.5);
  });

  it('explicit ease: "linear" equals the absent case at 101 samples', () => {
    const implicit: Track = [{ p: 0, v: 0 }, { p: 1, v: 10 }];
    const explicit: Track = [{ p: 0, v: 0, ease: 'linear' }, { p: 1, v: 10 }];
    for (let i = 0; i <= 100; i++) {
      const p = i / 100;
      expect(sampleTrack(explicit, p)).toBe(sampleTrack(implicit, p));
    }
  });

  it('"smooth" hits the endpoints exactly', () => {
    const track: Track = [{ p: 0, v: 0, ease: 'smooth' }, { p: 1, v: 10 }];
    expect(sampleTrack(track, 0)).toBe(0);
    expect(sampleTrack(track, 1)).toBe(10);
  });

  it('"smooth" matches the linear midpoint but differs at p=0.25', () => {
    const track: Track = [{ p: 0, v: 0, ease: 'smooth' }, { p: 1, v: 10 }];
    expect(sampleTrack(track, 0.5)).toBe(5);
    expect(sampleTrack(track, 0.25)).toBe(1.5625);
    expect(sampleTrack(track, 0.25)).not.toBe(2.5);
  });

  it('is non-overshooting for "smooth" and "smoother" over 101 samples', () => {
    for (const ease of ['smooth', 'smoother'] as const) {
      const track: Track = [{ p: 0, v: -4, ease }, { p: 1, v: 9 }];
      for (let i = 0; i <= 100; i++) {
        const v = sampleTrack(track, i / 100);
        expect(v).toBeGreaterThanOrEqual(-4);
        expect(v).toBeLessThanOrEqual(9);
      }
    }
  });

  it('is monotone (never decreases) for an ascending segment, both eases', () => {
    for (const ease of ['smooth', 'smoother'] as const) {
      const track: Track = [{ p: 0, v: 0, ease }, { p: 1, v: 10 }];
      let prev = -Infinity;
      for (let i = 0; i <= 100; i++) {
        const v = sampleTrack(track, i / 100);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
  });

  it('is C1 for an all-"smooth" track; the same track left linear is not (test teeth)', () => {
    const h = 1e-5;
    const smoothTrack: Track = [
      { p: 0, v: 0, ease: 'smooth' },
      { p: 0.5, v: 10, ease: 'smooth' },
      { p: 1, v: 0 },
    ];
    const dL = (sampleTrack(smoothTrack, 0.5) - sampleTrack(smoothTrack, 0.5 - h)) / h;
    const dR = (sampleTrack(smoothTrack, 0.5 + h) - sampleTrack(smoothTrack, 0.5)) / h;
    expect(Math.abs(dL - dR)).toBeLessThan(0.05);

    const linearTrack: Track = [
      { p: 0, v: 0 },
      { p: 0.5, v: 10 },
      { p: 1, v: 0 },
    ];
    const dLl = (sampleTrack(linearTrack, 0.5) - sampleTrack(linearTrack, 0.5 - h)) / h;
    const dRl = (sampleTrack(linearTrack, 0.5 + h) - sampleTrack(linearTrack, 0.5)) / h;
    expect(Math.abs(dLl - dRl)).toBeGreaterThan(0.05);
  });
});
