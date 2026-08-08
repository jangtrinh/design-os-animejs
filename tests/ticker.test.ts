// Exercises ticker.ts (review finding M-6): `translateX(${p*100}%)` resolves
// against the TICK's own width (2px in main.css), not the strip's, so the
// whole p:0->1 range used to move the tick only 2px across a 180px strip.
// No jsdom needed — stub `document.getElementById` to return fake elements
// with a configurable `clientWidth` (the only property ticker.ts reads).
//
// Phase 02 (ticker pill upgrade): travelPx now also subtracts the pill's
// 28px total horizontal padding (chrome.css's #ticker rule, 14px each side)
// so the tick never travels past the pill's inner edge — expected values
// below updated from (stripWidth - tickWidth) to (stripWidth - 28 - tickWidth).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTicker } from '../src/ui/ticker';

interface FakeEl {
  clientWidth: number;
  style: { transform: string };
  parentElement: FakeEl | null;
}

function makeFakeStrip(stripWidth: number, tickWidth: number): { tick: FakeEl; strip: FakeEl } {
  const strip: FakeEl = { clientWidth: stripWidth, style: { transform: '' }, parentElement: null };
  const tick: FakeEl = { clientWidth: tickWidth, style: { transform: '' }, parentElement: strip };
  return { tick, strip };
}

describe('createTicker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('travels the full (stripWidth - 28 - tickWidth) px range, not the tick`s own 2px width', () => {
    const { tick } = makeFakeStrip(180, 2);
    vi.stubGlobal('document', { getElementById: (id: string) => (id === 'ticker-tick' ? tick : null) });

    const ticker = createTicker();
    ticker.update(0);
    expect(tick.style.transform).toBe('translateX(0px)');

    ticker.update(1);
    expect(tick.style.transform).toBe('translateX(150px)'); // (180-28-2)*1, not 2px

    ticker.update(0.5);
    expect(tick.style.transform).toBe('translateX(75px)'); // (180-28-2)*0.5
  });

  it('adapts to the live strip/tick widths instead of hard-coding 252px', () => {
    const { tick } = makeFakeStrip(300, 20);
    vi.stubGlobal('document', { getElementById: (id: string) => (id === 'ticker-tick' ? tick : null) });

    const ticker = createTicker();
    ticker.update(1);
    expect(tick.style.transform).toBe('translateX(252px)'); // (300-28-20)*1
  });

  it('is a safe no-op when #ticker-tick or its parent strip is missing', () => {
    vi.stubGlobal('document', { getElementById: () => null });
    const ticker = createTicker();
    expect(() => ticker.update(0.5)).not.toThrow();
  });
});
