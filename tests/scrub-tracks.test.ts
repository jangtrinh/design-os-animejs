import { describe, expect, it } from 'vitest';
import { BEATS, damp, poseAt, sampleTrack, type Track } from '../src/motion/scrub-tracks';
import { ARM_LIMITS } from '../src/scene/arm-rig-math';

describe('sampleTrack', () => {
  const track: Track = [
    { p: 0, v: 0 },
    { p: 0.5, v: 10 },
    { p: 1, v: 20 },
  ];

  it('returns the first keyframe value at p=0 and below', () => {
    expect(sampleTrack(track, 0)).toBe(0);
    expect(sampleTrack(track, -5)).toBe(0);
  });

  it('returns the last keyframe value at p=1 and above', () => {
    expect(sampleTrack(track, 1)).toBe(20);
    expect(sampleTrack(track, 5)).toBe(20);
  });

  it('interpolates linearly between two keyframes', () => {
    expect(sampleTrack(track, 0.25)).toBe(5);
    expect(sampleTrack(track, 0.75)).toBe(15);
  });

  it('is a pure function: same p always yields same value regardless of call order', () => {
    const forward = [0, 0.25, 0.5, 0.75, 1].map((p) => sampleTrack(track, p));
    const backward = [1, 0.75, 0.5, 0.25, 0].map((p) => sampleTrack(track, p));
    expect(forward).toEqual([...backward].reverse());
  });

  it('interpolates a simple 2-keyframe track (p=0.25 halfway between 0 and 10 -> 2.5)', () => {
    const twoPointTrack: Track = [
      { p: 0, v: 0 },
      { p: 1, v: 10 },
    ];
    expect(sampleTrack(twoPointTrack, 0.25)).toBe(2.5);
  });
});

describe('damp', () => {
  it('returns target unchanged when already at target', () => {
    expect(damp(5, 5, 6, 0.016)).toBeCloseTo(5, 10);
  });

  it('does not move when dt=0 (frame-rate independence anchor)', () => {
    expect(damp(0, 1, 6, 0)).toBeCloseTo(0, 10);
  });

  it('converges toward target as dt grows', () => {
    const near = damp(0, 1, 6, 0.016);
    const far = damp(0, 1, 6, 1);
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(far);
    expect(far).toBeCloseTo(1, 2);
  });

  it('produces the same result for many small steps as one large step covering the same total dt (within tolerance)', () => {
    let stepped = 0;
    for (let i = 0; i < 100; i++) stepped = damp(stepped, 1, 6, 0.01);
    const single = damp(0, 1, 6, 1);
    expect(stepped).toBeCloseTo(single, 2);
  });

  it('damp(0, 1, 6, 0) is exactly 0 (no time elapsed -> no movement)', () => {
    expect(damp(0, 1, 6, 0)).toBe(0);
  });

  it('damp(0, 1, 6, 10) is within 1e-6 of the target (fully settled)', () => {
    expect(damp(0, 1, 6, 10)).toBeCloseTo(1, 6);
  });

  it('is monotonic: increasing dt always moves strictly closer to target', () => {
    const dts = [0, 0.05, 0.1, 0.2, 0.4, 0.8, 1.5, 3];
    const values = dts.map((dt) => damp(0, 1, 6, dt));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('is frame-rate independent: one dt=0.1 step equals two dt=0.05 steps (within 1e-9)', () => {
    const oneStep = damp(0, 1, 6, 0.1);
    const twoStepsFirst = damp(0, 1, 6, 0.05);
    const twoSteps = damp(twoStepsFirst, 1, 6, 0.05);
    expect(Math.abs(oneStep - twoSteps)).toBeLessThan(1e-9);
  });
});

describe('poseAt', () => {
  it('matches the approved choreography at p=0 (intro beat)', () => {
    const pose = poseAt(0);
    expect(pose.baseYawDeg).toBe(0);
    expect(pose.shoulderPitchDeg).toBe(0);
    expect(pose.elbowPitchDeg).toBe(0);
    expect(pose.camRadius).toBe(3.2);
    expect(pose.camTheta).toBe(0.62);
    expect(pose.camPhi).toBe(1.22);
    expect(pose.camTargetY).toBe(0.62);
    expect(pose.bgMix).toBe(0);
    expect(pose.wireMix).toBe(0);
    expect(pose.explode).toBe(0); // explode ramp hasn't started yet (starts at p=0.35)
  });

  it('matches the approved choreography at p=0.6 (fold beat)', () => {
    const pose = poseAt(0.6);
    expect(pose.baseYawDeg).toBe(34);
    expect(pose.shoulderPitchDeg).toBe(16);
    expect(pose.elbowPitchDeg).toBe(-26);
    // explode ramps 0.35->0.75 (0->1); p=0.6 is 62.5% through that ramp.
    expect(pose.explode).toBeCloseTo(0.625, 9);
  });

  it('matches the approved choreography at p=1 (rest beat) — phase 03 exploded-blueprint endpoint', () => {
    const pose = poseAt(1);
    expect(pose.baseYawDeg).toBe(20);
    expect(pose.shoulderPitchDeg).toBe(10);
    expect(pose.elbowPitchDeg).toBe(-18);
    expect(pose.camRadius).toBe(4.8);
    expect(pose.camTheta).toBe(2.35);
    expect(pose.bgMix).toBe(1);
    expect(pose.wireMix).toBe(1);
    expect(pose.explode).toBe(1); // fully exploded by the end of the blueprint act
  });

  it('clamps out-of-range p the same as its nearest boundary (reversibility contract)', () => {
    expect(poseAt(-1)).toEqual(poseAt(0));
    expect(poseAt(2)).toEqual(poseAt(1));
  });

  it('is stateless: scrolling forward then back to the same p reproduces the identical pose (Gherkin UC-02)', () => {
    const points = [0, 0.15, 0.3, 0.6, 0.85, 1];
    const forwardPath = points.map(poseAt);
    const backwardPath = [...points].reverse().map(poseAt);
    expect(forwardPath).toEqual([...backwardPath].reverse());
  });

  it('interpolates across the flat 0.3-0.6 segment of baseYawDeg (p=0.45 -> 34, both neighbors are 34)', () => {
    expect(poseAt(0.45).baseYawDeg).toBe(34);
  });

  it('never exceeds ARM_LIMITS across the full p range (101 samples, p = i/100)', () => {
    for (let i = 0; i <= 100; i++) {
      const p = i / 100;
      const pose = poseAt(p);
      expect(pose.baseYawDeg).toBeGreaterThanOrEqual(ARM_LIMITS.baseYawDeg[0]);
      expect(pose.baseYawDeg).toBeLessThanOrEqual(ARM_LIMITS.baseYawDeg[1]);
      expect(pose.shoulderPitchDeg).toBeGreaterThanOrEqual(ARM_LIMITS.shoulderPitchDeg[0]);
      expect(pose.shoulderPitchDeg).toBeLessThanOrEqual(ARM_LIMITS.shoulderPitchDeg[1]);
      expect(pose.elbowPitchDeg).toBeGreaterThanOrEqual(ARM_LIMITS.elbowPitchDeg[0]);
      expect(pose.elbowPitchDeg).toBeLessThanOrEqual(ARM_LIMITS.elbowPitchDeg[1]);
    }
  });

  it('crosses the dark->paper background threshold inside [0, 0.18]', () => {
    expect(poseAt(0).bgMix).toBeLessThan(0.5);
    expect(poseAt(0.18).bgMix).toBeGreaterThanOrEqual(0.5);
    expect(poseAt(0.3).bgMix).toBe(1);
  });
});

describe('BEATS', () => {
  it('exposes the 4 phase-04 label/ticker milestones in ascending order', () => {
    expect(BEATS).toEqual([0, 0.3, 0.6, 0.85]);
    expect([...BEATS].sort((a, b) => a - b)).toEqual([...BEATS]);
  });
});
