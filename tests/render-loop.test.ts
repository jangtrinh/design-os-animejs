// Exercises render-loop.ts's rAF scheduling directly, including the
// tab-hidden -> visible transition (review finding B-1: hard constraint
// "one owned RAF loop" was violated there). No DOM/jsdom needed: the module
// only touches `document`/`requestAnimationFrame`/`performance` *inside*
// createRenderLoop(), so a fake queue stubbed via vi.stubGlobal before
// calling it is enough (same technique the review's node repro used).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRenderLoop } from '../src/scene/render-loop';

interface FakeRaf {
  pendingCount(): number;
  flush(frames: number): void;
}

function stubRaf(): FakeRaf {
  let nextId = 1;
  const queue = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queue.delete(id);
  });
  return {
    pendingCount: () => queue.size,
    flush(frames: number) {
      for (let f = 0; f < frames; f++) {
        const batch = [...queue.entries()];
        queue.clear();
        for (const [, cb] of batch) cb(f * 16);
      }
    },
  };
}

describe('createRenderLoop — visibilitychange (review finding B-1)', () => {
  let listeners: Record<string, Array<() => void>>;
  let fakeDocument: {
    hidden: boolean;
    addEventListener: (t: string, fn: () => void) => void;
    removeEventListener: () => void;
  };

  beforeEach(() => {
    listeners = {};
    fakeDocument = {
      hidden: true,
      addEventListener: (t, fn) => {
        (listeners[t] ??= []).push(fn);
      },
      removeEventListener: () => {},
    };
    vi.stubGlobal('document', fakeDocument);
    vi.stubGlobal('performance', { now: () => 0 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('never has more than 1 rAF pending, even across a hidden->visible transition at load', () => {
    const raf = stubRaf();
    let renderCount = 0;
    const loop = createRenderLoop(() => {
      renderCount++;
    });

    // Page loads in a hidden tab: browsers queue the rAF but never fire it.
    loop.start();
    expect(raf.pendingCount()).toBe(1);

    // User switches to the tab.
    fakeDocument.hidden = false;
    for (const fn of listeners.visibilitychange ?? []) fn();

    // Must stay at 1 pending callback, not become 2 (the B-1 bug: a second
    // chain got scheduled on top of the still-queued first one).
    expect(raf.pendingCount()).toBe(1);

    raf.flush(3);
    expect(renderCount).toBe(3); // not 6 (double render() per frame)
    expect(raf.pendingCount()).toBe(1); // exactly 1 rAF pending after every tick
  });

  it('stays at exactly 1 pending rAF across repeated hidden<->visible toggles while running', () => {
    const raf = stubRaf();
    fakeDocument.hidden = false;
    const loop = createRenderLoop(() => {});
    loop.start();
    expect(raf.pendingCount()).toBe(1);

    for (let i = 0; i < 5; i++) {
      fakeDocument.hidden = true;
      for (const fn of listeners.visibilitychange ?? []) fn();
      expect(raf.pendingCount()).toBe(0); // hidden: pending callback is cancelled

      fakeDocument.hidden = false;
      for (const fn of listeners.visibilitychange ?? []) fn();
      expect(raf.pendingCount()).toBe(1); // visible again: exactly one scheduled
    }
  });

  it('stop() cancels the pending rAF and start() does not double-schedule if called again', () => {
    const raf = stubRaf();
    fakeDocument.hidden = false;
    const loop = createRenderLoop(() => {});

    loop.start();
    expect(raf.pendingCount()).toBe(1);
    loop.stop();
    expect(raf.pendingCount()).toBe(0);

    loop.start();
    loop.start(); // second start() while already running must be a no-op
    expect(raf.pendingCount()).toBe(1);
  });
});
