// Additive Arm-Rig-only idle offsets — motion-quality phase 02 (user
// feedback A: "no default animation on page entry; the model must move a
// little"). Pure math file: only imports clampPose/ArmPose (arm-rig-math.ts)
// and EASES/ScrubPose (scrub-tracks.ts), both themselves import-free, so
// this runs under vitest's plain "node" env (N1). scrub-controller.ts is the
// only caller — it adds the offset to the sampled pose, right before
// applyPose(), which stays the single writer of three.js state; this file
// only produces numbers, never touches rig/ctx/overlay.
//
// Clock start: createIdleMotion's `t` starts at 0 on its first advance(),
// and act-wiring.ts (the only place that constructs it) is only reached
// after main.ts's `await intro.play()` resolves — i.e. after the Hero Intro
// completes (F4, "motion starts after the Hero Intro completes"). Do not add
// a redundant "intro complete" signal here.
import { clampPose, type ArmPose } from '../scene/arm-rig-math';
import { EASES, type ScrubPose } from './scrub-tracks';

export interface IdleAxis {
  key: keyof ArmPose;
  amplitudeDeg: number;
  periodSeconds: number;
  phaseRad: number;
}

// Fable ruling #3: yaw ±6.0deg/14.0s, shoulder ±1.5deg/9.0s, verbatim.
// Elbow's period is a disclosed deviation from the ruling's literal 7s — see
// phase-02 report "7s -> 6.5s" section: 14 and 7 share gcd 7, so all three
// sines would re-align every LCM(14,9,7)=126s (a visible 2-minute loop);
// 6.5s honours the ruling's stated intent ("no common divisor") instead,
// giving LCM(14,9,6.5)=1638s (27 min). Amplitude unchanged.
// Phases (0 / 1.9 / 3.4 rad) are chosen so no two axes cross zero together
// at t=0 — a synced zero-crossing would read as one "breath" instead of
// three independently moving joints.
export const IDLE_AXES: readonly IdleAxis[] = [
  { key: 'baseYawDeg', amplitudeDeg: 6.0, periodSeconds: 14.0, phaseRad: 0.0 },
  { key: 'shoulderPitchDeg', amplitudeDeg: 1.5, periodSeconds: 9.0, phaseRad: 1.9 },
  { key: 'elbowPitchDeg', amplitudeDeg: 2.5, periodSeconds: 6.5, phaseRad: 3.4 },
];

/**
 * Indexed by act index, matching section-router.ts's ACTS order exactly:
 * [hero, blueprint, zoom, scroll, clockwork, outro] = [1, 0.15, 0, 0.15, 0.15, 0].
 * F2/F3: a weight of 0 (zoom, outro) makes offsetFor() return null for that
 * act below — not a zero vector — so those acts (and every act under
 * prefers-reduced-motion) keep today's exact early-return cost untouched.
 */
export const IDLE_ACT_WEIGHTS: readonly number[] = [1, 0.15, 0, 0.15, 0.15, 0];

/** F4: 0 -> full ramp-in duration, seconds, starting at the idle clock's t=0. */
export const IDLE_RAMP_SECONDS = 1.2;

function ramp(t: number): number {
  return EASES.smooth(Math.min(1, t / IDLE_RAMP_SECONDS));
}

/** Pure. Additive arm offsets at clock `t` seconds, scaled by `weight` and the ramp-in. */
export function idleOffsetAt(t: number, weight: number): ArmPose {
  const scale = ramp(t) * weight;
  const pose = {} as ArmPose;
  for (const axis of IDLE_AXES) {
    pose[axis.key] =
      axis.amplitudeDeg * Math.sin((2 * Math.PI * t) / axis.periodSeconds + axis.phaseRad) * scale;
  }
  return pose;
}

/** Pure. Adds `offset` to the 3 arm fields (through clampPose); every other field passes through. */
export function withIdleOffset<T extends ScrubPose>(pose: T, offset: ArmPose): T {
  const clamped = clampPose({
    baseYawDeg: pose.baseYawDeg + offset.baseYawDeg,
    shoulderPitchDeg: pose.shoulderPitchDeg + offset.shoulderPitchDeg,
    elbowPitchDeg: pose.elbowPitchDeg + offset.elbowPitchDeg,
  });
  // Spread order guarantees F1: every non-arm field comes from `pose`
  // untouched, `clamped` only ever overwrites the 3 arm keys.
  return { ...pose, ...clamped };
}

export interface IdleMotion {
  /** Advance the shared clock. Register ONCE on the render loop, before the act controllers. */
  advance(dt: number): void;
  /** Offsets for `actIndex` at the current clock, or null when this act has zero idle weight. */
  offsetFor(actIndex: number): ArmPose | null;
}

export function createIdleMotion(args: { reducedMotion: boolean }): IdleMotion {
  const { reducedMotion } = args;
  let t = 0;

  return {
    advance(dt: number): void {
      t += dt;
    },
    offsetFor(actIndex: number): ArmPose | null {
      // F3: reduced motion always returns null, by construction — never a
      // zero-amplitude offset, so the caller's idle-aware EPSILON bypass
      // never bypasses anything under prefers-reduced-motion.
      if (reducedMotion) return null;
      const weight = IDLE_ACT_WEIGHTS[actIndex];
      if (!weight) return null; // falsy/undefined: zero-weight act or out-of-range index
      return idleOffsetAt(t, weight);
    },
  };
}
