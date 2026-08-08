// Sole owner of requestAnimationFrame for the whole app. anime.js's internal
// ticker is switched off (`engine.useDefaultMainLoop = false`) and driven
// manually here so three.js render + anime.js tween updates share one clock.
import { engine } from 'animejs';

export type FrameCallback = (dtSeconds: number, elapsedSeconds: number) => void;

export interface RenderLoop {
  add(cb: FrameCallback): void;
  start(): void;
  stop(): void;
}

const MAX_DT_SECONDS = 0.05; // clamp dt spikes after a tab-hidden gap

export function createRenderLoop(onRender: () => void): RenderLoop {
  engine.useDefaultMainLoop = false;

  const callbacks: FrameCallback[] = [];
  let rafId = 0;
  let running = false;
  let lastTime = 0;
  let elapsed = 0;

  function tick(now: number): void {
    const dt = Math.min(Math.max((now - lastTime) / 1000, 0), MAX_DT_SECONDS);
    lastTime = now;
    elapsed += dt;

    // Fixed order: anime.js state -> app callbacks -> three.js render.
    engine.update();
    for (const cb of callbacks) cb(dt, elapsed);
    onRender();

    if (running) rafId = requestAnimationFrame(tick);
  }

  function handleVisibilityChange(): void {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (running && rafId === 0) {
      // Guard against a second concurrent rAF chain (review finding B-1):
      // start() already scheduled a callback even while the tab was hidden
      // (browsers queue it, they just don't fire it until visible again) —
      // only schedule a replacement here if nothing is already pending.
      lastTime = performance.now();
      rafId = requestAnimationFrame(tick);
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return {
    add(cb: FrameCallback): void {
      callbacks.push(cb);
    },
    start(): void {
      if (running) return;
      running = true;
      lastTime = performance.now();
      rafId = requestAnimationFrame(tick);
    },
    stop(): void {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    },
  };
}
