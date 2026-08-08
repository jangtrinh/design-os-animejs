// Shared fake-collaborator builder for scrub-controller.test.ts (reduced-
// motion branch) and scrub-controller-router-gate.test.ts (scroll-driven
// branch, phase 06) — split out into its own non-*.test.ts module (not
// matched by vitest.config.ts's `tests/**/*.test.ts` include) so both files
// can import it without triggering vitest to double-collect its describe/it
// blocks (which would happen if one .test.ts imported another directly).
import { vi } from 'vitest';
import type { ArmRig } from '../src/scene/arm-rig';
import type { SceneContext } from '../src/scene/scene-setup';
import type { WireframeOverlay } from '../src/scene/wireframe-overlay';
import type { RenderLoop } from '../src/scene/render-loop';

export function makeFakes() {
  const setPose = vi.fn();
  const rig = { setPose, pivotWorldPositions: vi.fn(), setExplode: vi.fn() } as unknown as ArmRig;

  const positionSet = vi.fn();
  const lookAt = vi.fn();
  const setBackgroundMix = vi.fn();
  const ctx = {
    scene: {},
    camera: { position: { set: positionSet }, lookAt },
    renderer: {},
    render: vi.fn(),
    resize: vi.fn(),
    setBackgroundMix,
  } as unknown as SceneContext;

  const setMix = vi.fn();
  const setDrawIn = vi.fn();
  const setLineColor = vi.fn();
  const overlay: WireframeOverlay = { setMix, setDrawIn, setLineColor };

  const add = vi.fn();
  const loop = { add, start: vi.fn(), stop: vi.fn() } as unknown as RenderLoop;

  const sectionEl = {} as HTMLElement;

  return { rig, ctx, overlay, loop, sectionEl, setPose, positionSet, lookAt, setBackgroundMix, setMix, setLineColor, add };
}
