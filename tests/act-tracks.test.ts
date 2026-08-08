// poseAtAct — per-act pose dispatch. Pure, no DOM/three.js needed, runs
// under plain "node". Covers act 1's delegation to poseAt, boundary
// continuity across every adjacent act pair (this plan's main regression
// guard for phase 07's re-tuning), and the clampPose-identity guard against
// a silently-clamped choreography (every raw track value must already be
// inside ARM_LIMITS — clampPose must never actually change anything).
import { describe, expect, it } from 'vitest';
import { poseAtAct } from '../src/motion/act-tracks';
import { poseAt, type ScrubPose } from '../src/motion/scrub-tracks';
import { clampPose } from '../src/scene/arm-rig-math';

const SCRUB_KEYS: readonly (keyof ScrubPose)[] = [
  'baseYawDeg',
  'shoulderPitchDeg',
  'elbowPitchDeg',
  'camRadius',
  'camTheta',
  'camPhi',
  'camTargetY',
  'bgMix',
  'wireMix',
  'explode',
  'veil',
];

describe('poseAtAct — index 1 (blueprint) delegation', () => {
  it('deep-equals poseAt(p) on every shared ScrubPose field', () => {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const { lineColor: _lineColor, ...rest } = poseAtAct(1, p);
      expect(rest).toEqual(poseAt(p));
    }
  });
});

describe('poseAtAct — boundary continuity across every adjacent act pair', () => {
  // pair index i means acts (i, i+1); the 2->3 (zoom->scroll) pair is a
  // deliberate veiled hard cut — only veil and explode need to match there
  // (see act-track-tables.ts's ZOOM_TRACKS header comment).
  const pairs = [0, 1, 2, 3, 4];

  it.each(pairs)('boundary pair %i: poseAtAct(i, 1) vs poseAtAct(i+1, 0)', (i) => {
    const end = poseAtAct(i, 1);
    const start = poseAtAct(i + 1, 0);
    if (i === 2) {
      expect(end.veil).toBe(start.veil);
      expect(end.explode).toBe(start.explode);
      return;
    }
    for (const key of SCRUB_KEYS) {
      expect(end[key]).toBe(start[key]);
    }
  });
});

describe('poseAtAct — clampPose identity (no silently-clamped choreography)', () => {
  it.each([0, 1, 2, 3, 4, 5])('act %i: every raw track value is inside ARM_LIMITS for 101 sampled p', (act) => {
    for (let i = 0; i <= 100; i++) {
      const p = i / 100;
      const pose = poseAtAct(act, p);
      const clamped = clampPose(pose);
      expect(clamped.baseYawDeg).toBe(pose.baseYawDeg);
      expect(clamped.shoulderPitchDeg).toBe(pose.shoulderPitchDeg);
      expect(clamped.elbowPitchDeg).toBe(pose.elbowPitchDeg);
    }
  });
});

// motion-quality phase 01 (feedback B): Clockwork's 4 discrete yaw marks are
// re-cut from 0.02-wide linear snaps into 0.16-wide eased moves with
// shoulder/elbow trailing out of phase. These tests guard the motion-quality
// properties (C1 continuity, peak rate, lag) without touching any assertion
// above — the 4 marks and both act boundaries stay byte-identical.
describe('poseAtAct — act 4 (clockwork) motion quality', () => {
  it('the 4 yaw marks are still reachable at their hold windows', () => {
    expect(poseAtAct(4, 0.07).baseYawDeg).toBe(25);
    expect(poseAtAct(4, 0.35).baseYawDeg).toBe(5);
    expect(poseAtAct(4, 0.61).baseYawDeg).toBe(-15);
    expect(poseAtAct(4, 0.9).baseYawDeg).toBe(-35);
  });

  it('is C1 across the whole act on all 3 arm fields (one-sided derivatives agree within 0.05 at every keyframe joint)', () => {
    const h = 1e-5;
    const fields: (keyof ScrubPose)[] = ['baseYawDeg', 'shoulderPitchDeg', 'elbowPitchDeg'];
    const ps = new Set<number>();
    for (const p of [0, 0.14, 0.3, 0.4, 0.56, 0.66, 0.82, 1]) ps.add(p);
    for (const p of [0, 0.17, 0.34, 0.43, 0.6, 0.69, 0.86, 1]) ps.add(p);
    for (const p of [0, 0.19, 0.36, 0.45, 0.62, 0.71, 0.88, 1]) ps.add(p);
    for (const p of ps) {
      if (p <= 0 || p >= 1) continue;
      for (const field of fields) {
        const dL = (poseAtAct(4, p)[field] - poseAtAct(4, p - h)[field]) / h;
        const dR = (poseAtAct(4, p + h)[field] - poseAtAct(4, p)[field]) / h;
        expect(Math.abs(dL - dR)).toBeLessThan(0.05);
      }
    }
  });

  it('peak rate cap: max |dv/dp| stays under the cap (fails against the old 1000 deg/p table — proven teeth)', () => {
    const caps: Record<string, number> = { baseYawDeg: 250, shoulderPitchDeg: 100, elbowPitchDeg: 100 };
    for (const field of Object.keys(caps) as (keyof ScrubPose)[]) {
      let maxRate = 0;
      for (let i = 0; i < 10000; i++) {
        const p = i / 10000;
        const d = Math.abs(poseAtAct(4, p + 1e-4)[field] - poseAtAct(4, p)[field]) / 1e-4;
        maxRate = Math.max(maxRate, d);
      }
      expect(maxRate).toBeLessThan(caps[field]);
    }
  });

  it('shoulder and elbow start their first move after yaw does', () => {
    const pose = poseAtAct(4, 0.15);
    expect(pose.baseYawDeg).not.toBe(25);
    expect(pose.shoulderPitchDeg).toBe(6);
    expect(pose.elbowPitchDeg).toBe(-12);
  });
});
