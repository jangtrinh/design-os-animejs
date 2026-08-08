// Exercises hero-intro.ts + render-loop.ts together (both real modules) to
// lock in review finding M-1: intro.tick() used to stay registered on the
// loop forever, re-applying the finished state (mix=0) every frame and
// silently overwriting whatever the Scrub controller painted afterwards.
// Uses real timers (animejs's timeline runs off wall-clock time, same as
// the review's node repro at /tmp/rl-repro/overlay2.mjs) — no jsdom, only a
// stubbed requestAnimationFrame/document queue.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRenderLoop } from '../src/scene/render-loop';
import { createHeroIntro } from '../src/motion/hero-intro';
import type { WireframeOverlay } from '../src/scene/wireframe-overlay';
import type { ArmRig } from '../src/scene/arm-rig';
import type { SceneContext } from '../src/scene/scene-setup';

function stubRafAndDocument(): { pump(): void } {
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
  vi.stubGlobal('document', {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  });
  return {
    pump(): void {
      const batch = [...queue.values()];
      queue.clear();
      for (const cb of batch) cb(performance.now());
    },
  };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('createHeroIntro — tick() stops applying state once the intro resolves (M-1)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lets a later frame callback (stand-in for Scrub) own wireMix uncontested after completion', async () => {
    const raf = stubRafAndDocument();
    const mixLog: number[] = [];
    const overlay = {
      setMix: (m: number) => mixLog.push(m),
      setDrawIn() {},
      setLineColor() {},
    } as unknown as WireframeOverlay;
    const rig = { setPose() {}, pivotWorldPositions: () => ({}) } as unknown as ArmRig;
    const ctx = {} as SceneContext;

    const loop = createRenderLoop(() => {});
    const intro = createHeroIntro(overlay, rig, ctx);
    // Registration order matches main.ts: intro added first (step 9), a
    // Scrub-like callback added later (step 14).
    loop.add(() => intro.tick());
    // Stand-in for scrub-controller.frame()'s EPSILON early-return
    // (scrub-controller.ts:92): only paints wireMix while "scrolling".
    let scrolling = 0;
    loop.add(() => {
      if (scrolling-- > 0) overlay.setMix(0.85);
    });

    loop.start();
    let resolved = false;
    intro.play().then(() => {
      resolved = true;
    });

    // Drive real frames past the intro's 2.2s duration.
    for (let f = 0; f < 250 && !resolved; f++) {
      raf.pump();
      await sleep(16);
    }
    expect(resolved).toBe(true);

    // User scrolls once settled: stand-in paints 0.85 for a few frames, then
    // stops (mirrors scrub's real early-return once it settles).
    scrolling = 3;
    for (let f = 0; f < 8; f++) {
      raf.pump();
      await sleep(16);
    }

    // Pre-fix: intro.tick() ran every frame AFTER the stand-in and reset mix
    // back to 0 the instant scrolling stopped — the renderer never saw 0.85.
    expect(mixLog.at(-1)).toBe(0.85);
  }, 10_000);
});
