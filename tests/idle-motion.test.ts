// Pure-function tests for idle-motion.ts (motion-quality phase 02). Plain
// node env — no DOM/three.js, matching idle-motion.ts's own import
// constraint (N1: only arm-rig-math.ts + scrub-tracks.ts, both import-free).
import { describe, expect, it } from 'vitest';
import {
  IDLE_AXES,
  IDLE_ACT_WEIGHTS,
  idleOffsetAt,
  withIdleOffset,
  createIdleMotion,
} from '../src/motion/idle-motion';
import { clampPose } from '../src/scene/arm-rig-math';
import { poseAtAct } from '../src/motion/act-tracks';

describe('idle-motion — IDLE_ACT_WEIGHTS (F2)', () => {
  it('matches the per-act weight table, one entry per act (hero..outro)', () => {
    expect(IDLE_ACT_WEIGHTS).toEqual([1, 0.15, 0, 0.15, 0.15, 0]);
    expect(IDLE_ACT_WEIGHTS.length).toBe(6);
  });
});

describe('idle-motion — createIdleMotion under reduced motion (F3)', () => {
  it('offsetFor is null for every act, even after advance()', () => {
    const idle = createIdleMotion({ reducedMotion: true });
    idle.advance(10);
    for (let i = 0; i < 6; i++) {
      expect(idle.offsetFor(i)).toBeNull();
    }
  });
});

describe('idle-motion — zero-weight and out-of-range acts', () => {
  it('zoom(2)/outro(5) are null under normal motion; out-of-range indices are null, not a throw', () => {
    const idle = createIdleMotion({ reducedMotion: false });
    idle.advance(3);
    expect(idle.offsetFor(2)).toBeNull();
    expect(idle.offsetFor(5)).toBeNull();
    expect(idle.offsetFor(6)).toBeNull();
    expect(idle.offsetFor(-1)).toBeNull();
  });
});

describe('idle-motion — ramp-in (F4, 1.2s)', () => {
  it('is 0 at t=0, <=50% of the un-ramped sine at t=0.6, and matches the raw sine at t=1.2 (ramp=1)', () => {
    // toBeCloseTo (not toBe) — ramp(0)=0 times a negative sine yields -0 for
    // some axes; -0 === 0 numerically, but Object.is (toBe's equality) does
    // not consider them equal.
    const atZero = idleOffsetAt(0, 1);
    expect(atZero.baseYawDeg).toBeCloseTo(0, 12);
    expect(atZero.shoulderPitchDeg).toBeCloseTo(0, 12);
    expect(atZero.elbowPitchDeg).toBeCloseTo(0, 12);

    const at06 = idleOffsetAt(0.6, 1);
    const unrampedYawAt06 = 6.0 * Math.sin((2 * Math.PI * 0.6) / 14.0);
    expect(Math.abs(at06.baseYawDeg)).toBeLessThanOrEqual(Math.abs(unrampedYawAt06) * 0.5 + 1e-9);

    const at12 = idleOffsetAt(1.2, 1);
    const rawSineAt12 = {
      baseYawDeg: 6.0 * Math.sin((2 * Math.PI * 1.2) / 14.0),
      shoulderPitchDeg: 1.5 * Math.sin((2 * Math.PI * 1.2) / 9.0 + 1.9),
      elbowPitchDeg: 2.5 * Math.sin((2 * Math.PI * 1.2) / 6.5 + 3.4),
    };
    expect(Math.abs(at12.baseYawDeg - rawSineAt12.baseYawDeg)).toBeLessThan(1e-12);
    expect(Math.abs(at12.shoulderPitchDeg - rawSineAt12.shoulderPitchDeg)).toBeLessThan(1e-12);
    expect(Math.abs(at12.elbowPitchDeg - rawSineAt12.elbowPitchDeg)).toBeLessThan(1e-12);
  });
});

describe('idle-motion — amplitude bound and reach', () => {
  it('never exceeds its per-axis amplitude over 30s at weight 1, and reaches near-full yaw amplitude within one 14s period', () => {
    let maxYawWithinFirstPeriod = 0;
    for (let i = 0; i <= 30 * 120; i++) {
      const t = i / 120;
      const o = idleOffsetAt(t, 1);
      expect(Math.abs(o.baseYawDeg)).toBeLessThanOrEqual(6 + 1e-9);
      expect(Math.abs(o.shoulderPitchDeg)).toBeLessThanOrEqual(1.5 + 1e-9);
      expect(Math.abs(o.elbowPitchDeg)).toBeLessThanOrEqual(2.5 + 1e-9);
      if (t <= 14) maxYawWithinFirstPeriod = Math.max(maxYawWithinFirstPeriod, Math.abs(o.baseYawDeg));
    }
    expect(maxYawWithinFirstPeriod).toBeGreaterThanOrEqual(5.99);
  });
});

describe('idle-motion — periods mutually non-commensurate', () => {
  it('no pair of [14, 9, 6.5] has a near-integer ratio (this is the test that would have caught 14 vs 7)', () => {
    const periods = IDLE_AXES.map((a) => a.periodSeconds);
    for (let i = 0; i < periods.length; i++) {
      for (let j = i + 1; j < periods.length; j++) {
        const ratio = periods[i] / periods[j];
        expect(Math.abs(ratio - Math.round(ratio))).toBeGreaterThan(0.01);
      }
    }
  });
});

describe('idle-motion — withIdleOffset (F1: arm-only, no camera drift)', () => {
  it('leaves every non-arm ScrubPose field ===-identical to the input', () => {
    const pose = poseAtAct(1, 0.5);
    const offset = idleOffsetAt(3, 0.15);
    const result = withIdleOffset(pose, offset);

    expect(result.camRadius).toBe(pose.camRadius);
    expect(result.camTheta).toBe(pose.camTheta);
    expect(result.camPhi).toBe(pose.camPhi);
    expect(result.camTargetY).toBe(pose.camTargetY);
    expect(result.bgMix).toBe(pose.bgMix);
    expect(result.wireMix).toBe(pose.wireMix);
    expect(result.explode).toBe(pose.explode);
    expect(result.veil).toBe(pose.veil);
  });
});

describe('idle-motion — clampPose stays an identity with idle applied (headroom table)', () => {
  it('for acts [0,1,3,4], withIdleOffset never triggers an actual clamp across p x t sweeps', () => {
    const acts = [0, 1, 3, 4];
    for (const act of acts) {
      const weight = IDLE_ACT_WEIGHTS[act];
      for (let pi = 0; pi <= 100; pi++) {
        const p = pi / 100;
        const pose = poseAtAct(act, p);
        for (let ti = 0; ti < 8; ti++) {
          const t = (ti / 8) * 14;
          const offset = idleOffsetAt(t, weight);
          // Compare against the RAW unclamped sum (not withIdleOffset's own
          // output, which is already clamped internally — reclamping that
          // would be trivially idempotent regardless of whether a real clamp
          // fired). This is the actual headroom assertion from the plan's
          // "Clamp head-room" table: idle never pushes the pose past ARM_LIMITS.
          const rawSum = {
            baseYawDeg: pose.baseYawDeg + offset.baseYawDeg,
            shoulderPitchDeg: pose.shoulderPitchDeg + offset.shoulderPitchDeg,
            elbowPitchDeg: pose.elbowPitchDeg + offset.elbowPitchDeg,
          };
          const applied = withIdleOffset(pose, offset);
          const reClamped = clampPose(rawSum);
          expect(applied.baseYawDeg).toBeCloseTo(reClamped.baseYawDeg, 9);
          expect(applied.shoulderPitchDeg).toBeCloseTo(reClamped.shoulderPitchDeg, 9);
          expect(applied.elbowPitchDeg).toBeCloseTo(reClamped.elbowPitchDeg, 9);
          // Direct headroom check: the raw sum itself never leaves ARM_LIMITS.
          expect(rawSum.baseYawDeg).toBeCloseTo(clampPose(rawSum).baseYawDeg, 9);
          expect(rawSum.shoulderPitchDeg).toBeCloseTo(clampPose(rawSum).shoulderPitchDeg, 9);
          expect(rawSum.elbowPitchDeg).toBeCloseTo(clampPose(rawSum).elbowPitchDeg, 9);
        }
      }
    }
  });
});

describe('idle-motion — determinism', () => {
  it('idleOffsetAt is pure: same inputs before/after an advance()-driven sweep give identical outputs', () => {
    const before = idleOffsetAt(3.7, 0.15);
    const idle = createIdleMotion({ reducedMotion: false });
    for (let i = 0; i < 500; i++) idle.advance(0.01);
    const after = idleOffsetAt(3.7, 0.15);
    expect(after).toEqual(before);
  });
});

describe('idle-motion — clock linearity', () => {
  it('100 x advance(0.01) matches one advance(1.0) within 1e-9', () => {
    const idleSmall = createIdleMotion({ reducedMotion: false });
    for (let i = 0; i < 100; i++) idleSmall.advance(0.01);
    const small = idleSmall.offsetFor(0)!;

    const idleBig = createIdleMotion({ reducedMotion: false });
    idleBig.advance(1.0);
    const big = idleBig.offsetFor(0)!;

    expect(Math.abs(small.baseYawDeg - big.baseYawDeg)).toBeLessThan(1e-9);
    expect(Math.abs(small.shoulderPitchDeg - big.shoulderPitchDeg)).toBeLessThan(1e-9);
    expect(Math.abs(small.elbowPitchDeg - big.elbowPitchDeg)).toBeLessThan(1e-9);
  });
});
