// Idle-motion EPSILON-bypass cases for scrub-controller.ts's frame() (phase
// 02). Split out of scrub-controller-router-gate.test.ts (not added there)
// to keep both files under the project's <200-line hard constraint — that
// file was already at 200 lines before these 3 cases; adding them in place
// would have put it at 239 (same idiom as phase-01's split of
// scrub-tracks-easing.test.ts out of scrub-tracks.test.ts, see that phase's
// report). Same 'animejs' mock idiom as the sibling file (see its header
// comment for why: onScroll/createTimeline need document/window, which this
// repo's plain "node" vitest env doesn't provide).
//
// This is the regression guard for scrub-controller.ts:151's EPSILON
// early-return going idle-aware — plan.md's Verified Fact 4 calls this out
// as the single most breakable thing in this phase: without the bypass, an
// act at scroll rest applies no pose at all, so the idle layer would be
// invisible.
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

function makeFakeIdle() {
  return {
    advance: vi.fn(),
    offsetFor: vi.fn().mockReturnValue({ baseYawDeg: 3, shoulderPitchDeg: 0, elbowPitchDeg: 0 }),
  };
}

describe('createScrubController — idle EPSILON-bypass, scroll-rest cases', () => {
  beforeEach(() => {
    animeMocks.onScrollSpy.mockReset();
    animeMocks.createTimelineSpy.mockReset();
    animeMocks.addSpy.mockReset();
  });

  it('idle keeps the pose alive at scroll rest — rig.setPose fires every frame, offset applied', () => {
    const fakes = makeFakes();
    const { setStateP } = setupAnimeMocks();
    const router = { isActive: vi.fn().mockReturnValue(true), report: vi.fn() };
    const idle = makeFakeIdle();

    createScrubController({
      sectionEl: fakes.sectionEl,
      rig: fakes.rig,
      ctx: fakes.ctx,
      overlay: fakes.overlay,
      loop: fakes.loop,
      reducedMotion: false,
      actIndex: 0,
      poseFn: makePoseFn(),
      router,
      idle,
    });

    const frame = fakes.add.mock.calls[0][0] as (dt: number) => void;
    setStateP(0);
    frame(0.016);
    frame(0.016);
    frame(0.016);

    expect(fakes.setPose).toHaveBeenCalledTimes(3);
    expect(fakes.setPose).toHaveBeenLastCalledWith({
      baseYawDeg: 3,
      shoulderPitchDeg: 0,
      elbowPitchDeg: 0,
    });
  });

  it('without idle, rest still early-returns — rig.setPose fires exactly once across three frames', () => {
    const fakes = makeFakes();
    const { setStateP } = setupAnimeMocks();
    const router = { isActive: vi.fn().mockReturnValue(true), report: vi.fn() };

    createScrubController({
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
    setStateP(0);
    frame(0.016);
    frame(0.016);
    frame(0.016);

    expect(fakes.setPose).toHaveBeenCalledTimes(1);
  });

  it('N3: idle repaints the pose at rest but does not re-notify progress', () => {
    const fakes = makeFakes();
    const { setStateP } = setupAnimeMocks();
    const router = { isActive: vi.fn().mockReturnValue(true), report: vi.fn() };
    const idle = makeFakeIdle();
    const onProgress = vi.fn();

    createScrubController({
      sectionEl: fakes.sectionEl,
      rig: fakes.rig,
      ctx: fakes.ctx,
      overlay: fakes.overlay,
      loop: fakes.loop,
      reducedMotion: false,
      actIndex: 0,
      poseFn: makePoseFn(),
      router,
      idle,
      onProgress,
    });

    const frame = fakes.add.mock.calls[0][0] as (dt: number) => void;
    setStateP(0);
    frame(0.016);
    frame(0.016);
    frame(0.016);

    expect(onProgress).toHaveBeenCalledTimes(1);
  });
});
