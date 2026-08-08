// Pure act-routing math (activeIndex/globalProgress) — no DOM needed, runs
// under plain "node". createSectionRouter itself writes document.body.dataset
// and is NOT exercised here (this vitest environment has no `document`,
// matching this project's stated policy of not adding jsdom); its dataset
// bookkeeping is covered by source-level reasoning in the phase reports.
import { describe, expect, it } from 'vitest';
import { ACTS, activeIndex, globalProgress, type ActDef } from '../src/motion/section-router';

describe('activeIndex', () => {
  it('returns 0 when every act is at local progress 0', () => {
    expect(activeIndex([0, 0, 0, 0, 0, 0])).toBe(0);
  });

  it('returns the index of the single non-zero act', () => {
    expect(activeIndex([0, 0.4, 0, 0, 0, 0])).toBe(1);
  });

  it('returns the LAST non-zero act when several are non-zero', () => {
    expect(activeIndex([0, 0.9, 0.2, 0, 0, 0])).toBe(2);
  });

  it('p exactly 1 counts as non-zero (last act fully scrolled through)', () => {
    expect(activeIndex([0, 0, 0, 0, 0, 1])).toBe(5);
  });
});

describe('globalProgress', () => {
  it('is 0 at page top (every act at local 0)', () => {
    expect(globalProgress([0, 0, 0, 0, 0, 0])).toBe(0);
  });

  it('is 1 when the last act is at local progress 1', () => {
    expect(globalProgress([0, 0, 0, 0, 0, 1])).toBe(1);
  });

  it('is monotonic non-decreasing across 200 sampled scroll states', () => {
    // Simulates scrolling straight through every act in order, sampling the
    // combined local-progress vector 200 times across the whole page.
    const samples: number[][] = [];
    for (let i = 0; i <= 200; i++) {
      const totalP = i / 200; // 0..1 across the whole simulated scroll
      const scaled = totalP * ACTS.length;
      const local = ACTS.map((_, actIdx) => {
        const actLocal = scaled - actIdx;
        return Math.min(1, Math.max(0, actLocal));
      });
      samples.push(local);
    }
    const globals = samples.map((local) => globalProgress(local));
    for (let i = 1; i < globals.length; i++) {
      expect(globals[i]).toBeGreaterThanOrEqual(globals[i - 1]);
    }
  });

  it('is weighted by rangeVh, not heightVh (act 1 at local 0.5 -> (80+150)/1030 = 0.2233)', () => {
    // hero (index 0) rangeVh=80 fully "before"; blueprint (index 1) rangeVh=300,
    // half-weighted at local=0.5 -> 150. Total weight across all 6 acts = 1030.
    const totalWeight = ACTS.reduce((sum, act) => sum + act.rangeVh, 0);
    expect(totalWeight).toBe(1030);
    const local = [0, 0.5, 0, 0, 0, 0];
    expect(globalProgress(local)).toBeCloseTo((80 + 150) / 1030, 9);
    expect(globalProgress(local)).toBeCloseTo(0.2233, 4);
  });

  it('clamps to [0,1] even with an out-of-range local vector', () => {
    expect(globalProgress([0, 0, 0, 0, 0, 5])).toBe(1);
  });

  it('accepts a custom acts table (default-arg override), unweighted equal split', () => {
    const twoActs: readonly ActDef[] = [
      { id: 'hero', domId: 'a', heightVh: 100, rangeVh: 100 },
      { id: 'blueprint', domId: 'b', heightVh: 100, rangeVh: 100 },
    ];
    expect(globalProgress([1, 0], twoActs)).toBeCloseTo(0.5, 9);
    expect(globalProgress([0, 0.5], twoActs)).toBeCloseTo(0.75, 9);
  });
});
