// Exercises the reduced-motion branch of scrub-controller.ts with fake
// ArmRig/SceneContext/WireframeOverlay/RenderLoop collaborators (no DOM/
// three.js needed — this repo's vitest environment is plain "node").
// The scroll-driven branch (onScroll + createTimeline) needs a real
// browser/jsdom layout engine (animejs measures actual CSS `100lvh` via
// offsetHeight) and is NOT exercised here — see phase-03 report for the
// source-level evidence covering that path, and
// scrub-controller-router-gate.test.ts (phase 06) for the router-gate
// logic inside frame(), reached via mocking the 'animejs' module itself
// instead of the DOM.
import { describe, expect, it, vi } from 'vitest';
import { createScrubController } from '../src/motion/scrub-controller';
import { poseAt } from '../src/motion/scrub-tracks';
import { makeFakes } from './scrub-controller-fakes';

describe('createScrubController — reduced-motion branch', () => {
  it('applies poseAt(0) exactly once (M-3: dark bg, full render, zero arm pose — not p=0.5), renders before projecting (M-2), registers no frame callback, and reports progress 0', () => {
    const fakes = makeFakes();
    const onProgress = vi.fn();
    const callOrder: string[] = [];
    (fakes.ctx.render as ReturnType<typeof vi.fn>).mockImplementation(() => callOrder.push('render'));
    onProgress.mockImplementation(() => callOrder.push('onProgress'));

    const controller = createScrubController({
      sectionEl: fakes.sectionEl,
      rig: fakes.rig,
      ctx: fakes.ctx,
      overlay: fakes.overlay,
      loop: fakes.loop,
      reducedMotion: true,
      onProgress,
    });

    const expected = poseAt(0);

    // Rig: zero pose (poseAt(0) === the arm's rest angles, all zero).
    expect(fakes.setPose).toHaveBeenLastCalledWith({
      baseYawDeg: expected.baseYawDeg,
      shoulderPitchDeg: expected.shoulderPitchDeg,
      elbowPitchDeg: expected.elbowPitchDeg,
    });

    // Camera: spherical -> cartesian conversion per phase-03 spec formula.
    const x = expected.camRadius * Math.sin(expected.camPhi) * Math.sin(expected.camTheta);
    const y = expected.camRadius * Math.cos(expected.camPhi) + expected.camTargetY;
    const z = expected.camRadius * Math.sin(expected.camPhi) * Math.cos(expected.camTheta);
    expect(fakes.positionSet).toHaveBeenCalledWith(x, y, z);
    expect(fakes.lookAt).toHaveBeenCalledWith(0, expected.camTargetY, 0);

    // Background + wireframe mix applied.
    expect(fakes.setBackgroundMix).toHaveBeenCalledWith(expected.bgMix);
    expect(fakes.setMix).toHaveBeenCalledWith(expected.wireMix);

    // M-3: bgMix at p=0 is 0 (dark, NOT paper) -> hero contrast stays 18.2:1,
    // wireMix is 0 (full PBR render, no wireframe) -> line color is the dark hex.
    expect(expected.bgMix).toBe(0);
    expect(expected.wireMix).toBe(0);
    expect(fakes.setLineColor).toHaveBeenCalledWith(0xa7a29c);

    // M-2: ctx.render() must run before the single onProgress/label-projection
    // call, or camera.project() reads a stale matrixWorldInverse.
    expect(fakes.ctx.render).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(0);
    expect(callOrder).toEqual(['render', 'onProgress']);

    // No frame callback registered — reduced-motion never runs per-frame work.
    expect(fakes.add).not.toHaveBeenCalled();

    expect(controller.progress()).toBe(0);
  });

  it('refresh() and destroy() are safe no-ops', () => {
    const fakes = makeFakes();
    const controller = createScrubController({
      sectionEl: fakes.sectionEl,
      rig: fakes.rig,
      ctx: fakes.ctx,
      overlay: fakes.overlay,
      loop: fakes.loop,
      reducedMotion: true,
    });

    expect(() => controller.refresh()).not.toThrow();
    expect(() => controller.destroy()).not.toThrow();
  });

  it('works without an onProgress callback', () => {
    const fakes = makeFakes();
    expect(() =>
      createScrubController({
        sectionEl: fakes.sectionEl,
        rig: fakes.rig,
        ctx: fakes.ctx,
        overlay: fakes.overlay,
        loop: fakes.loop,
        reducedMotion: true,
      }),
    ).not.toThrow();
  });
});
