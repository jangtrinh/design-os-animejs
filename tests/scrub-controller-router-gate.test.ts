// Router-gate cases for scrub-controller.ts's scroll-driven frame() (phase
// 06). This branch normally constructs anime.js's onScroll/createTimeline,
// which read `document`/`window` internally and throw in this repo's plain
// "node" vitest environment (verified directly: onScroll({target:{}}) throws
// "Cannot read properties of null (reading 'body')", and stubbing a minimal
// window/document cascades into needing requestAnimationFrame too — i.e. it
// bottoms out at reinventing jsdom, which this phase's spec forbids).
// Mocking the 'animejs' module itself (not the DOM) sidesteps that: it's the
// same fake-collaborator idiom scrub-controller.test.ts already uses for
// ArmRig/SceneContext/WireframeOverlay/RenderLoop, just applied to the one
// remaining real dependency, so frame() (the router-gate logic this phase
// actually needs to test) becomes reachable without any DOM polyfill. The
// real scroll measurement itself is still NOT tested here — see the
// phase-03 report for the source-level evidence covering that part.
//
// Phase 02's idle-motion EPSILON-bypass cases live in the sibling
// scrub-controller-idle-gate.test.ts (not here) — this file was already at
// 200 lines before that phase; splitting keeps both files under the
// project's <200-line hard constraint (same idiom as phase-01's
// scrub-tracks-easing.test.ts split, see that phase's report). Both files
// share setupAnimeMocks/makePoseFn via local copies — small enough (2
// helpers) that a shared module would cost more than it saves.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { poseAt } from '../src/motion/scrub-tracks';
import type { ActPose } from '../src/motion/act-tracks';
import { makeFakes } from './scrub-controller-fakes';

const animeMocks = vi.hoisted(() => ({
  onScrollSpy: vi.fn(),
  createTimelineSpy: vi.fn(),
  addSpy: vi.fn(),
}));

vi.mock('animejs', () => ({
  onScroll: animeMocks.onScrollSpy,
  createTimeline: animeMocks.createTimelineSpy,
}));

// Imported after the mock declaration (vi.mock is hoisted above imports by
// vitest regardless of source order, but this ordering documents why the
// module resolves to the mock).
import { createScrubController } from '../src/motion/scrub-controller';

// Captures the internal `state` object passed to `timeline.add(state, ...)`
// so the test can mutate state.p directly to simulate scroll, without a real
// ScrollObserver.
function setupAnimeMocks(): { setStateP: (p: number) => void } {
  let capturedState: { p: number } = { p: 0 };
  animeMocks.onScrollSpy.mockReturnValue({ refresh: vi.fn(), revert: vi.fn() });
  animeMocks.addSpy.mockImplementation((state: { p: number }) => {
    capturedState = state;
    return { revert: vi.fn() };
  });
  animeMocks.createTimelineSpy.mockReturnValue({ add: animeMocks.addSpy });
  return {
    setStateP(p: number): void {
      capturedState.p = p;
    },
  };
}

function makePoseFn(): (p: number) => ActPose {
  return (p: number) => ({ ...poseAt(0), baseYawDeg: p * 100, lineColor: 0x123456 });
}

describe('createScrubController — scroll-driven branch, router-gate cases', () => {
  beforeEach(() => {
    animeMocks.onScrollSpy.mockReset();
    animeMocks.createTimelineSpy.mockReset();
    animeMocks.addSpy.mockReset();
  });

  it('inactive act never calls rig.setPose', () => {
    const fakes = makeFakes();
    const { setStateP } = setupAnimeMocks();
    const router = { isActive: vi.fn().mockReturnValue(false), report: vi.fn() };

    createScrubController({
      sectionEl: fakes.sectionEl,
      rig: fakes.rig,
      ctx: fakes.ctx,
      overlay: fakes.overlay,
      loop: fakes.loop,
      reducedMotion: false,
      actIndex: 2,
      poseFn: makePoseFn(),
      router,
    });

    const frame = fakes.add.mock.calls[0][0] as (dt: number) => void;
    setStateP(0.7);
    frame(0.016);
    frame(0.016); // a second frame too — inactive must stay inactive, not just "not yet armed"

    expect(fakes.setPose).not.toHaveBeenCalled();
  });

  it('on activation, pSmooth snaps to state.p instead of damping in from wherever it was left', () => {
    const fakes = makeFakes();
    const { setStateP } = setupAnimeMocks();
    const router = { isActive: vi.fn().mockReturnValue(true), report: vi.fn() };

    const controller = createScrubController({
      sectionEl: fakes.sectionEl,
      rig: fakes.rig,
      ctx: fakes.ctx,
      overlay: fakes.overlay,
      loop: fakes.loop,
      reducedMotion: false,
      actIndex: 0,
      poseFn: makePoseFn(),
      router,
    });

    const frame = fakes.add.mock.calls[0][0] as (dt: number) => void;
    // First-ever frame while active, scroll already far along (0.8) — a
    // damp-in from pSmooth's initial 0 would land far short of 0.8 after one
    // 16ms tick (damp(0, 0.8, lambda=6, 0.016) ~= 0.076, not 0.8); the snap
    // logic makes it land exactly on 0.8 instead.
    setStateP(0.8);
    frame(0.016);

    expect(controller.progress()).toBeCloseTo(0.8, 9);
  });

  it('report() is called every frame, even while inactive', () => {
    const fakes = makeFakes();
    const { setStateP } = setupAnimeMocks();
    const report = vi.fn();
    const router = { isActive: vi.fn().mockReturnValue(false), report };

    createScrubController({
      sectionEl: fakes.sectionEl,
      rig: fakes.rig,
      ctx: fakes.ctx,
      overlay: fakes.overlay,
      loop: fakes.loop,
      reducedMotion: false,
      actIndex: 3,
      poseFn: makePoseFn(),
      router,
    });

    const frame = fakes.add.mock.calls[0][0] as (dt: number) => void;
    setStateP(0.42);
    frame(0.016);

    expect(report).toHaveBeenCalledWith(3, 0.42);
  });
});
