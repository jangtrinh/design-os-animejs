import { describe, expect, it } from 'vitest';
import { ARM_LIMITS, clamp, clampPose, DEG, type ArmPose } from '../src/scene/arm-rig-math';

describe('DEG', () => {
  it('equals Math.PI / 180', () => {
    expect(DEG).toBe(Math.PI / 180);
  });
});

describe('clamp', () => {
  it('clamps a value below min up to min', () => {
    expect(clamp(-100, -60, 60)).toBe(-60);
  });

  it('clamps a value above max down to max', () => {
    expect(clamp(100, -60, 60)).toBe(60);
  });

  it('leaves an in-range value unchanged', () => {
    expect(clamp(12, -60, 60)).toBe(12);
  });
});

describe('clampPose', () => {
  it('clamps an out-of-range pose to ARM_LIMITS boundaries', () => {
    const pose: ArmPose = { baseYawDeg: 200, shoulderPitchDeg: -50, elbowPitchDeg: 50 };
    const result = clampPose(pose);
    expect(result).toEqual({
      baseYawDeg: ARM_LIMITS.baseYawDeg[1],
      shoulderPitchDeg: ARM_LIMITS.shoulderPitchDeg[0],
      elbowPitchDeg: ARM_LIMITS.elbowPitchDeg[1],
    });
  });

  it('returns an in-range pose unchanged and does not mutate the input', () => {
    const pose: ArmPose = { baseYawDeg: 10, shoulderPitchDeg: 5, elbowPitchDeg: -5 };
    // Freeze the input so any attempted mutation throws in strict-mode test code,
    // proving clampPose builds a fresh object instead of writing back into `pose`.
    Object.freeze(pose);
    const result = clampPose(pose);
    expect(result).toEqual({ baseYawDeg: 10, shoulderPitchDeg: 5, elbowPitchDeg: -5 });
    expect(pose).toEqual({ baseYawDeg: 10, shoulderPitchDeg: 5, elbowPitchDeg: -5 });
  });
});
