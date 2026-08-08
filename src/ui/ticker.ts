// Film-strip ticker (#ticker/#ticker-tick, phase 01 markup): a red tick that
// slides left->right across the fixed tick-mark strip as scrub progress p
// goes 0->1, and back when the user scrolls up (two-way, per scrub-tracks.ts
// contract). Pure DOM write, no animation library needed - `p` is already
// damped upstream by scrub-controller.ts's frame callback.
export interface Ticker {
  update(p: number): void;
}

export function createTicker(): Ticker {
  const tick = document.getElementById('ticker-tick');
  const strip = tick?.parentElement ?? null; // #ticker

  return {
    update(p: number): void {
      if (!tick || !strip) return;
      // Review finding M-6 (spec error, amended in phase-04-...md): percentage
      // `translateX` resolves against the TICK's own width (2px), not the
      // strip's. Read the live widths (no magic numbers duplicated from CSS)
      // and travel the true available px range.
      // Phase 02 (ticker pill upgrade): the pill has 14px of horizontal
      // padding on each side (chrome.css's #ticker rule) and the tick starts
      // already offset `left:14px` inside it — subtract both paddings (28px
      // total) so the tick's right edge never travels past the pill's inner
      // right edge.
      const travelPx = strip.clientWidth - 28 - tick.clientWidth;
      tick.style.transform = `translateX(${travelPx * p}px)`;
    },
  };
}
